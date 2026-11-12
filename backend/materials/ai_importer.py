"""
Automated AI Question Paper & Answer Sheet Import Engine
Specialized for CA Foundation, CA Intermediate, and CA Final exams.
Uses Google Gemini API with fallback models, PyMuPDF table extraction,
multi-signal matching, deterministic validation, and atomic database publishing.
"""

import os
import re
import json
import time
import hashlib
import base64
import logging
import fitz  # PyMuPDF
import requests as http_requests
from django.conf import settings
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────
# Helper: Resolve Active Gemini Models and API Key
# ─────────────────────────────────────────────────────────────

def get_gemini_config(explicit_key=None):
    """
    Resolves the API key and models from:
    1. Explicit key
    2. PlatformSetting model
    3. Environment variables
    """
    api_key = explicit_key
    if not api_key:
        try:
            from subscriptions.models import PlatformSetting
            ps = PlatformSetting.objects.filter(key="GEMINI_API_KEY").first()
            if ps and ps.value and ps.value.strip():
                api_key = ps.value.strip()
        except Exception:
            pass
    if not api_key:
        api_key = os.environ.get("GEMINI_API_KEY", "").strip()

    primary_model = os.environ.get("GEMINI_MODEL", "gemini-3.5-flash").strip()
    fallback_model = os.environ.get("GEMINI_FALLBACK_MODEL", "gemini-3.8-flash").strip()

    candidate_models = [
        primary_model,
        "gemini-3.5-flash-lite",
        "gemini-3.6-flash",
        fallback_model,
        "gemini-flash-latest",
        "gemini-flash-lite-latest",
        "gemini-3.1-flash-lite",
    ]
    # Remove duplicates preserving order
    seen = set()
    models = [m for m in candidate_models if m and not (m in seen or seen.add(m))]

    return api_key, models


# ─────────────────────────────────────────────────────────────
# Helper: Compute File Hashes for Idempotency
# ─────────────────────────────────────────────────────────────

def compute_file_hash(file_path):
    hasher = hashlib.sha256()
    with open(file_path, 'rb') as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


# ─────────────────────────────────────────────────────────────
# Step 1: PyMuPDF Text, Blocks, and Table Extraction
# ─────────────────────────────────────────────────────────────

def clean_cell_text(val):
    """
    Cleans cell values by normalizing newlines and consecutive whitespace,
    preserving numbers, currency symbols (₹), and parenthetical qualifiers.
    """
    if val is None:
        return ""
    s = str(val).strip()
    # Normalize hyphenated linebreaks across lines: e.g. "Non-\ncurrent" -> "Non-current"
    s = re.sub(r'-\s*\n\s*', '-', s)
    # Normalize remaining internal newlines to spaces so 'Investments\n(Non-current)' -> 'Investments (Non-current)'
    s = re.sub(r'\s+', ' ', s)
    return s.strip()


def table_to_markdown(table_dict):
    """
    Converts a structured table dict {headers: [...], rows: [[...], ...]} to GFM markdown table.
    """
    if not table_dict or not table_dict.get("headers"):
        return ""
    headers = [str(h) for h in table_dict["headers"]]
    rows = table_dict.get("rows", [])
    
    header_line = "| " + " | ".join(headers) + " |"
    separator_line = "| " + " | ".join(["---"] * len(headers)) + " |"
    row_lines = []
    for r in rows:
        row_cells = [str(c) if c is not None else "" for c in r]
        # Pad row if fewer cells than headers
        if len(row_cells) < len(headers):
            row_cells.extend([""] * (len(headers) - len(row_cells)))
        row_lines.append("| " + " | ".join(row_cells[:len(headers)]) + " |")
    
    return "\n".join([header_line, separator_line] + row_lines)


def convert_table_to_dict(table_data):
    """
    Converts PyMuPDF extracted raw table list into a normalized dict:
    {"headers": [...], "rows": [[...], ...], "columns_count": N}
    Handles 4-column accounting balance sheets (Particulars | Amount | Particulars | Amount),
    journal entries, T-accounts, and ledger tables.
    """
    if not table_data or len(table_data) == 0:
        return None

    raw_headers = [clean_cell_text(h) for h in table_data[0]]
    if not any(raw_headers):
        return None

    # Fill any empty column headers
    headers = []
    for i, h in enumerate(raw_headers):
        if h:
            headers.append(h)
        else:
            headers.append(f"Column {i+1}")

    rows = []
    for raw_row in table_data[1:]:
        clean_row = [clean_cell_text(cell) for cell in raw_row]
        # Ensure row cell count matches headers
        if len(clean_row) < len(headers):
            clean_row.extend([""] * (len(headers) - len(clean_row)))
        elif len(clean_row) > len(headers):
            clean_row = clean_row[:len(headers)]
        
        # Keep row if at least one cell has content
        if any(clean_row):
            rows.append(clean_row)

    if not rows:
        return None

    return {
        "headers": headers,
        "rows": rows,
        "columns_count": len(headers),
        "rows_count": len(rows)
    }


def extract_pdf_document_content(file_path, api_key=None, candidate_models=None):
    """
    Extracts text, layout elements, and accounting tables from a PDF using PyMuPDF.
    Embeds markdown table representations directly into page text for high-fidelity Gemini comprehension.
    If digital text is absent (< 100 characters total across pages), falls back to Gemini Vision OCR.
    """
    if not file_path or not os.path.exists(file_path):
        return {"pages": [], "full_text": "", "total_pages": 0, "tables": [], "is_scanned": False}

    doc = fitz.open(file_path)
    total_pages = len(doc)
    pages_data = []
    all_extracted_tables = []
    full_text_parts = []
    total_chars = 0

    for page_idx, page in enumerate(doc):
        page_num = page_idx + 1
        page_text = page.get_text().strip()
        total_chars += len(page_text)

        # Extract structured accounting tables on this page
        page_tables = []
        page_tables_markdown = []
        try:
            detected_tables = page.find_tables()
            for t_idx, t in enumerate(detected_tables):
                t_dict = convert_table_to_dict(t.extract())
                if t_dict:
                    t_dict["page_number"] = page_num
                    t_dict["table_id"] = f"p{page_num}_t{t_idx+1}"
                    md_repr = table_to_markdown(t_dict)
                    t_dict["markdown"] = md_repr
                    page_tables.append(t_dict)
                    all_extracted_tables.append(t_dict)
                    page_tables_markdown.append(f"\n[ACCOUNTING TABLE p{page_num}_t{t_idx+1} ({t_dict['columns_count']} Columns)]:\n{md_repr}\n")
        except Exception:
            pass

        # Synthesize page content including markdown tables
        combined_page_text = page_text
        if page_tables_markdown:
            combined_page_text += "\n\n" + "\n".join(page_tables_markdown)

        pages_data.append({
            "page_number": page_num,
            "text": page_text,
            "combined_text": combined_page_text,
            "tables": page_tables
        })

        full_text_parts.append(f"--- [PAGE {page_num} OF {total_pages}] ---\n{combined_page_text}")

    # Fallback to Gemini Vision OCR if document is scanned
    is_scanned = (total_chars < 80 and total_pages > 0)
    if is_scanned and api_key and candidate_models:
        logger.info(f"PDF {file_path} appears scanned ({total_chars} text chars). Running Gemini Vision OCR across {total_pages} pages...")
        ocr_pages_data = []
        ocr_full_text_parts = []
        for page_idx, page in enumerate(doc):
            page_num = page_idx + 1
            pix = page.get_pixmap(dpi=130)
            img_bytes = pix.tobytes("jpeg")
            b64_img = base64.b64encode(img_bytes).decode("utf-8")
            ocr_prompt = f"""You are an elite academic OCR engine for CA examinations.
Transcribe all text, questions, case studies, MCQ options, marks, and tables from this exam page image accurately.
Format all tables as markdown tables.
Return strict JSON: {{"transcribed_text": "full text of this page with markdown tables"}}"""
            parsed_ocr, _, _ = call_gemini_api(ocr_prompt, api_key, candidate_models, inline_images=[b64_img], timeout=45)
            page_text = (parsed_ocr.get("transcribed_text", "") if parsed_ocr else "")
            ocr_pages_data.append({
                "page_number": page_num,
                "text": page_text,
                "combined_text": page_text,
                "tables": []
            })
            ocr_full_text_parts.append(f"--- [PAGE {page_num} OF {total_pages}] ---\n{page_text}")

        doc.close()
        return {
            "pages": ocr_pages_data,
            "full_text": "\n\n".join(ocr_full_text_parts),
            "total_pages": total_pages,
            "tables": all_extracted_tables,
            "is_scanned": True
        }

    doc.close()

    return {
        "pages": pages_data,
        "full_text": "\n\n".join(full_text_parts),
        "total_pages": total_pages,
        "tables": all_extracted_tables,
        "is_scanned": False
    }


def infer_document_type(file_path=None, raw_sample_text=None):
    """
    Infers whether a PDF is a QUESTION_PAPER, SUGGESTED_ANSWER, or COMBINED
    by scanning text on the initial pages or using provided sample text and filename.
    """
    try:
        sample_text = (raw_sample_text or "").lower()
        fname = (os.path.basename(file_path) if file_path else "").lower()

        if file_path and os.path.exists(file_path):
            try:
                doc = fitz.open(file_path)
                for i in range(min(5, len(doc))):
                    sample_text += " " + doc[i].get_text("text").lower()
                doc.close()
            except Exception as e:
                logger.warning(f"Failed to read PDF for inference: {e}")

        # Filename indicators
        fname_has_ans = any(k in fname for k in ["ans", "answer", "solution", "suggested", "key"])
        fname_has_qp = any(k in fname for k in ["_qp", "-qp", "qp.", "qp_", "question", "question_paper"])

        # Content indicators
        has_qp_text = any(k in sample_text for k in [
            "time allowed", "maximum marks", "max marks",
            "the question paper comprises", "candidates are permitted",
            "question no. 1 is compulsory", "questions are based on the following case scenario",
            "working notes should form part of the answer", "each sub-division carries",
            "roll no.", "total no. of printed pages"
        ])
        has_ans_text = any(k in sample_text for k in [
            "suggested answers", "suggested answer", "suggested solution",
            "hints & solutions", "solution to question", "answer key", "marking scheme",
            "part ii – descriptive questions", "as per as ", "as per section ",
            "it needs to be adjusted as follows", "is not correctly stated"
        ])

        # MCQ Answer key table pattern on first page (e.g., 1 i, 2 ii, 3 iii or 1 (a), 2 (b)...)
        has_mcq_key_table = bool(re.search(r'\b1\s*\n\s*(?:[a-d]|[ivx]+)\s*\n\s*2\s*\n\s*(?:[a-d]|[ivx]+)', sample_text[:1000]))

        if fname_has_ans and not fname_has_qp:
            return 'SUGGESTED_ANSWER'
        if fname_has_qp and not fname_has_ans:
            return 'QUESTION_PAPER'

        if (has_qp_text and has_ans_text) and not fname_has_ans:
            return 'COMBINED'
        elif has_ans_text or has_mcq_key_table or fname_has_ans:
            return 'SUGGESTED_ANSWER'
        elif has_qp_text or fname_has_qp:
            return 'QUESTION_PAPER'

        if any(k in fname for k in ["paper", "test", "mtp", "rtp"]):
            return 'QUESTION_PAPER'

        return 'UNKNOWN'
    except Exception:
        return 'UNKNOWN'


