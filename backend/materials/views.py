from rest_framework import viewsets, permissions
from rest_framework.pagination import PageNumberPagination
from materials.models import QuestionPaper, AnswerPaper, Notes, Video, MCQ, Bookmark, SubjectiveQuestion, Feedback
from materials.serializers import (
    QuestionPaperSerializer, AnswerPaperSerializer, NotesSerializer, 
    VideoSerializer, MCQSerializer, BookmarkSerializer, SubjectiveQuestionSerializer, FeedbackSerializer
)
from rest_framework.views import APIView
from rest_framework.response import Response
from courses.models import Subject
from django.contrib.auth import get_user_model
User = get_user_model()
from authentication.permissions import IsSuperUser

class IsStaffOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user and request.user.is_staff


class QuestionPagination(PageNumberPagination):
    """50 questions per page. Supports ?page=N&page_size=N (max 200)."""
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 200


class SubjectiveQuestionViewSet(viewsets.ModelViewSet):
    serializer_class = SubjectiveQuestionSerializer
    permission_classes = [IsStaffOrReadOnly]
    pagination_class = QuestionPagination

    def get_queryset(self):
        queryset = SubjectiveQuestion.objects.select_related(
            'subject', 'topic', 'sub_topic', 'icai_topic',
            'icai_topic__chapter', 'icai_topic__chapter__paper',
        ).prefetch_related(
            'parts',
            'parts__options',
            'options',
        )

        params = self.request.query_params

        subject_id = params.get('subject_id')
        if subject_id:
            queryset = queryset.filter(subject_id=subject_id)

        topic_id = params.get('topic_id')
        if topic_id:
            queryset = queryset.filter(topic_id=topic_id)

        icai_topic_id = params.get('icai_topic_id')
        if icai_topic_id:
            queryset = queryset.filter(icai_topic_id=icai_topic_id)

        chapter_id = params.get('chapter_id')
        if chapter_id:
            queryset = queryset.filter(icai_topic__chapter_id=chapter_id)

        paper_id = params.get('paper_id')
        if paper_id:
            queryset = queryset.filter(icai_topic__chapter__paper_id=paper_id)

        status = params.get('status')
        if status:
            queryset = queryset.filter(status=status)

        question_type = params.get('question_type')
        if question_type:
            queryset = queryset.filter(question_type=question_type)

        difficulty = params.get('difficulty')
        if difficulty:
            queryset = queryset.filter(difficulty=difficulty)

        search = params.get('search')
        if search:
            from django.db.models import Q
            queryset = queryset.filter(
                Q(question_text__icontains=search) |
                Q(q_no__icontains=search) |
                Q(tags__icontains=search)
            )

        return queryset.order_by('topic__order', 'id')

class QuestionPaperViewSet(viewsets.ModelViewSet):
    queryset = QuestionPaper.objects.all()
    serializer_class = QuestionPaperSerializer
    permission_classes = [IsStaffOrReadOnly]

class AnswerPaperViewSet(viewsets.ModelViewSet):
    queryset = AnswerPaper.objects.all()
    serializer_class = AnswerPaperSerializer
    permission_classes = [IsStaffOrReadOnly]

class NotesViewSet(viewsets.ModelViewSet):
    queryset = Notes.objects.all()
    serializer_class = NotesSerializer
    permission_classes = [IsStaffOrReadOnly]

class VideoViewSet(viewsets.ModelViewSet):
    queryset = Video.objects.all()
    serializer_class = VideoSerializer
    permission_classes = [IsStaffOrReadOnly]

class MCQViewSet(viewsets.ModelViewSet):
    queryset = MCQ.objects.all()
    serializer_class = MCQSerializer
    permission_classes = [IsStaffOrReadOnly]

class BookmarkViewSet(viewsets.ModelViewSet):
    serializer_class = BookmarkSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Bookmark.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

from .models import Feedback
from .serializers import FeedbackSerializer

class FeedbackViewSet(viewsets.ModelViewSet):
    serializer_class = FeedbackSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Admin can view all, users view their own
        if self.request.user.is_staff:
            return Feedback.objects.all()
        return Feedback.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class AdminDashboardStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsSuperUser]

    def get(self, request):
        from django.db.models import Sum
        from django.utils import timezone
        from subscriptions.models import Payment, UserSubscription
        from authentication.models import User

        # Calculate revenue & active subscriptions
        revenue_data = Payment.objects.filter(status='SUCCESS').aggregate(total=Sum('amount'))
        total_revenue = float(revenue_data['total'] or 0.0)
        
        active_subs_count = UserSubscription.objects.filter(is_active=True, end_date__gte=timezone.now()).count()
        
        # Unpaid student users (no active subscription)
        active_sub_user_ids = UserSubscription.objects.filter(
            is_active=True, 
            end_date__gte=timezone.now()
        ).values_list('user_id', flat=True).distinct()
        
        unpaid_students_count = User.objects.filter(is_staff=False).exclude(id__in=active_sub_user_ids).count()

        # Calculate monthly stats for the last 6 months dynamically
        import datetime
        monthly_stats = []
        for i in range(5, -1, -1):
            year = timezone.now().year
            month = timezone.now().month - i
            while month <= 0:
                month += 12
                year -= 1
                
            month_start = datetime.datetime(year, month, 1, tzinfo=datetime.timezone.utc)
            if month == 12:
                month_end = datetime.datetime(year + 1, 1, 1, tzinfo=datetime.timezone.utc)
            else:
                month_end = datetime.datetime(year, month + 1, 1, tzinfo=datetime.timezone.utc)
                
            rev = Payment.objects.filter(
                status='SUCCESS',
                created_at__gte=month_start,
                created_at__lt=month_end
            ).aggregate(total=Sum('amount'))['total'] or 0.0
            
            users = User.objects.filter(
                date_joined__gte=month_start,
                date_joined__lt=month_end
            ).count()
            
            monthly_stats.append({
                "month": month_start.strftime('%b'),
                "revenue": float(rev),
                "users": users
            })

        stats = {
            "total_questions": SubjectiveQuestion.objects.count(),
            "total_subjects": Subject.objects.count(),
            "mcq_questions": MCQ.objects.count(),
            "theory_questions": SubjectiveQuestion.objects.count(),
            "total_users": User.objects.count(),
            "total_uploads": QuestionPaper.objects.count() + SubjectiveQuestion.objects.count(),
            "total_revenue": total_revenue,
            "active_subscriptions": active_subs_count,
            "unpaid_students": unpaid_students_count,
            "recent_activity": [],
            "monthly_charts": monthly_stats
        }

        # Add recent questions to activity
        recent_questions = SubjectiveQuestion.objects.order_by('-created_at')[:5]
        for q in recent_questions:
            stats["recent_activity"].append({
                "type": "question",
                "text": f"New question added for {q.topic.name if q.topic else 'Subject'}",
                "user": "System",
                "time": q.created_at
            })

        # Add recent feedbacks to activity
        recent_feedbacks = Feedback.objects.order_by('-created_at')[:5]
        for f in recent_feedbacks:
            stats["recent_activity"].append({
                "type": "feedback",
                "text": f"New feedback: {f.message[:50]}...",
                "user": f.user.email,
                "time": f.created_at
            })

        # Add recent user signups to activity
        recent_users = User.objects.order_by('-date_joined')[:5]
        for u in recent_users:
            stats["recent_activity"].append({
                "type": "user",
                "text": f"New user registered: {u.first_name} {u.last_name}",
                "user": u.email,
                "time": u.date_joined
            })

        # Sort combined activity by time
        stats["recent_activity"].sort(key=lambda x: x["time"], reverse=True)
        stats["recent_activity"] = stats["recent_activity"][:10]

        return Response(stats)


