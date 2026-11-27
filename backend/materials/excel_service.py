import io
import re
import json
from typing import Dict, List, Tuple, Any, Optional
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from django.db import transaction
from django.utils.text import slugify

from materials.models import (
    SubjectiveQuestion,
    SubQuestion,
    QuestionOption,
    Answer,
    Scenario
)
from master_data.models import (
    CALevel,
    ICAIPaper,
    ICAIChapter,
    ICAITopic
)


# ─────────────────────────────────────────────────────────────────────────────
# 1. TABLE PARSER & RECONSTRUCTION (SPEC PAGE 4 & 6)
# ─────────────────────────────────────────────────────────────────────────────

def split_text_and_tables(cell: str, row_num: int = 0, col_name: str = "Table") -> Tuple[str, List[Dict[str, Any]], Optional[Dict[str, Any]]]:
    """
    Parses inline [TABLE]...[/TABLE] blocks into ordered placeholder tokens
    ([TABLE-1], [TABLE-2], ...) and structured JSON tables.
    Validates table shape: each data row must have the same number of columns as the header.
    Returns: (text_with_placeholders, tables_list, error_dict_if_any)
    """
    if not cell:
        return "", [], None

    cell_str = str(cell).strip()
    if not cell_str:
        return "", [], None

    tables = []
    idx = 0
    error_dict = None

    def repl(m):
        nonlocal idx, error_dict
        idx += 1
        block_content = m.group(1).strip()
        lines = [ln for ln in block_content.splitlines() if ln.strip()]
        if not lines:
            return f"[TABLE-{idx}]"

        grid = [[c.strip() for c in ln.split("|")] for ln in lines]
        header_len = len(grid[0])
        for r_i, r in enumerate(grid[1:], start=2):
            if len(r) != header_len and not error_dict:
                error_dict = {
                    "row": row_num,
                    "column": col_name,
                    "message": f"header has {header_len} columns but a row has {len(r)}"
                }

        tables.append({
            "headers": grid[0],
            "rows": grid[1:],
            "type": "cursor"
        })
        return f"[TABLE-{idx}]"

    text = re.sub(r"\[TABLE\](.*?)\[/TABLE\]", repl, cell_str, flags=re.S)
    return text.strip(), tables, error_dict


def reconstruct_text_with_tables(text: str, table_data: Any) -> str:
    """
    Replaces [TABLE-1], [TABLE_1], etc. back with inline [TABLE]...[/TABLE]
    blocks so Excel export is completely lossless for round-trip editing.
    """
    if not text:
        return ""
    if not table_data:
        return text

    tables = []
    if isinstance(table_data, str):
        try:
            tables = json.loads(table_data)
        except Exception:
            tables = []
    elif isinstance(table_data, list):
        tables = table_data

    if not tables:
        return text

    def repl(m):
        raw_token = m.group(0)
        num_match = re.search(r'\d+', raw_token)
        if not num_match:
            return raw_token
        idx = int(num_match.group(0)) - 1
        if 0 <= idx < len(tables):
            t = tables[idx]
            headers = t.get("headers", [])
            rows = t.get("rows", [])
            block_lines = ["\n[TABLE]", " | ".join(headers)]
            for r in rows:
                block_lines.append(" | ".join(r))
            block_lines.append("[/TABLE]\n")
            return "\n".join(block_lines)
        return raw_token

    return re.sub(r"\[TABLE[_-]\d+\]", repl, text, flags=re.I).strip()


# ─────────────────────────────────────────────────────────────────────────────
# 2. HIERARCHY RESOLUTION (ANY QUALIFICATION: CA, CMA, CS, UPSC, IT)
# ─────────────────────────────────────────────────────────────────────────────

def resolve_or_create_hierarchy(
    qualification: str,
    level_name: str,
    paper_name: str,
    chapter_name: str,
    topic_name: str
) -> Tuple[CALevel, ICAIPaper, ICAIChapter, ICAITopic]:
    """
    Resolves or auto-creates the Qualification -> Level -> Paper -> Chapter -> Topic hierarchy.
    Works for ANY qualification (CA, CMA, CS, UPSC, etc.) without hardcoding.
    """
    qual = qualification.strip().upper() if qualification else "CA"
    lvl_name = level_name.strip() if level_name else f"{qual} Level 1"
    ppr_name = paper_name.strip() if paper_name else "General Paper"
    ch_name = chapter_name.strip() if chapter_name else "General Chapter"
    top_name = topic_name.strip() if topic_name else "General Topic"

    # 1. Level (match on qualification + name or name)
    level_obj = CALevel.objects.filter(name__iexact=lvl_name).first()
    if not level_obj:
        level_obj = CALevel.objects.create(
            qualification=qual,
            name=lvl_name,
            slug=slugify(lvl_name)[:120]
        )
    elif qual and level_obj.qualification.upper() != qual:
        level_obj.qualification = qual
        level_obj.save(update_fields=['qualification'])

    # 2. Paper
    paper_obj = ICAIPaper.objects.filter(level=level_obj, name__iexact=ppr_name).first()
    if not paper_obj:
        paper_obj = ICAIPaper.objects.create(
            level=level_obj,
            name=ppr_name,
            slug=slugify(f"{level_obj.slug}-{ppr_name}")[:200]
        )

    # 3. Chapter
    chapter_obj = ICAIChapter.objects.filter(paper=paper_obj, name__iexact=ch_name).first()
    if not chapter_obj:
        chapter_obj = ICAIChapter.objects.create(
            paper=paper_obj,
            name=ch_name,
            slug=slugify(f"{paper_obj.slug}-{ch_name}")[:300]
        )

    # 4. Topic
    topic_obj = ICAITopic.objects.filter(chapter=chapter_obj, name__iexact=top_name).first()
    if not topic_obj:
        topic_obj = ICAITopic.objects.create(
            chapter=chapter_obj,
            name=top_name,
            slug=slugify(f"{chapter_obj.slug}-{top_name}")[:300]
        )

    return level_obj, paper_obj, chapter_obj, topic_obj


# ─────────────────────────────────────────────────────────────────────────────
# 3. FIELD NORMALIZATION & HELPERS
# ─────────────────────────────────────────────────────────────────────────────

ATTEMPT_MAP = {
    'JAN': 'JAN', 'JANUARY': 'JAN', 'JAN.': 'JAN',
    'MAY': 'MAY',
    'SEP': 'SEP', 'SEPT': 'SEP', 'SEPTEMBER': 'SEP', 'SEP.': 'SEP',
    'NOV': 'NOV', 'NOVEMBER': 'NOV', 'NOV.': 'NOV'
}

def normalize_attempt(raw: Any) -> str:
    if not raw:
        return 'MAY'
    s = str(raw).strip().upper()
    return ATTEMPT_MAP.get(s, s[:3])


def normalize_column_name(h: Any) -> str:
    if not h:
        return ''
    s = str(h).strip().lower()
    s = re.sub(r'[^a-z0-9]', '_', s)
    s = re.sub(r'_+', '_', s).strip('_')
    return s


# Canonical columns as per Developer Spec
SPEC_HEADERS = [
    "Group ID", "Qualification", "Level", "Paper", "Chapter", "Topic",
    "Source", "Year", "Attempt", "Section", "Q No.", "Question Type",
    "Marks", "Difficulty", "Status", "Case Scenario Context",
    "Question Text", "Option A", "Option B", "Option C", "Option D",
    "Correct Option", "Answer / Solution", "Tags", "Is Important"
]