def extract_document_metadata_fast(file_path=None, raw_sample_text=None):
    """
    Extracts structured document metadata from PDF initial pages using deterministic pattern matching.
    Returns dictionary with course, group, paper_number, subject, series, exam_session, exam_year, exam_date, and max_marks.
    """
    text = ""
    if raw_sample_text:
        text = raw_sample_text
    elif file_path and os.path.exists(file_path):
        try:
            doc = fitz.open(file_path)
            for i in range(min(3, len(doc))):
                text += " " + doc[i].get_text("text")
            doc.close()
        except Exception as e:
            logger.warning(f"Failed to read PDF for metadata extraction: {e}")

    meta = {
        "title": "Question Paper",
        "course": "CA Intermediate",
        "group": "Group I",
        "paper_number": "",
        "subject": "",
        "series_title": "",
        "series": "",
        "exam_session": "",
        "exam_year": 2026,
        "exam_date": "",
        "maximum_marks": 100,
        "duration_minutes": 180,
        "inferred_type": "UNKNOWN"
    }

    if not text.strip():
        return meta

    # Series Title & Series Number
    m_series = re.search(r'(Mock Test Paper\s*[-–]\s*(Series\s+[IVX]+)[^:\n]*[:\s]*([A-Za-z]+,?\s*(\d{4}))?)', text, re.I)
    if m_series:
        meta["series_title"] = m_series.group(1).strip()
        meta["series"] = m_series.group(2).strip()
        if m_series.group(3):
            meta["exam_session"] = m_series.group(3).strip()
        if m_series.group(4):
            try:
                meta["exam_year"] = int(m_series.group(4))
            except Exception:
                pass
    elif "series i" in text.lower():
        meta["series"] = "Series I"
    elif "series ii" in text.lower():
        meta["series"] = "Series II"

    # Paper Number & Subject
    m_paper = re.search(r'PAPER\s*[-–:]\s*(\d+)\s*[:–-]\s*([^\n\r]+)', text, re.I)
    if m_paper:
        meta["paper_number"] = f"Paper {m_paper.group(1).strip()}"
        meta["subject"] = m_paper.group(2).strip()
    else:
        # Subject detection heuristics
        text_lower = text.lower()
        if "advanced accounting" in text_lower:
            meta["paper_number"] = "Paper 1"
            meta["subject"] = "Advanced Accounting"
        elif "corporate and other laws" in text_lower or "business laws" in text_lower:
            meta["paper_number"] = "Paper 2"
            meta["subject"] = "Corporate and Other Laws"
        elif "taxation" in text_lower or "income tax" in text_lower or "goods and services tax" in text_lower:
            meta["paper_number"] = "Paper 3"
            meta["subject"] = "Taxation"
        elif "cost and management accounting" in text_lower or "costing" in text_lower:
            meta["paper_number"] = "Paper 4"
            meta["subject"] = "Cost and Management Accounting"
        elif "auditing and ethics" in text_lower or "auditing" in text_lower:
            meta["paper_number"] = "Paper 5"
            meta["subject"] = "Auditing and Ethics"
        elif "financial management" in text_lower:
            meta["paper_number"] = "Paper 6"
            meta["subject"] = "Financial Management and Strategic Management"

    # Course & Group
    m_course = re.search(r'([A-Z\s]+COURSE)\s*[:–-]\s*(GROUP\s*[-–]\s*[IVX]+)', text, re.I)
    if m_course:
        meta["course"] = m_course.group(1).strip().title()
        meta["group"] = m_course.group(2).strip()
    elif "intermediate" in text.lower():
        meta["course"] = "CA Intermediate"
    elif "final" in text.lower():
        meta["course"] = "CA Final"
    elif "foundation" in text.lower():
        meta["course"] = "CA Foundation"

    # Date
    m_date = re.search(r'Date of Paper\s*[:–-]\s*([^\n\r]+)', text, re.I)
    if m_date:
        meta["exam_date"] = m_date.group(1).strip()
        m_year = re.search(r'\b(202\d)\b', meta["exam_date"])
        if m_year:
            try:
                meta["exam_year"] = int(m_year.group(1))
            except Exception:
                pass

    # Maximum Marks
    m_marks = re.search(r'Maximum Marks\s*[-–:]\s*(\d+)', text, re.I)
    if m_marks:
        try:
            meta["maximum_marks"] = int(m_marks.group(1))
        except Exception:
            pass

    meta["inferred_type"] = infer_document_type(file_path, text)
    return meta


def auto_pair_batch_documents(documents):
    """
    Intelligently pairs question paper documents and answer paper documents in a batch
    using document metadata (Paper Number, Subject, Series, Exam Session/Date)
    rather than superficial filename numbers.
    Detects duplicate files and surfaces candidate matches with compatibility scores.
    Returns list of dicts:
    [{'qp': doc, 'ans': doc, 'is_combined': bool, 'pairing_score': float, 'candidate_answers': list, 'warning': str}]
    """
    def _get(d, key, fallback=''):
        if isinstance(d, dict):
            return d.get(key, fallback)
        return getattr(d, key, fallback)

    # 1. Enrich documents with metadata if not present
    doc_metas = {}
    for d in documents:
        d_id = str(_get(d, 'id', ''))
        meta = _get(d, 'extracted_metadata', {})
        if not meta or not meta.get('subject'):
            f_path = getattr(getattr(d, 'file', None), 'path', None)
            meta = extract_document_metadata_fast(file_path=f_path)
            if hasattr(d, 'extracted_metadata'):
                d.extracted_metadata = meta
                try:
                    d.save(update_fields=['extracted_metadata'])
                except Exception:
                    pass
        doc_metas[d_id] = meta

    # 2. Check for duplicate files via file_hash and metadata fingerprint
    seen_hashes = {}
    for d in documents:
        d_id = str(_get(d, 'id', ''))
        f_hash = _get(d, 'file_hash', '')
        if f_hash:
            if f_hash in seen_hashes:
                original = seen_hashes[f_hash]
                d_meta = doc_metas.get(d_id, {})
                d_meta['is_duplicate'] = True
                d_meta['duplicate_of'] = _get(original, 'filename')
                d_meta['duplicate_reason'] = f"Exact duplicate file hash matching {_get(original, 'filename')}"
            else:
                seen_hashes[f_hash] = d

    # 3. Categorize documents
    qps = [d for d in documents if _get(d, 'file_type') == 'QUESTION_PAPER' or (_get(d, 'file_type') in ('UNKNOWN', '') and doc_metas.get(str(_get(d, 'id')), {}).get('inferred_type') == 'QUESTION_PAPER')]
    answers = [d for d in documents if _get(d, 'file_type') == 'SUGGESTED_ANSWER' or (_get(d, 'file_type') in ('UNKNOWN', '') and doc_metas.get(str(_get(d, 'id')), {}).get('inferred_type') == 'SUGGESTED_ANSWER')]
    combined = [d for d in documents if _get(d, 'file_type') == 'COMBINED' or (_get(d, 'file_type') in ('UNKNOWN', '') and doc_metas.get(str(_get(d, 'id')), {}).get('inferred_type') == 'COMBINED')]

    pairs = []
    for c in combined:
        pairs.append({
            'qp': c,
            'ans': c,
            'is_combined': True,
            'pairing_score': 1.0,
            'candidate_answers': [],
            'warning': None
        })

    used_answers = set()

    # 4. Pair each QP with the most compatible answer document
    for qp in qps:
        qp_id = str(_get(qp, 'id', ''))
        qp_meta = doc_metas.get(qp_id, {})
        qp_pnum = (qp_meta.get('paper_number') or '').lower().strip()
        qp_subj = (qp_meta.get('subject') or '').lower().strip()
        qp_series = (qp_meta.get('series') or '').lower().strip()
        qp_date = (qp_meta.get('exam_date') or '').lower().strip()
        qp_fname = (os.path.basename(str(_get(qp, 'filename', '')))).lower()

        scored_candidates = []

        for ans in answers:
            ans_id = str(_get(ans, 'id', ''))
            if ans_id in used_answers:
                continue
            ans_meta = doc_metas.get(ans_id, {})
            ans_pnum = (ans_meta.get('paper_number') or '').lower().strip()
            ans_subj = (ans_meta.get('subject') or '').lower().strip()
            ans_series = (ans_meta.get('series') or '').lower().strip()
            ans_date = (ans_meta.get('exam_date') or '').lower().strip()
            ans_fname = (os.path.basename(str(_get(ans, 'filename', '')))).lower()

            score = 0
            # Strict Subject Conflict Penalty
            if qp_subj and ans_subj and qp_subj != ans_subj:
                # E.g. Law vs Advanced Accounting
                score -= 100

            # Strict Series Conflict Penalty
            if qp_series and ans_series and qp_series != ans_series:
                # E.g. Series I vs Series II
                score -= 50

            # Positive Signals
            if qp_pnum and ans_pnum and qp_pnum == ans_pnum:
                score += 45
            if qp_subj and ans_subj and (qp_subj in ans_subj or ans_subj in qp_subj):
                score += 45
            if qp_series and ans_series and qp_series == ans_series:
                score += 25
            if qp_date and ans_date and qp_date == ans_date:
                score += 20

            # Keyword overlap fallback in filename
            for kw in ['advacc', 'accounting', 'acc', 'law', 'tax', 'cost', 'audit', 'fm', 'sm', 'seriesi', 'seriesii']:
                if kw in qp_fname and kw in ans_fname:
                    score += 10

            scored_candidates.append({
                'ans': ans,
                'score': score,
                'ans_id': ans_id,
                'ans_filename': _get(ans, 'filename'),
                'ans_meta': ans_meta
            })

        # Sort candidates descending by score
        scored_candidates.sort(key=lambda x: x['score'], reverse=True)

        best_match = None
        best_score = 0.0
        warning = None

        if scored_candidates and scored_candidates[0]['score'] >= 30:
            top = scored_candidates[0]
            best_match = top['ans']
            best_score = min(1.0, round(top['score'] / 100.0, 2))
            used_answers.add(top['ans_id'])
        elif len(qps) == 1 and len(answers) == 1 and str(_get(answers[0], 'id')) not in used_answers:
            # Single pair fallback with compatibility validation
            ans = answers[0]
            ans_meta = doc_metas.get(str(_get(ans, 'id')), {})
            ans_subj = (ans_meta.get('subject') or '').lower()
            if qp_subj and ans_subj and qp_subj != ans_subj:
                warning = f"Potential document mismatch: Question Paper is '{qp_meta.get('subject')}' but Answer document is '{ans_meta.get('subject')}'"
                best_match = ans
                best_score = 0.40
            else:
                best_match = ans
                best_score = 0.85
            used_answers.add(str(_get(ans, 'id')))
        else:
            if scored_candidates and scored_candidates[0]['score'] < 0:
                warning = f"No compatible answer document found for {qp_meta.get('subject', 'paper')} {qp_meta.get('series', '')}. Available answer sheets belong to different subjects or test series."

        pairs.append({
            'qp': qp,
            'ans': best_match,
            'is_combined': False,
            'pairing_score': best_score,
            'candidate_answers': scored_candidates[:3],
            'warning': warning
        })

    return pairs



# ─────────────────────────────────────────────────────────────
# Step 2: Gemini API Caller with Resilient Model Fallback
# ─────────────────────────────────────────────────────────────

def call_gemini_api(prompt, api_key, candidate_models, temperature=0.1, timeout=120, inline_images=None):
    """
    Sends request to Gemini API with JSON structured output and optional multimodal images.
    Tries candidate models in order with exponential backoff on rate limits.
    """
    if not api_key:
        return None, None, "No Gemini API Key provided."

    last_error = None
    total_tokens_in = 0
    total_tokens_out = 0

    parts = [{"text": prompt}]
    if inline_images:
        for img in inline_images:
            if isinstance(img, str):
                parts.append({"inline_data": {"mime_type": "image/jpeg", "data": img}})
            elif isinstance(img, dict):
                parts.append({"inline_data": img})

    payload = {
        "contents": [{"parts": parts}],
        "generationConfig": {
            "temperature": temperature,
            "responseMimeType": "application/json"
        }
    }

    for model in candidate_models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        for attempt in range(2):
            try:
                resp = http_requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=timeout)
                if resp.status_code == 200:
                    data = resp.json()
                    usage = data.get('usageMetadata', {})
                    total_tokens_in = usage.get('promptTokenCount', 0)
                    total_tokens_out = usage.get('candidatesTokenCount', 0)

                    candidates = data.get('candidates', [])
                    if candidates and 'content' in candidates[0] and 'parts' in candidates[0]['content']:
                        raw_text = candidates[0]['content']['parts'][0]['text'].strip()
                        # Strip markdown fence if present
                        if raw_text.startswith("```"):
                            raw_text = re.sub(r'^```(?:json)?\s*', '', raw_text)
                            raw_text = re.sub(r'\s*```$', '', raw_text)
                        
                        try:
                            parsed_json = json.loads(raw_text)
                        except json.JSONDecodeError:
                            fb = raw_text.find('{')
                            lb = raw_text.rfind('}')
                            if fb != -1 and lb != -1:
                                parsed_json = json.loads(raw_text[fb:lb+1])
                            else:
                                raise

                        return parsed_json, {
                            "model": model,
                            "tokens_in": total_tokens_in,
                            "tokens_out": total_tokens_out
                        }, None
                elif resp.status_code in (429, 503):
                    time.sleep(1.5 * (attempt + 1))
                    continue
                else:
                    last_error = f"Model {model} HTTP {resp.status_code}: {resp.text[:200]}"
                    break
            except Exception as e:
                last_error = f"Model {model} error: {str(e)}"
                break

    return None, None, last_error


def call_openai_api(prompt, api_key=None, candidate_models=None, temperature=0.1, timeout=120):
    """
    Sends request to OpenAI API with JSON structured output format.
    Tries candidate models in order.
    """
    if not api_key:
        from materials.views import resolve_openai_api_key
        api_key = resolve_openai_api_key()
    if not api_key:
        return None, None, "No OpenAI API Key provided."

    if not candidate_models:
        candidate_models = ["gpt-4o-mini", "gpt-4.1-mini", "gpt-5-mini", "gpt-4o"]

    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    last_error = None

    for model in candidate_models:
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": "You are an expert exam analyzer and Chartered Accountancy evaluator. Always return valid JSON."},
                {"role": "user", "content": prompt}
            ],
            "response_format": {"type": "json_object"},
            "temperature": temperature
        }
        try:
            resp = http_requests.post("https://api.openai.com/v1/chat/completions", json=payload, headers=headers, timeout=timeout)
            if resp.status_code == 200:
                data = resp.json()
                usage = data.get('usage', {})
                tokens_in = usage.get('prompt_tokens', 0)
                tokens_out = usage.get('completion_tokens', 0)
                content = data['choices'][0]['message']['content'].strip()
                try:
                    parsed = json.loads(content)
                    return parsed, {"model": model, "tokens_in": tokens_in, "tokens_out": tokens_out}, None
                except json.JSONDecodeError as je:
                    last_error = f"JSON decode error: {je}"
            else:
                err_body = resp.json().get('error', {}) if 'application/json' in resp.headers.get('content-type', '') else {}
                err_msg = err_body.get('message') or resp.text[:200]
                last_error = f"OpenAI {model} HTTP {resp.status_code}: {err_msg}"
                if resp.status_code == 429:
                    break
        except Exception as e:
            last_error = f"OpenAI {model} error: {str(e)}"

    return None, None, last_error