# ─────────────────────────────────────────────────────────────
# Excel Export: GET /api/materials/questions/export-excel/
# Downloads all SubjectiveQuestions as a formatted .xlsx file
# ─────────────────────────────────────────────────────────────
import io
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from django.http import HttpResponse

class ExportQuestionsExcelView(APIView):
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]

    def get(self, request):
        questions = SubjectiveQuestion.objects.select_related(
            'subject', 'topic', 'icai_topic'
        ).order_by('-created_at')

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Questions"

        # ── Styles ──
        header_font   = Font(bold=True, color="FFFFFF", size=11)
        header_fill   = PatternFill("solid", fgColor="1E3A5F")
        center_align  = Alignment(horizontal="center", vertical="center", wrap_text=True)
        left_align    = Alignment(horizontal="left",   vertical="top",    wrap_text=True)
        thin_border   = Border(
            left=Side(style='thin'), right=Side(style='thin'),
            top=Side(style='thin'), bottom=Side(style='thin')
        )
        alt_fill      = PatternFill("solid", fgColor="EEF2FF")

        # ── Column headers ──
        headers = [
            "ID", "Source", "Year", "Attempt", "Section", "Q No.",
            "Question Type", "Marks", "Difficulty", "Status",
            "Question Text", "Correct Answer",
            "Subject", "Topic", "ICAI Path",
            "Tags", "Is Important", "Created At"
        ]
        col_widths = [6, 10, 6, 8, 8, 8, 12, 7, 10, 10, 60, 60, 20, 20, 30, 20, 12, 18]

        for col_idx, (header, width) in enumerate(zip(headers, col_widths), start=1):
            cell = ws.cell(row=1, column=col_idx, value=header)
            cell.font      = header_font
            cell.fill      = header_fill
            cell.alignment = center_align
            cell.border    = thin_border
            ws.column_dimensions[get_column_letter(col_idx)].width = width

        ws.row_dimensions[1].height = 30
        ws.freeze_panes = "A2"

        # ── Data rows ──
        for row_idx, q in enumerate(questions, start=2):
            fill = alt_fill if row_idx % 2 == 0 else PatternFill()
            values = [
                q.id,
                q.source,
                q.year,
                q.attempt,
                q.section or "",
                q.q_no,
                q.question_type,
                q.marks,
                q.difficulty,
                q.status,
                q.question_text or "",
                q.correct_answer or "",
                q.subject.name if q.subject else "",
                q.topic.name   if q.topic   else "",
                q.icai_path    if q.icai_topic_id else "",
                q.tags or "",
                "Yes" if q.is_important else "No",
                q.created_at.strftime("%Y-%m-%d %H:%M") if q.created_at else "",
            ]
            for col_idx, value in enumerate(values, start=1):
                cell = ws.cell(row=row_idx, column=col_idx, value=value)
                cell.border    = thin_border
                cell.fill      = fill
                cell.alignment = left_align if col_idx in (11, 12) else center_align

        # ── Download response ──
        buffer = io.BytesIO()
        wb.save(buffer)
        buffer.seek(0)
        response = HttpResponse(
            buffer.read(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = 'attachment; filename="QBank_Questions.xlsx"'
        return response


# ─────────────────────────────────────────────────────────────
# Excel Import: POST /api/materials/questions/import-excel/
# Reads uploaded .xlsx and bulk-creates questions
# Required columns: source, year, attempt, q_no, question_text
# ─────────────────────────────────────────────────────────────
from rest_framework.parsers import MultiPartParser
from courses.models import Subject

class ImportQuestionsExcelView(APIView):
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]
    parser_classes     = [MultiPartParser]

    REQUIRED_COLS = {'source', 'year', 'attempt', 'q_no', 'question_text'}

    def post(self, request):
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'error': 'No file uploaded. Send the Excel file as form-data field "file".'}, status=400)

        try:
            wb = openpyxl.load_workbook(file_obj, read_only=True, data_only=True)
        except Exception:
            return Response({'error': 'Invalid Excel file. Please upload a valid .xlsx file.'}, status=400)

        ws = wb.active
        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            return Response({'error': 'The Excel file is empty.'}, status=400)

        # ── Map header names to column indexes ──
        raw_headers = rows[0]
        headers = {str(h).strip().lower().replace(' ', '_'): idx for idx, h in enumerate(raw_headers) if h}

        missing = self.REQUIRED_COLS - headers.keys()
        if missing:
            return Response({
                'error': f'Missing required columns: {", ".join(missing)}',
                'hint':  'Required: source, year, attempt, q_no, question_text'
            }, status=400)

        created, skipped, errors = [], [], []

        for row_num, row in enumerate(rows[1:], start=2):
            def val(col, default=''):
                idx = headers.get(col)
                return str(row[idx]).strip() if idx is not None and row[idx] is not None else default

            source = val('source')
            year   = val('year')
            attempt = val('attempt', 'MAY').upper()
            q_no   = val('q_no')
            q_text = val('question_text')

            if not all([source, year, q_no, q_text]):
                skipped.append(f"Row {row_num}: missing required values.")
                continue

            # Look up subject by name (optional)
            subject = None
            subj_name = val('subject')
            if subj_name:
                subject = Subject.objects.filter(name__iexact=subj_name).first()

            try:
                q = SubjectiveQuestion.objects.create(
                    source         = source,
                    year           = year,
                    attempt        = attempt,
                    section        = val('section', ''),
                    q_no           = q_no,
                    question_text  = q_text,
                    correct_answer = val('correct_answer') or val('answer', ''),
                    marks          = int(val('marks', '1') or 1),
                    difficulty     = val('difficulty', 'MEDIUM').upper(),
                    question_type  = val('question_type', 'NORMAL').upper(),
                    tags           = val('tags', ''),
                    is_important   = val('is_important', 'no').lower() in ('yes', 'true', '1'),
                    status         = 'ACTIVE',
                    subject        = subject,
                )
                created.append(q.id)
            except Exception as e:
                errors.append(f"Row {row_num}: {str(e)}")

        return Response({
            'message':       f'Import complete. {len(created)} created, {len(skipped)} skipped, {len(errors)} errors.',
            'created_count': len(created),
            'skipped_count': len(skipped),
            'error_count':   len(errors),
            'skipped_rows':  skipped[:10],
            'error_rows':    errors[:10],
        }, status=201 if created else 400)


