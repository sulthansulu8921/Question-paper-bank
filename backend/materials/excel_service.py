import io
import re
from typing import Dict, List, Tuple, Any, Optional
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from django.db import transaction

from materials.models import (
    SubjectiveQuestion,
    SubQuestion,
    QuestionOption,
    Answer,
    Scenario
)
from courses.models import Subject, Topic


# ─────────────────────────────────────────────────────────────────────────────
# 1. EXCEL TEMPLATE GENERATOR
# ─────────────────────────────────────────────────────────────────────────────

def _apply_header_style(ws, headers: List[str], col_widths: List[int], header_fill_hex: str):
    """Utility to style header row."""
    header_font  = Font(name='Segoe UI', size=11, bold=True, color='FFFFFF')
    header_fill  = PatternFill(start_color=header_fill_hex, end_color=header_fill_hex, fill_type='solid')
    center_align = Alignment(horizontal='center', vertical='center', wrap_text=True)
    thin_border  = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1'),
    )

    ws.row_dimensions[1].height = 32
    for col_idx, (header, width) in enumerate(zip(headers, col_widths), start=1):
        cell = ws.cell(row=1, column=col_idx, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = center_align
        cell.border = thin_border
        col_letter = get_column_letter(col_idx)
        ws.column_dimensions[col_letter].width = max(width, 12)
    ws.freeze_panes = 'A2'


def _apply_data_row_style(ws, row_idx: int, values: List[Any], left_align_cols: List[int], alt_fill: bool = False):
    """Utility to style a data row."""
    cell_font = Font(name='Segoe UI', size=10)
    fill = PatternFill(start_color='F8FAFC', end_color='F8FAFC', fill_type='solid') if alt_fill else PatternFill(fill_type=None)
    center_align = Alignment(horizontal='center', vertical='top', wrap_text=True)
    left_align   = Alignment(horizontal='left',   vertical='top', wrap_text=True)
    thin_border  = Border(
        left=Side(style='thin', color='E2E8F0'),
        right=Side(style='thin', color='E2E8F0'),
        top=Side(style='thin', color='E2E8F0'),
        bottom=Side(style='thin', color='E2E8F0'),
    )

    ws.row_dimensions[row_idx].height = 24
    for col_idx, val in enumerate(values, start=1):
        cell = ws.cell(row=row_idx, column=col_idx, value=val)
        cell.font = cell_font
        cell.border = thin_border
        if alt_fill:
            cell.fill = fill
        cell.alignment = left_align if col_idx in left_align_cols else center_align


def _build_instructions_sheet(ws):
    """Creates the Instructions tab."""
    ws.title = "Instructions"
    ws.views.sheetView[0].showGridLines = True

    title_font = Font(name='Segoe UI', size=16, bold=True, color='1E293B')
    subtitle_font = Font(name='Segoe UI', size=11, color='475569', italic=True)
    section_font = Font(name='Segoe UI', size=12, bold=True, color='0F172A')
    bold_font = Font(name='Segoe UI', size=10, bold=True, color='1E293B')
    regular_font = Font(name='Segoe UI', size=10, color='334155')
    bullet_font = Font(name='Segoe UI', size=10, color='1E40AF')

    ws.cell(row=1, column=1, value="📚 Question Bank Excel Import Guide & Rules").font = title_font
    ws.cell(row=2, column=1, value="You can import 3 standard question formats using this workbook. Follow the guidelines below:").font = subtitle_font
    ws.row_dimensions[1].height = 28
    ws.row_dimensions[2].height = 20

    instructions = [
        (4, "1. Multiple Choice Questions (Sheet: 1_MCQ_Questions)", "Navy Blue", [
            ("Format:", "Single standalone objective questions with 4 options (A, B, C, D) and 1 correct answer."),
            ("Required Columns:", "Question Text, Option A, Option B, Option C, Option D, Correct Option (A/B/C/D)."),
            ("Optional Columns:", "Q No, Marks (default 1), Difficulty (EASY/MEDIUM/HARD), Explanation, Subject, Topic, Source, Year, Attempt."),
            ("Tip:", "Put 'A', 'B', 'C', or 'D' in the Correct Option column. The system will automatically link options and answers.")
        ]),
        (10, "2. Case Scenarios (Sheet: 2_Case_Scenarios)", "Deep Purple", [
            ("Format:", "A comprehensive case narrative/passage followed by 2 or more linked multiple-choice sub-questions."),
            ("Required Columns:", "Case Scenario ID, Case Passage, Sub Q No, Sub Question Text, Option A, Option B, Option C, Option D, Correct Option."),
            ("Grouping Rule:", "Use the SAME 'Case Scenario ID' (e.g. CS-1, CS-1, CS-1) for all sub-questions of that case."),
            ("Passage:", "You can enter the full case narrative in the first row of the scenario ID or repeat it. The system combines them seamlessly."),
            ("Marks:", "Each sub-question can have its own marks (e.g. 2M). Parent scenario marks are auto-calculated.")
        ]),
        (17, "3. Descriptive / Practical Problems (Sheet: 3_Descriptive_Problems)", "Forest Green", [
            ("Format:", "Practical problems (e.g. Partnership Accounts, Consolidation, GST calculations) with sub-parts like 1(a), 1(b) and working notes."),
            ("Required Columns:", "Question No, Problem Background / Main Text, Sub Part No, Sub Part Question Text, Sub Part Marks, Solution / Answer Text."),
            ("Grouping Rule:", "Use the SAME 'Question No' (e.g. Q1, Q1) for all sub-parts belonging to the same problem."),
            ("Working Notes:", "Optional column for working notes, calculation steps, or journal ledger notes. These get linked to the sub-part solution.")
        ]),
        (24, "4. General Guidelines for Uploading", "Slate Gray", [
            ("Multi-sheet Upload:", "You can upload this entire master workbook with all 3 sheets populated; the system processes all sheets!"),
            ("Individual Upload:", "You can also upload an individual template file with just one sheet; the system detects it automatically."),
            ("Safe Import:", "Existing questions and data are completely safe and preserved. You will receive an exact count of items created.")
        ])
    ]

    for start_row, section_title, color_name, bullets in instructions:
        ws.cell(row=start_row, column=1, value=section_title).font = section_font
        ws.row_dimensions[start_row].height = 24
        for offset, (label, text) in enumerate(bullets, start=1):
            r = start_row + offset
            ws.row_dimensions[r].height = 20
            ws.cell(row=r, column=1, value=f"• {label}").font = bullet_font
            ws.cell(row=r, column=2, value=text).font = regular_font

    ws.column_dimensions['A'].width = 28
    ws.column_dimensions['B'].width = 110


def _build_mcq_sheet(ws, title: str = "1_MCQ_Questions"):
    """Creates styled MCQ sheet with sample CA exam questions."""
    ws.title = title
    ws.views.sheetView[0].showGridLines = True

    headers = [
        "Q No", "Question Text",
        "Option A", "Option B", "Option C", "Option D",
        "Correct Option", "Marks", "Difficulty", "Explanation",
        "Subject", "Topic", "Source", "Year", "Attempt"
    ]
    col_widths = [8, 55, 26, 26, 26, 26, 14, 8, 12, 45, 22, 22, 14, 8, 10]
    _apply_header_style(ws, headers, col_widths, '1E3A5F')  # Navy Blue

    samples = [
        [
            "1",
            "As per AS 2 (Valuation of Inventories), inventories should be valued at:",
            "Historical Cost",
            "Net Realisable Value",
            "Lower of Cost and Net Realisable Value",
            "Replacement Cost",
            "C",
            1,
            "EASY",
            "According to AS 2, inventories shall be valued at the lower of cost and net realizable value.",
            "Advanced Accounting",
            "AS 2 Valuation of Inventories",
            "ICAI Study Material",
            "2024",
            "MAY"
        ],
        [
            "2",
            "Which of the following is NOT recognized as a fundamental accounting assumption as per AS 1?",
            "Going Concern",
            "Consistency",
            "Accrual",
            "Prudence",
            "D",
            1,
            "MEDIUM",
            "AS 1 recognizes only three fundamental accounting assumptions: Going Concern, Consistency, and Accrual. Prudence is a major consideration for selecting accounting policies.",
            "Advanced Accounting",
            "AS 1 Disclosure of Policies",
            "ICAI MTP",
            "2024",
            "NOV"
        ],
        [
            "3",
            "Under section 135 of the Companies Act, 2013, the CSR Committee of the Board shall consist of:",
            "At least 2 directors",
            "At least 3 directors with at least 1 independent director",
            "Only independent directors",
            "Any 4 board members including managing director",
            "B",
            2,
            "MEDIUM",
            "Section 135(1) provides that every qualifying company shall constitute a CSR Committee consisting of 3 or more directors, with at least one independent director.",
            "Corporate and Other Laws",
            "Corporate Social Responsibility",
            "ICAI RTP",
            "2024",
            "MAY"
        ],
        [
            "4",
            "In case of a non-corporate assessee, Section 44AB requires tax audit if total sales or turnover exceeds:",
            "₹ 50 Lakhs",
            "₹ 1 Crore (or ₹ 10 Crores if cash transactions <= 5%)",
            "₹ 2 Crores",
            "₹ 5 Crores",
            "B",
            1,
            "HARD",
            "Under Section 44AB of Income Tax Act, threshold is ₹ 1 Crore, increased to ₹ 10 Crores where aggregate cash receipts and payments do not exceed 5%.",
            "Taxation",
            "Profits & Gains of Business",
            "ICAI RTP",
            "2024",
            "NOV"
        ]
    ]

    for idx, row in enumerate(samples, start=2):
        _apply_data_row_style(ws, idx, row, left_align_cols=[2, 3, 4, 5, 6, 10, 11, 12], alt_fill=(idx % 2 == 1))


def _build_case_scenario_sheet(ws, title: str = "2_Case_Scenarios"):
    """Creates styled Case Scenario sheet with sample CA case study."""
    ws.title = title
    ws.views.sheetView[0].showGridLines = True

    headers = [
        "Case Scenario ID", "Case Passage",
        "Sub Q No", "Sub Question Text",
        "Option A", "Option B", "Option C", "Option D",
        "Correct Option", "Marks", "Difficulty", "Explanation",
        "Subject", "Topic", "Source", "Year", "Attempt"
    ]
    col_widths = [16, 65, 10, 50, 26, 26, 26, 26, 14, 8, 12, 45, 22, 22, 14, 8, 10]
    _apply_header_style(ws, headers, col_widths, '4C1D95')  # Deep Purple

    passage_cs1 = (
        "Omega Ltd. is a manufacturing company engaged in producing specialized auto components. "
        "During FY 2023-24, the company incurred expenditure of ₹ 45 Lakhs on acquiring a patent right for a high-efficiency fuel injection system on 1st October 2023. "
        "The expected useful life of the patent is 10 years with zero residual value. "
        "In addition, the company spent ₹ 8 Lakhs during the research phase for developing an advanced battery casing and ₹ 12 Lakhs during the development phase which met all criteria under AS 26 for capitalization. "
        "The company's turnover for the year was ₹ 120 Crores with a net profit before tax of ₹ 14 Crores."
    )

    samples = [
        [
            "CS-1",
            passage_cs1,
            "1",
            "What amount of amortization should Omega Ltd. charge to the Profit & Loss Account for the patent for FY 2023-24 (assuming half-year amortization)?",
            "₹ 4.50 Lakhs",
            "₹ 2.25 Lakhs",
            "₹ 45.00 Lakhs",
            "Nil (since useful life is 10 years)",
            "B",
            2,
            "MEDIUM",
            "Amortization for full year = ₹ 45 Lakhs / 10 = ₹ 4.50 Lakhs. Since the patent was acquired on 1st October 2023 (6 months in FY 2023-24), amortization = ₹ 4.50 Lakhs * 6/12 = ₹ 2.25 Lakhs.",
            "Advanced Accounting",
            "AS 26 Intangible Assets",
            "ICAI Case Study Digest",
            "2024",
            "MAY"
        ],
        [
            "CS-1",
            passage_cs1,
            "2",
            "How should the research expenditure of ₹ 8 Lakhs and development expenditure of ₹ 12 Lakhs be treated as per AS 26?",
            "Both ₹ 8 Lakhs and ₹ 12 Lakhs should be capitalized as Intangible Assets",
            "Research ₹ 8 Lakhs expensed to P&L; Development ₹ 12 Lakhs capitalized",
            "Both ₹ 8 Lakhs and ₹ 12 Lakhs should be expensed immediately to P&L",
            "Both amounts deferred and written off over 5 years",
            "B",
            2,
            "MEDIUM",
            "Under AS 26, research costs are recognized as an expense when incurred. Development costs meeting capitalization criteria are capitalized as an intangible asset.",
            "Advanced Accounting",
            "AS 26 Intangible Assets",
            "ICAI Case Study Digest",
            "2024",
            "MAY"
        ],
        [
            "CS-1",
            passage_cs1,
            "3",
            "What will be the carrying amount of Intangible Assets under Development at the end of FY 2023-24 in the Balance Sheet?",
            "₹ 12 Lakhs",
            "₹ 20 Lakhs",
            "₹ 54.75 Lakhs",
            "₹ 57 Lakhs",
            "A",
            2,
            "HARD",
            "The development expenditure meeting AS 26 criteria is ₹ 12 Lakhs, which is shown as Intangible Assets under development until completed. The patent of ₹ 42.75 Lakhs net is shown under Intangible Assets.",
            "Advanced Accounting",
            "AS 26 Intangible Assets",
            "ICAI Case Study Digest",
            "2024",
            "MAY"
        ]
    ]

    for idx, row in enumerate(samples, start=2):
        _apply_data_row_style(ws, idx, row, left_align_cols=[2, 4, 5, 6, 7, 8, 12, 13, 14], alt_fill=(idx % 2 == 1))


def _build_descriptive_sheet(ws, title: str = "3_Descriptive_Problems"):
    """Creates styled Descriptive Problem sheet with sample CA multi-part problem."""
    ws.title = title
    ws.views.sheetView[0].showGridLines = True

    headers = [
        "Question No", "Problem Background / Main Text",
        "Sub Part No", "Sub Part Question Text", "Sub Part Marks",
        "Solution / Answer Text", "Working Notes",
        "Difficulty", "Subject", "Topic", "Source", "Year", "Attempt"
    ]
    col_widths = [14, 65, 12, 45, 12, 65, 50, 12, 22, 22, 14, 8, 10]
    _apply_header_style(ws, headers, col_widths, '065F46')  # Forest Green

    problem_bg = (
        "A and B were partners sharing profits and losses in the ratio of 3:2. On 31st March 2024, their Balance Sheet stood as follows:\n"
        "Liabilities: Capital A ₹ 1,50,000, Capital B ₹ 1,00,000, Creditors ₹ 60,000, General Reserve ₹ 40,000.\n"
        "Assets: Land & Building ₹ 1,20,000, Plant & Machinery ₹ 80,000, Stock ₹ 70,000, Debtors ₹ 50,000, Cash at Bank ₹ 30,000.\n"
        "On 1st April 2024, they admitted C into partnership on the following terms:\n"
        "1. C brings in ₹ 80,000 as capital for 1/5th share and ₹ 25,000 as premium for goodwill.\n"
        "2. Land & Building is revalued at ₹ 1,50,000; Plant is depreciated by 10%; Provision for doubtful debts is created at 5%."
    )

    sol_1a = (
        "Revaluation Account for the period ending 1st April 2024:\n"
        "Particulars | Amount (₹) | Particulars | Amount (₹)\n"
        "To Plant & Machinery A/c (10% of 80,000) | 8,000 | By Land & Building A/c (1,50,000 - 1,20,000) | 30,000\n"
        "To Provision for Doubtful Debts A/c (5% of 50,000) | 2,500 |\n"
        "To Profit on Revaluation transferred to:\n"
        "  - A's Capital A/c (3/5) : ₹ 11,700\n"
        "  - B's Capital A/c (2/5) : ₹ 7,800 | 19,500 |\n"
        "Total: ₹ 30,000 | Total: ₹ 30,000\n\n"
        "Net Revaluation Gain: ₹ 19,500 credited to partners in old ratio 3:2."
    )

    wn_1a = (
        "Working Note 1: Appreciation in Land & Building = ₹ 1,50,000 - ₹ 1,20,000 = ₹ 30,000 (Credited).\n"
        "Working Note 2: Depreciation on Plant & Machinery = ₹ 80,000 * 10% = ₹ 8,000 (Debited).\n"
        "Working Note 3: Provision for Doubtful Debts = ₹ 50,000 * 5% = ₹ 2,500 (Debited).\n"
        "Revaluation Gain = ₹ 30,000 - (₹ 8,000 + ₹ 2,500) = ₹ 19,500."
    )

    sol_1b = (
        "Journal Entries on Admission of Partner C:\n\n"
        "1. Bank A/c  Dr.  ₹ 1,05,000\n"
        "     To C's Capital A/c  ₹ 80,000\n"
        "     To Premium for Goodwill A/c  ₹ 25,000\n"
        "   (Being capital and goodwill premium brought in cash by C)\n\n"
        "2. Premium for Goodwill A/c  Dr.  ₹ 25,000\n"
        "     To A's Capital A/c (₹ 25,000 * 3/5)  ₹ 15,000\n"
        "     To B's Capital A/c (₹ 25,000 * 2/5)  ₹ 10,000\n"
        "   (Being goodwill premium distributed among old partners in sacrificing ratio 3:2)\n\n"
        "3. General Reserve A/c  Dr.  ₹ 40,000\n"
        "     To A's Capital A/c (₹ 40,000 * 3/5)  ₹ 24,000\n"
        "     To B's Capital A/c (₹ 40,000 * 2/5)  ₹ 16,000\n"
        "   (Being undistributed general reserve transferred to old partners' capital)"
    )

    wn_1b = (
        "Working Note: Sacrificing Ratio calculation:\n"
        "Since C acquires 1/5th share and no other agreement is made, old partners sacrifice in their old profit sharing ratio (3:2).\n"
        "Sacrificing ratio of A and B = 3:2."
    )

    samples = [
        [
            "Q1",
            problem_bg,
            "1(a)",
            "Prepare the Revaluation Account and determine the net profit or loss on revaluation.",
            5,
            sol_1a,
            wn_1a,
            "MEDIUM",
            "Advanced Accounting",
            "Partnership Accounts",
            "ICAI Exam",
            "2024",
            "MAY"
        ],
        [
            "Q1",
            problem_bg,
            "1(b)",
            "Pass necessary journal entries for the admission of C and distribution of goodwill and general reserve.",
            5,
            sol_1b,
            wn_1b,
            "MEDIUM",
            "Advanced Accounting",
            "Partnership Accounts",
            "ICAI Exam",
            "2024",
            "MAY"
        ]
    ]

    for idx, row in enumerate(samples, start=2):
        _apply_data_row_style(ws, idx, row, left_align_cols=[2, 4, 6, 7, 9, 10], alt_fill=(idx % 2 == 1))


def generate_question_template(template_type: str = 'all') -> Tuple[io.BytesIO, str]:
    """
    Generates a styled Excel workbook template.
    template_type options:
      - 'all': Master 3-in-1 workbook (Instructions, MCQ, Case Scenario, Descriptive)
      - 'mcq': Dedicated MCQ template
      - 'case_scenario': Dedicated Case Scenario template
      - 'descriptive': Dedicated Descriptive / Problem template
    """
    wb = openpyxl.Workbook()
    norm_type = (template_type or 'all').lower().strip()

    if norm_type in ('mcq', 'type1'):
        ws = wb.active
        _build_mcq_sheet(ws, title="MCQ_Questions")
        filename = "QBank_MCQ_Template.xlsx"

    elif norm_type in ('case_scenario', 'casescenario', 'scenario', 'type2'):
        ws = wb.active
        _build_case_scenario_sheet(ws, title="Case_Scenarios")
        filename = "QBank_Case_Scenario_Template.xlsx"

    elif norm_type in ('descriptive', 'problem', 'type3'):
        ws = wb.active
        _build_descriptive_sheet(ws, title="Descriptive_Problems")
        filename = "QBank_Descriptive_Problem_Template.xlsx"

    else:
        # Master 3-in-1 template
        ws_inst = wb.active
        _build_instructions_sheet(ws_inst)

        ws_mcq = wb.create_sheet(title="1_MCQ_Questions")
        _build_mcq_sheet(ws_mcq)

        ws_cs = wb.create_sheet(title="2_Case_Scenarios")
        _build_case_scenario_sheet(ws_cs)

        ws_prob = wb.create_sheet(title="3_Descriptive_Problems")
        _build_descriptive_sheet(ws_prob)

        filename = "QBank_Master_Import_Template.xlsx"

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer, filename


# ─────────────────────────────────────────────────────────────────────────────
# 2. ROBUST EXCEL QUESTION IMPORTER
# ─────────────────────────────────────────────────────────────────────────────

def _clean_str(val: Any) -> str:
    """Safely converts and cleans string values."""
    if val is None:
        return ''
    s = str(val).strip()
    return '' if s.lower() in ('none', 'null', 'nan') else s


def _clean_int(val: Any, default: int = 1) -> int:
    """Safely parses integer values."""
    if val is None:
        return default
    try:
        # Handles floats like '2.0' in Excel
        return int(float(str(val).strip()))
    except (ValueError, TypeError):
        return default


def _normalize_header(h: Any) -> str:
    """Normalizes Excel column headers for resilient dictionary lookups."""
    if not h:
        return ''
    s = str(h).strip().lower()
    s = re.sub(r'[^a-z0-9]', '_', s)
    s = re.sub(r'_+', '_', s).strip('_')
    return s


def _resolve_subject_topic(subject_name: str, topic_name: str) -> Tuple[Optional[Subject], Optional[Topic]]:
    """Resolves or looks up Subject and Topic models by name."""
    subject = None
    topic = None
    if subject_name:
        subject = Subject.objects.filter(name__iexact=subject_name).first()
        if not subject:
            subject = Subject.objects.filter(name__icontains=subject_name).first()
    if topic_name:
        if subject:
            topic = Topic.objects.filter(subject=subject, name__iexact=topic_name).first()
            if not topic:
                topic = Topic.objects.filter(subject=subject, name__icontains=topic_name).first()
        else:
            topic = Topic.objects.filter(name__iexact=topic_name).first()
    return subject, topic


def _process_mcq_rows(rows: List[Dict[str, Any]], user: Any) -> Tuple[int, List[str], List[str]]:
    """Imports rows into MCQ questions."""
    created_count = 0
    skipped_rows = []
    error_rows = []

    for item in rows:
        row_num = item.get('__row_num__', 0)
        q_text = _clean_str(item.get('question_text') or item.get('question') or item.get('stem'))
        opt_a = _clean_str(item.get('option_a') or item.get('a'))
        opt_b = _clean_str(item.get('option_b') or item.get('b'))
        opt_c = _clean_str(item.get('option_c') or item.get('c'))
        opt_d = _clean_str(item.get('option_d') or item.get('d'))
        correct_raw = _clean_str(item.get('correct_option') or item.get('correct_answer') or item.get('answer')).upper()

        if not q_text or not (opt_a or opt_b):
            skipped_rows.append(f"Row {row_num}: missing question text or options.")
            continue

        # Extract correct option letter (A, B, C, or D)
        correct_letter = 'A'
        m = re.search(r'\b([A-D])\b', correct_raw)
        if m:
            correct_letter = m.group(1)
        elif correct_raw in ('1', '2', '3', '4'):
            correct_letter = {'1': 'A', '2': 'B', '3': 'C', '4': 'D'}[correct_raw]

        q_no = _clean_str(item.get('q_no') or item.get('question_no') or item.get('qno')) or f"MCQ-{row_num}"
        marks = _clean_int(item.get('marks') or item.get('mark'), default=1)
        diff = _clean_str(item.get('difficulty')).upper()
        if diff not in ('EASY', 'MEDIUM', 'HARD'):
            diff = 'MEDIUM'
        explanation = _clean_str(item.get('explanation') or item.get('solution'))
        source = _clean_str(item.get('source')) or 'EXCEL'
        year = _clean_str(item.get('year')) or '2024'
        attempt = _clean_str(item.get('attempt')).upper() or 'MAY'

        subject_str = _clean_str(item.get('subject'))
        topic_str = _clean_str(item.get('topic'))
        subject, topic = _resolve_subject_topic(subject_str, topic_str)

        try:
            with transaction.atomic():
                q = SubjectiveQuestion.objects.create(
                    question_type='MCQ',
                    q_no=q_no,
                    question_text=q_text,
                    correct_answer=f"Option {correct_letter}",
                    explanation=explanation,
                    marks=marks,
                    difficulty=diff,
                    status='ACTIVE',
                    source=source,
                    year=year,
                    attempt=attempt,
                    subject=subject,
                    topic=topic,
                    created_by=user,
                )

                # Create 4 options
                options_data = [
                    ('A', opt_a),
                    ('B', opt_b),
                    ('C', opt_c),
                    ('D', opt_d),
                ]
                for idx, (letter, text) in enumerate(options_data, start=1):
                    if text:
                        QuestionOption.objects.create(
                            question=q,
                            text=text,
                            is_correct=(letter == correct_letter),
                            order=idx
                        )

                # Create answer record
                if explanation or correct_letter:
                    Answer.objects.create(
                        question=q,
                        answer_content=f"Correct Option: {correct_letter}\n\nExplanation:\n{explanation}" if explanation else f"Correct Option: {correct_letter}",
                        matching_status='matched'
                    )

                created_count += 1
        except Exception as e:
            error_rows.append(f"Row {row_num} (MCQ): {str(e)}")

    return created_count, skipped_rows, error_rows


def _process_case_scenario_rows(rows: List[Dict[str, Any]], user: Any) -> Tuple[int, int, List[str], List[str]]:
    """Groups rows by Case Scenario ID and creates parent scenario questions with sub-questions."""
    scenarios_created = 0
    sub_questions_created = 0
    skipped_rows = []
    error_rows = []

    # Group by scenario id
    grouped: Dict[str, List[Dict[str, Any]]] = {}
    for item in rows:
        scenario_id = _clean_str(
            item.get('case_scenario_id') or item.get('scenario_id') or
            item.get('scenario_no') or item.get('case_no') or item.get('q_no')
        )
        if not scenario_id:
            scenario_id = f"CS-AUTO-{item.get('__row_num__', 0)}"
        grouped.setdefault(scenario_id, []).append(item)

    for scenario_id, group in grouped.items():
        # Find passage
        passage = ''
        subject_str = ''
        topic_str = ''
        source = 'EXCEL'
        year = '2024'
        attempt = 'MAY'
        diff = 'MEDIUM'

        for r in group:
            p = _clean_str(r.get('case_passage') or r.get('passage') or r.get('scenario_text') or r.get('case_text'))
            if p and len(p) > len(passage):
                passage = p
            if not subject_str and _clean_str(r.get('subject')):
                subject_str = _clean_str(r.get('subject'))
            if not topic_str and _clean_str(r.get('topic')):
                topic_str = _clean_str(r.get('topic'))
            if _clean_str(r.get('source')):
                source = _clean_str(r.get('source'))
            if _clean_str(r.get('year')):
                year = _clean_str(r.get('year'))
            if _clean_str(r.get('attempt')):
                attempt = _clean_str(r.get('attempt')).upper()
            if _clean_str(r.get('difficulty')):
                diff = _clean_str(r.get('difficulty')).upper()

        if not passage:
            # Check if first sub-question text has content
            passage = f"Case Scenario {scenario_id}"

        # Calculate total marks
        total_marks = sum(_clean_int(r.get('marks') or r.get('sub_marks'), default=2) for r in group) or 2
        subject, topic = _resolve_subject_topic(subject_str, topic_str)

        try:
            with transaction.atomic():
                parent_q = SubjectiveQuestion.objects.create(
                    question_type='CASE_SCENARIO',
                    q_no=scenario_id,
                    question_text=passage,
                    case_scenario_passage=passage,
                    marks=total_marks,
                    difficulty=diff if diff in ('EASY', 'MEDIUM', 'HARD') else 'MEDIUM',
                    status='ACTIVE',
                    source=source,
                    year=year,
                    attempt=attempt,
                    subject=subject,
                    topic=topic,
                    created_by=user,
                )

                # Create Scenario record
                scenario_obj = Scenario.objects.create(
                    parent_question=parent_q,
                    scenario_text=passage
                )
                parent_q.scenario = scenario_obj
                parent_q.save(update_fields=['scenario'])

                # Process sub-questions
                for idx, r in enumerate(group, start=1):
                    row_num = r.get('__row_num__', 0)
                    sub_q_no = _clean_str(
                        r.get('sub_q_no') or r.get('sub_question_no') or
                        r.get('sub_part_no') or r.get('part')
                    ) or str(idx)
                    sub_q_text = _clean_str(
                        r.get('sub_question_text') or r.get('question_text') or r.get('question')
                    )
                    if not sub_q_text:
                        skipped_rows.append(f"Row {row_num}: Sub-question in {scenario_id} has no question text.")
                        continue

                    sub_marks = _clean_int(r.get('marks') or r.get('sub_marks'), default=2)
                    explanation = _clean_str(r.get('explanation') or r.get('solution'))
                    opt_a = _clean_str(r.get('option_a') or r.get('a'))
                    opt_b = _clean_str(r.get('option_b') or r.get('b'))
                    opt_c = _clean_str(r.get('option_c') or r.get('c'))
                    opt_d = _clean_str(r.get('option_d') or r.get('d'))
                    has_options = bool(opt_a or opt_b)

                    correct_raw = _clean_str(r.get('correct_option') or r.get('correct_answer') or r.get('answer')).upper()
                    correct_letter = 'A'
                    m = re.search(r'\b([A-D])\b', correct_raw)
                    if m:
                        correct_letter = m.group(1)

                    sub_q = SubQuestion.objects.create(
                        parent_question=parent_q,
                        scenario=scenario_obj,
                        identifier=sub_q_no,
                        sub_question_number=sub_q_no,
                        question_text=sub_q_text,
                        question_type='MCQ' if has_options else 'NORMAL',
                        marks=sub_marks,
                        correct_answer=f"Option {correct_letter}" if has_options else (correct_raw or explanation),
                        matching_status='matched'
                    )

                    if has_options:
                        options_data = [
                            ('A', opt_a),
                            ('B', opt_b),
                            ('C', opt_c),
                            ('D', opt_d),
                        ]
                        for o_idx, (letter, text) in enumerate(options_data, start=1):
                            if text:
                                QuestionOption.objects.create(
                                    sub_question=sub_q,
                                    text=text,
                                    is_correct=(letter == correct_letter),
                                    order=o_idx
                                )

                    # Create Answer record
                    ans_text = f"Correct Option: {correct_letter}\n\nExplanation:\n{explanation}" if explanation else (f"Correct Option: {correct_letter}" if has_options else explanation)
                    Answer.objects.create(
                        question=parent_q,
                        sub_question=sub_q,
                        answer_content=ans_text,
                        matching_status='matched'
                    )
                    sub_questions_created += 1

                scenarios_created += 1
        except Exception as e:
            error_rows.append(f"Scenario {scenario_id}: {str(e)}")

    return scenarios_created, sub_questions_created, skipped_rows, error_rows


def _process_descriptive_problem_rows(rows: List[Dict[str, Any]], user: Any) -> Tuple[int, int, List[str], List[str]]:
    """Groups rows by Question No and creates descriptive problem questions with sub-parts and working notes."""
    problems_created = 0
    sub_parts_created = 0
    skipped_rows = []
    error_rows = []

    # Group by Question No
    grouped: Dict[str, List[Dict[str, Any]]] = {}
    for item in rows:
        q_no = _clean_str(
            item.get('question_no') or item.get('q_no') or
            item.get('problem_no') or item.get('qno')
        )
        if not q_no:
            q_no = f"Q-AUTO-{item.get('__row_num__', 0)}"
        grouped.setdefault(q_no, []).append(item)

    for q_no, group in grouped.items():
        # Find problem background
        main_text = ''
        subject_str = ''
        topic_str = ''
        source = 'EXCEL'
        year = '2024'
        attempt = 'MAY'
        diff = 'MEDIUM'

        for r in group:
            t = _clean_str(
                r.get('problem_background_main_text') or r.get('problem_background') or
                r.get('main_text') or r.get('question_text') or r.get('problem_text')
            )
            if t and len(t) > len(main_text):
                main_text = t
            if not subject_str and _clean_str(r.get('subject')):
                subject_str = _clean_str(r.get('subject'))
            if not topic_str and _clean_str(r.get('topic')):
                topic_str = _clean_str(r.get('topic'))
            if _clean_str(r.get('source')):
                source = _clean_str(r.get('source'))
            if _clean_str(r.get('year')):
                year = _clean_str(r.get('year'))
            if _clean_str(r.get('attempt')):
                attempt = _clean_str(r.get('attempt')).upper()
            if _clean_str(r.get('difficulty')):
                diff = _clean_str(r.get('difficulty')).upper()

        if not main_text:
            main_text = f"Problem {q_no}"

        subject, topic = _resolve_subject_topic(subject_str, topic_str)
        total_marks = sum(
            _clean_int(r.get('sub_part_marks') or r.get('marks') or r.get('sub_marks'), default=5)
            for r in group
        ) or 5

        try:
            with transaction.atomic():
                parent_q = SubjectiveQuestion.objects.create(
                    question_type='NORMAL',
                    q_no=q_no,
                    question_text=main_text,
                    marks=total_marks,
                    difficulty=diff if diff in ('EASY', 'MEDIUM', 'HARD') else 'MEDIUM',
                    status='ACTIVE',
                    source=source,
                    year=year,
                    attempt=attempt,
                    subject=subject,
                    topic=topic,
                    created_by=user,
                )

                # If this group has sub-parts
                has_explicit_subparts = any(
                    _clean_str(r.get('sub_part_no') or r.get('sub_part_question_text') or r.get('part'))
                    for r in group
                )

                if has_explicit_subparts:
                    for idx, r in enumerate(group, start=1):
                        row_num = r.get('__row_num__', 0)
                        sub_part_no = _clean_str(
                            r.get('sub_part_no') or r.get('sub_q_no') or
                            r.get('part') or r.get('sub_part')
                        ) or f"1({chr(96 + idx)})"
                        sub_text = _clean_str(
                            r.get('sub_part_question_text') or r.get('sub_question_text') or
                            r.get('question_text') or r.get('sub_part')
                        ) or f"Sub-part {sub_part_no}"

                        sub_marks = _clean_int(r.get('sub_part_marks') or r.get('marks'), default=5)
                        sol_text = _clean_str(r.get('solution_answer_text') or r.get('solution') or r.get('correct_answer') or r.get('answer'))
                        wn = _clean_str(r.get('working_notes') or r.get('working_note') or r.get('notes'))

                        full_ans = sol_text
                        if wn:
                            full_ans = f"{sol_text}\n\nWorking Notes:\n{wn}" if sol_text else f"Working Notes:\n{wn}"

                        sub_q = SubQuestion.objects.create(
                            parent_question=parent_q,
                            identifier=sub_part_no,
                            sub_question_number=sub_part_no,
                            question_text=sub_text,
                            question_type='NORMAL',
                            marks=sub_marks,
                            correct_answer=sol_text or full_ans,
                            matching_status='matched'
                        )

                        Answer.objects.create(
                            question=parent_q,
                            sub_question=sub_q,
                            answer_content=full_ans,
                            matching_status='matched'
                        )
                        sub_parts_created += 1
                else:
                    # Single descriptive question without sub-parts
                    sol_text = _clean_str(group[0].get('solution_answer_text') or group[0].get('correct_answer') or group[0].get('answer') or group[0].get('solution'))
                    wn = _clean_str(group[0].get('working_notes') or group[0].get('notes'))
                    full_ans = sol_text
                    if wn:
                        full_ans = f"{sol_text}\n\nWorking Notes:\n{wn}" if sol_text else f"Working Notes:\n{wn}"

                    parent_q.correct_answer = sol_text or full_ans
                    parent_q.save(update_fields=['correct_answer'])

                    Answer.objects.create(
                        question=parent_q,
                        answer_content=full_ans,
                        matching_status='matched'
                    )

                problems_created += 1
        except Exception as e:
            error_rows.append(f"Problem {q_no}: {str(e)}")

    return problems_created, sub_parts_created, skipped_rows, error_rows


def import_questions_from_excel(file_obj: Any, user: Any) -> Dict[str, Any]:
    """
    Master Excel Importer.
    Supports:
      1. Multi-sheet master workbooks (1_MCQ_Questions, 2_Case_Scenarios, 3_Descriptive_Problems).
      2. Single-sheet dedicated workbooks for MCQ, Case Scenario, or Descriptive Problems.
      3. Legacy flat question sheets.
    """
    try:
        wb = openpyxl.load_workbook(file_obj, data_only=True)
    except Exception as e:
        return {
            'success': False,
            'error': f'Invalid Excel file: {str(e)}. Please upload a valid .xlsx file.'
        }

    all_sheets = wb.sheetnames
    if not all_sheets:
        return {'success': False, 'error': 'The uploaded Excel file has no worksheets.'}

    # Summary accumulators
    mcq_created = 0
    scenarios_created = 0
    scenario_subs_created = 0
    problems_created = 0
    problem_subs_created = 0
    all_skipped = []
    all_errors = []

    # Helper to parse sheet rows into normalized dicts
    def parse_sheet_rows(sheet) -> Tuple[List[Dict[str, Any]], Dict[str, int]]:
        raw_rows = list(sheet.iter_rows(values_only=True))
        if not raw_rows:
            return [], {}
        # Find first non-empty row as header
        header_row_idx = 0
        while header_row_idx < len(raw_rows) and not any(raw_rows[header_row_idx]):
            header_row_idx += 1
        if header_row_idx >= len(raw_rows):
            return [], {}

        raw_headers = raw_rows[header_row_idx]
        header_map = {}
        for c_idx, h in enumerate(raw_headers):
            if h is not None:
                norm_h = _normalize_header(h)
                if norm_h:
                    header_map[norm_h] = c_idx

        parsed_data = []
        for r_offset, r_vals in enumerate(raw_rows[header_row_idx + 1:], start=header_row_idx + 2):
            if not any(r_vals):
                continue
            row_dict = {'__row_num__': r_offset}
            for col_name, c_idx in header_map.items():
                if c_idx < len(r_vals):
                    row_dict[col_name] = r_vals[c_idx]
            parsed_data.append(row_dict)

        return parsed_data, header_map

    # Check sheet names
    def classify_sheet(name: str, headers: Dict[str, int]) -> str:
        nl = name.lower()
        if 'instruct' in nl or 'guide' in nl or 'readme' in nl:
            return 'IGNORE'
        if 'mcq' in nl or 'objective' in nl:
            return 'MCQ'
        if 'scenario' in nl or 'case' in nl:
            return 'CASE_SCENARIO'
        if 'descript' in nl or 'problem' in nl or 'theory' in nl or 'normal' in nl:
            return 'DESCRIPTIVE'

        # Fallback inspection by headers
        if any(k in headers for k in ('case_passage', 'case_scenario_id', 'scenario_no', 'scenario_id')):
            return 'CASE_SCENARIO'
        if any(k in headers for k in ('sub_part_no', 'sub_part_question_text', 'problem_background', 'working_notes')):
            return 'DESCRIPTIVE'
        if any(k in headers for k in ('option_a', 'opt_a', 'option_b', 'correct_option')):
            return 'MCQ'
        return 'UNKNOWN'

    sheets_to_process = []
    for s_name in all_sheets:
        ws = wb[s_name]
        data, h_map = parse_sheet_rows(ws)
        if not data:
            continue
        classification = classify_sheet(s_name, h_map)
        if classification != 'IGNORE':
            sheets_to_process.append((s_name, classification, data, h_map))

    if not sheets_to_process:
        return {'success': False, 'error': 'No readable question data found in any worksheet.'}

    for s_name, s_type, data, h_map in sheets_to_process:
        if s_type == 'MCQ':
            c, sk, err = _process_mcq_rows(data, user)
            mcq_created += c
            all_skipped.extend([f"[{s_name}] {s}" for s in sk])
            all_errors.extend([f"[{s_name}] {e}" for e in err])

        elif s_type == 'CASE_SCENARIO':
            sc_c, sub_c, sk, err = _process_case_scenario_rows(data, user)
            scenarios_created += sc_c
            scenario_subs_created += sub_c
            all_skipped.extend([f"[{s_name}] {s}" for s in sk])
            all_errors.extend([f"[{s_name}] {e}" for e in err])

        elif s_type == 'DESCRIPTIVE':
            pr_c, sub_c, sk, err = _process_descriptive_problem_rows(data, user)
            problems_created += pr_c
            problem_subs_created += sub_c
            all_skipped.extend([f"[{s_name}] {s}" for s in sk])
            all_errors.extend([f"[{s_name}] {e}" for e in err])

        else:
            # UNKNOWN fallback: check if rows have a question_type column
            has_qtype = any('question_type' in r for r in data)
            if has_qtype:
                mcq_subset = [r for r in data if _clean_str(r.get('question_type')).upper() == 'MCQ']
                cs_subset = [r for r in data if 'CASE' in _clean_str(r.get('question_type')).upper()]
                desc_subset = [r for r in data if r not in mcq_subset and r not in cs_subset]

                if mcq_subset:
                    c, sk, err = _process_mcq_rows(mcq_subset, user)
                    mcq_created += c
                if cs_subset:
                    sc_c, sub_c, sk, err = _process_case_scenario_rows(cs_subset, user)
                    scenarios_created += sc_c
                    scenario_subs_created += sub_c
                if desc_subset:
                    pr_c, sub_c, sk, err = _process_descriptive_problem_rows(desc_subset, user)
                    problems_created += pr_c
                    problem_subs_created += sub_c
            else:
                # Default to descriptive or standard
                pr_c, sub_c, sk, err = _process_descriptive_problem_rows(data, user)
                problems_created += pr_c
                problem_subs_created += sub_c
                all_skipped.extend([f"[{s_name}] {s}" for s in sk])
                all_errors.extend([f"[{s_name}] {e}" for e in err])

    total_created = mcq_created + scenarios_created + problems_created

    # Construct descriptive success message
    parts = []
    if mcq_created:
        parts.append(f"{mcq_created} MCQ(s)")
    if scenarios_created:
        parts.append(f"{scenarios_created} Case Scenario(s) ({scenario_subs_created} sub-questions)")
    if problems_created:
        parts.append(f"{problems_created} Descriptive Problem(s) ({problem_subs_created} sub-parts)")

    summary_details = ", ".join(parts) if parts else "0 questions"

    return {
        'success': total_created > 0,
        'message': f"Import complete: Created {total_created} question(s) [{summary_details}].",
        'total_created': total_created,
        'mcq_count': mcq_created,
        'scenario_count': scenarios_created,
        'scenario_sub_count': scenario_subs_created,
        'problem_count': problems_created,
        'problem_sub_count': problem_subs_created,
        'skipped_count': len(all_skipped),
        'error_count': len(all_errors),
        'skipped_rows': all_skipped[:10],
        'error_rows': all_errors[:10],
    }