def call_unified_ai(prompt, api_key=None, candidate_models=None, temperature=0.1, timeout=120, inline_images=None, provider='auto'):
    """
    Unified AI dispatcher that can route to OpenAI or Gemini with automatic fallback.
    """
    if provider == 'openai':
        res, meta, err = call_openai_api(prompt, temperature=temperature, timeout=timeout)
        if res:
            return res, meta, None
        gem_key, gem_models = get_gemini_config()
        return call_gemini_api(prompt, gem_key, gem_models, temperature=temperature, timeout=timeout, inline_images=inline_images)
    elif provider == 'gemini':
        gem_key, gem_models = get_gemini_config(api_key)
        res, meta, err = call_gemini_api(prompt, gem_key, candidate_models or gem_models, temperature=temperature, timeout=timeout, inline_images=inline_images)
        if res:
            return res, meta, None
        return call_openai_api(prompt, temperature=temperature, timeout=timeout)
    else:
        res, meta, err = call_openai_api(prompt, temperature=temperature, timeout=timeout)
        if res:
            return res, meta, None
        gem_key, gem_models = get_gemini_config(api_key)
        return call_gemini_api(prompt, gem_key, candidate_models or gem_models, temperature=temperature, timeout=timeout, inline_images=inline_images)


# ─────────────────────────────────────────────────────────────
# Step 3: Extract Exam Document Metadata
# ─────────────────────────────────────────────────────────────

def extract_document_metadata_ai(qp_text, api_key, models):
    """
    Analyzes the initial pages of the Question Paper to extract exam metadata.
    """
    header_snippet = qp_text[:12000]

    prompt = f"""You are an expert exam analyzer for the Institute of Chartered Accountants of India (ICAI).
Analyze this Question Paper header text and extract structured metadata into JSON.

TEXT:
---
{header_snippet}
---

Return STRICT JSON matching this schema:
{{
  "title": "e.g. Mock Test Paper – Series I / Revision Test Paper / Past Exam",
  "course": "CA Foundation / CA Intermediate / CA Final",
  "group": "Group I / Group II or null",
  "subject": "e.g. Advanced Accounting / Corporate and Other Laws / Taxation",
  "paper_number": "e.g. Paper 1 / Paper 2",
  "exam_session": "e.g. July 2026 / May 2025 / Nov 2024",
  "exam_year": 2026,
  "exam_date": "e.g. 25 July 2026 or null",
  "duration_minutes": 180,
  "maximum_marks": 100,
  "instructions": [
    "General rubric instruction line 1",
    "General rubric instruction line 2"
  ]
}}
"""
    parsed, meta, err = call_unified_ai(prompt, api_key=api_key, candidate_models=models, temperature=0.1, timeout=40, provider='gemini')
    if parsed and isinstance(parsed, dict):
        return parsed, meta, None
    return {
        "title": "Question Paper",
        "course": "CA Intermediate",
        "group": "Group I",
        "subject": "Advanced Accounting",
        "paper_number": "Paper 1",
        "exam_session": "July 2026",
        "exam_year": 2026,
        "exam_date": None,
        "duration_minutes": 180,
        "maximum_marks": 100,
        "instructions": []
    }, meta, err


# ─────────────────────────────────────────────────────────────
# Step 4: Question Paper Extraction & Classification
# ─────────────────────────────────────────────────────────────

def normalize_accounting_table(tbl):
    """
    Validates and normalizes an accounting table dict into a standard schema:
    {"headers": [...], "rows": [[...]], "columns_count": N, "rows_count": N}
    Supports 4-column balance sheets, journal entries, ledgers, and costing tables.
    """
    if not tbl:
        return None
    if isinstance(tbl, str):
        try:
            tbl = json.loads(tbl)
        except Exception:
            return None
    if not isinstance(tbl, dict) or not tbl.get("headers"):
        return None

    raw_headers = tbl["headers"]
    headers = [clean_cell_text(h) for h in raw_headers]
    if not any(headers):
        return None

    raw_rows = tbl.get("rows", [])
    rows = []
    for r in raw_rows:
        if isinstance(r, list):
            clean_r = [clean_cell_text(c) for c in r]
            if len(clean_r) < len(headers):
                clean_r.extend([""] * (len(headers) - len(clean_r)))
            elif len(clean_r) > len(headers):
                clean_r = clean_r[:len(headers)]
            if any(clean_r):
                rows.append(clean_r)

    if not rows:
        return None

    return {
        "headers": headers,
        "rows": rows,
        "columns_count": len(headers),
        "rows_count": len(rows)
    }


def extract_table_from_markdown(text):
    """
    Extracts GFM markdown tables from plain text and parses them into normalized table dicts.
    """
    if not text:
        return text, None
    table_pattern = re.compile(r'(\|.+?\|\n\|[-:\s|]+?\|\n(?:\|.+?\|\n?)+)', re.MULTILINE)
    match = table_pattern.search(text)
    if not match:
        return text, None

    raw_table = match.group(1).strip()
    lines = [l.strip() for l in raw_table.split('\n') if l.strip()]
    if len(lines) < 3:
        return text, None

    headers = [clean_cell_text(c) for c in lines[0].split('|')[1:-1]]
    rows = []
    for l in lines[2:]:
        cells = [clean_cell_text(c) for c in l.split('|')[1:-1]]
        if any(cells):
            if len(cells) < len(headers):
                cells.extend([""] * (len(headers) - len(cells)))
            rows.append(cells[:len(headers)])

    if headers and rows:
        cleaned_text = table_pattern.sub('', text).strip()
        tbl_dict = {
            "headers": headers,
            "rows": rows,
            "columns_count": len(headers),
            "rows_count": len(rows)
        }
        return cleaned_text, tbl_dict

    return text, None


# ─────────────────────────────────────────────────────────────
# Step 4: Question Paper Extraction & Classification
# ─────────────────────────────────────────────────────────────

def roman_to_int(s):
    """Converts a Roman numeral string (e.g. 'I', 'IV', 'V') or digit string to an integer."""
    if not s:
        return 1
    roman_map = {'I': 1, 'V': 5, 'X': 10, 'L': 50, 'C': 100, 'D': 500, 'M': 1000}
    clean = str(s).upper().strip()
    if clean.isdigit():
        return int(clean)
    total = 0
    prev_val = 0
    for char in reversed(clean):
        val = roman_map.get(char, 0)
        if val >= prev_val:
            total += val
        else:
            total -= val
        prev_val = val
    return total if total > 0 else 1


def clean_sub_question_text(q_text, scenario_text=None):
    """
    Strips scenario transition preamble phrases and any repeated scenario text
    from the child sub-question stem so only the clean sub-question text remains.
    """
    if not q_text:
        return ""
    cleaned = q_text
    # Remove standard transition clauses
    cleaned = re.sub(r'(?i)In\s+light\s+of\s+the\s+above\s+facts,?\s+(?:answer|solve)\s+the\s+following\s+.*?:', '', cleaned)
    cleaned = re.sub(r'(?i)Based\s+on\s+the\s+above\s+(?:case\s+scenario|facts|information),?\s+(?:answer|solve)\s+.*?:', '', cleaned)
    cleaned = re.sub(r'(?i)Questions?\s*\d+\s*(?:to|-)\s*\d+\s*are\s+based\s+on\s+the\s+following\s+case\s+scenario.*?:', '', cleaned)
    cleaned = re.sub(r'(?i)\(Each\s+MCQ\s+\d+\s+Marks?\):?', '', cleaned)
    # Remove redundant leading question numbering (e.g. "1.", "1(a)", "Q1.")
    cleaned = re.sub(r'^\s*(?:Question\s*(?:No\.?)?|Q)?\s*\d+\s*[\.\)]?\s*', '', cleaned)
    
    # If the complete scenario text or a substantial portion of it was duplicated at the beginning, strip it
    if scenario_text and len(scenario_text) > 30 and scenario_text in cleaned:
        cleaned = cleaned.replace(scenario_text, '').strip()

    return cleaned.strip()


def hierarchicalize_and_reconcile_questions(sections, qp_text=None):
    """
    Guarantees the strict hierarchical Case Scenario and Sub-Question structure:
    1. Extracts each complete original scenario paragraph ONCE and places it at the top of its parent question.
    2. Groups all related child sub-questions individually under that parent scenario.
    3. Strips repeated scenario paragraphs from child sub-questions.
    4. Preserves original question and sub-question numbering (e.g. Question 1 -> 1(a), 1(b)...).
    5. Keeps independent questions without a scenario independent (case_scenario_passage = None).
    6. Keeps distinct scenarios separate (does not merge Case Scenario 1 and Case Scenario 2).
    7. Preserves scenario and subquestion tables, figures, dates, and amounts.
    """
    if not sections or not isinstance(sections, list):
        return sections

    for sec in sections:
        raw_questions = sec.get("questions", [])
        if not raw_questions or not isinstance(raw_questions, list):
            continue

        reconciled_questions = []
        i = 0
        scenario_counter = 1

        while i < len(raw_questions):
            q = raw_questions[i]
            q_num = str(q.get("question_number") or q.get("q_no") or "").strip()
            q_text = str(q.get("question_text") or "").strip()
            scenario_text = str(q.get("case_scenario_passage") or "").strip()
            q_type = str(q.get("question_type") or "NORMAL").upper()
            full_blob = f"{q_text} {scenario_text}"

            # Detect whether this question has or initiates a Case Scenario
            has_explicit_scenario = bool(scenario_text and len(scenario_text) > 40)
            is_cs_type = (q_type == 'CASE_SCENARIO')
            cs_header_match = re.search(r'(?i)\bCase\s+(?:Scenario|Study)\s*(?:[-#:]\s*|\s+)?([0-9IVXLCDM]+)?\b', full_blob)
            range_match = re.search(r'(?i)(?:questions?|q\.?|mcqs?)\s*\(?(\d+)\s*(?:to|-)\s*(\d+)\)?\s*(?:are\s+based\s+on\s+(?:the\s+following\s+|this\s+)?case\s+scenario|based\s+on)', full_blob)
            if not range_match:
                range_match = re.search(r'(?i)(?:questions?|q\.?|mcqs?)\s*\(?(\d+)\s*(?:to|-)\s*(\d+)\)?', full_blob)

            is_case_scenario = has_explicit_scenario or is_cs_type or bool(cs_header_match and 'case scenario' in full_blob.lower()) or bool(range_match and 'case scenario' in full_blob.lower())

            # If not a case scenario, check if it's a normal descriptive question or independent question
            if not is_case_scenario:
                # Ensure child does not retain repeated scenario text
                q["case_scenario_passage"] = None
                subqs = q.get("subquestions") or q.get("sub_questions") or []
                clean_subqs = []
                for s_idx, sq in enumerate(subqs):
                    sq_id = str(sq.get("identifier") or sq.get("sub_number") or f"{q_num}({chr(97+s_idx)})").strip()
                    sq_copy = dict(sq)
                    sq_copy["identifier"] = sq_id
                    sq_copy["original_question_number"] = q_num
                    sq_copy["sub_question_number"] = sq_id
                    sq_copy["case_scenario_passage"] = None
                    clean_subqs.append(sq_copy)
                q["subquestions"] = clean_subqs
                reconciled_questions.append(q)
                i += 1
                continue

            # It IS a case scenario!
            # 1. Determine parent scenario text
            best_scenario_text = scenario_text
            if not best_scenario_text or len(best_scenario_text) < 40:
                boundary = re.search(r'(?i)(?:In\s+light\s+of\s+the\s+above\s+facts|Questions?\s*\d+\s*(?:to|-)\s*\d+|Answer\s+the\s+following\s+Multiple\s+Choice)', q_text)
                if boundary:
                    best_scenario_text = q_text[:boundary.start()].strip()
                else:
                    best_scenario_text = q_text

            # Clean header lines from scenario text
            best_scenario_text = re.sub(r'(?i)^\s*(?:PART\s+[I|II|1|2][^\n]*\n*|\bPart\s+I\s+is\s+compulsory[^\n]*\n*|Case\s+(?:Scenario|Study)\s*[0-9IVXLCDM]*[^\n]*\n*)', '', best_scenario_text).strip()

            # 2. Determine question range (e.g. 1 to 5)
            start_no = None
            end_no = None
            if range_match and range_match.group(1) and range_match.group(2):
                try:
                    start_no = int(range_match.group(1))
                    end_no = int(range_match.group(2))
                except ValueError:
                    pass

            # Determine parent question number
            parent_q_num = q_num
            if not parent_q_num or parent_q_num.lower().startswith('cs') or not parent_q_num.isdigit():
                if cs_header_match and cs_header_match.group(1):
                    parent_q_num = str(roman_to_int(cs_header_match.group(1)))
                elif start_no is not None:
                    parent_q_num = str(start_no)
                else:
                    parent_q_num = str(scenario_counter)
            scenario_counter += 1

            parent_q = {
                "question_id": q.get("question_id") or f"q_cs_{parent_q_num}",
                "question_number": parent_q_num,
                "original_question_number": parent_q_num,
                "question_type": "CASE_SCENARIO",
                "question_text": f"Case Scenario {parent_q_num}",
                "case_scenario_passage": best_scenario_text,
                "table_data": q.get("table_data") or q.get("structured_table"),
                "structured_table": q.get("table_data") or q.get("structured_table"),
                "source_pages": q.get("source_pages", []),
                "options": [],
                "subquestions": [],
                "marks": q.get("marks") or 0
            }

            # Collect existing subquestions inside q:
            existing_subqs = q.get("subquestions") or q.get("sub_questions") or []
            for s_idx, sq in enumerate(existing_subqs):
                sq_orig_no = str(sq.get("original_question_number") or sq.get("sub_number") or sq.get("identifier") or "").strip()
                letter_id = chr(97 + s_idx)
                sub_id = str(sq.get("identifier") or sq.get("sub_number") or f"{parent_q_num}({letter_id})").strip()
                c_text = clean_sub_question_text(sq.get("question_text", ""), best_scenario_text)
                child = dict(sq)
                child["identifier"] = sub_id
                child["original_question_number"] = sq_orig_no or str(s_idx + 1)
                child["sub_question_number"] = sub_id
                child["question_text"] = c_text
                child["case_scenario_passage"] = None
                parent_q["subquestions"].append(child)

            # If q itself had an actual standalone MCQ (options >= 2) attached directly to it:
            if not existing_subqs and q.get("options") and len(q.get("options")) >= 2:
                c_text = clean_sub_question_text(q_text, best_scenario_text)
                sub_id = f"{parent_q_num}(a)"
                orig_no = q.get("original_question_number") or q_num or "1"
                parent_q["subquestions"].append({
                    "question_id": f"q_{parent_q_num}_{sub_id}",
                    "identifier": sub_id,
                    "original_question_number": orig_no,
                    "sub_question_number": sub_id,
                    "question_type": "MCQ",
                    "question_text": c_text or q_text,
                    "options": q.get("options", []),
                    "marks": q.get("marks") or 2,
                    "table_data": q.get("table_data") if not best_scenario_text else None,
                    "source_pages": q.get("source_pages", []),
                    "case_scenario_passage": None
                })

            # Absorb subsequent child questions belonging to this scenario
            j = i + 1
            while j < len(raw_questions):
                cand = raw_questions[j]
                cand_num = str(cand.get("question_number") or cand.get("q_no") or "").strip()
                cand_text = str(cand.get("question_text") or "").strip()
                cand_passage = str(cand.get("case_scenario_passage") or "").strip()
                cand_type = str(cand.get("question_type") or "NORMAL").upper()

                # Stop if candidate starts a NEW case scenario!
                cand_blob = f"{cand_text} {cand_passage}"
                is_new_cs = bool(re.search(r'(?i)\bCase\s+(?:Scenario|Study)\s*(?:[-#:]\s*|\s+)?([0-9IVXLCDM]+)\b', cand_blob))
                if is_new_cs and j > i:
                    break

                belongs = False
                cand_int = None
                try:
                    cand_int = int(re.sub(r'^[Qq]\.?\s*', '', cand_num))
                except ValueError:
                    cand_int = None

                if start_no is not None and end_no is not None and cand_int is not None:
                    if start_no <= cand_int <= end_no:
                        belongs = True
                elif cand_passage and best_scenario_text and (cand_passage == best_scenario_text or cand_passage in best_scenario_text or best_scenario_text in cand_passage):
                    belongs = True
                elif cand_type == 'MCQ' and (start_no is not None and cand_int is not None and cand_int <= (end_no or 5)):
                    belongs = True
                elif cand_type == 'MCQ' and (cand_passage or (cand_int is not None and start_no is not None and cand_int <= (end_no or 5))):
                    belongs = True

                if belongs:
                    c_text = clean_sub_question_text(cand_text, best_scenario_text)
                    letter_idx = len(parent_q["subquestions"])
                    letter_code = chr(97 + letter_idx)
                    sub_id = f"{parent_q_num}({letter_code})"

                    child = {
                        "question_id": cand.get("question_id") or f"q_{parent_q_num}_{sub_id}",
                        "identifier": sub_id,
                        "original_question_number": cand.get("original_question_number") or cand_num or (str(cand_int) if cand_int is not None else str(letter_idx + 1)),
                        "sub_question_number": sub_id,
                        "question_type": cand_type if cand_type in ('MCQ', 'NORMAL', 'THEORY', 'ACCOUNTING_PROBLEM') else ('MCQ' if cand.get("options") else 'NORMAL'),
                        "question_text": c_text or cand_text,
                        "options": cand.get("options", []),
                        "marks": cand.get("marks") or 2,
                        "table_data": cand.get("table_data") or cand.get("structured_table"),
                        "source_pages": cand.get("source_pages", []),
                        "case_scenario_passage": None
                    }
                    parent_q["subquestions"].append(child)
                    j += 1
                else:
                    break

            # Recalculate parent marks
            if parent_q["subquestions"]:
                parent_q["marks"] = sum((sq.get("marks") or 0) for sq in parent_q["subquestions"]) or parent_q["marks"] or 10

            reconciled_questions.append(parent_q)
            i = j

        sec["questions"] = reconciled_questions

    return sections