# ─────────────────────────────────────────────────────────────────────────────
# 4. TEMPLATE GENERATOR (QBank_Import_Format.xlsx)
# ─────────────────────────────────────────────────────────────────────────────

def generate_qbank_template(template_type: str = 'all') -> Tuple[io.BytesIO, str]:
    """
    Generates QBank Excel Templates conforming to Developer Spec.
    Supports:
      - 'all': Master 3-in-1 format (QBank_Import_Format.xlsx) containing all 3 question types:
               4 orange rows (Case Scenario Q1-Q4), 2 green rows (Descriptive Problem Q3a-b), 1 standalone MCQ (Q15).
      - 'mcq': Dedicated Standalone MCQ template (QBank_MCQ_Template.xlsx) with 3 diverse MCQ sample rows.
      - 'case_scenario': Dedicated Case Scenario template (QBank_Case_Scenario_Template.xlsx) with 4 linked MCQ sub-questions and shared passage.
      - 'descriptive': Dedicated Descriptive/Practical Problem template (QBank_Descriptive_Problem_Template.xlsx) with 2-col and 3-col in-cell tables.
    """
    wb = openpyxl.Workbook()
    t_norm = (template_type or 'all').strip().lower()

    # ── Sheet 1: Instructions ──
    ws_inst = wb.active
    ws_inst.title = "Instructions"
    ws_inst.views.sheetView[0].showGridLines = True

    title_font = Font(name='Segoe UI', size=15, bold=True, color='0F172A')
    sec_font = Font(name='Segoe UI', size=11, bold=True, color='1E3A5F')
    label_font = Font(name='Segoe UI', size=10, bold=True, color='334155')
    val_font = Font(name='Segoe UI', size=10, color='475569')

    if t_norm in ('mcq', '1_mcq', 'mcqs'):
        inst_title = "QuBook — Excel Question Import: Standalone MCQ Guide & Rules"
        filename = "QBank_MCQ_Template.xlsx"
        guide_items = [
            (4, "1. Universal Hierarchy (Any Qualification Stream)", [
                ("Qualification", "Enter qualification (e.g. CA, CMA, CS, UPSC, IT). The system auto-provisions new streams."),
                ("Level, Paper, Chapter, Topic", "Auto-resolves or creates full hierarchy. Questions appear immediately in student practice."),
            ]),
            (8, "2. MCQ Question Format", [
                ("Group ID", "Leave blank for standalone MCQs."),
                ("Question Type", "Enter MCQ."),
                ("Question Text", "The stem/prompt of the multiple-choice question."),
                ("Options A - D", "Provide clear distractor options in Option A, Option B, Option C, and Option D."),
                ("Correct Option", "Enter A, B, C, or D corresponding to the correct answer."),
                ("Answer / Solution", "Detailed explanation, formula step, or statutory reference explaining why the option is correct.")
            ]),
            (16, "3. Blank Keys / Bonus Questions", [
                ("No Correct Option", "If the exam body declared a question ambiguous or gave no correct option, leave Correct Option blank."),
                ("Explanation", "State the rationale (e.g. 'ICAI gave no correct option') in the Answer / Solution column.")
            ]),
            (20, "4. Deduplication & Safety", [
                ("Dedupe Key", "Level + Paper + Source + Year + Q No."),
                ("Re-importing", "Safely skips existing questions without creating duplicates or overwriting existing student records.")
            ])
        ]
    elif t_norm in ('case_scenario', 'scenario', '2_scenario', 'case'):
        inst_title = "QuBook — Excel Question Import: Case Scenario Guide & Rules"
        filename = "QBank_Case_Scenario_Template.xlsx"
        guide_items = [
            (4, "1. Universal Hierarchy (Any Qualification Stream)", [
                ("Qualification", "Enter qualification (e.g. CA, CMA, CS, UPSC, IT). Auto-provisions streams on the fly."),
                ("Level, Paper, Chapter, Topic", "Auto-resolves or creates full curriculum hierarchy."),
            ]),
            (8, "2. Case Scenario Context & Shared Group ID", [
                ("Group ID", "REQUIRED. Enter the same Group ID (e.g. CS-01) for all sub-questions of this scenario."),
                ("Case Scenario Context", "Paste the full common passage/scenario in this column on every sub-question row."),
                ("Question Type", "Enter MCQ for multiple-choice sub-questions, or DESCRIPTIVE for subjective sub-questions.")
            ]),
            (13, "3. Linked Sub-Questions", [
                ("Q No.", "Enter sub-question number (e.g. 1, 2, 3, 4). Each sub-question row holds its own Question Text & Options."),
                ("Options A - D", "Fill distractor options for each MCQ sub-question."),
                ("Correct Option", "Enter A, B, C, or D. If the question has no correct option (bonus), leave this column blank.")
            ]),
            (18, "4. Deduplication & Multi-Part Linking", [
                ("Dedupe Key", "Level + Paper + Source + Year + Q No. + Group ID."),
                ("Atomic Safety", "All sub-questions are linked under the shared scenario parent. Re-importing safely skips existing.")
            ])
        ]
    elif t_norm in ('descriptive', 'problem', '3_problem', 'practical'):
        inst_title = "QuBook — Excel Question Import: Descriptive / Problem Guide & Rules"
        filename = "QBank_Descriptive_Problem_Template.xlsx"
        guide_items = [
            (4, "1. Universal Hierarchy (Any Qualification Stream)", [
                ("Qualification", "Enter qualification (e.g. CA, CMA, CS, UPSC, IT). Generic hierarchy auto-creation."),
                ("Level, Paper, Chapter, Topic", "Automatically maps into curriculum structure."),
            ]),
            (8, "2. Multi-Part Problems & Group ID", [
                ("Group ID", "Enter common identifier (e.g. Q3) for all sub-parts of the same parent question."),
                ("Q No.", "Enter sub-part label (e.g. 3(a), 3(b), or 1(a), 1(b))."),
                ("Question Type", "Enter DESCRIPTIVE.")
            ]),
            (13, "3. In-Cell Tables Syntax ([TABLE]...[/TABLE])", [
                ("Table Syntax", "Wrap tables between [TABLE] and [/TABLE]. First line = headers. Next lines = data rows."),
                ("Delimiter", "Columns separated by pipe symbol '|'."),
                ("Shape Validation", "CRITICAL: Every data row must have the exact same number of columns as the header row."),
                ("Example", "[TABLE]\nParticulars | Amount (₹)\nSalaries | 18,50,000\nProvident Fund | 1,85,000\n[/TABLE]")
            ]),
            (20, "4. Step-by-Step Solutions & Working Notes", [
                ("Answer / Solution", "Place full working notes, journal entries, and solution tables (wrapped in [TABLE]) here.")
            ])
        ]
    else:
        inst_title = "QuBook — Excel Question Import: Master Guide & Rules"
        filename = "QBank_Import_Format.xlsx"
        guide_items = [
            (4, "1. Universal Hierarchy (Every Course, Not Just CA)", [
                ("Qualification", "Enter qualification (e.g. CA, CMA, CS, UPSC, IT). The importer automatically creates new streams."),
                ("Level, Paper, Chapter, Topic", "Full hierarchy is auto-resolved or created. Imported questions become instantly visible to students."),
            ]),
            (8, "2. Question Types & Group ID", [
                ("Question Type", "Enter MCQ or DESCRIPTIVE. Case Scenario is a wrapper expressed via Group ID + Case Scenario Context."),
                ("Group ID", "Blank = standalone question. Same Group ID across rows = one case scenario or one multi-part question."),
                ("Case Scenario Rows", "Put the passage in 'Case Scenario Context'. Each row holds one sub-question and its answer."),
                ("Descriptive Sub-parts", "Rows with same Group ID (e.g. Q3) without context represent sub-parts (e.g. 3(a), 3(b)).")
            ]),
            (14, "3. In-Cell Tables ([TABLE]...[/TABLE])", [
                ("Table Syntax", "Place tables inline wrapped between [TABLE] and [/TABLE]."),
                ("Row & Column Delimiter", "First line inside block = header row. New lines = data rows. Columns separated by '|'."),
                ("Shape Validation", "Every data row must have the same number of columns as the header row."),
                ("Example", "[TABLE]\nParticulars | Amount (₹)\nSalaries | 12,00,000\nRent | 1,50,000\n[/TABLE]")
            ]),
            (20, "4. MCQ Answers & Blank Keys", [
                ("Correct Option", "Enter A, B, C, or D. If ICAI gave no correct option (e.g. Q4 Jan 2025), leave it blank."),
                ("Options A-D", "Fill at least Option A and Option B for MCQ rows.")
            ]),
            (25, "5. Deduplication & Safety", [
                ("Dedupe Key", "Level + Paper + Source + Year + Q No. (+ Group ID for sub-parts)."),
                ("Re-importing", "Re-importing the same sheet safely skips existing questions with zero duplicates and zero data loss.")
            ])
        ]

    ws_inst.cell(row=1, column=1, value=inst_title).font = title_font
    ws_inst.cell(row=2, column=1, value="Fill the 'Questions' sheet following the specification below:").font = val_font
    ws_inst.row_dimensions[1].height = 26
    ws_inst.row_dimensions[2].height = 20

    for start_r, title, rows in guide_items:
        ws_inst.cell(row=start_r, column=1, value=title).font = sec_font
        for off, (lbl, desc) in enumerate(rows, start=1):
            r = start_r + off
            ws_inst.cell(row=r, column=1, value=f"• {lbl}:").font = label_font
            ws_inst.cell(row=r, column=2, value=desc).font = val_font
            ws_inst.row_dimensions[r].height = 20

    ws_inst.column_dimensions['A'].width = 28
    ws_inst.column_dimensions['B'].width = 110

    # ── Sheet 2: Questions ──
    ws_q = wb.create_sheet(title="Questions")
    ws_q.views.sheetView[0].showGridLines = True

    header_font = Font(name='Segoe UI', size=11, bold=True, color='FFFFFF')
    header_fill = PatternFill(start_color='1E3A5F', end_color='1E3A5F', fill_type='solid')
    header_align = Alignment(horizontal='center', vertical='center', wrap_text=True)
    border_thin = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )

    col_widths = [
        12, 14, 18, 22, 22, 20, 12, 8, 10, 10, 10, 16,
        8, 12, 10, 50, 55, 24, 24, 24, 24, 14, 50, 16, 12
    ]

    ws_q.row_dimensions[1].height = 32
    for col_idx, (hdr, width) in enumerate(zip(SPEC_HEADERS, col_widths), start=1):
        cell = ws_q.cell(row=1, column=col_idx, value=hdr)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_align
        cell.border = border_thin
        col_letter = get_column_letter(col_idx)
        ws_q.column_dimensions[col_letter].width = max(width, 12)
    ws_q.freeze_panes = 'A2'

    # Sample rows from Spec (Real CA Inter Advanced Accounting, Jan 2025)
    cs_passage = (
        "PQR Ltd. is a diversified manufacturing entity in India. During the financial year 2024-25, "
        "the company engaged in several significant commercial transactions:\n"
        "1. On 1st July 2024, PQR Ltd. purchased an intellectual property patent for ₹ 60,00,000 having an estimated life of 10 years.\n"
        "2. Incurred research phase costs of ₹ 10,00,000 and development phase costs of ₹ 18,00,000 compliant with AS 26 capitalization requirements.\n"
        "3. Government grant of ₹ 15,00,000 received on 1st October 2024 toward acquiring non-depreciable freehold land costing ₹ 75,00,000.\n"
        "4. Foreign exchange transaction: Goods imported on 15th January 2025 for US $ 50,000 when 1 USD = ₹ 83.00, remaining unsettled on 31st March 2025 when 1 USD = ₹ 84.50."
    )

    table_q3a = (
        "The following balances were extracted from the ledger of Alpha Ltd. as on 31st March 2025:\n\n"
        "[TABLE]\n"
        "Particulars | Amount (₹)\n"
        "Salaries & Employee Wages | 18,50,000\n"
        "Contribution to Provident Fund | 1,85,000\n"
        "Rent, Rates & Insurance | 4,20,000\n"
        "Audit Fees | 75,000\n"
        "Depreciation on Plant | 3,10,000\n"
        "[/TABLE]\n\n"
        "You are required to calculate the total Employee Benefit Expense as per Schedule III of Companies Act, 2013."
    )

    ans_q3a = (
        "Calculation of Employee Benefit Expense as per Schedule III:\n\n"
        "[TABLE]\n"
        "Particulars | Amount (₹)\n"
        "Salaries & Employee Wages | 18,50,000\n"
        "Contribution to Provident Fund | 1,85,000\n"
        "Total Employee Benefit Expense | 20,35,000\n"
        "[/TABLE]\n\n"
        "Note: Rent, Rates & Insurance and Audit Fees are classified under Other Expenses."
    )

    table_q3b = (
        "Pass necessary journal entries in the books of Alpha Ltd. for provision of employee benefit expenses and tax deduction at source:\n\n"
        "[TABLE]\n"
        "Date | Transaction Details | Gross Amount (₹)\n"
        "31-03-2025 | Outstanding Salaries payable to staff | 2,50,000\n"
        "31-03-2025 | TDS on Professional Consultancy @ 10% | 50,000\n"
        "[/TABLE]"
    )

    ans_q3b = (
        "Journal Entries in the books of Alpha Ltd.:\n\n"
        "[TABLE]\n"
        "Date | Account Head | Dr Amount (₹) | Cr Amount (₹)\n"
        "31-03-2025 | Salaries & Wages A/c Dr. | 2,50,000 | -\n"
        "31-03-2025 | To Outstanding Salaries A/c | - | 2,50,000\n"
        "31-03-2025 | Legal & Professional Fees A/c Dr. | 50,000 | -\n"
        "31-03-2025 | To TDS Payable A/c | - | 5,000\n"
        "31-03-2025 | To Consultant Payable A/c | - | 45,000\n"
        "[/TABLE]"
    )

    cs_sample_rows = [
        [
            "CS-01", "CA", "CA Intermediate", "Advanced Accounting", "Accounting Standards", "Case Scenarios",
            "PYQ", "2025", "JAN", "Part I", "1", "MCQ", 2, "MEDIUM", "ACTIVE",
            cs_passage,
            "What is the amortization expense for the patent for FY 2024-25 (acquired on 1st July 2024)?",
            "₹ 6,00,000", "₹ 4,50,000", "₹ 3,00,000", "Nil",
            "B", "Full year amortization = ₹ 6,00,000. For 9 months = ₹ 4,50,000.", "AS 26, Patent", "Yes"
        ],
        [
            "CS-01", "CA", "CA Intermediate", "Advanced Accounting", "Accounting Standards", "Case Scenarios",
            "PYQ", "2025", "JAN", "Part I", "2", "MCQ", 2, "MEDIUM", "ACTIVE",
            cs_passage,
            "How should the research and development expenditures be recognized as per AS 26?",
            "Both expensed to P&L", "Research ₹ 10L expensed; Development ₹ 18L capitalized", "Both capitalized", "Both deferred over 5 years",
            "B", "Under AS 26, research costs are always expensed. Development costs meeting criteria are capitalized.", "AS 26, R&D", "No"
        ],
        [
            "CS-01", "CA", "CA Intermediate", "Advanced Accounting", "Accounting Standards", "Case Scenarios",
            "PYQ", "2025", "JAN", "Part I", "3", "MCQ", 2, "MEDIUM", "ACTIVE",
            cs_passage,
            "What is the foreign exchange gain or loss to be recognized in P&L on 31st March 2025 as per AS 11?",
            "Loss of ₹ 75,000", "Gain of ₹ 75,000", "Loss of ₹ 1,50,000", "Nil",
            "A", "Exchange difference = 50,000 * (84.50 - 83.00) = ₹ 75,000 (Loss).", "AS 11, Forex", "No"
        ],
        [
            "CS-01", "CA", "CA Intermediate", "Advanced Accounting", "Accounting Standards", "Case Scenarios",
            "PYQ", "2025", "JAN", "Part I", "4", "MCQ", 2, "HARD", "ACTIVE",
            cs_passage,
            "What is the net carrying amount of the freehold land under the capital approach as per AS 12?",
            "₹ 75,00,000", "₹ 60,00,000", "₹ 90,00,000", "Nil",
            "", "ICAI gave no correct option for this question in Jan 2025.", "AS 12, Grants", "No"
        ],
    ]

    desc_sample_rows = [
        [
            "Q3", "CA", "CA Intermediate", "Advanced Accounting", "Financial Statements of Companies", "Practical Problems",
            "PYQ", "2025", "JAN", "Part II", "3(a)", "DESCRIPTIVE", 5, "MEDIUM", "ACTIVE",
            "",
            table_q3a,
            "", "", "", "",
            "", ans_q3a, "Schedule III, Employee Benefit", "Yes"
        ],
        [
            "Q3", "CA", "CA Intermediate", "Advanced Accounting", "Financial Statements of Companies", "Practical Problems",
            "PYQ", "2025", "JAN", "Part II", "3(b)", "DESCRIPTIVE", 5, "MEDIUM", "ACTIVE",
            "",
            table_q3b,
            "", "", "", "",
            "", ans_q3b, "Journal Entries, TDS", "No"
        ],
    ]

    mcq_sample_rows = [
        [
            "", "CA", "CA Intermediate", "Advanced Accounting", "AS 16 Borrowing Costs", "MCQ Practice",
            "RTP", "2025", "JAN", "Part I", "15", "MCQ", 1, "MEDIUM", "ACTIVE",
            "",
            "As per AS 16, capitalization of borrowing costs should be suspended during:",
            "Extended periods in which active development of qualifying asset is interrupted",
            "Temporary delays that are a necessary part of the process of getting an asset ready",
            "Periods when substantial technical and administrative work is being carried out",
            "The construction phase when minor adjustments are underway",
            "A", "According to AS 16 paragraph 17, capitalization of borrowing costs should be suspended during extended periods of interruption.", "AS 16, Borrowing Costs", "No"
        ],
        [
            "", "CA", "CA Intermediate", "Advanced Accounting", "AS 2 Valuation of Inventories", "MCQ Practice",
            "MTP", "2025", "JAN", "Part I", "16", "MCQ", 2, "MEDIUM", "ACTIVE",
            "",
            "A trader purchased goods costing ₹ 5,00,000. At the year-end, the estimated selling price is ₹ 5,10,000 and estimated selling expenses are ₹ 30,000. What is the value of inventory as per AS 2?",
            "₹ 5,00,000", "₹ 4,80,000", "₹ 5,10,000", "₹ 4,70,000",
            "B", "As per AS 2, inventory is valued at lower of Cost (₹ 5,00,000) and Net Realizable Value (₹ 5,10,000 - ₹ 30,000 = ₹ 4,80,000). Hence, ₹ 4,80,000.", "AS 2, Inventories", "Yes"
        ],
        [
            "", "CA", "CA Intermediate", "Advanced Accounting", "Financial Statements of Companies", "MCQ Practice",
            "PYQ", "2024", "NOV", "Part I", "17", "MCQ", 1, "EASY", "ACTIVE",
            "",
            "Under Schedule III Part I of Companies Act 2013, Proposed Dividend declared after the balance sheet date is shown as:",
            "Short-term Provision", "Other Current Liability", "Contingent Liability in Notes to Accounts", "Appropriation from General Reserve",
            "C", "As per AS 4 (Revised) and Schedule III, dividend declared after the balance sheet date is not recognized as a liability, but disclosed in the Notes to Accounts as a Contingent Liability.", "Schedule III, Dividends", "No"
        ]
    ]

    orange_fill = PatternFill(start_color='FFEDD5', end_color='FFEDD5', fill_type='solid') # Soft orange
    green_fill  = PatternFill(start_color='DCFCE7', end_color='DCFCE7', fill_type='solid') # Soft green
    regular_font = Font(name='Segoe UI', size=10)
    left_align   = Alignment(horizontal='left', vertical='top', wrap_text=True)
    center_align = Alignment(horizontal='center', vertical='top', wrap_text=True)

    # Determine which rows and fills to render
    if t_norm in ('mcq', '1_mcq', 'mcqs'):
        sample_rows_to_render = [(r, None) for r in mcq_sample_rows]
    elif t_norm in ('case_scenario', 'scenario', '2_scenario', 'case'):
        sample_rows_to_render = [(r, orange_fill) for r in cs_sample_rows]
    elif t_norm in ('descriptive', 'problem', '3_problem', 'practical'):
        sample_rows_to_render = [(r, green_fill) for r in desc_sample_rows]
    else:
        sample_rows_to_render = (
            [(r, orange_fill) for r in cs_sample_rows] +
            [(r, green_fill) for r in desc_sample_rows] +
            [(mcq_sample_rows[0], None)]
        )

    for r_idx, (row_data, row_fill) in enumerate(sample_rows_to_render, start=2):
        ws_q.row_dimensions[r_idx].height = 28
        for c_idx, val in enumerate(row_data, start=1):
            cell = ws_q.cell(row=r_idx, column=c_idx, value=val)
            cell.font = regular_font
            cell.border = border_thin
            if row_fill:
                cell.fill = row_fill
            # Align text columns left, IDs/codes center
            if c_idx in (16, 17, 18, 19, 20, 21, 23, 24):
                cell.alignment = left_align
            else:
                cell.alignment = center_align

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer, filename