# ─────────────────────────────────────────────────────────────
# PDF Question Extraction: POST /api/materials/questions/extract-from-pdf/
# Accepts a PDF file, extracts text (or renders pages for scanned PDFs),
# sends to Gemini 1.5 Flash, returns structured question JSON for review.
# ─────────────────────────────────────────────────────────────
import fitz  # PyMuPDF
import base64
import json
import re
import requests as http_requests

EXTRACTION_PROMPT = """You are an expert CA (Chartered Accountancy) exam question extractor.

Your task: Extract ALL questions from the provided CA exam paper PDF content and return them as a strict JSON array.

EXTRACTION RULES:
1. Extract EVERY question — numbered (Q1, 1(a), Question 1) or unnumbered.
2. For each question produce this exact JSON structure:
{
  "q_no": "1",                    // Question number as string, e.g. "1", "1(a)", "2(b)(ii)"
  "question_text": "...",         // Full question statement including all sub-text
  "correct_answer": null,         // Model answer / solution if present in the document, else null
  "table_data": null,             // If QUESTION has a table → {"headers":["Col1","Col2"],"rows":[["v1","v2"]]}
  "answer_table_data": null,      // If ANSWER/SOLUTION has tables/ledgers/journals → same format
  "marks": 10,                    // Marks as integer. Default 10 if not stated.
  "question_type": "NORMAL",      // "NORMAL" | "MCQ" | "MIXED" | "THEORY"
  "difficulty": "MEDIUM",         // "EASY" | "MEDIUM" | "HARD" — estimate by question complexity
  "sub_questions": []             // Array of sub-parts if any, each: {"identifier":"a","question_text":"...","correct_answer":null,"table_data":null,"answer_table_data":null,"marks":5}
}

TABLE DETECTION RULES (CRITICAL):
- Convert ALL tables to JSON format: {"headers": [...], "rows": [[...]]}
- This includes: ledger accounts, journal entries, trial balance, P&L account, balance sheet, cash flow, ratio analysis, cost sheets, reconciliation statements
- Preserve ALL column headers and ALL rows accurately
- If a table has merged cells or totals rows, include them as separate rows
- Never leave table data as plain text — always convert to JSON

SUB-QUESTION RULES:
- If a question has parts (a), (b), (c) or (i), (ii), (iii) — put the intro in question_text, parts in sub_questions[]
- Each sub-question identifier should be just the part label: "a", "b", "i", "ii"
- Sub-questions can themselves have table_data and answer_table_data

MCQ RULES:
- Set question_type to "MCQ"
- Include all options (A), (B), (C), (D) in question_text
- If answer is given, put it in correct_answer as the letter, e.g. "C"

IMPORTANT:
- Return ONLY a valid JSON array — no markdown, no code blocks, no explanation
- Never invent data — extract only what is actually in the document
- Preserve all numbers, figures, and technical terminology exactly

JSON array output:
"""

# ─────────────────────────────────────────────────────────────
# Deterministic Non-AI PDF Question Extractor & Parser Engine
# ─────────────────────────────────────────────────────────────
import re
import json
import base64

def convert_table_to_html(data):
    if not data or not data[0]:
        return ""
    headers = [str(h or '').strip() for h in data[0]]
    rows = data[1:]
    
    html = '<div class="overflow-x-auto my-3"><table class="w-full border-collapse border border-slate-300 text-xs font-mono">'
    html += '<thead><tr class="bg-slate-100">'
    for h in headers:
        html += f'<th class="border border-slate-300 px-3 py-1.5 font-bold text-left">{h}</th>'
    html += '</tr></thead><tbody>'
    for r in rows:
        html += '<tr>'
        for cell in r:
            val = str(cell or '').strip()
            html += f'<td class="border border-slate-300 px-3 py-1.5">{val}</td>'
        html += '</tr>'
    html += '</tbody></table></div>'
    return html