def filter_questions_by_target_type(sections, target_question_type):
    """
    Filters sections and questions to match user's chosen target question format:
    - 'MCQ': Only keep MCQs and Case Scenarios containing MCQ subquestions
    - 'DESCRIPTIVE': Only keep Descriptive/Subjective questions and problems
    - 'CASE_SCENARIO': Only keep Case Scenarios
    """
    target = str(target_question_type or 'ALL').upper()
    if target == 'ALL' or not sections:
        return sections

    filtered_sections = []
    for sec in sections:
        sec_copy = dict(sec)
        kept_questions = []
        for q in sec.get("questions", []):
            is_scenario = (q.get("question_type") == "CASE_SCENARIO" or bool(q.get("case_scenario_passage")))
            is_mcq = (q.get("question_type") == "MCQ" or bool(q.get("options")))

            if target == 'MCQ':
                if is_scenario:
                    mcq_subs = [
                        sq for sq in q.get("subquestions", [])
                        if sq.get("question_type") == "MCQ" or bool(sq.get("options"))
                    ]
                    if mcq_subs:
                        q_copy = dict(q)
                        q_copy["subquestions"] = mcq_subs
                        kept_questions.append(q_copy)
                elif is_mcq:
                    kept_questions.append(q)

            elif target == 'DESCRIPTIVE':
                if is_scenario:
                    desc_subs = [
                        sq for sq in q.get("subquestions", [])
                        if sq.get("question_type") != "MCQ" and not bool(sq.get("options"))
                    ]
                    if desc_subs:
                        q_copy = dict(q)
                        q_copy["subquestions"] = desc_subs
                        kept_questions.append(q_copy)
                elif not is_mcq:
                    kept_questions.append(q)

            elif target == 'CASE_SCENARIO':
                if is_scenario:
                    kept_questions.append(q)

        if kept_questions:
            sec_copy["questions"] = kept_questions
            filtered_sections.append(sec_copy)

    return filtered_sections


def parse_question_paper_ai(qp_text, extracted_tables, api_key, models, target_question_type='ALL'):
    """
    Parses the full question paper text and tables into structured sections,
    questions, subquestions, marks, types, and MCQ options with strict accounting table preservation.
    Enforces that Case Scenarios are extracted ONCE at the parent level and linked to their child subquestions.
    Supports filtering by target_question_type ('ALL', 'MCQ', 'DESCRIPTIVE', 'CASE_SCENARIO').
    """
    truncated_qp = qp_text[:250000]
    tables_summary = json.dumps(extracted_tables[:15]) if extracted_tables else "None"

    target_clean = str(target_question_type or 'ALL').upper()
    target_type_instruction = ""
    if target_clean == 'MCQ':
        target_type_instruction = """
CRITICAL USER SELECTION - STRICT FORMAT RESTRICTION:
- The user has strictly selected: MCQs ONLY.
- EXTRACT ONLY Multiple Choice Questions (MCQs) and Case Scenarios containing MCQs!
- DO NOT EXTRACT any subjective, descriptive, theory questions, or long numerical accounting problems (e.g. Part II).
- If a question has no multiple choice options (A, B, C, D) and is not an MCQ scenario, COMPLETELY SKIP IT.
"""
    elif target_clean == 'DESCRIPTIVE':
        target_type_instruction = """
CRITICAL USER SELECTION - STRICT FORMAT RESTRICTION:
- The user has strictly selected: DESCRIPTIVE / SUBJECTIVE QUESTIONS ONLY.
- EXTRACT ONLY descriptive questions, accounting problems, theory questions, and practical computation problems.
- DO NOT EXTRACT standalone MCQs (Multiple Choice Questions with A/B/C/D options).
"""
    elif target_clean == 'CASE_SCENARIO':
        target_type_instruction = """
CRITICAL USER SELECTION - STRICT FORMAT RESTRICTION:
- The user has strictly selected: CASE SCENARIO BASED QUESTIONS ONLY.
- EXTRACT ONLY Case Scenarios and comprehension passages with their subquestions.
- DO NOT EXTRACT standalone independent questions.
"""

    prompt = f"""You are an elite academic examination parser for ICAI Chartered Accountancy and higher educational examinations.

Analyze this Question Paper content and extract ALL genuine test questions and subquestions into structured JSON.
{target_type_instruction}
CRITICAL EXCLUSION RULE:
- NEVER extract general exam instructions or structural notices as questions!
  Examples to completely skip:
  * "1. The question paper comprises two parts, Part I and Part II."
  * "2. Part I comprises Case Scenario based Multiple Choice Questions (MCQs)"
  * "3. Part II comprises questions which require descriptive type answers."
  * "Question No. 1 is compulsory..."
  * "Working notes should form part of the answer..."
  * "Candidates are permitted to use non-programmable calculators..."
- ONLY extract genuine test questions and problems where a student must calculate, solve, or answer!

CRITICAL HIERARCHICAL CASE SCENARIO & SUB-QUESTION RULES:
1. CASE SCENARIOS & COMPREHENSION PASSAGES:
   - When a question or group of questions is based on a case scenario or background narrative (e.g., "Case Scenario 1", "Questions 1 to 5 are based on the following case scenario...", etc.):
     * Extract the complete original scenario paragraph ONCE and place it in the parent question's "case_scenario_passage".
     * PRESERVE EVERYTHING: Keep all original sentences, facts, names, dates, financial figures, and accounting tables intact! If the scenario spans multiple pages, combine the entire narrative into this single parent scenario passage.
     * DO NOT REPEAT the same scenario inside every child sub-question!
     * DO NOT create a separate repeated scenario for Question 1(a), Question 1(b), Question 1(c) or MCQs 1, 2, 3...
     * The scenario is the PARENT content, and all related questions are its CHILDREN inside "subquestions".
   - Case Scenario with MCQs (e.g. Case Scenario 1 followed by Questions 1 to 5):
     * Parent Question has:
       "question_number": "1" (or original question number),
       "question_type": "CASE_SCENARIO",
       "case_scenario_passage": "<complete scenario narrative extracted once>",
       "question_text": "Case Scenario 1",
       "marks": <sum of subquestion marks>,
       "subquestions": [
         {{
           "identifier": "1(a)",
           "original_question_number": "1",
           "sub_question_number": "1(a)",
           "question_type": "MCQ",
           "question_text": "<only the actual MCQ question stem, without the scenario narrative>",
           "marks": 2,
           "options": [{{"label": "A", "text": "...", "is_correct": false}}, {{"label": "B", "text": "...", "is_correct": false}}, ...],
           "table_data": null,
           "source_pages": [1, 2]
         }},
         {{
           "identifier": "1(b)",
           "original_question_number": "1",
           "sub_question_number": "1(b)",
           "question_type": "MCQ",
           "question_text": "<second actual MCQ question stem>",
           "marks": 2,
           "options": [...],
           "table_data": null,
           "source_pages": [2]
         }}
       ]
   - Descriptive Questions with Sub-Questions (e.g. Question 1 has (a), (b), (c)):
     * If Question 1 has an opening scenario or background narrative, extract it ONCE into Question 1's "case_scenario_passage" (or "question_text").
     * Place Sub-Question 1(a), Sub-Question 1(b), Sub-Question 1(c) inside "subquestions".
     * Never repeat the common scenario inside 1(a), 1(b), 1(c).
2. INDEPENDENT QUESTIONS:
   - Independent MCQs or normal descriptive questions without a scenario MUST have "case_scenario_passage": null. Do NOT assume every question has a scenario!
3. MULTIPLE CHOICE QUESTIONS (MCQs):
   - Set "question_type": "MCQ".
   - Options array: [{{"label": "A", "text": "...", "is_correct": false}}, ...].
   - ALWAYS separate options from "question_text"! The "question_text" contains ONLY the question stem.
4. ACCOUNTING & FINANCIAL PRACTICAL PROBLEMS:
   - Set "question_type": "ACCOUNTING_PROBLEM".
   - Extract full problem statement, marks, subquestions, and accounting tables.
5. PRESERVE ACCOUNTING TABLES:
   - Extract 4-column Balance Sheets/Trial Balances, Schedule III, Journal Entries, and Ledgers into "table_data": {{"headers": [...], "rows": [[...], ...]}}.

TABLES DETECTED IN DOCUMENT:
{tables_summary}

QUESTION PAPER CONTENT:
---
{truncated_qp}
---

Return STRICT JSON matching this schema:
{{
  "sections": [
    {{
      "section_id": "PART_I",
      "title": "Part I - Case Scenario Based MCQs",
      "instructions": "All MCQs are compulsory",
      "questions": [
        {{
          "question_id": "q_cs_1",
          "question_number": "1",
          "question_type": "CASE_SCENARIO",
          "question_text": "Case Scenario 1",
          "case_scenario_passage": "Complete original scenario narrative extracted once. All facts, dates, names, figures preserved...",
          "marks": 10,
          "table_data": null,
          "subquestions": [
            {{
              "identifier": "1(a)",
              "original_question_number": "1",
              "sub_question_number": "1(a)",
              "question_type": "MCQ",
              "question_text": "Is filing Form INC-24 with the Central Government mandatory for this name change?",
              "marks": 2,
              "options": [
                {{"label": "A", "text": "Yes, because...", "is_correct": false, "order": 0}},
                {{"label": "B", "text": "No, because...", "is_correct": false, "order": 1}},
                {{"label": "C", "text": "...", "is_correct": false, "order": 2}},
                {{"label": "D", "text": "...", "is_correct": false, "order": 3}}
              ],
              "table_data": null,
              "source_pages": [1, 2]
            }},
            {{
              "identifier": "1(b)",
              "original_question_number": "1",
              "sub_question_number": "1(b)",
              "question_type": "MCQ",
              "question_text": "Question 2 stem statement...",
              "marks": 2,
              "options": [
                {{"label": "A", "text": "...", "is_correct": false, "order": 0}},
                {{"label": "B", "text": "...", "is_correct": false, "order": 1}},
                {{"label": "C", "text": "...", "is_correct": false, "order": 2}},
                {{"label": "D", "text": "...", "is_correct": false, "order": 3}}
              ],
              "table_data": null,
              "source_pages": [2]
            }}
          ],
          "source_pages": [1, 2]
        }}
      ]
    }},
    {{
      "section_id": "PART_II",
      "title": "Part II - Descriptive Questions",
      "instructions": "Question 1 is compulsory. Attempt any 4 from remaining.",
      "questions": [
        {{
          "question_id": "q_desc_1",
          "question_number": "1",
          "question_type": "ACCOUNTING_PROBLEM",
          "question_text": "The following information relates to Vishnu Ltd as on 31st March 2026...",
          "case_scenario_passage": null,
          "marks": 20,
          "table_data": {{
            "headers": ["Particulars", "Amount (₹)", "Particulars", "Amount (₹)"],
            "rows": [
              ["Term Loans (Secured)", "40,00,000", "Investments (Non-current)", "9,00,000"],
              ["Trade payables", "45,80,000", "Profit for the year", "32,00,000"]
            ]
          }},
          "subquestions": [
            {{
              "identifier": "1(a)",
              "original_question_number": "1",
              "sub_question_number": "1(a)",
              "question_type": "NORMAL",
              "question_text": "Prepare Balance Sheet of Vishnu Ltd. as per Schedule III...",
              "marks": 10,
              "table_data": null,
              "source_pages": [3]
            }},
            {{
              "identifier": "1(b)",
              "original_question_number": "1",
              "sub_question_number": "1(b)",
              "question_type": "NORMAL",
              "question_text": "State the disclosure requirements for Term Loans...",
              "marks": 10,
              "table_data": null,
              "source_pages": [4]
            }}
          ],
          "source_pages": [3, 4]
        }}
      ]
    }}
  ]
}}
"""
    parsed, meta, err = call_unified_ai(prompt, api_key=api_key, candidate_models=models, temperature=0.1, timeout=120, provider='gemini')
    if target_clean != 'ALL' and parsed:
        if isinstance(parsed, dict) and "sections" in parsed:
            parsed["sections"] = filter_questions_by_target_type(parsed["sections"], target_clean)
        elif isinstance(parsed, list):
            parsed = filter_questions_by_target_type(parsed, target_clean)
    return parsed, meta, err