# ─────────────────────────────────────────────────────────────────────────────
# 5. ROBUST BULK EXCEL IMPORTER (DJANGO / DRF)
# ─────────────────────────────────────────────────────────────────────────────

def import_questions_from_excel(file_obj: Any, user: Any) -> Dict[str, Any]:
    """
    Master Excel Importer conforming to Developer Spec:
    - Finds sheet 'Questions' (or processes all data sheets in multi-sheet workbooks).
    - Auto-creates generic hierarchy: Qualification -> Level -> Paper -> Chapter -> Topic.
    - Sets icai_topic and chapter on questions.
    - Recognizes MCQs, Case Scenarios (shared passage + Group ID), Descriptive Problems with sub-parts.
    - Parses inline [TABLE]...[/TABLE] blocks with shape validation.
    - Normalizes attempts (JAN/MAY/SEP/NOV).
    - Deduplicates: Level + Paper + Source + Year + Q No. (+ Group ID).
    - Safe transaction rollback on failure.
    - Returns structured counts and scrollable error/skipped rows list.
    """
    try:
        wb = openpyxl.load_workbook(file_obj, data_only=True)
    except Exception as e:
        return {
            'success': False,
            'error': f'Invalid Excel file: {str(e)}. Please upload a valid .xlsx file.'
        }

    # Identify target data sheets:
    # 1. Prefer sheet explicitly named 'questions'
    target_sheets = []
    for name in wb.sheetnames:
        if name.strip().lower() == 'questions':
            target_sheets = [wb[name]]
            break

    # 2. Otherwise collect all non-instruction sheets (e.g. 1_MCQ_Questions, 2_Case_Scenarios, 3_Descriptive_Problems)
    if not target_sheets:
        target_sheets = [
            wb[name] for name in wb.sheetnames
            if not any(k in name.strip().lower() for k in ('instruct', 'guide', 'help', 'readme'))
        ]

    # 3. Fallback to active sheet
    if not target_sheets:
        target_sheets = [wb.active]

    # Map aliases for flexible header detection
    aliases = {
        'group_id': ['group_id', 'group', 'scenario_id', 'case_scenario_id'],
        'qualification': ['qualification', 'stream', 'course_category'],
        'level': ['level', 'course_level', 'exam_level'],
        'paper': ['paper', 'exam_paper', 'subject'],
        'chapter': ['chapter', 'exam_chapter', 'unit', 'module'],
        'topic': ['topic', 'exam_topic'],
        'source': ['source', 'exam_source'],
        'year': ['year', 'exam_year'],
        'attempt': ['attempt', 'exam_attempt', 'month'],
        'section': ['section', 'part'],
        'q_no': ['q_no', 'question_no', 'qno', 'sub_q_no'],
        'question_type': ['question_type', 'type'],
        'marks': ['marks', 'mark'],
        'difficulty': ['difficulty', 'level_difficulty'],
        'status': ['status'],
        'case_scenario_context': ['case_scenario_context', 'case_passage', 'scenario_passage', 'passage', 'context'],
        'question_text': ['question_text', 'question', 'stem'],
        'option_a': ['option_a', 'a', 'opt_a'],
        'option_b': ['option_b', 'b', 'opt_b'],
        'option_c': ['option_c', 'c', 'opt_c'],
        'option_d': ['option_d', 'd', 'opt_d'],
        'correct_option': ['correct_option', 'correct_answer', 'answer_key'],
        'answer_solution': ['answer_solution', 'answer', 'solution', 'model_answer'],
        'tags': ['tags', 'tag'],
        'is_important': ['is_important', 'important']
    }

    # Required columns check as per spec page 7
    required_canon = [
        ('qualification', 'Qualification'),
        ('level', 'Level'),
        ('paper', 'Paper'),
        ('chapter', 'Chapter'),
        ('topic', 'Topic'),
        ('source', 'Source'),
        ('year', 'Year'),
        ('q_no', 'Q No.'),
        ('question_type', 'Question Type'),
        ('question_text', 'Question Text')
    ]

    # Parse rows into raw data
    data_rows = []
    error_rows = []
    skipped_rows = []

    for ws in target_sheets:
        raw_rows = list(ws.iter_rows(values_only=True))
        if not raw_rows:
            continue

        # Find header row
        header_idx = 0
        while header_idx < len(raw_rows) and not any(raw_rows[header_idx]):
            header_idx += 1
        if header_idx >= len(raw_rows):
            continue

        raw_headers = raw_rows[header_idx]
        header_map = {}
        for c_i, h in enumerate(raw_headers):
            if h is not None:
                norm_h = normalize_column_name(h)
                if norm_h:
                    header_map[norm_h] = c_i

        resolved_cols: Dict[str, Optional[int]] = {}
        for canon, alt_list in aliases.items():
            found = None
            for alt in alt_list:
                if alt in header_map:
                    found = header_map[alt]
                    break
            resolved_cols[canon] = found

        missing_cols = [lbl for canon, lbl in required_canon if resolved_cols.get(canon) is None]
        if missing_cols:
            if len(target_sheets) == 1:
                return {
                    'success': False,
                    'error': f'Missing required columns in sheet "{ws.title}": {", ".join(missing_cols)}'
                }
            continue

        # Helper to extract cell value
        def get_val(r_vals: Tuple, canon: str, default: str = '', cols=resolved_cols) -> str:
            c_i = cols.get(canon)
            if c_i is not None and c_i < len(r_vals) and r_vals[c_i] is not None:
                v = str(r_vals[c_i]).strip()
                return '' if v.lower() in ('none', 'null', 'nan') else v
            return default

        for r_offset, r_vals in enumerate(raw_rows[header_idx + 1:], start=header_idx + 2):
            if not any(r_vals):
                continue

            row_num = r_offset
            q_text = get_val(r_vals, 'question_text')
            q_no = get_val(r_vals, 'q_no')
            q_type_raw = get_val(r_vals, 'question_type').upper()
            qual = get_val(r_vals, 'qualification') or 'CA'
            level = get_val(r_vals, 'level')
            paper = get_val(r_vals, 'paper')
            chapter = get_val(r_vals, 'chapter')
            topic = get_val(r_vals, 'topic')
            source = get_val(r_vals, 'source')
            year = get_val(r_vals, 'year')

            # Check required row values
            missing_fields = []
            if not level: missing_fields.append("Level")
            if not paper: missing_fields.append("Paper")
            if not chapter: missing_fields.append("Chapter")
            if not topic: missing_fields.append("Topic")
            if not source: missing_fields.append("Source")
            if not year: missing_fields.append("Year")
            if not q_no: missing_fields.append("Q No.")
            if not q_type_raw: missing_fields.append("Question Type")
            if not q_text and q_type_raw != 'CASE_SCENARIO':
                missing_fields.append("Question Text")

            if missing_fields:
                error_rows.append({
                    "row": row_num,
                    "column": missing_fields[0],
                    "message": f"Required value missing: {', '.join(missing_fields)}"
                })
                continue

            # Question Type normalization: MCQ or DESCRIPTIVE (or CASE_SCENARIO header)
            q_type = 'MCQ' if 'MCQ' in q_type_raw else ('CASE_SCENARIO' if 'SCENARIO' in q_type_raw else 'DESCRIPTIVE')

            # Attempt normalization
            raw_att = get_val(r_vals, 'attempt')
            attempt = normalize_attempt(raw_att)
            if attempt not in ('JAN', 'MAY', 'SEP', 'NOV'):
                error_rows.append({
                    "row": row_num,
                    "column": "Attempt",
                    "message": f"Attempt '{raw_att}' could not be normalized to JAN, MAY, SEP, or NOV."
                })
                continue

            # MCQ Validation (Spec Page 7):
            # At least two options filled and Correct Option matches a filled option (allow blank only when intended)
            opt_a = get_val(r_vals, 'option_a')
            opt_b = get_val(r_vals, 'option_b')
            opt_c = get_val(r_vals, 'option_c')
            opt_d = get_val(r_vals, 'option_d')
            correct_opt = get_val(r_vals, 'correct_option').upper()

            if q_type == 'MCQ':
                filled_opts = {k: v for k, v in [('A', opt_a), ('B', opt_b), ('C', opt_c), ('D', opt_d)] if v}
                if len(filled_opts) < 2:
                    error_rows.append({
                        "row": row_num,
                        "column": "Option A / B",
                        "message": "MCQ must have at least two options filled (e.g. Option A and Option B)."
                    })
                    continue
                if correct_opt and correct_opt not in filled_opts:
                    error_rows.append({
                        "row": row_num,
                        "column": "Correct Option",
                        "message": f"Correct Option '{correct_opt}' does not match any filled option ({', '.join(filled_opts.keys())})."
                    })
                    continue

            # Table shape validation on Question Text and Answer / Solution
            q_text_clean, q_tables, t_err1 = split_text_and_tables(q_text, row_num, "Question Table")
            if t_err1:
                error_rows.append(t_err1)
                continue

            ans_raw = get_val(r_vals, 'answer_solution')
            ans_clean, ans_tables, t_err2 = split_text_and_tables(ans_raw, row_num, "Answer Table")
            if t_err2:
                error_rows.append(t_err2)
                continue

            # Table shape on Case Scenario Context if present
            context_raw = get_val(r_vals, 'case_scenario_context')
            context_clean, context_tables, t_err3 = split_text_and_tables(context_raw, row_num, "Case Scenario Context Table")
            if t_err3:
                error_rows.append(t_err3)
                continue

            # Marks parsing
            try:
                marks = int(float(get_val(r_vals, 'marks', '1')))
            except Exception:
                marks = 1

            # Difficulty & Status
            diff = get_val(r_vals, 'difficulty', 'MEDIUM').upper()
            if diff not in ('EASY', 'MEDIUM', 'HARD', 'NONE'):
                diff = 'MEDIUM'

            status = get_val(r_vals, 'status', 'ACTIVE').upper()
            if status not in ('ACTIVE', 'PUBLISHED', 'DRAFT', 'ARCHIVED'):
                status = 'ACTIVE'

            group_id = get_val(r_vals, 'group_id')
            section = get_val(r_vals, 'section')
            tags = get_val(r_vals, 'tags')
            is_imp = get_val(r_vals, 'is_important').lower() in ('yes', 'true', '1')

            data_rows.append({
                'row_num': row_num,
                'group_id': group_id,
                'qualification': qual,
                'level': level,
                'paper': paper,
                'chapter': chapter,
                'topic': topic,
                'source': source,
                'year': year,
                'attempt': attempt,
                'section': section,
                'q_no': q_no,
                'question_type': q_type,
                'marks': marks,
                'difficulty': diff,
                'status': status,
                'context': context_clean,
                'context_tables': context_tables,
                'question_text': q_text_clean,
                'question_tables': q_tables,
                'opt_a': opt_a,
                'opt_b': opt_b,
                'opt_c': opt_c,
                'opt_d': opt_d,
                'correct_opt': correct_opt,
                'answer_text': ans_clean,
                'answer_tables': ans_tables,
                'tags': tags,
                'is_important': is_imp
            })

    if not data_rows:
        return {
            'success': False,
            'created_count': 0,
            'skipped_count': 0,
            'error_count': len(error_rows),
            'skipped_rows': [],
            'error_rows': error_rows,
            'message': f"Import aborted with {len(error_rows)} validation error(s)." if error_rows else "The uploaded Excel file contains no valid question rows."
        }

    # ── Grouping Buffer ──
    # Blank Group ID = standalone question (own group)
    # Same Group ID = grouped unit (Case Scenario or Multi-part Question)
    grouped_units: List[List[Dict[str, Any]]] = []
    current_named_groups: Dict[str, List[Dict[str, Any]]] = {}

    for row in data_rows:
        gid = row['group_id']
        if not gid:
            # Standalone question
            grouped_units.append([row])
        else:
            if gid not in current_named_groups:
                current_named_groups[gid] = []
                grouped_units.append(current_named_groups[gid])
            current_named_groups[gid].append(row)

    created_count = 0
    scenarios_created = 0
    problems_created = 0
    mcqs_created = 0

    # ── Process Each Group Inside Atomic Transactions ──
    for group in grouped_units:
        if not group:
            continue

        first_r = group[0]
        group_id = first_r['group_id']
        level_name = first_r['level']
        paper_name = first_r['paper']
        source = first_r['source']
        year = first_r['year']
        q_no_target = group_id if group_id else first_r['q_no']

        # ── Deduplication Check (Spec Page 7) ──
        # Dedupe key = Level + Paper + Source + Year + Q No. (+ Group ID)
        dedupe_qs = SubjectiveQuestion.objects.filter(
            icai_topic__chapter__paper__level__name__iexact=level_name,
            icai_topic__chapter__paper__name__iexact=paper_name,
            source__iexact=source,
            year=year
        )
        if group_id:
            dedupe_qs = dedupe_qs.filter(q_no__iexact=group_id)
        else:
            dedupe_qs = dedupe_qs.filter(q_no__iexact=q_no_target)

        if dedupe_qs.exists():
            skipped_rows.append({
                "row": first_r['row_num'],
                "reason": f"Duplicate question: Level '{level_name}', Paper '{paper_name}', Source '{source}', Year '{year}', Q No '{q_no_target}' already exists."
            })
            continue

        try:
            with transaction.atomic():
                # 1. Resolve Hierarchy
                level_obj, paper_obj, chapter_obj, topic_obj = resolve_or_create_hierarchy(
                    qualification=first_r['qualification'],
                    level_name=level_name,
                    paper_name=paper_name,
                    chapter_name=first_r['chapter'],
                    topic_name=first_r['topic']
                )

                has_scenario_context = any(bool(r['context']) for r in group)

                if has_scenario_context and group_id:
                    # ─────────────────────────────────────────────────────────────
                    # CASE SCENARIO (Shared passage + linked sub-questions)
                    # ─────────────────────────────────────────────────────────────
                    passage = ''
                    passage_tables = []
                    for r in group:
                        if r['context'] and len(r['context']) > len(passage):
                            passage = r['context']
                            passage_tables = r['context_tables']

                    if not passage:
                        passage = f"Case Scenario {group_id}"

                    sub_marks_total = sum(r['marks'] for r in group if r['question_type'] != 'CASE_SCENARIO') or 2

                    parent_q = SubjectiveQuestion.objects.create(
                        question_type='CASE_SCENARIO',
                        q_no=group_id,
                        question_text=passage,
                        case_scenario_passage=passage,
                        table_data=json.dumps(passage_tables) if passage_tables else None,
                        marks=sub_marks_total,
                        difficulty=first_r['difficulty'],
                        status=first_r['status'],
                        source=source,
                        year=year,
                        attempt=first_r['attempt'],
                        section=first_r['section'],
                        tags=first_r['tags'],
                        is_important=first_r['is_important'],
                        icai_topic=topic_obj,
                        chapter=chapter_obj,
                        created_by=user
                    )

                    scenario_obj = Scenario.objects.create(
                        parent_question=parent_q,
                        scenario_text=passage,
                        table_data=json.dumps(passage_tables) if passage_tables else None
                    )
                    parent_q.scenario = scenario_obj
                    parent_q.save(update_fields=['scenario'])

                    # Process each sub-question row
                    for r in group:
                        if r['question_type'] == 'CASE_SCENARIO':
                            # Header row carrying combined scenario answer
                            parent_q.correct_answer = r['answer_text']
                            parent_q.answer_table_data = json.dumps(r['answer_tables']) if r['answer_tables'] else None
                            parent_q.save(update_fields=['correct_answer', 'answer_table_data'])
                            if r['answer_text']:
                                Answer.objects.create(
                                    question=parent_q,
                                    answer_content=r['answer_text'],
                                    matching_status='matched'
                                )
                            continue

                        sub_q_no = r['q_no']
                        is_mcq = (r['question_type'] == 'MCQ')
                        correct_opt_letter = r['correct_opt']
                        correct_ans_val = (f"Option {correct_opt_letter}" if correct_opt_letter else "") if is_mcq else (r['answer_text'] or "")

                        # Child SubjectiveQuestion
                        child_q = SubjectiveQuestion.objects.create(
                            parent_question=parent_q,
                            scenario=scenario_obj,
                            question_type='MCQ' if is_mcq else 'NORMAL',
                            q_no=sub_q_no,
                            sub_question_number=sub_q_no,
                            question_text=r['question_text'],
                            table_data=json.dumps(r['question_tables']) if r['question_tables'] else None,
                            correct_answer=correct_ans_val,
                            explanation=r['answer_text'] or "",
                            answer_table_data=json.dumps(r['answer_tables']) if r['answer_tables'] else None,
                            marks=r['marks'],
                            difficulty=r['difficulty'],
                            status=r['status'],
                            source=source,
                            year=year,
                            attempt=r['attempt'],
                            section=r['section'],
                            tags=r['tags'],
                            is_important=r['is_important'],
                            icai_topic=topic_obj,
                            chapter=chapter_obj,
                            created_by=user
                        )

                        # SubQuestion record
                        sub_q = SubQuestion.objects.create(
                            parent_question=parent_q,
                            scenario=scenario_obj,
                            identifier=sub_q_no,
                            sub_question_number=sub_q_no,
                            question_text=r['question_text'],
                            question_type='MCQ' if is_mcq else 'NORMAL',
                            marks=r['marks'],
                            correct_answer=correct_ans_val,
                            table_data=json.dumps(r['question_tables']) if r['question_tables'] else None,
                            answer_table_data=json.dumps(r['answer_tables']) if r['answer_tables'] else None,
                            matching_status='matched'
                        )

                        # MCQ Options attached to both child question and sub-question
                        if is_mcq:
                            opts = [('A', r['opt_a']), ('B', r['opt_b']), ('C', r['opt_c']), ('D', r['opt_d'])]
                            for ltr, text in opts:
                                if text:
                                    is_corr = (ltr == correct_opt_letter if correct_opt_letter else False)
                                    QuestionOption.objects.create(
                                        question=child_q,
                                        sub_question=sub_q,
                                        text=text,
                                        is_correct=is_corr,
                                        order=ord(ltr) - ord('A') + 1
                                    )

                        # Answer record for the sub-question
                        ans_content = r['answer_text'] or (f"Correct Option: {correct_opt_letter}" if correct_opt_letter else "")
                        Answer.objects.create(
                            question=parent_q,
                            sub_question=sub_q,
                            answer_content=ans_content,
                            matching_status='matched'
                        )

                    scenarios_created += 1
                    created_count += 1

                elif len(group) > 1 and group_id:
                    # ─────────────────────────────────────────────────────────────
                    # MULTI-PART QUESTION (e.g. 3(a), 3(b))
                    # ─────────────────────────────────────────────────────────────
                    total_marks = sum(r['marks'] for r in group) or 5

                    parent_q = SubjectiveQuestion.objects.create(
                        question_type='NORMAL',
                        q_no=group_id,
                        question_text=f"Question {group_id}",
                        marks=total_marks,
                        difficulty=first_r['difficulty'],
                        status=first_r['status'],
                        source=source,
                        year=year,
                        attempt=first_r['attempt'],
                        section=first_r['section'],
                        tags=first_r['tags'],
                        is_important=first_r['is_important'],
                        icai_topic=topic_obj,
                        chapter=chapter_obj,
                        created_by=user
                    )

                    for r in group:
                        part_no = r['q_no']
                        is_mcq = (r['question_type'] == 'MCQ')
                        correct_opt_letter = r['correct_opt']
                        correct_ans_val = (f"Option {correct_opt_letter}" if correct_opt_letter else "") if is_mcq else (r['answer_text'] or "")

                        child_q = SubjectiveQuestion.objects.create(
                            parent_question=parent_q,
                            question_type='MCQ' if is_mcq else 'NORMAL',
                            q_no=part_no,
                            sub_question_number=part_no,
                            question_text=r['question_text'],
                            table_data=json.dumps(r['question_tables']) if r['question_tables'] else None,
                            correct_answer=correct_ans_val,
                            explanation=r['answer_text'] or "",
                            answer_table_data=json.dumps(r['answer_tables']) if r['answer_tables'] else None,
                            marks=r['marks'],
                            difficulty=r['difficulty'],
                            status=r['status'],
                            source=source,
                            year=year,
                            attempt=r['attempt'],
                            section=r['section'],
                            tags=r['tags'],
                            is_important=r['is_important'],
                            icai_topic=topic_obj,
                            chapter=chapter_obj,
                            created_by=user
                        )

                        sub_q = SubQuestion.objects.create(
                            parent_question=parent_q,
                            identifier=part_no,
                            sub_question_number=part_no,
                            question_text=r['question_text'],
                            question_type='MCQ' if is_mcq else 'NORMAL',
                            marks=r['marks'],
                            correct_answer=correct_ans_val,
                            table_data=json.dumps(r['question_tables']) if r['question_tables'] else None,
                            answer_table_data=json.dumps(r['answer_tables']) if r['answer_tables'] else None,
                            matching_status='matched'
                        )

                        if is_mcq:
                            opts = [('A', r['opt_a']), ('B', r['opt_b']), ('C', r['opt_c']), ('D', r['opt_d'])]
                            for ltr, text in opts:
                                if text:
                                    is_corr = (ltr == correct_opt_letter if correct_opt_letter else False)
                                    QuestionOption.objects.create(
                                        question=child_q,
                                        sub_question=sub_q,
                                        text=text,
                                        is_correct=is_corr,
                                        order=ord(ltr) - ord('A') + 1
                                    )

                        ans_content = r['answer_text'] or (f"Correct Option: {correct_opt_letter}" if correct_opt_letter else "")
                        Answer.objects.create(
                            question=parent_q,
                            sub_question=sub_q,
                            answer_content=ans_content,
                            matching_status='matched'
                        )

                    problems_created += 1
                    created_count += 1

                else:
                    # ─────────────────────────────────────────────────────────────
                    # STANDALONE QUESTION (One row, e.g. Q15)
                    # ─────────────────────────────────────────────────────────────
                    r = first_r
                    is_mcq = (r['question_type'] == 'MCQ')
                    correct_opt_letter = r['correct_opt']
                    correct_ans_val = (f"Option {correct_opt_letter}" if correct_opt_letter else "") if is_mcq else (r['answer_text'] or "")

                    q = SubjectiveQuestion.objects.create(
                        question_type='MCQ' if is_mcq else 'NORMAL',
                        q_no=r['q_no'],
                        question_text=r['question_text'],
                        table_data=json.dumps(r['question_tables']) if r['question_tables'] else None,
                        correct_answer=correct_ans_val,
                        explanation=r['answer_text'] or "",
                        answer_table_data=json.dumps(r['answer_tables']) if r['answer_tables'] else None,
                        marks=r['marks'],
                        difficulty=r['difficulty'],
                        status=r['status'],
                        source=source,
                        year=year,
                        attempt=r['attempt'],
                        section=r['section'],
                        tags=r['tags'],
                        is_important=r['is_important'],
                        icai_topic=topic_obj,
                        chapter=chapter_obj,
                        created_by=user
                    )

                    if is_mcq:
                        opts = [('A', r['opt_a']), ('B', r['opt_b']), ('C', r['opt_c']), ('D', r['opt_d'])]
                        for ltr, text in opts:
                            if text:
                                is_corr = (ltr == correct_opt_letter if correct_opt_letter else False)
                                QuestionOption.objects.create(
                                    question=q,
                                    text=text,
                                    is_correct=is_corr,
                                    order=ord(ltr) - ord('A') + 1
                                )
                        mcqs_created += 1
                    else:
                        problems_created += 1

                    ans_content = r['answer_text'] or (f"Correct Option: {correct_opt_letter}" if correct_opt_letter else "")
                    if ans_content:
                        Answer.objects.create(
                            question=q,
                            answer_content=ans_content,
                            matching_status='matched'
                        )

                    created_count += 1

        except Exception as e:
            error_rows.append({
                "row": first_r['row_num'],
                "column": "Database Error",
                "message": f"Failed to save question {q_no_target}: {str(e)}"
            })

    # Summary report
    details = []
    if mcqs_created: details.append(f"{mcqs_created} standalone MCQ(s)")
    if scenarios_created: details.append(f"{scenarios_created} Case Scenario(s)")
    if problems_created: details.append(f"{problems_created} Descriptive Problem(s)")

    msg = f"Import complete: {created_count} question(s) created"
    if details:
        msg += f" ({', '.join(details)})"
    msg += f", {len(skipped_rows)} skipped (duplicates), {len(error_rows)} error(s)."

    return {
        'success': created_count > 0,
        'created_count': created_count,
        'skipped_count': len(skipped_rows),
        'error_count': len(error_rows),
        'skipped_rows': skipped_rows[:15],
        'error_rows': error_rows[:15],
        'message': msg
    }