def extract_table_from_text(question_text):
    if not question_text:
        return question_text, None

    import json

    # 1. Regex-based HTML table parsing
    html_table_pattern = re.compile(r'<div class="overflow-x-auto[^"]*"><table.*?>.*?</table></div>|<table.*?>.*?</table>', re.DOTALL)
    table_match = html_table_pattern.search(question_text)
    if table_match:
        table_html = table_match.group(0)
        try:
            # Extract headers
            th_pattern = re.compile(r'<th.*?>(.*?)</th>', re.DOTALL)
            headers = [re.sub(r'<[^>]*>', '', m).strip() for m in th_pattern.findall(table_html)]
            
            # Extract rows
            tr_pattern = re.compile(r'<tr>(.*?)</tr>', re.DOTALL)
            td_pattern = re.compile(r'<td.*?>(.*?)</td>', re.DOTALL)
            
            rows = []
            for tr_content in tr_pattern.findall(table_html):
                cells = [re.sub(r'<[^>]*>', '', m).strip() for m in td_pattern.findall(tr_content)]
                if cells:
                    rows.append(cells)
            
            if headers and rows:
                cleaned_text = html_table_pattern.sub('', question_text).strip()
                table_json = json.dumps({"headers": headers, "rows": rows})
                return cleaned_text, table_json
        except Exception as e:
            print("Failed parsing HTML table:", e)

    # 2. Markdown pipe-based table parsing
    lines = question_text.split('\n')
    table_lines = []
    other_lines = []
    in_table = False

    for line in lines:
        stripped = line.strip()
        if stripped.count('|') >= 2:
            in_table = True
            table_lines.append(stripped)
        else:
            if in_table:
                in_table = False
                other_lines.append(line)
            else:
                other_lines.append(line)

    if len(table_lines) >= 2:
        headers = []
        rows = []
        for idx, t_line in enumerate(table_lines):
            cells = [c.strip() for c in t_line.split('|')]
            if cells and cells[0] == '':
                cells.pop(0)
            if cells and cells[-1] == '':
                cells.pop()
            
            # Skip separator line
            if idx == 1 and all(all(char in '-: ' for char in c) for c in cells if c):
                continue
                
            if not headers:
                headers = cells
            else:
                if len(cells) < len(headers):
                    cells += [''] * (len(headers) - len(cells))
                elif len(cells) > len(headers):
                    cells = cells[:len(headers)]
                rows.append(cells)
                
        if headers and rows:
            table_json = json.dumps({"headers": headers, "rows": rows})
            cleaned_text = '\n'.join(other_lines)
            return cleaned_text.strip(), table_json

    # 3. Double-space / tab separated plain text table parsing
    other_lines = []
    table_lines = []
    in_table = False
    col_split_pattern = re.compile(r'\s{2,}|\t')
    
    for line in lines:
        stripped = line.strip()
        parts = col_split_pattern.split(stripped)
        if len(parts) >= 2 and not stripped.endswith('.'):
            in_table = True
            table_lines.append(parts)
        else:
            if in_table:
                in_table = False
                other_lines.append(line)
            else:
                other_lines.append(line)
                
    if len(table_lines) >= 2:
        headers = table_lines[0]
        rows = table_lines[1:]
        cleaned_rows = []
        for r in rows:
            if len(r) < len(headers):
                r += [''] * (len(headers) - len(r))
            elif len(r) > len(headers):
                r = r[:len(headers)]
            cleaned_rows.append(r)
            
        table_json = json.dumps({"headers": headers, "rows": cleaned_rows})
        cleaned_text = '\n'.join(other_lines)
        return cleaned_text.strip(), table_json

    return question_text, None