# ─────────────────────────────────────────────────────────────
# Step 5: Answer Paper Structured Parsing
# ─────────────────────────────────────────────────────────────

def parse_answer_paper_ai(ans_text, extracted_tables, api_key, models):
    """
    Parses the official answer paper / suggested answers into structured answers,
    MCQ answer keys, calculations, journal entries, ledger accounts, and working notes.
    """
    truncated_ans = ans_text[:250000]
    tables_summary = json.dumps(extracted_tables[:15]) if extracted_tables else "None"

    prompt = f"""You are an expert CA professor and official solution evaluator for ICAI examinations.

Analyze this Official Answer Paper / Suggested Solutions document and extract ALL answers into structured JSON.

CRITICAL RULES FOR MCQ ANSWER KEYS VS DESCRIPTIVE SOLUTIONS:
1. COMPACT MCQ ANSWER KEYS:
   - ICAI Answer papers typically start with a compact MCQ answer key table on Page 1 (e.g., "Answers to MCQs" / "MCQ No. 1 (b), 2 (b)..." or "1 (i), 2 (iii)...").
   - Extract EACH MCQ into its own answer item:
     * "question_number": "1", "2", ...
     * "correct_option": "A", "B", "C", "D" (normalize Roman numerals i, ii, iii, iv to A, B, C, D)
     * "sub_identifier": null
     * "is_mcq": true
2. DESCRIPTIVE SOLUTIONS & ACCOUNTING PROBLEMS:
   - Typically labeled "Part II – Descriptive Questions" or "Descriptive Answers", starting after the MCQ table.
   - Questions in Part II are ALSO numbered 1, 2, 3... with subquestions (a), (b), or (a)(i), (a)(ii).
   - Extract EACH subquestion answer item:
     * "question_number": "1", "2", ...
     * "sub_identifier": "(a)", "(a)(i)", "(a)(ii)", "(b)", etc.
     * "is_mcq": false
     * Full model answer text, working notes, calculations, accounting standards, and financial tables!

CAPTURE FOR EVERY ANSWER:
1. Question Number & Subquestion Identifier (e.g., "1", "1(a)", "1(a)(i)", "1(b)", "2", "3(a)").
2. For MCQs: The correct option letter ("A", "B", "C", "D") and official justification.
3. For Descriptive / Accounting Problems:
   - Full model answer text
   - Accounting journal entries and balance sheet / ledger tables
   - Working notes and intermediate calculations
   - Final numerical result statement
   - Accounting standards referenced (e.g., "AS 13", "Ind AS 16", "AS 16", "Companies Act 2013")

CRITICAL ACCOUNTING SOLUTION TABLES - PRESERVE EXACT GRIDS:
If an answer contains financial tables (Balance Sheets, Profit & Loss, Journal entries, Ledgers, Notes to Accounts), extract them into "answer_table_data":
1. Journal Entries:
   Headers: ["Date", "Particulars", "L.F.", "Debit (₹)", "Credit (₹)"]
2. Schedule III Balance Sheet:
   Headers: ["Particulars", "Note No.", "Figures as at end of current period (₹)", "Figures as at end of previous period (₹)"]
3. Ledger Accounts / T-Accounts:
   Headers: ["Date", "Particulars", "Amount (₹)", "Date", "Particulars", "Amount (₹)"]
4. 4-Column Balance Sheet / Trial Balance:
   Headers: ["Particulars", "Amount (₹)", "Particulars", "Amount (₹)"]

TABLES DETECTED IN ANSWER DOCUMENT:
{tables_summary}

ANSWER PAPER CONTENT:
---
{truncated_ans}
---

Return STRICT JSON matching this schema:
{{
  "answers": [
    {{
      "question_number": "1",
      "sub_identifier": null,
      "correct_option": "A",
      "answer_text": "The accounting treatment under Indian GAAP requires...",
      "working_notes": "Working Note 1: Valuation of Land on conversion...",
      "calculations": "Rs. 5,00,000 * 10% = Rs. 50,000",
      "answer_table_data": null,
      "accounting_standards": ["AS 10", "Ind AS 16"],
      "source_pages": [1]
    }},
    {{
      "question_number": "1",
      "sub_identifier": "(a)",
      "correct_option": null,
      "answer_text": "Balance Sheet of Vishnu Ltd. as at 31st March 2026 (as per Schedule III)...",
      "working_notes": "WN 1: Share Capital = 50,00,000\\nWN 2: Reserves and Surplus = 81,00,000...",
      "calculations": "Total Assets = Rs. 3,60,00,000 = Total Liabilities",
      "answer_table_data": {{
        "headers": ["Particulars", "Note No.", "Figures as at 31.03.2026 (₹)"],
        "rows": [
          ["I. EQUITY AND LIABILITIES", "", ""],
          ["(1) Shareholders' Funds", "", ""],
          ["(a) Share Capital", "1", "50,00,000"],
          ["(b) Reserves and Surplus", "2", "81,00,000"],
          ["(2) Non-Current Liabilities", "", ""],
          ["(a) Long-term borrowings (Term Loan)", "3", "40,00,000"],
          ["(3) Current Liabilities", "", ""],
          ["(a) Trade Payables", "", "45,80,000"],
          ["TOTAL", "", "2,16,80,000"]
        ]
      }},
      "accounting_standards": ["Schedule III", "Companies Act 2013"],
      "source_pages": [2, 3]
    }}
  ]
}}
"""
    parsed, meta, err = call_unified_ai(prompt, api_key=api_key, candidate_models=models, temperature=0.1, timeout=120, provider='gemini')
    return parsed, meta, err


# ─────────────────────────────────────────────────────────────
# Step 6: Multi-Signal Matching of Questions and Answers
# ─────────────────────────────────────────────────────────────

def normalize_option_label(lbl):
    """
    Normalizes option labels (e.g. '(a)', 'a', '(i)', 'i', '1') to standard uppercase 'A', 'B', 'C', 'D'.
    """
    if not lbl:
        return ""
    clean = re.sub(r'[\(\)\[\]\.\s]', '', str(lbl)).strip().upper()
    roman_map = {'I': 'A', 'II': 'B', 'III': 'C', 'IV': 'D', '1': 'A', '2': 'B', '3': 'C', '4': 'D'}
    return roman_map.get(clean, clean)


