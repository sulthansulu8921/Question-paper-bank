from rest_framework import viewsets, permissions
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

class IsStaffOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user and request.user.is_staff

class SubjectiveQuestionViewSet(viewsets.ModelViewSet):
    queryset = SubjectiveQuestion.objects.all()
    serializer_class = SubjectiveQuestionSerializer
    permission_classes = [IsStaffOrReadOnly]

    def get_queryset(self):
        queryset = SubjectiveQuestion.objects.all()
        subject_id = self.request.query_params.get('subject_id')
        if subject_id:
            queryset = queryset.filter(subject_id=subject_id)
        return queryset

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
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]

    def get(self, request):
        stats = {
            "total_questions": SubjectiveQuestion.objects.count(),
            "total_subjects": Subject.objects.count(),
            "mcq_questions": MCQ.objects.count(),
            "theory_questions": SubjectiveQuestion.objects.count(), # Considering subjective as theory
            "total_users": User.objects.count(),
            "total_uploads": QuestionPaper.objects.count() + SubjectiveQuestion.objects.count(),
            "recent_activity": []
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

        # Sort combined activity by time
        stats["recent_activity"].sort(key=lambda x: x["time"], reverse=True)
        stats["recent_activity"] = stats["recent_activity"][:8]

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