def parse_questions_from_raw_text(text):
    """
    Parses a string of text into structured questions and sub-questions using Regex.
    Also extracts marks.
    Clean up instructions, OMR directions, Rough Work, watermarks, stamps, and booklet codes.
    """
    attempt = "MAY"
    year = ""
    if text:
        header_match = re.search(r'(?i)\b(JAN(?:UARY)?|MAY|SEP(?:TEMBER)?|NOV(?:EMBER)?)\s*,?\s*(20\d{2})\b', text[:3000])
        if header_match:
            attempt = header_match.group(1).upper()[:3]
            year = header_match.group(2)

    if not year:
        import datetime
        year = str(datetime.datetime.now().year)

    # Regex patterns
    main_q_pattern = re.compile(
        r'(?i)^\s*(?:Question\s*(?:No\.?)?|Q(?:uestion)?\.?\s*|Q)?\s*(\d{1,3})\b(?:\s*[\.:\-)\s]|$)',
        re.IGNORECASE
    )
    # Combined question formats like 1(a), Q1(b), 1. (a)
    combined_q_pattern = re.compile(
        r'(?i)^\s*(?:Question\s*(?:No\.?)?|Q(?:uestion)?\.?\s*|Q)?\s*(\d{1,3})\s*(?:\.|\s+)?\s*\((?P<sub_id>[a-p]|(?:i|v|x)+)\)\s*(?P<content>.*)',
        re.IGNORECASE
    )
    combined_q_pattern2 = re.compile(
        r'(?i)^\s*(?:Question\s*(?:No\.?)?|Q(?:uestion)?\.?\s*|Q)?\s*(\d{1,3})\s*(?:\.|\s+)?\s*(?P<sub_id>[a-p])(?:\)|\.)\s*(?P<content>.*)',
        re.IGNORECASE
    )
    sub_q_pattern = re.compile(
        r'^\s*(?:\((?P<id1>[a-p]|(?:i|v|x)+)\)|\[(?P<id2>[a-p]|(?:i|v|x)+)\]|(?P<id3>[a-p]|(?:i|v|x)+)(?:\)|\.))\s*(?P<content>.*)',
        re.IGNORECASE
    )
    marks_pattern = re.compile(r'(?i)(?:\(|\[)\s*(?:Marks?:\s*)?(\d+)\s*(?:Marks?|M)\s*(?:\)|\])')
    case_scenario_pattern = re.compile(r'(?i)Case\s*(?:Scenario|Study)\s*(?:-|No\.?)?\s*(\d{1,2})\b')
    answer_pattern = re.compile(
        r'(?i)^\s*(?:Correct\s+)?(?:Answer|Ans|Option|Choice)(?:\s+Key|\s+Option|\s+Choice)?\s*(?::|\s*-\s*|\s+is\s+|\s*\.)\s*(.*)',
        re.IGNORECASE
    )
    answer_key_header_pattern = re.compile(r'(?i)\b(?:Answer\s+Key|Suggested\s+Answers?|Correct\s+Answers?|Key\s+to\s+MCQ|MCQ\s+Answers?)\b')
    answer_key_line_pattern = re.compile(
        r'(?i)^\s*(?:Question\s*No\.?\s*|Q)?(\d{1,3})\s*(?::|\.|\s*-\s*|\s*\.)\s*\(?([a-d])\)?(?:\s*(?:-|\s|is)\s*(.*))?$',
        re.IGNORECASE
    )

    INSTRUCTION_LINE_PATTERNS = [
        r'(?i)candidates?\s+should',
        r'(?i)use\s+blue/black',
        r'(?i)do\s+not\s+write\s+anything',
        r'(?i)negative\s+marks',
        r'(?i)this\s+booklet\s+contains',
        r'(?i)duration\s+of\s+the\s+exam',
        r'(?i)time\s+allowed',
        r'(?i)all\s+questions\s+are\s+compulsory',
        r'(?i)check\s+that\s+the\s+question\s+paper',
        r'(?i)\bomr\b',
        r'(?i)signature\s+of',
        r'(?i)roll\s+no',
        r'(?i)maximum\s+marks',
        r'(?i)instructions\s+to\s+candidates?',
        r'(?i)candidates?\s+instructions',
        r'(?i)general\s+instructions',
        r'(?i)omr\s+instructions'
    ]

    raw_lines = text.split('\n') if text else []
    cleaned_lines = []
    has_started = False
    in_answer_key_section = False
    answer_keys = {}
    last_answer_q_num = None
    
    seen_lines = set()

    for line in raw_lines:
        stripped = line.strip()
        if not stripped:
            continue

        # Stop processing at Rough Work section
        lower_stripped = stripped.lower()
        if "rough work" in lower_stripped or "space for rough work" in lower_stripped:
            break
        if "page break" in lower_stripped:
            continue

        # Remove watermarks, booklet codes, signatures, Tesseract stamps, page numbers
        cleaned = stripped
        cleaned = re.sub(r'(?i)\b(?:ZAN\d?|RPJ\d?)\b', '', cleaned)
        cleaned = re.sub(r'^\d{7}$', '', cleaned)  # Standalone OMR/booklet numbers e.g. 4089257
        cleaned = re.sub(r'(?i)\b(?:visit|www\.|copyright|all rights reserved)\S*', '', cleaned)
        cleaned = re.sub(r'(?i)\bBooklet\s+Code\s*(?::|-)?\s*[A-Z]\b', '', cleaned)
        cleaned = re.sub(r'(?i)\bCode\s*(?::|-)?\s*[A-Z]\b', '', cleaned)
        cleaned = re.sub(r'(?i)\bPage\s*\d+\s*(?:of\s*\d+)?\b', '', cleaned)
        cleaned = re.sub(r'\b\d+\s*of\s*\d+\b', '', cleaned)
        cleaned = re.sub(r'(?i)\b(?:Signature\s+of\s+Candidate|Signature\s+of\s+Invigilator|Candidate\'s\s+Signature|Invigilator\'s\s+Signature)\b', '', cleaned)
        cleaned = cleaned.strip()

        if not cleaned:
            continue

        lower_cleaned = cleaned.lower()

        # Check for cover page/instruction/exam headers we should drop
        instructions_keywords = [
            "general instructions",
            "instructions to candidates",
            "candidate instructions",
            "omr instructions",
            "omr sheet",
            "do not open this booklet",
            "read the instructions",
            "roll no.",
            "candidate signature",
            "invigilator signature"
        ]
        
        header_footers = [
            "board of studies",
            "the institute of chartered accountants of india",
            "intermediate (professional competence) examination",
            "intermediate examination",
            "professional competence examination",
            "accounting standards board",
            "gates classes",
            "students question papers"
        ]

        if any(kw in lower_cleaned for kw in instructions_keywords):
            continue
        if any(hf in lower_cleaned for hf in header_footers):
            continue

        # Drop lines that are just page numbers, e.g. "1", "2", "- 2 -", "[2]"
        if re.match(r'^\s*\[?\s*-?\s*\d+\s*-?\s*\]?\s*$', cleaned):
            continue

        # Avoid exact duplicate header lines
        if len(cleaned) > 20:
            if cleaned in seen_lines:
                continue
            seen_lines.add(cleaned)

        # Detect start of questions or Answer Key section
        is_case = case_scenario_pattern.search(cleaned)
        is_main = main_q_pattern.match(cleaned)
        is_ans_key = answer_key_header_pattern.search(cleaned)

        if not has_started:
            is_instruction = False
            for pat in INSTRUCTION_LINE_PATTERNS:
                if re.search(pat, lower_cleaned):
                    is_instruction = True
                    break
            if not is_instruction:
                if is_case or is_main or is_ans_key:
                    has_started = True

        if not has_started:
            continue

        # If we hit Answer Key page header
        if is_ans_key:
            in_answer_key_section = True
            continue

        # If we are in the end-of-document Answer Key section
        if in_answer_key_section:
            key_match = answer_key_line_pattern.match(cleaned)
            if key_match:
                q_num = key_match.group(1)
                opt_letter = key_match.group(2).upper()
                explanation = key_match.group(3)
                
                ans_str = f"({opt_letter})"
                if explanation:
                    ans_str += "\n" + explanation.strip()
                
                answer_keys[q_num] = ans_str
                last_answer_q_num = q_num
                continue
            else:
                # If there's non-empty text and a previously parsed question, append as explanation
                if last_answer_q_num in answer_keys:
                    answer_keys[last_answer_q_num] += "\n" + cleaned
                continue

        cleaned_lines.append(cleaned)

    # Parse clean lines using state machine
    questions = []
    current_q = None
    current_sq = None
    in_case_scenario = False
    case_start = None
    case_end = None
    in_explanation = False

    for line in cleaned_lines:
        stripped = line
        # Check for Case Scenario start
        case_match = case_scenario_pattern.search(stripped)
        if case_match:
            case_num = case_match.group(1)
            current_q = {
                "q_no": f"CS{case_num}",
                "question_text": stripped,
                "marks": 10,
                "question_type": "MIXED",
                "difficulty": "MEDIUM",
                "attempt": attempt,
                "year": year,
                "sub_questions": []
            }
            questions.append(current_q)
            current_sq = None
            in_case_scenario = True
            case_start = None
            case_end = None
            in_explanation = False
            continue

        # Range detection under Case Scenario
        if in_case_scenario and case_start is None:
            range_match = re.search(r'(?i)Question(?:s|\s*No\.?)?\s*(\d+)\s*(?:-|to)\s*(\d+)', stripped)
            if range_match:
                case_start = int(range_match.group(1))
                case_end = int(range_match.group(2))

        # Check for inline answers/steps inside questions
        ans_match = answer_pattern.match(stripped)
        if ans_match:
            ans_content = ans_match.group(1).strip()
            in_explanation = True
            
            target_container = None
            if current_sq:
                if current_sq["identifier"].lower() in ['a', 'b', 'c', 'd']:
                    is_descriptive = len(current_sq["question_text"]) > 60 or "marks" in current_sq["question_text"].lower() or any(v in current_sq["question_text"].lower() for v in ["explain", "calculate", "prepare", "describe"])
                    if is_descriptive:
                        target_container = current_sq
                    else:
                        target_container = current_q
                else:
                    target_container = current_sq
            else:
                target_container = current_q
                
            if target_container:
                target_container["correct_answer"] = ans_content
            continue

        # Check for combined question pattern (e.g. 1(a) or 1a) )
        comb_match = combined_q_pattern.match(stripped) or combined_q_pattern2.match(stripped)
        if comb_match:
            q_num = comb_match.group(1)
            sub_id = comb_match.group('sub_id')
            content = comb_match.group('content').strip()
            
            # Find or create parent question
            parent_q = None
            for q in questions:
                if q["q_no"] == q_num:
                    parent_q = q
                    break
            
            if not parent_q:
                parent_q = {
                    "q_no": q_num,
                    "question_text": f"Question {q_num}",
                    "marks": 10,
                    "question_type": "MIXED",
                    "difficulty": "MEDIUM",
                    "attempt": attempt,
                    "year": year,
                    "sub_questions": []
                }
                questions.append(parent_q)
            
            current_q = parent_q
            in_case_scenario = False
            
            current_sq = {
                "identifier": sub_id,
                "question_text": content,
                "marks": 5,
                "table_data": None
            }
            # Extract marks if present
            marks_m = marks_pattern.search(content)
            if marks_m:
                current_sq["marks"] = int(marks_m.group(1))
                current_sq["question_text"] = marks_pattern.sub('', current_sq["question_text"]).strip()
                
            current_q["sub_questions"].append(current_sq)
            in_explanation = False
            continue

        # Check for main question start
        main_match = main_q_pattern.match(stripped)
        if main_match:
            full_match_str = main_match.group(0)
            has_explicit_prefix = any(p in full_match_str.lower() for p in ["question", "q.", "q "]) or full_match_str.lower().strip().startswith("q")
            
            q_num = main_match.group(1)
            q_num_int = int(q_num)
            
            is_valid_main = False
            if has_explicit_prefix:
                is_valid_main = True
            else:
                if not questions:
                    is_valid_main = True
                else:
                    last_q_val = None
                    for prev_q in reversed(questions):
                        if not prev_q["q_no"].startswith("CS"):
                            try:
                                last_q_val = int(prev_q["q_no"])
                                break
                            except ValueError:
                                pass
                    if last_q_val is None:
                        is_valid_main = True
                    elif q_num_int == last_q_val + 1:
                        is_valid_main = True

            if is_valid_main and q_num_int <= 50:
                in_explanation = False
                is_scenario_sub = False

                if in_case_scenario:
                    if case_start is not None and case_start <= q_num_int <= case_end:
                        is_scenario_sub = True
                    elif case_start is None:
                        # Fallback sequence detection
                        if q_num_int == 1:
                            is_scenario_sub = True
                        elif current_q and current_q.get("sub_questions"):
                            try:
                                last_id = int(current_q["sub_questions"][-1]["identifier"])
                                if q_num_int == last_id + 1:
                                    is_scenario_sub = True
                            except ValueError:
                                pass

                if is_scenario_sub:
                    current_sq = {
                        "identifier": q_num,
                        "question_text": stripped,
                        "marks": 2,
                        "table_data": None
                    }
                    marks_m = marks_pattern.search(stripped)
                    if marks_m:
                        current_sq["marks"] = int(marks_m.group(1))
                        current_sq["question_text"] = marks_pattern.sub('', current_sq["question_text"]).strip()
                    current_q["sub_questions"].append(current_sq)
                    continue
                else:
                    in_case_scenario = False
                    case_start = None
                    case_end = None

                    current_q = {
                        "q_no": q_num,
                        "question_text": stripped,
                        "marks": 10,
                        "question_type": "NORMAL",
                        "difficulty": "MEDIUM",
                        "attempt": attempt,
                        "year": year,
                        "sub_questions": []
                    }
                    marks_m = marks_pattern.search(stripped)
                    if marks_m:
                        current_q["marks"] = int(marks_m.group(1))
                        current_q["question_text"] = marks_pattern.sub('', current_q["question_text"]).strip()

                    questions.append(current_q)
                    current_sq = None
                    continue

        # Check for sub-question start
        sub_match = sub_q_pattern.match(stripped)
        if sub_match:
            gd = sub_match.groupdict()
            ident = gd.get('id1') or gd.get('id2') or gd.get('id3') or ''
            content = gd.get('content') or ''

            if in_case_scenario and current_sq and not in_explanation:
                current_sq["question_text"] += "\n" + stripped
                continue

            in_explanation = False

            if not current_q:
                current_q = {
                    "q_no": "1",
                    "question_text": "Questions",
                    "marks": 10,
                    "question_type": "NORMAL",
                    "difficulty": "MEDIUM",
                    "attempt": attempt,
                    "year": year,
                    "sub_questions": []
                }
                questions.append(current_q)

            current_sq = {
                "identifier": ident,
                "question_text": content,
                "marks": 5,
                "table_data": None
            }
            marks_m = marks_pattern.search(stripped)
            if marks_m:
                current_sq["marks"] = int(marks_m.group(1))
                current_sq["question_text"] = marks_pattern.sub('', current_sq["question_text"]).strip()

            current_q["sub_questions"].append(current_sq)
            continue

        # Regular text line
        if in_explanation:
            target_container = None
            if current_sq:
                if current_sq["identifier"].lower() in ['a', 'b', 'c', 'd']:
                    is_descriptive = len(current_sq["question_text"]) > 60 or "marks" in current_sq["question_text"].lower() or any(v in current_sq["question_text"].lower() for v in ["explain", "calculate", "prepare", "describe"])
                    if is_descriptive:
                        target_container = current_sq
                    else:
                        target_container = current_q
                else:
                    target_container = current_sq
            else:
                target_container = current_q
            
            if target_container:
                if not target_container.get("correct_answer"):
                    target_container["correct_answer"] = stripped
                else:
                    target_container["correct_answer"] += "\n" + stripped
        else:
            # Check if the line indicates a section start
            lower_line = stripped.lower()
            is_section_header = False
            section_headers = [
                "additional information",
                "required:",
                "you are required to:",
                "prepare",
                "calculate",
                "pass journal entries",
                "working notes",
                "suggested answer"
            ]
            if any(lower_line.startswith(sh) or sh in lower_line[:30] for sh in section_headers):
                is_section_header = True

            if current_sq:
                marks_m = marks_pattern.search(stripped)
                if marks_m:
                    current_sq["marks"] = int(marks_m.group(1))
                    stripped = marks_pattern.sub('', stripped).strip()
                if is_section_header:
                    current_sq["question_text"] += "\n\n" + stripped
                else:
                    current_sq["question_text"] += "\n" + stripped
            elif current_q:
                marks_m = marks_pattern.search(stripped)
                if marks_m:
                    current_q["marks"] = int(marks_m.group(1))
                    stripped = marks_pattern.sub('', stripped).strip()
                if is_section_header:
                    current_q["question_text"] += "\n\n" + stripped
                else:
                    current_q["question_text"] += "\n" + stripped

    # Helper to split solution text
    def split_answer_and_working_notes(correct_answer):
        if not correct_answer:
            return "", ""
        pattern = re.compile(
            r'(?i)(?:\r?\n|^)\s*(?:Working\s+Notes?(?:\s*-\s*\d+)?|W\.?\s*N\.?\s*s?)\b\s*(?::|-)?',
            re.MULTILINE
        )
        match = pattern.search(correct_answer)
        if match:
            start_idx = match.start()
            answer = correct_answer[:start_idx].strip()
            working_notes = correct_answer[start_idx:].strip()
            return answer, working_notes
        return correct_answer.strip(), ""

    # Post-process: Map end-of-document Answer Keys back
    if answer_keys:
        for q in questions:
            q_num = q["q_no"]
            if q_num in answer_keys:
                q["correct_answer"] = answer_keys[q_num]
            for sq in q.get("sub_questions", []):
                sq_num = sq["identifier"]
                if sq_num in answer_keys:
                    sq["correct_answer"] = answer_keys[sq_num]

    # Post-process: detect question types and extract tables
    for q in questions:
        cleaned_text, table_json = extract_table_from_text(q.get("question_text", ""))
        if table_json:
            q["question_text"] = cleaned_text
            q["table_data"] = json.loads(table_json)

        cleaned_ans, ans_table_json = extract_table_from_text(q.get("correct_answer", ""))
        if ans_table_json:
            q["correct_answer"] = cleaned_ans
            q["answer_table_data"] = json.loads(ans_table_json)

        # Split model answer into suggested answer & working notes
        q_ans = q.get("correct_answer") or ""
        q_clean_ans, q_wn = split_answer_and_working_notes(q_ans)
        q["answer"] = q_clean_ans
        q["working_notes"] = q_wn

        if q.get("sub_questions"):
            q["question_type"] = "MIXED"
            for sq in q["sub_questions"]:
                cleaned_sq, sq_table_json = extract_table_from_text(sq.get("question_text", ""))
                if sq_table_json:
                    sq["question_text"] = cleaned_sq
                    sq["table_data"] = json.loads(sq_table_json)

                cleaned_sq_ans, sq_ans_table = extract_table_from_text(sq.get("correct_answer", ""))
                if sq_ans_table:
                    sq["correct_answer"] = cleaned_sq_ans
                    sq["answer_table_data"] = json.loads(sq_ans_table)

                sq_ans = sq.get("correct_answer") or ""
                sq_clean_ans, sq_wn = split_answer_and_working_notes(sq_ans)
                sq["answer"] = sq_clean_ans
                sq["working_notes"] = sq_wn

                sq_text_lower = sq["question_text"].lower()
                if "choose the correct" in sq_text_lower or ("(a)" in sq_text_lower and "(b)" in sq_text_lower) or ("(a)" in sq_text_lower and "option" in sq_text_lower):
                    sq["question_type"] = "MCQ"
                elif any(term in sq_text_lower for term in ["calculate", "compute", "prepare", "journalize", "ledger"]):
                    sq["question_type"] = "NORMAL"
                else:
                    sq["question_type"] = "THEORY"

            # Merge back normal questions with MCQ option sub-questions
            if not q["q_no"].startswith("CS") and len(q["sub_questions"]) == 4:
                idents = [s["identifier"].lower() for s in q["sub_questions"]]
                if idents == ["a", "b", "c", "d"]:
                    is_mcq = True
                    question_verbs = ["explain", "discuss", "calculate", "compute", "prepare", "define", "distinguish", "state", "write"]
                    for s in q["sub_questions"]:
                        s_text_lower = s["question_text"].lower()
                        if any(verb in s_text_lower for verb in question_verbs) and len(s_text_lower) > 60:
                            is_mcq = False
                            break
                    if is_mcq:
                        extra_text = ""
                        for s in q["sub_questions"]:
                            label = s["identifier"].upper()
                            extra_text += f"\n({label}) {s['question_text']}"
                        q["question_text"] += extra_text
                        q["question_type"] = "MCQ"
                        q["sub_questions"] = []
            continue

        text_lower = q["question_text"].lower()
        if "choose the correct" in text_lower or ("(a)" in text_lower and "(b)" in text_lower) or ("(a)" in text_lower and "option" in text_lower):
            q["question_type"] = "MCQ"
        elif any(term in text_lower for term in ["calculate", "compute", "prepare", "journalize", "ledger"]):
            q["question_type"] = "NORMAL"
        else:
            q["question_type"] = "THEORY"

    return questions, attempt, year