def match_questions_and_answers(sections, answers_list):
    """
    Matches each question and subquestion with its corresponding official answer
    using multi-signal verification: question numbers, subquestion identifiers, MCQ keys,
    accounting standard citations, and layout alignment.
    Synchronizes both structured_table and table_data for maximum frontend compatibility.
    """
    def clean_num(val):
        if not val:
            return ""
        s = re.sub(r'^(?:mcq|question|q\.?|no\.?|case\s+scenario)\s*', '', str(val).strip().lower())
        return s.strip()

    direct_map = {}
    mcq_answers_map = {}
    desc_answers_map = {}
    sub_map = {}
    mcq_key_map = {}

    for ans in answers_list:
        raw_q_num = str(ans.get("question_number", "")).strip().lower()
        sub_id = str(ans.get("sub_identifier") or ans.get("sub_question_number") or ans.get("sub_number") or ans.get("identifier") or "").strip().lower()
        sub_id_clean = re.sub(r'[\(\)\[\]\.\s]', '', sub_id)
        c_num = clean_num(raw_q_num)
        sub_letter = sub_id_clean[len(c_num):] if (c_num and sub_id_clean.startswith(c_num) and len(sub_id_clean) > len(c_num)) else sub_id_clean
        is_mcq_ans = bool("mcq" in raw_q_num or ans.get("correct_option") or ans.get("official_option") or ans.get("answer_option"))

        corr_opt_val = ans.get("correct_option") or ans.get("official_option") or ans.get("answer_option")
        if corr_opt_val:
            norm_opt = normalize_option_label(corr_opt_val)
            for k in [raw_q_num, c_num, f"mcq {c_num}", f"mcq_{c_num}", f"q{c_num}", f"q_{c_num}"]:
                if k:
                    mcq_key_map[k] = norm_opt

        if is_mcq_ans:
            for k in [raw_q_num, c_num, f"mcq {c_num}", f"mcq_{c_num}", f"q{c_num}", f"q_{c_num}"]:
                if k:
                    mcq_answers_map[k] = ans
                    direct_map[k] = ans
        else:
            for k in [raw_q_num, c_num, f"q{c_num}", f"question {c_num}"]:
                if k:
                    desc_answers_map[k] = ans
                    direct_map[k] = ans

        if raw_q_num and (sub_id_clean or sub_letter):
            for sid in set([s for s in [sub_id_clean, sub_letter] if s]):
                for k in [f"{raw_q_num}_{sid}", f"{raw_q_num}{sid}", f"{c_num}_{sid}", f"{c_num}{sid}", f"{c_num}({sid})", f"{raw_q_num}({sid})"]:
                    sub_map[k] = ans

        # Check if raw_q_num itself encodes sub-identifier like 1(a) or 1a
        composite_m = re.match(r'^(\d+)\s*\(?([a-z0-9]+)\)?$', raw_q_num)
        if composite_m:
            comp_base = composite_m.group(1)
            comp_sub = composite_m.group(2)
            for k in [f"{comp_base}_{comp_sub}", f"{comp_base}{comp_sub}", f"{comp_base}({comp_sub})", f"q{comp_base}_{comp_sub}"]:
                sub_map[k] = ans

        # Also index nested sub-answers/sub-questions inside the answer item
        for nested_sq in (ans.get("subquestions", []) or ans.get("sub_answers", [])):
            n_id = str(nested_sq.get("identifier") or nested_sq.get("sub_identifier", "")).strip().lower()
            n_clean = re.sub(r'[\(\)\[\]\.\s]', '', n_id)
            if n_clean:
                for k in [f"{raw_q_num}_{n_clean}", f"{raw_q_num}{n_clean}", f"{c_num}_{n_clean}", f"{c_num}{n_clean}", f"{c_num}({n_clean})"]:
                    sub_map[k] = nested_sq

    # Auto-wrap raw questions list into sections if needed
    if sections and isinstance(sections, list) and not any('questions' in s for s in sections if isinstance(s, dict)):
        sections = [{"section_name": "General", "questions": sections}]

    total_questions = 0
    matched_count = 0
    total_marks = 0

    for sec in sections:
        for q in sec.get("questions", []):
            total_questions += 1
            q_num_raw = str(q.get("question_number", "")).strip().lower()
            c_num = clean_num(q_num_raw)
            candidate_keys = [q_num_raw, c_num, f"mcq {c_num}", f"mcq_{c_num}", f"q{c_num}", f"question {c_num}"]
            q_marks = q.get("marks") or 0
            total_marks += q_marks

            # Normalize question table
            q_table = normalize_accounting_table(q.get("table_data") or q.get("structured_table"))
            if not q_table and q.get("question_text"):
                cleaned_txt, extracted_tbl = extract_table_from_markdown(q["question_text"])
                if extracted_tbl:
                    q_table = extracted_tbl
                    q["question_text"] = cleaned_txt

            q["table_data"] = q_table
            q["structured_table"] = q_table

            has_subqs = bool(q.get("subquestions") and len(q["subquestions"]) > 0)

            if has_subqs:
                # ── Parent Question with Sub-Questions (e.g. Case Scenario or multi-part descriptive) ──
                # The parent narrative does NOT hold the student solution. Each sub-question has its own matched answer.
                parent_ans_text = "Case Scenario / Main Passage: See individual sub-question answers below."
                q["official_answer"] = {
                    "answer_id": "",
                    "answer_question_number": q.get("question_number", ""),
                    "answer_text": parent_ans_text,
                    "solution_text": parent_ans_text,
                    "working_notes": "",
                    "calculations": "",
                    "answer_table_data": None,
                    "structured_table": None,
                    "confidence_score": 1.0,
                    "confidence": 1.0,
                    "matching_status": "matched",
                    "review_flag": "MATCHED",
                    "review_flags": [],
                    "ai_explanation": "",
                    "accounting_standards": [],
                    "source_pages": q.get("source_pages", [])
                }
                q["matched_answer"] = q["official_answer"]

                all_children_matched = True
                parent_review_flags = []

                # Match each child sub-question individually
                for sq in q.get("subquestions", []):
                    sq_id = str(sq.get("identifier", "")).strip().lower()
                    sq_id_clean = re.sub(r'[\(\)\[\]\.\s]', '', sq_id)
                    sq_orig = str(sq.get("original_question_number", "")).strip().lower()
                    sq_orig_clean = clean_num(sq_orig)
                    sq_sub_no = str(sq.get("sub_question_number", "")).strip().lower()

                    # Generate lookup keys for this subquestion
                    sq_lookup_keys = [
                        sq_orig_clean,
                        sq_orig,
                        f"mcq_{sq_orig_clean}",
                        f"mcq {sq_orig_clean}",
                        f"q{sq_orig_clean}",
                        f"{c_num}_{sq_id_clean}",
                        f"{c_num}{sq_id_clean}",
                        f"{c_num}({sq_id_clean})",
                        sq_id_clean,
                        sq_id,
                        sq_sub_no
                    ]
                    sq_lookup_keys = [k for k in sq_lookup_keys if k]

                    sq_ans = None
                    corr_opt = None
                    is_child_mcq = (sq.get("question_type") == "MCQ" or bool(sq.get("options")))

                    if is_child_mcq:
                        for k in sq_lookup_keys:
                            if k in mcq_key_map:
                                corr_opt = mcq_key_map[k]
                                break
                        for k in sq_lookup_keys:
                            if k in mcq_answers_map:
                                sq_ans = mcq_answers_map[k]
                                break
                        if not sq_ans:
                            for k in sq_lookup_keys:
                                if k in direct_map:
                                    sq_ans = direct_map[k]
                                    break
                    else:
                        for k in sq_lookup_keys:
                            if k in sub_map:
                                sq_ans = sub_map[k]
                                break
                        if not sq_ans:
                            for k in sq_lookup_keys:
                                if k in desc_answers_map:
                                    sq_ans = desc_answers_map[k]
                                    break

                    sq_conf = 0.0
                    sq_status = "needs_review"
                    sq_flags = []

                    if is_child_mcq and corr_opt:
                        opt_matched = False
                        for opt in sq.get("options", []):
                            opt_lbl = normalize_option_label(opt.get("label", ""))
                            if opt_lbl == corr_opt:
                                opt["is_correct"] = True
                                opt_matched = True
                            else:
                                opt["is_correct"] = False
                        if opt_matched:
                            sq_conf = 0.98
                            sq_status = "matched"
                        else:
                            sq_conf = 0.60
                            sq_status = "needs_review"
                            sq_flags.append(f"Official answer key indicates option '{corr_opt}' which does not match extracted options")
                    elif sq_ans:
                        sq_conf = 0.95
                        sq_status = "matched"
                        if is_child_mcq and sq_ans.get("correct_option") and sq.get("options"):
                            corr = normalize_option_label(sq_ans["correct_option"])
                            for opt in sq["options"]:
                                opt_lbl = normalize_option_label(opt.get("label", ""))
                                opt["is_correct"] = (opt_lbl == corr)
                    else:
                        sq_status = "needs_review"
                        sq_conf = 0.0
                        sq_flags.append(f"Official answer for sub-question {sq_id} not identified confidently in answer paper")

                    if sq_status != "matched":
                        all_children_matched = False
                        parent_review_flags.extend(sq_flags)

                    sq_ans_table = normalize_accounting_table(
                        (sq_ans.get("answer_table_data") if sq_ans else None) or
                        (sq_ans.get("structured_table") if sq_ans else None)
                    )

                    sq_ans_text = (sq_ans.get("solution_text") or sq_ans.get("answer_text") or "") if sq_ans else ""
                    if not sq_ans_text and is_child_mcq and corr_opt:
                        sq_ans_text = f"({corr_opt.lower()})"
                    sq_wn = sq_ans.get("working_notes", "") if sq_ans else ""
                    sq_calc = sq_ans.get("calculations", "") if sq_ans else ""

                    sq_answer_obj = {
                        "answer_id": sq_ans.get("answer_id", "") if sq_ans else "",
                        "answer_question_number": sq_ans.get("question_number", "") if sq_ans else (sq_orig_clean or sq_id),
                        "answer_text": sq_ans_text,
                        "solution_text": sq_ans_text,
                        "working_notes": sq_wn,
                        "calculations": sq_calc,
                        "answer_table_data": sq_ans_table,
                        "structured_table": sq_ans_table,
                        "confidence_score": sq_conf,
                        "matching_status": sq_status,
                        "review_flag": "MATCHED" if sq_status == "matched" else "NEEDS REVIEW",
                        "review_flags": sq_flags,
                        "correct_option": corr_opt,
                        "accounting_standards": sq_ans.get("accounting_standards", []) if sq_ans else [],
                        "source_pages": sq_ans.get("source_pages", []) if sq_ans else []
                    }
                    sq["official_answer"] = sq_answer_obj
                    sq["matched_answer"] = sq_answer_obj
                    sq["matching_status"] = sq_status
                    sq["confidence"] = sq_conf
                    sq["is_approved"] = (sq_status == "matched")

                if all_children_matched:
                    q["matching_status"] = "matched"
                    q["confidence"] = 0.98
                    q["is_approved"] = True
                    matched_count += 1
                else:
                    q["matching_status"] = "needs_review"
                    q["confidence"] = 0.50
                    q["is_approved"] = False
                    q["review_flags"] = parent_review_flags

            else:
                # ── Standalone / Independent Question (without sub-questions) ──
                matched_ans = None
                if q.get("question_type") == "MCQ":
                    for k in candidate_keys:
                        if k in mcq_answers_map:
                            matched_ans = mcq_answers_map[k]
                            break
                else:
                    for k in candidate_keys:
                        if k in desc_answers_map:
                            matched_ans = desc_answers_map[k]
                            break

                if not matched_ans:
                    for k in candidate_keys:
                        if k in direct_map:
                            matched_ans = direct_map[k]
                            break

                corr_opt = None
                for k in candidate_keys:
                    if k in mcq_key_map:
                        corr_opt = mcq_key_map[k]
                        break

                confidence = 0.5
                matching_status = "needs_review"
                review_flags = []

                if q.get("question_type") == "MCQ" and corr_opt:
                    opt_matched = False
                    for opt in q.get("options", []):
                        opt_lbl = normalize_option_label(opt.get("label", ""))
                        if opt_lbl == corr_opt:
                            opt["is_correct"] = True
                            opt_matched = True
                        else:
                            opt["is_correct"] = False
                    if opt_matched:
                        confidence = 0.98
                        matching_status = "matched"
                        matched_count += 1
                    else:
                        confidence = 0.60
                        matching_status = "needs_review"
                        review_flags.append(f"Official answer key indicates option '{corr_opt}' which does not match extracted options")
                elif matched_ans:
                    confidence = 0.95
                    matching_status = "matched"
                    matched_count += 1
                    if matched_ans.get("correct_option") and q.get("options"):
                        corr = normalize_option_label(matched_ans["correct_option"])
                        for opt in q["options"]:
                            opt_lbl = normalize_option_label(opt.get("label", ""))
                            opt["is_correct"] = (opt_lbl == corr)
                else:
                    matching_status = "needs_review"
                    confidence = 0.0
                    review_flags.append("Official answer not found in solution paper")

                ans_table = normalize_accounting_table(
                    (matched_ans.get("answer_table_data") if matched_ans else None) or
                    (matched_ans.get("structured_table") if matched_ans else None) or
                    (matched_ans.get("table_data") if matched_ans else None)
                )
                if not ans_table and matched_ans and matched_ans.get("answer_text"):
                    cleaned_ans_txt, extracted_ans_tbl = extract_table_from_markdown(matched_ans["answer_text"])
                    if extracted_ans_tbl:
                        ans_table = extracted_ans_tbl

                answer_obj = {
                    "answer_id": matched_ans.get("answer_id", "") if matched_ans else "",
                    "answer_question_number": matched_ans.get("question_number", "") if matched_ans else "",
                    "answer_text": matched_ans.get("answer_text", "") if matched_ans else "",
                    "solution_text": matched_ans.get("answer_text", "") if matched_ans else "",
                    "working_notes": matched_ans.get("working_notes", "") if matched_ans else "",
                    "calculations": matched_ans.get("calculations", "") if matched_ans else "",
                    "answer_table_data": ans_table,
                    "structured_table": ans_table,
                    "confidence_score": confidence,
                    "confidence": confidence,
                    "matching_status": matching_status,
                    "review_flag": "MATCHED" if matching_status == "matched" else "NEEDS REVIEW",
                    "review_flags": review_flags,
                    "ai_explanation": matched_ans.get("ai_explanation", "") if matched_ans else "",
                    "accounting_standards": matched_ans.get("accounting_standards", []) if matched_ans else [],
                    "source_pages": matched_ans.get("source_pages", []) if matched_ans else []
                }
                q["official_answer"] = answer_obj
                q["matched_answer"] = answer_obj
                q["matching_status"] = matching_status
                q["confidence"] = confidence
                q["review_flags"] = review_flags
                q["is_approved"] = (matching_status == "matched" and len(review_flags) == 0)

    unmatched_count = total_questions - matched_count

    validation = {
        "question_count": total_questions,
        "matched_answer_count": matched_count,
        "unmatched_question_count": unmatched_count,
        "mark_total": total_marks,
        "issues": []
    }
    if unmatched_count > 0:
        validation["issues"].append(f"{unmatched_count} question(s) have missing or unmatched official answers.")
    if total_marks < 80:
        validation["issues"].append(f"Total marks ({total_marks}) is lower than standard CA paper total (100).")

    return sections, validation


# ─────────────────────────────────────────────────────────────
# Step 7: Classification, Taxonomy & Duplicate Detection
# ─────────────────────────────────────────────────────────────