# ─────────────────────────────────────────────────────────────────────────────
# 6. LOSSLESS ROUND-TRIP EXPORT (SPEC PAGE 6)
# ─────────────────────────────────────────────────────────────────────────────

def export_questions_to_excel(queryset=None) -> Tuple[io.BytesIO, str]:
    """
    Exports questions to Excel emitting the exact round-trip columns so
    export -> edit -> re-import is 100% lossless.
    Reconstructs inline [TABLE]...[/TABLE] blocks from table_data and answer_table_data.
    Emits scenario sub-questions and multi-parts with Group ID and Case Scenario Context.
    """
    if queryset is None:
        queryset = SubjectiveQuestion.objects.select_related(
            'icai_topic', 'icai_topic__chapter', 'icai_topic__chapter__paper',
            'icai_topic__chapter__paper__level', 'scenario', 'parent_question'
        ).prefetch_related('options', 'parts', 'answer_records', 'child_questions').order_by('id')

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Questions"
    ws.views.sheetView[0].showGridLines = True

    header_font = Font(name='Segoe UI', size=11, bold=True, color='FFFFFF')
    header_fill = PatternFill(start_color='1E3A5F', end_color='1E3A5F', fill_type='solid')
    header_align = Alignment(horizontal='center', vertical='center', wrap_text=True)
    border_thin = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )

    col_widths = [
        12, 14, 18, 22, 22, 20, 12, 8, 10, 10, 10, 16,
        8, 12, 10, 50, 55, 24, 24, 24, 24, 14, 50, 16, 12
    ]

    ws.row_dimensions[1].height = 32
    for col_idx, (hdr, width) in enumerate(zip(SPEC_HEADERS, col_widths), start=1):
        cell = ws.cell(row=1, column=col_idx, value=hdr)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_align
        cell.border = border_thin
        col_letter = get_column_letter(col_idx)
        ws.column_dimensions[col_letter].width = max(width, 12)
    ws.freeze_panes = 'A2'

    regular_font = Font(name='Segoe UI', size=10)
    left_align   = Alignment(horizontal='left', vertical='top', wrap_text=True)
    center_align = Alignment(horizontal='center', vertical='top', wrap_text=True)

    current_row = 2

    def format_row(q_obj, group_id="", context_str="", is_child=False):
        nonlocal current_row

        # Hierarchy
        qual = "CA"
        lvl = ""
        ppr = ""
        ch = ""
        top = ""
        if q_obj.icai_topic:
            top = q_obj.icai_topic.name
            if q_obj.icai_topic.chapter:
                ch = q_obj.icai_topic.chapter.name
                if q_obj.icai_topic.chapter.paper:
                    ppr = q_obj.icai_topic.chapter.paper.name
                    if q_obj.icai_topic.chapter.paper.level:
                        lvl = q_obj.icai_topic.chapter.paper.level.name
                        qual = q_obj.icai_topic.chapter.paper.level.qualification

        # Question Type
        q_type_str = "MCQ" if q_obj.question_type == 'MCQ' else "DESCRIPTIVE"
        if q_obj.question_type == 'CASE_SCENARIO' and not is_child:
            q_type_str = "CASE_SCENARIO"

        # Reconstruct Question Text with inline tables
        q_text_full = reconstruct_text_with_tables(q_obj.question_text, q_obj.table_data)

        # Reconstruct Answer Text with inline tables
        ans_obj = q_obj.answer_records.first()
        raw_ans = ans_obj.answer_content if ans_obj else (q_obj.correct_answer or "")
        ans_full = reconstruct_text_with_tables(raw_ans, q_obj.answer_table_data)

        # Options A, B, C, D
        opt_a, opt_b, opt_c, opt_d = "", "", "", ""
        correct_opt = ""
        options = list(q_obj.options.all().order_by('order'))
        for idx, o in enumerate(options):
            if idx == 0: opt_a = o.text
            elif idx == 1: opt_b = o.text
            elif idx == 2: opt_c = o.text
            elif idx == 3: opt_d = o.text
            if o.is_correct:
                correct_opt = chr(65 + idx)

        row_vals = [
            group_id,
            qual,
            lvl,
            ppr,
            ch,
            top,
            q_obj.source,
            q_obj.year,
            q_obj.attempt,
            q_obj.section or "",
            q_obj.q_no,
            q_type_str,
            q_obj.marks,
            q_obj.difficulty,
            q_obj.status,
            context_str,
            q_text_full,
            opt_a,
            opt_b,
            opt_c,
            opt_d,
            correct_opt,
            ans_full,
            q_obj.tags or "",
            "Yes" if q_obj.is_important else "No"
        ]

        ws.row_dimensions[current_row].height = 24
        for c_idx, val in enumerate(row_vals, start=1):
            cell = ws.cell(row=current_row, column=c_idx, value=val)
            cell.font = regular_font
            cell.border = border_thin
            if c_idx in (16, 17, 18, 19, 20, 21, 23, 24):
                cell.alignment = left_align
            else:
                cell.alignment = center_align

        current_row += 1

    # Iterate through root questions
    root_questions = queryset.filter(parent_question__isnull=True)
    for q in root_questions:
        if q.question_type == 'CASE_SCENARIO':
            # Export children with Group ID and Case Scenario Context
            gid = q.q_no
            ctx = reconstruct_text_with_tables(q.case_scenario_passage or q.question_text, q.table_data)
            children = q.child_questions.all().order_by('id')
            if children.exists():
                for ch_q in children:
                    format_row(ch_q, group_id=gid, context_str=ctx, is_child=True)
            else:
                # Scenario without child questions: export parent
                format_row(q, group_id=gid, context_str=ctx)

        elif q.parts.exists() or q.child_questions.exists():
            # Multi-part question
            gid = q.q_no
            children = q.child_questions.all().order_by('id')
            if children.exists():
                for ch_q in children:
                    format_row(ch_q, group_id=gid, is_child=True)
            else:
                format_row(q, group_id=gid)
        else:
            # Standalone question
            format_row(q, group_id="")

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer, "QBank_Exported_Questions.xlsx"