class PDFQuestionExtractView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsStaffOrReadOnly]
    parser_classes = [MultiPartParser]

    def post(self, request):
        pdf_file = request.FILES.get('pdf')
        if not pdf_file:
            return Response({'error': 'No PDF file provided. Upload as form-data field "pdf".'}, status=400)

        # ── Step 1: Open PDF with PyMuPDF ──
        try:
            pdf_bytes = pdf_file.read()
            doc = fitz.open(stream=pdf_bytes, filetype='pdf')
        except Exception as e:
            return Response({'error': f'Could not open PDF file: {str(e)}'}, status=400)

        pages_text = []
        pages_images_b64 = []
        merged_elements = []

        # Iterate pages and extract sorted elements (text & tables)
        for page_num, page in enumerate(doc):
            # Render page to base64 PNG
            mat = fitz.Matrix(1.8, 1.8)
            pix = page.get_pixmap(matrix=mat)
            img_bytes = pix.tobytes("png")
            pages_images_b64.append(base64.b64encode(img_bytes).decode('utf-8'))

            # Extract regular page text density
            pages_text.append(page.get_text().strip())

            # Get tables first
            table_bboxes = []
            try:
                tables = page.find_tables()
                for tab in tables:
                    table_bboxes.append(tab.bbox)
                    y0 = tab.bbox[1]  # vertical start position
                    tab_data = tab.extract()
                    html_table = convert_table_to_html(tab_data)
                    if html_table:
                        merged_elements.append((page_num, y0, html_table, 'table'))
            except Exception:
                pass  # find_tables support check

            # Get layout blocks: (x0, y0, x1, y1, text, block_no, block_type)
            blocks = page.get_text("blocks")
            for b in blocks:
                x0, y0, x1, y1, block_text, block_no, block_type = b
                block_text = block_text.strip()
                if not block_text:
                    continue
                
                # Check overlap: if center of block is inside any table bbox
                in_table = False
                bx_center = (x0 + x1) / 2.0
                by_center = (y0 + y1) / 2.0
                for tbox in table_bboxes:
                    tx0, ty0, tx1, ty1 = tbox
                    # Give a tiny 2pt margin for safety
                    if (tx0 - 2) <= bx_center <= (tx1 + 2) and (ty0 - 2) <= by_center <= (ty1 + 2):
                        in_table = True
                        break
                
                if not in_table:
                    merged_elements.append((page_num, y0, block_text, 'text'))

        doc.close()

        total_text = '\n\n--- PAGE BREAK ---\n\n'.join(pages_text)
        avg_chars = len(total_text.strip()) / max(len(pages_text), 1)
        is_scanned = avg_chars < 150

        # Sort all elements across document by page number, then vertical y0 coordinate
        merged_elements.sort(key=lambda x: (x[0], x[1]))

        # Re-assemble text incorporating table blocks in-order
        ordered_lines = []
        for item in merged_elements:
            pg, y, val, item_type = item
            if item_type == 'table':
                ordered_lines.append(f"\n\n{val}\n\n")
            else:
                ordered_lines.append(val)

        full_document_text = "\n".join(ordered_lines)
        questions, attempt, year = parse_questions_from_raw_text(full_document_text)

        return Response({
            'questions': questions,
            'total_extracted': len(questions),
            'is_scanned': is_scanned,
            'pages': len(pages_images_b64),
            'page_images': pages_images_b64 if is_scanned else []
        }, status=200)