def classify_and_enrich_questions(sections, paper, job=None):
    """
    Enriches questions with taxonomy suggestions (Paper, Chapter, Topic)
    queried directly from active database models and detects duplicate questions
    with tenant-level isolation.
    """
    from master_data.models import ICAIChapter, ICAITopic
    from materials.models import SubjectiveQuestion
    from django.db.models import Q

    chapters_cache = []
    if paper:
        chapters = list(ICAIChapter.objects.filter(paper=paper).prefetch_related('topics'))
        for ch in chapters:
            topics = list(ch.topics.all())
            chapters_cache.append({
                "chapter_id": ch.id,
                "chapter_name": ch.name,
                "topics": [{"topic_id": t.id, "topic_name": t.name} for t in topics]
            })

    duplicate_candidates_count = 0
    tables_count = 0
    mcqs_count = 0
    low_confidence_count = 0

    as_concept_map = {
        "as 1": "disclosure of accounting policies",
        "as 2": "valuation of inventories",
        "as 3": "cash flow",
        "as 4": "contingencies",
        "as 5": "net profit or loss",
        "as 7": "construction contracts",
        "as 9": "revenue recognition",
        "as 10": "property, plant and equipment",
        "as 11": "foreign exchange",
        "as 12": "government grants",
        "as 13": "investments",
        "as 14": "amalgamation",
        "as 15": "employee benefits",
        "as 16": "borrowing costs",
        "as 17": "segment reporting",
        "as 18": "related party",
        "as 19": "leases",
        "as 20": "earnings per share",
        "as 22": "taxes on income",
        "as 24": "discontinuing operations",
        "as 26": "intangible assets",
        "as 28": "impairment of assets",
        "as 29": "provisions",
        "schedule iii": "financial statements of companies",
        "balance sheet": "financial statements of companies",
        "profit and loss": "financial statements of companies",
        "buy back": "buyback",
        "buyback": "buyback",
        "internal reconstruction": "internal reconstruction",
        "capital reduction": "internal reconstruction",
        "amalgamation": "amalgamation",
        "absorption": "amalgamation",
        "branch": "branch",
        "foreign branch": "branch",
        "share capital": "share capital",
        "debenture": "debentures",
        "deposit": "acceptance of deposits",
        "charge": "registration of charges",
        "management": "management and administration",
        "director": "management and administration",
        "dividend": "declaration and payment of dividend",
        "audit": "audit and auditors",
        "fema": "foreign exchange management",
        "llp": "limited liability partnership",
        "interpretation": "interpretation of statutes",
        "general clauses": "general clauses act",
        "gst": "goods and services tax",
        "input tax credit": "input tax credit",
        "itc": "input tax credit",
        "tds": "tax deduction at source",
        "salary": "salaries",
        "house property": "house property",
        "capital gain": "capital gains",
        "pgbp": "profits and gains of business",
    }

    for sec in sections:
        for q in sec.get("questions", []):
            q_text = (q.get("question_text") or "") + " " + (q.get("case_scenario_passage") or "")
            q_type = q.get("question_type") or "NORMAL"
            
            if q_type == "MCQ":
                mcqs_count += 1
            if q.get("table_data") or q.get("structured_table"):
                tables_count += 1
            if (q.get("confidence") or 1.0) < 0.8:
                low_confidence_count += 1

            best_chapter = None
            best_topic = None
            best_score = 0
            q_full_text = f"{q_text} {json.dumps(q.get('official_answer', {}))}".lower()

            # Rule 1: Key ICAI standard or concept lookup
            for kw, target_concept in as_concept_map.items():
                if kw in q_full_text:
                    for ch_entry in chapters_cache:
                        if target_concept in ch_entry["chapter_name"].lower():
                            best_chapter = ch_entry
                            best_score = 10
                            break
                    if best_chapter:
                        break

            # Rule 2: Token / substring overlap scoring
            if not best_chapter and chapters_cache:
                for ch_entry in chapters_cache:
                    ch_clean = re.sub(r'^(chapter\s*\d+\s*:\s*|\d+\.\s*)', '', ch_entry["chapter_name"].lower())
                    words = [w for w in re.split(r'[^a-z0-9]', ch_clean) if len(w) > 3 and w not in ('introduction', 'overview', 'basic', 'concepts', 'general', 'other')]
                    score = sum(1 for w in words if w in q_full_text)
                    if score > best_score:
                        best_score = score
                        best_chapter = ch_entry

            if best_chapter and (best_score >= 1 or len(chapters_cache) == 1):
                q["suggested_chapter_id"] = best_chapter["chapter_id"]
                q["suggested_chapter_name"] = best_chapter["chapter_name"]
                q["proposed_new_chapter"] = False
                
                # Propose best topic within the chapter
                best_t_score = 0
                for t_entry in best_chapter.get("topics", []):
                    t_words = [w for w in re.split(r'[^a-z0-9]', t_entry["topic_name"].lower()) if len(w) > 3]
                    t_score = sum(1 for w in t_words if w in q_full_text)
                    if t_score > best_t_score:
                        best_t_score = t_score
                        best_topic = t_entry
                
                if not best_topic and best_chapter.get("topics"):
                    best_topic = best_chapter["topics"][0]

                if best_topic:
                    q["suggested_topic_id"] = best_topic.get("topic_id")
                    q["suggested_topic_name"] = best_topic.get("topic_name")
                else:
                    q["suggested_topic_id"] = None
                    q["suggested_topic_name"] = None
            else:
                q["suggested_chapter_id"] = None
                q["suggested_chapter_name"] = "General Accounting"
                q["proposed_new_chapter"] = True
                q["suggested_topic_id"] = None
                q["suggested_topic_name"] = None

            # Check Duplicates in DB with tenant isolation
            q_num = str(q.get("question_number", "")).strip()
            sec_title = sec.get("title", "")
            sec_label = "Part II" if re.search(r'\bpart\s*[-_–]?\s*ii\b', sec_title, re.I) else ("Part I" if re.search(r'\bpart\s*[-_–]?\s*i\b', sec_title, re.I) else (sec_title[:10] if sec_title else "Part I"))
            if job and job.source and q_num:
                dup_qs = SubjectiveQuestion.objects.filter(
                    source=job.source,
                    attempt=job.exam_session or "MAY",
                    year=str(job.exam_year or 2026),
                    section=sec_label,
                    q_no=q_num
                )
                if job.institution:
                    dup_qs = dup_qs.filter(Q(institution=job.institution) | Q(is_platform_wide=True))
                existing = dup_qs.first()
                if existing:
                    q["is_duplicate"] = True
                    q["duplicate_id"] = existing.id
                    q["duplicate_reason"] = f"Question {sec_label} Q{existing.q_no} already exists in {existing.source} {existing.attempt} {existing.year}"
                    duplicate_candidates_count += 1
                else:
                    q["is_duplicate"] = False
            else:
                q["is_duplicate"] = False

    return {
        "duplicate_candidates_count": duplicate_candidates_count,
        "tables_count": tables_count,
        "mcqs_count": mcqs_count,
        "low_confidence_count": low_confidence_count
    }


# ─────────────────────────────────────────────────────────────
# Step 8: Main Pipeline Orchestrator for Import Job
# ─────────────────────────────────────────────────────────────

def run_import_job_pipeline(job):
    """
    Executes the complete end-to-end import pipeline for a QuestionImportJob:
    1. Extract PDF pages & tables
    2. Extract document metadata
    3. Parse question paper structure
    4. Parse answer paper structure
    5. Match questions & answers
    6. Validate, classify taxonomy, check duplicates
    7. Save draft payload and set status to review_required
    """
    start_time = time.time()
    api_key, models = get_gemini_config()

    if not api_key:
        job.status = 'failed'
        job.error_message = 'No Gemini API Key found. Configure GEMINI_API_KEY in backend/.env or Admin Settings.'
        job.save()
        return False, job.error_message

    try:
        # Step 1: Extract Text & Tables
        job.status = 'extracting'
        job.stage_label = 'Extracting pages, layout, and accounting tables from PDFs...'
        job.progress_percent = 15
        job.save()

        qp_content = extract_pdf_document_content(job.question_pdf.path, api_key, models)
        ans_content = extract_pdf_document_content(job.answer_pdf.path, api_key, models) if job.answer_pdf else {"pages": [], "full_text": "", "tables": [], "is_scanned": False}

        if not qp_content['full_text'].strip():
            job.status = 'failed'
            job.error_message = 'Could not extract text from Question Paper PDF. Ensure file is not corrupt or password-protected.'
            job.save()
            return False, job.error_message

        # Step 2: Metadata Extraction
        job.status = 'extracting'
        job.stage_label = 'Detecting exam session, year, course, and maximum marks...'
        job.progress_percent = 30
        job.save()

        target_question_type = (job.extracted_metadata or {}).get('target_question_type')
        if not target_question_type and job.batch and job.batch.batch_payload:
            target_question_type = job.batch.batch_payload.get('target_question_type')
        target_question_type = str(target_question_type or 'ALL').upper()

        metadata, meta_usage, _ = extract_document_metadata_ai(qp_content['full_text'], api_key, models)
        metadata['target_question_type'] = target_question_type
        job.extracted_metadata = metadata
        job.exam_year = metadata.get('exam_year') or job.exam_year
        job.exam_session = metadata.get('exam_session') or job.exam_session
        job.maximum_marks = metadata.get('maximum_marks') or job.maximum_marks
        job.duration_minutes = metadata.get('duration_minutes') or job.duration_minutes
        job.save()

        # Step 3: Parse Question Paper
        job.status = 'parsing_questions'
        job.stage_label = f"Parsing question structure ({'MCQs Only' if target_question_type == 'MCQ' else 'Descriptive Only' if target_question_type == 'DESCRIPTIVE' else 'All Formats'}), options, and tables..."
        job.progress_percent = 50
        job.save()

        qp_parsed, qp_usage, qp_err = parse_question_paper_ai(
            qp_content['full_text'],
            qp_content['tables'],
            api_key,
            models,
            target_question_type=target_question_type
        )

        sections = []
        if isinstance(qp_parsed, dict):
            raw_sec = qp_parsed.get('sections')
            if raw_sec and isinstance(raw_sec, list):
                sections = raw_sec
            elif 'questions' in qp_parsed:
                sections = [{'section_id': 'PART_I', 'title': 'Examination Questions', 'questions': qp_parsed['questions']}]
        elif isinstance(qp_parsed, list):
            if qp_parsed and any('questions' in s for s in qp_parsed if isinstance(s, dict)):
                sections = qp_parsed
            else:
                sections = [{'section_id': 'PART_I', 'title': 'Examination Questions', 'questions': qp_parsed}]

        if not sections:
            job.status = 'failed'
            job.error_message = f"Failed to parse question paper structure: {qp_err or 'No questions extracted'}"
            job.save()
            return False, job.error_message

        # Reconcile into strict hierarchical structure:
        # Case scenario narrative passage extracted ONCE at the parent question,
        # with all related sub-questions nested under it without repeated scenario text.
        sections = hierarchicalize_and_reconcile_questions(sections, qp_content['full_text'])

        # Enforce strict user-selected question type filter
        if target_question_type != 'ALL':
            sections = filter_questions_by_target_type(sections, target_question_type)

        # Step 4: Parse Answer Paper
        job.status = 'parsing_answers'
        job.stage_label = 'Parsing official solutions, journal entries, and working notes...'
        job.progress_percent = 70
        job.save()

        answers_list = []
        ans_usage = {}
        if ans_content['full_text'].strip():
            ans_parsed, ans_usage, _ = parse_answer_paper_ai(
                ans_content['full_text'],
                ans_content['tables'],
                api_key,
                models
            )
            if isinstance(ans_parsed, dict):
                answers_list = ans_parsed.get('answers') or ans_parsed.get('solutions') or []
            elif isinstance(ans_parsed, list):
                answers_list = ans_parsed

        # Step 5: Multi-Signal Matching & Validation
        job.status = 'matching'
        job.stage_label = 'Matching questions to official answers with confidence scores...'
        job.progress_percent = 85
        job.save()

        matched_sections, validation = match_questions_and_answers(sections, answers_list)

        # Step 6: Taxonomy Auto-Classification & Duplicate Detection
        job.status = 'validating'
        job.stage_label = 'Auto-classifying questions to CA Chapters, Topics, and checking duplicates...'
        job.progress_percent = 92
        job.save()

        target_paper = job.paper
        if not target_paper:
            from master_data.models import ICAIPaper
            subject_name = (metadata.get('subject') or '').lower()
            paper_num = (metadata.get('paper_number') or '').lower()
            for p in ICAIPaper.objects.all():
                p_name = p.name.lower()
                if subject_name and (subject_name in p_name or p_name in subject_name):
                    target_paper = p
                    break
                if paper_num and paper_num in p_name:
                    target_paper = p
                    break
            if target_paper:
                job.paper = target_paper
                if target_paper.level and not job.level:
                    job.level = target_paper.level

        classification_stats = classify_and_enrich_questions(matched_sections, target_paper, job=job)

        # Assemble full payload
        payload = {
            "document": metadata,
            "sections": matched_sections,
            "validation": validation,
            "classification_stats": classification_stats,
            "raw_question_pages": [p['page_number'] for p in qp_content['pages']],
            "total_extracted_tables": len(qp_content['tables']) + len(ans_content['tables']),
        }

        # Calculate metrics
        end_time = time.time()
        elapsed = round(end_time - start_time, 2)
        total_tokens_in = (meta_usage.get('tokens_in', 0) if meta_usage else 0) + (qp_usage.get('tokens_in', 0) if qp_usage else 0) + (ans_usage.get('tokens_in', 0) if ans_usage else 0)
        total_tokens_out = (meta_usage.get('tokens_out', 0) if meta_usage else 0) + (qp_usage.get('tokens_out', 0) if qp_usage else 0) + (ans_usage.get('tokens_out', 0) if ans_usage else 0)

        # Gemini Flash pricing estimate ($0.10/1M in, $0.40/1M out)
        cost_estimate = (total_tokens_in * 0.0000001) + (total_tokens_out * 0.0000004)

        job.status = 'review_required'
        job.stage_label = f"Extraction complete! {validation['question_count']} questions ready for review."
        job.progress_percent = 100
        job.extracted_payload = payload
        job.model_used = qp_usage.get('model', 'gemini-3.5-flash') if qp_usage else 'gemini-3.5-flash'
        job.total_input_tokens = total_tokens_in
        job.total_output_tokens = total_tokens_out
        job.estimated_cost_usd = round(cost_estimate, 6)
        job.processing_time_seconds = elapsed
        job.save()

        return True, None

    except Exception as e:
        job.status = 'failed'
        job.error_message = f"Pipeline execution error: {str(e)}"
        job.save()
        return False, str(e)