class ParseTextOnlyView(APIView):
    """
    Used when frontend performs OCR on scanned pages, then submits the fully OCR-ed text
    to be structured via regex pattern matching.
    """
    permission_classes = [permissions.IsAuthenticated, IsStaffOrReadOnly]

    def post(self, request):
        text = request.data.get('text', '')
        if not text:
            return Response({'error': 'No text content provided.'}, status=400)

        questions, attempt, year = parse_questions_from_raw_text(text)
        return Response({
            'questions': questions,
            'total_extracted': len(questions),
            'attempt': attempt,
            'year': year
        }, status=200)



# ─────────────────────────────────────────────────────────────
# Simple PDF Upload (No AI): POST /api/materials/upload-pdf/
# Stores the PDF in media/question_papers/ and optionally
# creates a QuestionPaper record. Returns the file URL.
# ─────────────────────────────────────────────────────────────
import os as _os

class UploadPDFView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsStaffOrReadOnly]
    parser_classes = [MultiPartParser]

    def post(self, request):
        pdf_file = request.FILES.get('pdf')
        if not pdf_file:
            return Response({'error': 'No PDF file provided. Send as form-data field "pdf".'}, status=400)

        if not pdf_file.name.lower().endswith('.pdf'):
            return Response({'error': 'Only PDF files are accepted.'}, status=400)

        # Optional metadata from request
        title       = request.data.get('title', _os.path.splitext(pdf_file.name)[0])
        subject_id  = request.data.get('subject_id')
        year        = request.data.get('year', '')
        source      = request.data.get('source', '')
        is_premium  = request.data.get('is_premium', 'true').lower() != 'false'
        paper_type  = request.data.get('paper_type', 'question_paper')  # question_paper | answer_paper | notes

        # Look up subject
        subject = None
        if subject_id:
            subject = Subject.objects.filter(id=subject_id).first()

        # Save file — store under question_papers/ folder
        from django.core.files.storage import default_storage
        file_path = default_storage.save(f'question_papers/{pdf_file.name}', pdf_file)
        file_url  = request.build_absolute_uri(f'/media/{file_path}')

        # Optionally create a QuestionPaper record
        record = None
        if subject and title:
            if paper_type == 'answer_paper':
                record = AnswerPaper.objects.create(
                    title=title,
                    subject=subject,
                    year=year,
                    pdf_file=file_path,
                    is_premium=is_premium,
                )
            else:
                record = QuestionPaper.objects.create(
                    title=title,
                    subject=subject,
                    year=year,
                    source=source,
                    pdf_file=file_path,
                    is_premium=is_premium,
                )

        return Response({
            'message':   'PDF uploaded successfully.',
            'file_url':  file_url,
            'file_path': file_path,
            'record_id': record.id if record else None,
            'title':     title,
        }, status=201)


class GenericFileUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsStaffOrReadOnly]
    parser_classes = [MultiPartParser]

    def post(self, request):
        uploaded_file = request.FILES.get('file')
        if not uploaded_file:
            return Response({'error': 'No file provided. Send as form-data field "file".'}, status=400)

        # Save to default storage inside 'uploads/' directory
        from django.core.files.storage import default_storage
        file_path = default_storage.save(f'uploads/{uploaded_file.name}', uploaded_file)
        file_url  = request.build_absolute_uri(f'/media/{file_path}')

        return Response({
            'message': 'File uploaded successfully.',
            'url': file_url,
            'file_path': file_path,
            'name': uploaded_file.name,
        }, status=200)