# ─────────────────────────────────────────────────────────────
# Step 9: Batch Pipeline Orchestrator
# ─────────────────────────────────────────────────────────────

def run_import_batch_pipeline(batch):
    """
    Executes the processing pipeline for an entire ImportBatch across all associated jobs.
    """
    jobs = list(batch.jobs.all())
    if not jobs:
        batch.status = 'failed'
        batch.error_message = 'No jobs found in this batch to process.'
        batch.save()
        return False, batch.error_message

    batch.status = 'processing'
    batch.stage_label = f"Processing {len(jobs)} document pairs..."
    batch.progress_percent = 5
    batch.save()

    total_questions = 0
    matched_answers = 0
    missing_answers = 0
    tables_count = 0
    mcqs_count = 0
    duplicate_candidates = 0
    low_confidence = 0
    total_tokens_in = 0
    total_tokens_out = 0
    total_cost = 0.0
    total_time = 0.0

    batch_sections = []

    for idx, job in enumerate(jobs):
        success, err = run_import_job_pipeline(job)
        if success and job.extracted_payload:
            payload = job.extracted_payload
            val = payload.get("validation", {})
            total_questions += val.get("question_count", 0)
            matched_answers += val.get("matched_answer_count", 0)
            missing_answers += val.get("unmatched_question_count", 0)

            stats = payload.get("classification_stats", {})
            tables_count += stats.get("tables_count", 0)
            mcqs_count += stats.get("mcqs_count", 0)
            duplicate_candidates += stats.get("duplicate_candidates_count", 0)
            low_confidence += stats.get("low_confidence_count", 0)

            total_tokens_in += job.total_input_tokens
            total_tokens_out += job.total_output_tokens
            total_cost += job.estimated_cost_usd
            total_time += job.processing_time_seconds

            for sec in payload.get("sections", []):
                sec_copy = dict(sec)
                sec_copy["job_id"] = str(job.id)
                sec_copy["job_source"] = job.source
                batch_sections.append(sec_copy)

        batch.progress_percent = int(10 + (idx + 1) / len(jobs) * 85)
        batch.stage_label = f"Processed {idx+1}/{len(jobs)} document pairs..."
        batch.save()

    batch.status = 'needs_review'
    batch.stage_label = f"Batch extraction complete! {total_questions} questions across {len(jobs)} papers ready for review."
    batch.progress_percent = 100
    batch.total_questions_detected = total_questions
    batch.matched_answers_count = matched_answers
    batch.missing_answers_count = missing_answers
    batch.tables_count = tables_count
    batch.mcqs_count = mcqs_count
    batch.duplicate_candidates_count = duplicate_candidates
    batch.low_confidence_count = low_confidence
    batch.total_input_tokens = total_tokens_in
    batch.total_output_tokens = total_tokens_out
    batch.estimated_cost_usd = round(total_cost, 6)
    batch.processing_time_seconds = round(total_time, 2)
    batch.batch_payload = {
        "sections": batch_sections,
        "total_jobs": len(jobs),
        "total_questions": total_questions,
        "matched_answers": matched_answers,
        "missing_answers": missing_answers
    }
    batch.save()
    return True, None


# ─────────────────────────────────────────────────────────────
# Step 10: Publish Approved Questions to Question Bank
# ─────────────────────────────────────────────────────────────

def publish_approved_questions_to_database(job, approved_only=True):
    """
    Atomically publishes questions from the job's extracted_payload into
    SubjectiveQuestion, SubQuestion, and QuestionOption records in the database.
    """
    from materials.models import SubjectiveQuestion, SubQuestion, QuestionOption, ImportAuditLog, Scenario, Answer
    from courses.models import Subject
    from master_data.models import CALevel, ICAIPaper, ICAIChapter, ICAITopic

    payload = job.extracted_payload or {}
    sections = payload.get("sections", [])
    if not sections:
        return 0, "No questions found in job payload to publish."

    # Resolve target subject
    target_subject = None
    if job.paper:
        target_subject = Subject.objects.filter(name__icontains=job.paper.name.split("-")[-1].strip()).first()
    if not target_subject:
        target_subject = Subject.objects.first()

    published_count = 0

    with transaction.atomic():
        for sec in sections:
            sec_title = sec.get("section_name") or sec.get("title", "")
            for q in sec.get("questions", []):
                if approved_only and not q.get("is_approved"):
                    continue

                q_num = str(q.get("question_number", "")).strip() or "1"
                q_text = q.get("question_text", "").strip()
                case_scenario = q.get("case_scenario_passage", "").strip() if q.get("case_scenario_passage") else ""
                q_type = q.get("question_type", "NORMAL").upper()
                if q_type not in ['NORMAL', 'MCQ', 'THEORY', 'CASE_SCENARIO', 'MIXED']:
                    q_type = 'NORMAL'

                marks = q.get("marks") or 10
                official_ans = q.get("official_answer", {}) or q.get("matched_answer", {})
                correct_ans = official_ans.get("answer_text", "")
                wn = official_ans.get("working_notes", "")
                if wn:
                    correct_ans = f"{correct_ans}\n\nWORKING NOTES:\n{wn}"

                # Table data
                table_obj = q.get("table_data") or q.get("structured_table")
                ans_table_obj = official_ans.get("answer_table_data") or official_ans.get("structured_table")
                table_json = json.dumps(table_obj) if table_obj else None
                ans_table_json = json.dumps(ans_table_obj) if ans_table_obj else None

                # Resolve ICAI Topic
                target_icai_topic = None
                if q.get("suggested_topic_id"):
                    target_icai_topic = ICAITopic.objects.filter(id=q["suggested_topic_id"]).first()
                if not target_icai_topic and q.get("suggested_chapter_id"):
                    ch_obj = ICAIChapter.objects.filter(id=q["suggested_chapter_id"]).first()
                    if ch_obj:
                        target_icai_topic = ICAITopic.objects.filter(chapter=ch_obj).first()
                if not target_icai_topic:
                    target_icai_topic = job.topic

                sec_label = "Part II" if re.search(r'\bpart\s*[-_–]?\s*ii\b', sec_title, re.I) else ("Part I" if re.search(r'\bpart\s*[-_–]?\s*i\b', sec_title, re.I) else (sec_title[:10] if sec_title else "Part I"))

                # Create or update SubjectiveQuestion with tenant isolation (idempotent)
                lookup_kwargs = {
                    "source": job.source or "Mock Test Paper",
                    "attempt": job.exam_session or "MAY",
                    "year": str(job.exam_year or 2026),
                    "section": sec_label,
                    "q_no": q_num,
                }
                if job.institution:
                    lookup_kwargs["institution"] = job.institution
                else:
                    lookup_kwargs["is_platform_wide"] = True

                tags_val = q.get("tags") or []
                if isinstance(tags_val, list):
                    tags_str = ", ".join(str(t) for t in tags_val)
                else:
                    tags_str = str(tags_val)

                db_q, created = SubjectiveQuestion.objects.update_or_create(
                    **lookup_kwargs,
                    defaults={
                        "subject": target_subject,
                        "icai_topic": target_icai_topic,
                        "chapter": job.chapter if job.chapter else (target_icai_topic.chapter if (target_icai_topic and hasattr(target_icai_topic, 'chapter')) else None),
                        "section": sec_label,
                        "question_type": q_type,
                        "marks": marks,
                        "difficulty": q.get("difficulty") or "MEDIUM",
                        "status": "PUBLISHED",
                        "institution": job.institution,
                        "is_platform_wide": job.is_platform_wide,
                        "question_text": q_text,
                        "case_scenario_passage": case_scenario,
                        "correct_answer": correct_ans,
                        "explanation": official_ans.get("ai_explanation") or official_ans.get("explanation") or "",
                        "related_concept": q.get("related_concept") or "",
                        "tags": tags_str,
                        "table_data": table_json,
                        "answer_table_data": ans_table_json,
                        "created_by": job.created_by,
                        "pdf_url": job.question_pdf.url if job.question_pdf else None,
                        "original_question_number": q_num,
                    }
                )

                # If question has a scenario narrative, create/link the Scenario record
                scenario_obj = None
                if case_scenario:
                    q_pages = q.get("source_pages", [])
                    p_start = q_pages[0] if q_pages else None
                    p_end = q_pages[-1] if q_pages else None
                    scenario_obj = Scenario.objects.create(
                        import_batch=job.batch,
                        parent_question=db_q,
                        scenario_text=case_scenario,
                        table_data=table_json,
                        source_page_start=p_start,
                        source_page_end=p_end
                    )
                    db_q.scenario = scenario_obj
                    db_q.save()

                # Reset and recreate QuestionOptions
                db_q.options.all().delete()
                for o_idx, opt in enumerate(q.get("options", [])):
                    opt_text = opt.get("text", "") or opt.get("option_text", "")
                    QuestionOption.objects.create(
                        question=db_q,
                        text=opt_text,
                        is_correct=bool(opt.get("is_correct", False)),
                        order=opt.get("order", o_idx)
                    )

                # Reset and recreate SubQuestions
                db_q.parts.all().delete()
                subqs = q.get("subquestions", [])
                if subqs:
                    for sq in subqs:
                        sq_id = sq.get("identifier", "(a)")
                        sq_orig_no = sq.get("original_question_number") or q_num
                        sq_sub_no = sq.get("sub_question_number") or sq_id
                        sq_status = sq.get("matching_status") or "matched"
                        sq_text = sq.get("question_text", "")
                        sq_marks = sq.get("marks") or 2
                        sq_type = "MCQ" if (sq.get("question_type") == "MCQ" or sq.get("options")) else "NORMAL"
                        sq_ans = sq.get("official_answer", {}) or sq.get("matched_answer", {})
                        sq_ans_text = sq_ans.get("answer_text", "")
                        sq_wn = sq_ans.get("working_notes", "")
                        if sq_wn:
                            sq_ans_text = f"{sq_ans_text}\n\nWORKING NOTES:\n{sq_wn}"

                        sub_q = SubQuestion.objects.create(
                            parent_question=db_q,
                            scenario=scenario_obj,
                            original_question_number=sq_orig_no,
                            sub_question_number=sq_sub_no,
                            matching_status=sq_status,
                            identifier=sq_id,
                            question_text=sq_text,
                            question_type=sq_type,
                            marks=sq_marks,
                            correct_answer=sq_ans_text,
                            table_data=json.dumps(sq.get("table_data") or sq.get("structured_table")) if (sq.get("table_data") or sq.get("structured_table")) else None,
                            answer_table_data=json.dumps(sq_ans.get("answer_table_data") or sq_ans.get("structured_table")) if (sq_ans.get("answer_table_data") or sq_ans.get("structured_table")) else None
                        )

                        # Subquestion options if MCQ
                        if sq.get("options"):
                            for so_idx, sopt in enumerate(sq.get("options", [])):
                                sopt_text = sopt.get("text", "") or sopt.get("option_text", "")
                                QuestionOption.objects.create(
                                    sub_question=sub_q,
                                    text=sopt_text,
                                    is_correct=bool(sopt.get("is_correct", False)),
                                    order=sopt.get("order", so_idx)
                                )

                        # Create individual Answer record for this sub-question
                        sq_pages = sq_ans.get("source_pages", [])
                        sq_page = sq_pages[0] if sq_pages else None
                        Answer.objects.create(
                            question=db_q,
                            sub_question=sub_q,
                            answer_content=sq_ans_text,
                            matching_status=sq_status,
                            answer_source_page=sq_page
                        )
                else:
                    # Independent question with no subquestions: create root Answer record
                    main_pages = official_ans.get("source_pages", [])
                    main_page = main_pages[0] if main_pages else None
                    Answer.objects.create(
                        question=db_q,
                        sub_question=None,
                        answer_content=correct_ans,
                        matching_status=q.get("matching_status") or "matched",
                        answer_source_page=main_page
                    )

                # Audit Log
                ImportAuditLog.objects.create(
                    batch=job.batch,
                    job=job,
                    user=job.created_by,
                    action="PUBLISH_QUESTION",
                    question_reference=f"Q{q_num}",
                    details={
                        "published_id": db_q.id,
                        "created": created,
                        "marks": marks,
                        "type": q_type,
                        "status": "PUBLISHED",
                        "subquestions_count": len(q.get("subquestions", [])),
                        "options_count": len(q.get("options", []))
                    }
                )

                published_count += 1

        job.status = 'published'
        job.published_at = timezone.now()
        job.published_question_count = published_count
        job.save()

    return published_count, None


def publish_approved_batch_to_database(batch, approved_only=True):
    """
    Atomically publishes all approved questions across all jobs in a batch.
    """
    from materials.models import ImportAuditLog
    total_published = 0
    errors = []

    for job in batch.jobs.all():
        count, err = publish_approved_questions_to_database(job, approved_only=approved_only)
        if err:
            errors.append(f"Job {str(job.id)[:8]}: {err}")
        else:
            total_published += count

    if total_published > 0:
        batch.status = 'published'
        batch.published_at = timezone.now()
        batch.published_questions_count = total_published
        batch.save()

        ImportAuditLog.objects.create(
            batch=batch,
            user=batch.created_by,
            action="PUBLISH_BATCH",
            question_reference=f"Batch {batch.name}",
            details={"published_count": total_published, "errors": errors}
        )

    return total_published, ("; ".join(errors) if errors else None)

