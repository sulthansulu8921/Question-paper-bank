from rest_framework import viewsets, permissions
from rest_framework.pagination import PageNumberPagination
from materials.models import (
    QuestionPaper, AnswerPaper, Notes, Video, MCQ, Bookmark, SubjectiveQuestion, Feedback,
    AssessmentSession, AssessmentAnswer, MockTestTemplate
)
from materials.serializers import (
    QuestionPaperSerializer, AnswerPaperSerializer, NotesSerializer, 
    VideoSerializer, MCQSerializer, BookmarkSerializer, SubjectiveQuestionSerializer, FeedbackSerializer,
    AssessmentSessionSerializer, AssessmentAnswerSerializer, MockTestTemplateSerializer
)
from rest_framework.views import APIView
from rest_framework.response import Response
from courses.models import Subject
from django.contrib.auth import get_user_model
User = get_user_model()
from authentication.permissions import IsSuperUser
from subscriptions.permissions import (
    HasVideoAccess, HasNotesAccess, HasQuestionBankAccess,
    HasMockTestAccess, HasLiveClassAccess, HasDownloadPermission
)

class IsStaffOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        user = request.user
        return bool(user and user.is_authenticated and (
            user.is_superuser or 
            user.role in ['SUPER_ADMIN', 'QUESTION_ADMIN']
        ))


class IsQuestionAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and (
            user.is_superuser or 
            user.role in ['SUPER_ADMIN', 'QUESTION_ADMIN']
        ))


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

        course_id = params.get('course_id')
        if course_id:
            from django.db.models import Q
            from courses.models import Course
            try:
                course = Course.objects.get(id=course_id)
                queryset = queryset.filter(
                    Q(subject__course_id=course_id) |
                    Q(icai_topic__chapter__paper__level__name__iexact=course.name)
                )
            except Course.DoesNotExist:
                queryset = queryset.filter(subject__course_id=course_id)

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

        level_id = params.get('level_id')
        if level_id:
            queryset = queryset.filter(icai_topic__chapter__paper__level_id=level_id)

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

    def _get_access_limit(self, request):
        """
        Returns (limit, has_full_access):
        - Staff/superuser → -1 (unlimited)
        - Active premium subscription matching paper/group → -1 (unlimited)
        - Within 2 free trial papers → -1 (unlimited)
        - Free user / no matching sub → plan's free_questions_per_chapter (default 3)
        """
        user = request.user

        # Staff / admin always get full access
        if user and user.is_authenticated and (user.is_staff or user.is_superuser):
            return -1, True

        from django.utils import timezone
        from subscriptions.models import UserSubscription, UserViewedPaper
        from master_data.models import ICAIPaper

        if user and user.is_authenticated:
            # 1. Check if user has active subscription matching this content
            active_subs = UserSubscription.objects.filter(
                user=user,
                is_active=True,
                end_date__gte=timezone.now()
            ).select_related('plan', 'subject', 'level')

            paper_id = request.query_params.get('paper_id')
            subject_id = request.query_params.get('subject_id')

            has_sub_access = False
            for sub in active_subs:
                if not getattr(sub.plan, 'question_bank_access', True):
                    continue

                if paper_id:
                    try:
                        paper = ICAIPaper.objects.get(id=paper_id)
                        
                        # Match level
                        sub_level = sub.level or (sub.plan.level_specific if sub.plan else None)
                        if sub_level and sub_level != paper.level:
                            continue

                        # Match scope
                        if sub.plan.scope == 'GROUP_WISE':
                            paper_num = None
                            code_str = ((paper.code or '') + (paper.name or '')).lower()
                            if any(x in code_str for x in ['paper 1', 'paper 2', 'paper 3']):
                                paper_num = 1
                            elif any(x in code_str for x in ['paper 4', 'paper 5', 'paper 6']):
                                paper_num = 4
                            else:
                                if paper.order <= 3:
                                    paper_num = 1
                                else:
                                    paper_num = 4

                            if sub.group == 'ALL':
                                has_sub_access = True
                                break
                            elif sub.group == 'GROUP_1' and paper_num is not None and paper_num <= 3:
                                has_sub_access = True
                                break
                            elif sub.group == 'GROUP_2' and paper_num is not None and paper_num >= 4:
                                has_sub_access = True
                                break

                        elif sub.plan.scope == 'PAPER_WISE':
                            if sub.subject:
                                sub_name = sub.subject.name.lower().strip()
                                pap_name = paper.name.lower().strip()
                                if sub_name in pap_name or pap_name in sub_name:
                                    has_sub_access = True
                                    break
                    except ICAIPaper.DoesNotExist:
                        pass

                elif subject_id:
                    if sub.plan.scope == 'GROUP_WISE':
                        has_sub_access = True
                        break
                    elif sub.plan.scope == 'PAPER_WISE' and sub.subject_id and str(sub.subject_id) == str(subject_id):
                        has_sub_access = True
                        break
                else:
                    # Generic check if no paper_id/subject_id
                    has_sub_access = True
                    break

            if has_sub_access:
                return -1, True

            # 2. Check if within 2 free trial papers
            if paper_id:
                already_viewed = UserViewedPaper.objects.filter(user=user, paper_id=paper_id).exists()
                if already_viewed:
                    return -1, True
                viewed_count = UserViewedPaper.objects.filter(user=user).count()
                if viewed_count < 2:
                    return -1, True

            # Has active subscriptions but none match this content — use free limit from first plan
            if active_subs.exists():
                limit = active_subs.first().plan.free_questions_per_chapter
                return limit, limit == -1

        # Guest / no subscription → default free limit = 3
        return 3, False

    def list(self, request, *args, **kwargs):
        user = request.user
        paper_id = request.query_params.get('paper_id')

        # Gating check on list level
        if paper_id:
            from subscriptions.models import UserSubscription, UserViewedPaper
            from django.utils import timezone
            from master_data.models import ICAIPaper

            has_sub_access = False
            if user and user.is_authenticated:
                if user.is_staff or user.is_superuser:
                    has_sub_access = True
                else:
                    active_subs = UserSubscription.objects.filter(
                        user=user,
                        is_active=True,
                        end_date__gte=timezone.now()
                    ).select_related('plan', 'subject', 'level')

                    try:
                        paper = ICAIPaper.objects.get(id=paper_id)
                        for sub in active_subs:
                            if not getattr(sub.plan, 'question_bank_access', True):
                                continue
                            
                            sub_level = sub.level or (sub.plan.level_specific if sub.plan else None)
                            if sub_level and sub_level != paper.level:
                                continue

                            if sub.plan.scope == 'GROUP_WISE':
                                paper_num = None
                                code_str = ((paper.code or '') + (paper.name or '')).lower()
                                if any(x in code_str for x in ['paper 1', 'paper 2', 'paper 3']):
                                    paper_num = 1
                                elif any(x in code_str for x in ['paper 4', 'paper 5', 'paper 6']):
                                    paper_num = 4
                                else:
                                    if paper.order <= 3:
                                        paper_num = 1
                                    else:
                                        paper_num = 4

                                if sub.group == 'ALL':
                                    has_sub_access = True
                                    break
                                elif sub.group == 'GROUP_1' and paper_num is not None and paper_num <= 3:
                                    has_sub_access = True
                                    break
                                elif sub.group == 'GROUP_2' and paper_num is not None and paper_num >= 4:
                                    has_sub_access = True
                                    break
                            elif sub.plan.scope == 'PAPER_WISE':
                                if sub.subject:
                                    sub_name = sub.subject.name.lower().strip()
                                    pap_name = paper.name.lower().strip()
                                    if sub_name in pap_name or pap_name in sub_name:
                                        has_sub_access = True
                                        break
                    except ICAIPaper.DoesNotExist:
                        pass

            if not has_sub_access:
                if not user or not user.is_authenticated:
                    from rest_framework.exceptions import PermissionDenied
                    raise PermissionDenied({
                        "detail": "subscription_required",
                        "message": "Authentication required. Please log in."
                    })

                already_viewed = UserViewedPaper.objects.filter(user=user, paper_id=paper_id).exists()
                if not already_viewed:
                    viewed_count = UserViewedPaper.objects.filter(user=user).count()
                    if viewed_count >= 2:
                        from rest_framework.exceptions import PermissionDenied
                        raise PermissionDenied({
                            "detail": "subscription_required",
                            "message": "You have reached your limit of 2 free trial papers. Please select a plan to unlock more papers."
                        })
                    else:
                        from django.db import IntegrityError
                        try:
                            UserViewedPaper.objects.create(user=user, paper_id=paper_id)
                        except IntegrityError:
                            pass

        queryset = self.filter_queryset(self.get_queryset())
        total_count = queryset.count()

        access_limit, has_full_access = self._get_access_limit(request)

        # Apply limit server-side (never send locked questions to client)
        if not has_full_access and access_limit >= 0:
            visible_qs = queryset[:access_limit]
            locked_count = max(0, total_count - access_limit)
        else:
            visible_qs = queryset
            locked_count = 0

        page = self.paginate_queryset(visible_qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            response = self.get_paginated_response(serializer.data)
            response.data['locked_count'] = locked_count
            response.data['access_limit'] = access_limit
            response.data['has_full_access'] = has_full_access
            return response

        serializer = self.get_serializer(visible_qs, many=True)
        return Response({
            'results': serializer.data,
            'count': len(serializer.data),
            'locked_count': locked_count,
            'access_limit': access_limit,
            'has_full_access': has_full_access,
        })

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

class QuestionPaperViewSet(viewsets.ModelViewSet):
    queryset = QuestionPaper.objects.all()
    serializer_class = QuestionPaperSerializer
    permission_classes = [IsStaffOrReadOnly]

    def get_queryset(self):
        queryset = self.queryset.order_by('-year', 'id')
        subject_id = self.request.query_params.get('subject_id')
        course_id = self.request.query_params.get('course_id')
        if subject_id:
            queryset = queryset.filter(subject_id=subject_id)
        if course_id:
            queryset = queryset.filter(course_id=course_id)
        return queryset

class AnswerPaperViewSet(viewsets.ModelViewSet):
    queryset = AnswerPaper.objects.all()
    serializer_class = AnswerPaperSerializer
    permission_classes = [IsStaffOrReadOnly]

class NotesViewSet(viewsets.ModelViewSet):
    queryset = Notes.objects.all()
    serializer_class = NotesSerializer
    permission_classes = [IsStaffOrReadOnly, HasNotesAccess]

    def get_queryset(self):
        queryset = self.queryset.order_by('id')
        subject_id = self.request.query_params.get('subject_id')
        course_id = self.request.query_params.get('course_id')
        if subject_id:
            queryset = queryset.filter(subject_id=subject_id)
        if course_id:
            queryset = queryset.filter(course_id=course_id)
        return queryset

class VideoViewSet(viewsets.ModelViewSet):
    queryset = Video.objects.all()
    serializer_class = VideoSerializer
    permission_classes = [IsStaffOrReadOnly, HasVideoAccess]

    def get_queryset(self):
        queryset = self.queryset.order_by('id')
        subject_id = self.request.query_params.get('subject_id')
        course_id = self.request.query_params.get('course_id')
        if subject_id:
            queryset = queryset.filter(subject_id=subject_id)
        if course_id:
            queryset = queryset.filter(course_id=course_id)
        return queryset

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
        from courses.models import Course, Subject
        from materials.models import MaterialDownload, Notes, Video, QuestionPaper, SubjectiveQuestion, MCQ, Feedback

        # Calculate revenue & active subscriptions
        revenue_data = Payment.objects.filter(status='SUCCESS').aggregate(total=Sum('amount'))
        total_revenue = float(revenue_data['total'] or 0.0)
        
        active_subs_count = UserSubscription.objects.filter(is_active=True, end_date__gte=timezone.now()).count()
        expired_subs_count = UserSubscription.objects.filter(is_active=True, end_date__lt=timezone.now()).count()
        
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

        # Recent Registrations list
        recent_registrations = []
        for u in User.objects.filter(is_staff=False).order_by('-date_joined')[:10]:
            recent_registrations.append({
                "id": u.id,
                "first_name": u.first_name,
                "last_name": u.last_name,
                "email": u.email,
                "mobile_number": u.mobile_number,
                "date_joined": u.date_joined
            })

        # Recent Payments list
        recent_payments = []
        for p in Payment.objects.order_by('-created_at')[:10]:
            recent_payments.append({
                "id": p.id,
                "user_email": p.user.email,
                "amount": float(p.amount),
                "transaction_id": p.transaction_id,
                "status": p.status,
                "created_at": p.created_at
            })

        # Course-wise Analytics
        course_wise_analytics = []
        for c in Course.objects.all():
            active_count = UserSubscription.objects.filter(
                plan__course_specific=c,
                is_active=True,
                end_date__gte=timezone.now()
            ).count()
            course_wise_analytics.append({
                "course_name": c.name,
                "active_students": active_count
            })

        # Student Activity Logs
        activity_logs = []
        for dl in MaterialDownload.objects.order_by('-downloaded_at')[:10]:
            activity_logs.append({
                "type": "download",
                "text": f"Downloaded {dl.material_title} ({dl.material_type})",
                "user": dl.user.email,
                "time": dl.downloaded_at
            })
        for f in Feedback.objects.order_by('-created_at')[:10]:
            activity_logs.append({
                "type": "feedback",
                "text": f.message,
                "user": f.user.email,
                "time": f.created_at
            })
        for u in User.objects.filter(is_staff=False).order_by('-date_joined')[:10]:
            activity_logs.append({
                "type": "user",
                "text": f"Registered new student account",
                "user": u.email,
                "time": u.date_joined
            })
        activity_logs.sort(key=lambda x: x["time"], reverse=True)
        activity_logs = activity_logs[:15]

        stats = {
            "total_questions": SubjectiveQuestion.objects.count(),
            "total_subjects": Subject.objects.count(),
            "total_users": User.objects.count(),
            "total_students": User.objects.filter(is_staff=False).count(),
            "total_uploads": QuestionPaper.objects.count() + SubjectiveQuestion.objects.count(),
            "total_revenue": total_revenue,
            "active_subscriptions": active_subs_count,
            "expired_subscriptions": expired_subs_count,
            "unpaid_students": unpaid_students_count,
            "total_courses": Course.objects.count(),
            "total_question_papers": QuestionPaper.objects.count(),
            "total_notes": Notes.objects.count(),
            "total_videos": Video.objects.count(),
            "total_downloads": MaterialDownload.objects.count(),
            "recent_registrations": recent_registrations,
            "recent_payments": recent_payments,
            "course_wise_analytics": course_wise_analytics,
            "recent_activity": activity_logs,
            "monthly_charts": monthly_stats
        }

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
    permission_classes = [permissions.IsAuthenticated, IsQuestionAdmin]

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
            "Tags", "Is Important", "Added By", "Created At"
        ]
        col_widths = [6, 10, 6, 8, 8, 8, 12, 7, 10, 10, 60, 60, 20, 20, 30, 20, 12, 20, 18]

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
            
            created_by_str = "System"
            if q.created_by:
                if q.created_by.first_name or q.created_by.last_name:
                    created_by_str = f"{q.created_by.first_name} {q.created_by.last_name}".strip()
                else:
                    created_by_str = q.created_by.email or q.created_by.username

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
                created_by_str,
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
    permission_classes = [permissions.IsAuthenticated, IsQuestionAdmin]
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
                    created_by     = request.user,
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
        file_url  = request.build_absolute_uri(default_storage.url(file_path))

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
        file_url  = request.build_absolute_uri(default_storage.url(file_path))

        return Response({
            'message': 'File uploaded successfully.',
            'url': file_url,
            'file_path': file_path,
            'name': uploaded_file.name,
        }, status=200)


from rest_framework.decorators import action
from materials.models import VideoProgress, MaterialDownload, LiveClass, Notification
from materials.serializers import VideoProgressSerializer, MaterialDownloadSerializer, LiveClassSerializer, NotificationSerializer

class VideoProgressViewSet(viewsets.ModelViewSet):
    serializer_class = VideoProgressSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return VideoProgress.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=['post'], url_path='update')
    def update_progress(self, request):
        video_id = request.data.get('video_id')
        position = request.data.get('position', 0)
        duration = request.data.get('duration', 0)
        if not video_id:
            return Response({'error': 'video_id is required'}, status=400)
        
        percent = 0
        if duration > 0:
            percent = int((float(position) / float(duration)) * 100)
            if percent > 100: percent = 100

        is_completed = percent >= 90 # Mark as completed if 90%+ is watched

        progress, created = VideoProgress.objects.update_or_create(
            user=request.user,
            video_id=video_id,
            defaults={
                'last_position_seconds': int(position),
                'completion_percentage': percent,
                'is_completed': is_completed
            }
        )
        return Response(VideoProgressSerializer(progress).data)


class MaterialDownloadViewSet(viewsets.ModelViewSet):
    serializer_class = MaterialDownloadSerializer
    permission_classes = [permissions.IsAuthenticated, HasDownloadPermission]

    def get_queryset(self):
        if self.request.user.is_staff:
            return MaterialDownload.objects.all().order_by('-downloaded_at')
        return MaterialDownload.objects.filter(user=self.request.user).order_by('-downloaded_at')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class LiveClassViewSet(viewsets.ModelViewSet):
    serializer_class = LiveClassSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), permissions.IsAdminUser()]
        return [permissions.IsAuthenticated(), HasLiveClassAccess()]

    def get_queryset(self):
        course_id = self.request.query_params.get('course_id')
        qs = LiveClass.objects.all().order_by('scheduled_time')
        if course_id:
            qs = qs.filter(course_id=course_id)
        return qs


class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), permissions.IsAdminUser()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        return Notification.objects.all().order_by('-created_at')


from rest_framework.decorators import action
from django.utils import timezone
import random

class MockTestTemplateViewSet(viewsets.ModelViewSet):
    queryset = MockTestTemplate.objects.all().prefetch_related('questions')
    serializer_class = MockTestTemplateSerializer
    
    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), permissions.IsAdminUser()]
        return [permissions.IsAuthenticated(), HasMockTestAccess()]


class AssessmentSessionViewSet(viewsets.ModelViewSet):
    serializer_class = AssessmentSessionSerializer
    permission_classes = [permissions.IsAuthenticated, HasMockTestAccess]

    def get_queryset(self):
        user = self.request.user
        # Staff/admins can see all sessions; students see only their own
        if user.is_staff:
            qs = AssessmentSession.objects.all()
        else:
            qs = AssessmentSession.objects.filter(user=user)
        return qs.prefetch_related(
            'answers', 'answers__question', 'answers__question__options'
        ).select_related('user')

    def perform_create(self, serializer):
        pass

    def create(self, request, *args, **kwargs):
        user = request.user
        data = request.data
        
        mock_template_id = data.get('mock_template_id')
        selected_questions = []
        
        session_type = data.get('session_type', 'PRACTICE')
        title = data.get('title', 'Practice Session')
        qualification = data.get('qualification', '')
        course_level = data.get('course_level', '')
        subject = data.get('subject', '')
        chapter = data.get('chapter', '')
        topic = data.get('topic', '')
        
        total_questions = int(data.get('total_questions', 10))
        difficulty = data.get('difficulty', 'MIXED')
        mode = data.get('mode', 'LEARNING')
        
        if mock_template_id:
            try:
                template = MockTestTemplate.objects.get(id=mock_template_id)
                title = template.title
                session_type = 'MOCK'
                qualification = template.qualification
                course_level = template.course_level
                difficulty = template.difficulty
                total_questions = template.total_questions
                mode = 'CHALLENGE'
                
                template_qs = list(template.questions.all())
                if len(template_qs) > 0:
                    selected_questions = template_qs
                else:
                    # Try 1: Exact match (qualification, level, difficulty)
                    questions_qs = SubjectiveQuestion.objects.filter(
                        status__in=['ACTIVE', 'PUBLISHED'],
                        question_type='MCQ'
                    )
                    if qualification:
                        questions_qs = questions_qs.filter(icai_topic__chapter__paper__level__qualification__iexact=qualification)
                    if course_level:
                        questions_qs = questions_qs.filter(icai_topic__chapter__paper__level__name__iexact=course_level)
                    if difficulty != 'MIXED':
                        questions_qs = questions_qs.filter(difficulty=difficulty)
                    questions_list = list(questions_qs)
                    
                    # Try 2: Ignore difficulty
                    if len(questions_list) == 0 and difficulty != 'MIXED':
                        questions_qs = SubjectiveQuestion.objects.filter(
                            status__in=['ACTIVE', 'PUBLISHED'],
                            question_type='MCQ'
                        )
                        if qualification:
                            questions_qs = questions_qs.filter(icai_topic__chapter__paper__level__qualification__iexact=qualification)
                        if course_level:
                            questions_qs = questions_qs.filter(icai_topic__chapter__paper__level__name__iexact=course_level)
                        questions_list = list(questions_qs)
                        
                    # Try 3: Ignore level (match qualification only)
                    if len(questions_list) == 0:
                        questions_qs = SubjectiveQuestion.objects.filter(
                            status__in=['ACTIVE', 'PUBLISHED'],
                            question_type='MCQ'
                        )
                        if qualification:
                            questions_qs = questions_qs.filter(icai_topic__chapter__paper__level__qualification__iexact=qualification)
                        questions_list = list(questions_qs)
                        
                    # Try 4: Ignore qualification (any MCQs)
                    if len(questions_list) == 0:
                        questions_list = list(SubjectiveQuestion.objects.filter(
                            status__in=['ACTIVE', 'PUBLISHED'],
                            question_type='MCQ'
                        ))
                        
                    # Try 5: Any active/published questions (even subjective/theory/normal)
                    if len(questions_list) == 0:
                        questions_list = list(SubjectiveQuestion.objects.filter(
                            status__in=['ACTIVE', 'PUBLISHED']
                        ))
                        
                    if len(questions_list) > 0:
                        selected_questions = random.sample(questions_list, min(total_questions, len(questions_list)))
            except MockTestTemplate.DoesNotExist:
                return Response({"error": "Mock template not found."}, status=400)
                
        if not selected_questions:
            # Build query to select questions
            questions_qs = SubjectiveQuestion.objects.filter(status__in=['ACTIVE', 'PUBLISHED'])
            
            # Apply hierarchical filters if provided
            if qualification:
                questions_qs = questions_qs.filter(icai_topic__chapter__paper__level__qualification__iexact=qualification)
            if course_level:
                questions_qs = questions_qs.filter(icai_topic__chapter__paper__level__name__iexact=course_level)
            if subject:
                questions_qs = questions_qs.filter(icai_topic__chapter__paper__name__iexact=subject)
            if chapter:
                questions_qs = questions_qs.filter(icai_topic__chapter__name__iexact=chapter)
            if topic:
                questions_qs = questions_qs.filter(icai_topic__name__iexact=topic)
                
            # Apply difficulty filter
            if difficulty != 'MIXED':
                questions_qs = questions_qs.filter(difficulty=difficulty)
                
            # Prioritize MCQ
            questions_qs = questions_qs.filter(question_type='MCQ')
            
            questions_list = list(questions_qs)
            
            # Fallbacks for manual settings
            if len(questions_list) == 0:
                # Try 1: Ignore difficulty
                questions_qs = SubjectiveQuestion.objects.filter(
                    status__in=['ACTIVE', 'PUBLISHED'],
                    question_type='MCQ'
                )
                if qualification:
                    questions_qs = questions_qs.filter(icai_topic__chapter__paper__level__qualification__iexact=qualification)
                if course_level:
                    questions_qs = questions_qs.filter(icai_topic__chapter__paper__level__name__iexact=course_level)
                if subject:
                    questions_qs = questions_qs.filter(icai_topic__chapter__paper__name__iexact=subject)
                questions_list = list(questions_qs)
                
            if len(questions_list) == 0:
                # Try 2: Ignore level (qualification only)
                questions_qs = SubjectiveQuestion.objects.filter(
                    status__in=['ACTIVE', 'PUBLISHED'],
                    question_type='MCQ'
                )
                if qualification:
                    questions_qs = questions_qs.filter(icai_topic__chapter__paper__level__qualification__iexact=qualification)
                questions_list = list(questions_qs)

            if len(questions_list) == 0:
                # Try 3: Ignore qualification (any MCQs)
                questions_list = list(SubjectiveQuestion.objects.filter(
                    status__in=['ACTIVE', 'PUBLISHED'],
                    question_type='MCQ'
                ))
                
            if len(questions_list) == 0:
                # Try 4: Any active/published questions (even subjective/theory/normal)
                questions_list = list(SubjectiveQuestion.objects.filter(
                    status__in=['ACTIVE', 'PUBLISHED']
                ))
                
            if len(questions_list) == 0:
                return Response({"error": "No questions found matching your filter criteria."}, status=400)
                
            # Select random subset
            selected_questions = random.sample(questions_list, min(total_questions, len(questions_list)))
        
        # Create session
        session = AssessmentSession.objects.create(
            user=user,
            session_type=session_type,
            title=title,
            qualification=qualification,
            course_level=course_level,
            subject=subject,
            chapter=chapter,
            topic=topic,
            total_questions=len(selected_questions),
            difficulty=difficulty,
            mode=mode
        )
        
        # Create answers
        for q in selected_questions:
            AssessmentAnswer.objects.create(
                session=session,
                question=q
            )
            
        serializer = self.get_serializer(session)
        return Response(serializer.data, status=201)

    @action(detail=True, methods=['POST'])
    def submit(self, request, pk=None):
        session = self.get_object()
        if session.is_completed:
            return Response({"error": "Session is already completed."}, status=400)
            
        data = request.data
        answers_data = data.get('answers', [])
        duration_seconds = int(data.get('duration_seconds', 0))
        
        total_score = 0
        total_max_score = 0
        correct_count = 0
        
        # Map of answers provided by client: {question_id: {selected_option_id, typed_answer}}
        answers_map = {int(ans['question_id']): ans for ans in answers_data if 'question_id' in ans}
        
        session_answers = session.answers.all().select_related('question')
        for sa in session_answers:
            q = sa.question
            total_max_score += q.marks
            
            client_ans = answers_map.get(q.id)
            if client_ans:
                selected_opt_id = client_ans.get('selected_option_id')
                typed_answer = client_ans.get('typed_answer', '')
                
                sa.typed_answer = typed_answer
                if selected_opt_id:
                    sa.selected_option_id = selected_opt_id
                    
                # Evaluate MCQ
                if q.question_type == 'MCQ' and selected_opt_id:
                    # check correctness
                    correct_opt = q.options.filter(is_correct=True).first()
                    if correct_opt and correct_opt.id == int(selected_opt_id):
                        sa.is_correct = True
                        sa.score_obtained = q.marks
                        correct_count += 1
                    else:
                        sa.is_correct = False
                        sa.score_obtained = 0
                else:
                    # For subjective/theory, auto-mark correct if it matches correct_answer or non-empty
                    if typed_answer.strip():
                        sa.is_correct = True
                        sa.score_obtained = q.marks
                        correct_count += 1
                    else:
                        sa.is_correct = False
                        sa.score_obtained = 0
            else:
                sa.is_correct = False
                sa.score_obtained = 0
                
            sa.save()
            total_score += sa.score_obtained
            
        # Update session
        session.score = total_score
        session.max_score = total_max_score
        session.accuracy = (correct_count / session.total_questions * 100) if session.total_questions > 0 else 0
        session.duration_seconds = duration_seconds
        session.is_completed = True
        session.completed_at = timezone.now()
        session.save()
        
        # Trigger streak/gamification update
        try:
            from gamification.models import UserStats
            xp_gained = correct_count * 10
            coins_gained = correct_count
            
            stats, _ = UserStats.objects.get_or_create(user=session.user)
            stats.xp_points += xp_gained
            stats.coins += coins_gained
            stats.save()
        except Exception:
            pass
            
        serializer = self.get_serializer(session)
        return Response(serializer.data)

    @action(detail=False, methods=['GET'], url_path='weaknesses')
    def weaknesses(self, request):
        user = request.user
        completed_sessions = AssessmentSession.objects.filter(user=user, is_completed=True)
        
        # Aggregate performance by topic/chapter
        topic_stats = {}
        for session in completed_sessions:
            sa_qs = session.answers.all().select_related('question')
            for sa in sa_qs:
                q = sa.question
                topic_name = q.icai_topic.name if q.icai_topic else (session.topic or 'General')
                chapter_name = q.icai_topic.chapter.name if (q.icai_topic and q.icai_topic.chapter) else (session.chapter or 'General')
                subject_name = q.icai_topic.chapter.paper.name if (q.icai_topic and q.icai_topic.chapter and q.icai_topic.chapter.paper) else (session.subject or 'General')
                level_name = q.icai_topic.chapter.paper.level.name if (q.icai_topic and q.icai_topic.chapter and q.icai_topic.chapter.paper and q.icai_topic.chapter.paper.level) else (session.course_level or 'General')
                qual_name = q.icai_topic.chapter.paper.level.qualification if (q.icai_topic and q.icai_topic.chapter and q.icai_topic.chapter.paper and q.icai_topic.chapter.paper.level) else (session.qualification or 'General')
                
                key = (qual_name, level_name, subject_name, chapter_name, topic_name)
                if key not in topic_stats:
                    topic_stats[key] = {'attempted': 0, 'correct': 0}
                
                topic_stats[key]['attempted'] += 1
                if sa.is_correct:
                    topic_stats[key]['correct'] += 1
                    
        weaknesses_list = []
        for key, stats in topic_stats.items():
            attempted = stats['attempted']
            correct = stats['correct']
            accuracy = (correct / attempted * 100) if attempted > 0 else 0
            
            # If accuracy is below 60%, it's classified as a weakness
            if accuracy < 60:
                qual_name, level_name, subject_name, chapter_name, topic_name = key
                recommended_questions = 40 if accuracy < 35 else 25
                weaknesses_list.append({
                    'qualification': qual_name,
                    'course_level': level_name,
                    'subject': subject_name,
                    'chapter': chapter_name,
                    'topic': topic_name,
                    'accuracy': round(accuracy, 1),
                    'attempted': attempted,
                    'recommended_questions': recommended_questions
                })
                
        weaknesses_list.sort(key=lambda x: x['accuracy'])
        
        return Response({
            "weaknesses": weaknesses_list
        })

    @action(detail=False, methods=['POST'], url_path='generate-planner')
    def generate_planner(self, request):
        user = request.user
        data = request.data
        
        target_exam = data.get('target_exam', 'NEET')
        exam_date = data.get('exam_date', '')
        study_hours = float(data.get('study_hours', 4))
        
        # Calculate days remaining
        days_remaining = 30
        if exam_date:
            try:
                from datetime import datetime
                delta = datetime.strptime(exam_date, "%Y-%m-%d").date() - datetime.now().date()
                days_remaining = max(0, delta.days)
            except Exception:
                pass
                
        # 1. Fetch user's weaknesses
        completed_sessions = AssessmentSession.objects.filter(user=user, is_completed=True)
        topic_stats = {}
        for session in completed_sessions:
            sa_qs = session.answers.all().select_related('question')
            for sa in sa_qs:
                q = sa.question
                topic_name = q.icai_topic.name if q.icai_topic else (session.topic or 'General')
                chapter_name = q.icai_topic.chapter.name if (q.icai_topic and q.icai_topic.chapter) else (session.chapter or 'General')
                subject_name = q.icai_topic.chapter.paper.name if (q.icai_topic and q.icai_topic.chapter and q.icai_topic.chapter.paper) else (session.subject or 'General')
                level_name = q.icai_topic.chapter.paper.level.name if (q.icai_topic and q.icai_topic.chapter and q.icai_topic.chapter.paper and q.icai_topic.chapter.paper.level) else (session.course_level or 'General')
                qual_name = q.icai_topic.chapter.paper.level.qualification if (q.icai_topic and q.icai_topic.chapter and q.icai_topic.chapter.paper and q.icai_topic.chapter.paper.level) else (session.qualification or 'General')
                
                key = (qual_name, level_name, subject_name, chapter_name, topic_name)
                if key not in topic_stats:
                    topic_stats[key] = {'attempted': 0, 'correct': 0}
                
                topic_stats[key]['attempted'] += 1
                if sa.is_correct:
                    topic_stats[key]['correct'] += 1
                    
        weaknesses_list = []
        for key, stats in topic_stats.items():
            attempted = stats['attempted']
            correct = stats['correct']
            accuracy = (correct / attempted * 100) if attempted > 0 else 0
            if accuracy < 60:
                qual_name, level_name, subject_name, chapter_name, topic_name = key
                recommended_questions = 40 if accuracy < 35 else 25
                weaknesses_list.append({
                    'qualification': qual_name,
                    'course_level': level_name,
                    'subject': subject_name,
                    'chapter': chapter_name,
                    'topic': topic_name,
                    'accuracy': round(accuracy, 1),
                    'attempted': attempted,
                    'recommended_questions': recommended_questions
                })
                
        weaknesses_list.sort(key=lambda x: x['accuracy'])
        
        # 2. Build study plan using Gemini API or Fallback
        gemini_api_key = os.environ.get('GEMINI_API_KEY')
        plan = None
        
        if gemini_api_key:
            # Construct description of weaknesses for the prompt
            weakness_info = ""
            if weaknesses_list:
                weakness_info = "Here are the student's top weaknesses (where their accuracy is below 60%):\n"
                for w in weaknesses_list[:5]:
                    weakness_info += f"- {w['topic']} in {w['subject']} ({w['chapter']}) under level {w['course_level']} ({w['qualification']}): accuracy {w['accuracy']}%\n"
            else:
                weakness_info = "The student has no recorded weaknesses yet (perfect accuracy or no sessions completed)."
                
            system_instruction = (
                "You are 'qubook.in AI Study Planner', an advanced, professional AI scheduling engine.\n"
                "Your task is to generate a highly personalized 7-day study plan for a student preparing for an exam.\n"
                "Based on the input parameters (target exam, days remaining, daily study hours budget, and weakness profile), "
                "generate a JSON array containing exactly 7 objects, representing Day 1 to Day 7.\n"
                "Each object must have the following keys:\n"
                "- 'day': String (e.g., 'Day 1', 'Day 2', etc.)\n"
                "- 'title': String (e.g., 'Targeted Concept Review', 'MCQ Challenge', etc.)\n"
                "- 'duration': String (e.g., '2.5 hrs')\n"
                "- 'focus': String (the subject or topic name they should focus on)\n"
                "- 'description': String (actionable guidance on what to review or practice)\n"
                "- 'type': String (must be one of: 'LEARN', 'PRACTICE', 'MOCK', 'ANALYZE')\n"
                "- 'weaknessData': Object or null. If this task is a PRACTICE task focusing on one of the student's weaknesses, fill this with the weakness object (having keys: qualification, course_level, subject, chapter, topic). Otherwise set it to null.\n"
                "Your output must be valid JSON only. Do not wrap in markdown tags."
            )
            
            prompt = f"""
Student is preparing for the '{target_exam}' exam which is in {days_remaining} days.
Daily study goal: {study_hours} hours.
{weakness_info}

Please generate a highly customized 7-day study plan matching the schema.
"""
            
            url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
            headers = {
                "x-goog-api-key": gemini_api_key
            }
            payload = {
                "contents": [{
                    "parts": [{"text": system_instruction + "\n\nUser request:\n" + prompt}]
                }],
                "generationConfig": {
                    "responseMimeType": "application/json"
                }
            }
            
            try:
                import requests
                response = requests.post(url, json=payload, headers=headers, timeout=15)
                if response.status_code == 200:
                    res_data = response.json()
                    raw_text = res_data['candidates'][0]['content']['parts'][0]['text']
                    import json
                    plan = json.loads(raw_text)
            except Exception as e:
                # Log or ignore error, fallback will handle it
                pass
                
        # 3. Fallback generator if Gemini is missing or failed
        if not plan or not isinstance(plan, list):
            plan = []
            for i in range(1, 8):
                day_name = f"Day {i}"
                if i == 1:
                    w = weaknesses_list[0] if len(weaknesses_list) > 0 else None
                    plan.append({
                        "day": day_name,
                        "title": "Core Concept & Theory Review",
                        "duration": f"{round(study_hours * 0.6, 1)} hrs",
                        "focus": w['topic'] if w else "Syllabus foundations",
                        "description": f"Deep dive into notes for {w['topic'] if w else 'high-weightage areas'} in {w['subject'] if w else 'your course'}. Use Learn mode to check key formulas.",
                        "type": "LEARN",
                        "weaknessData": w
                    })
                elif i == 2:
                    w = weaknesses_list[0] if len(weaknesses_list) > 0 else None
                    plan.append({
                        "day": day_name,
                        "title": "Targeted Practice Session",
                        "duration": f"{round(study_hours * 0.8, 1)} hrs",
                        "focus": w['topic'] if w else "General practice",
                        "description": f"Take a 20-question Practice Session on {w['topic'] if w else 'this area'}. Target >75% accuracy.",
                        "type": "PRACTICE",
                        "weaknessData": w
                    })
                elif i == 3:
                    w = weaknesses_list[1] if len(weaknesses_list) > 1 else (weaknesses_list[0] if len(weaknesses_list) > 0 else None)
                    plan.append({
                        "day": day_name,
                        "title": "Secondary Weakness Overhaul",
                        "duration": f"{round(study_hours * 0.5, 1)} hrs",
                        "focus": w['topic'] if w else "Secondary concepts",
                        "description": f"Read explanation guides for {w['topic'] if w else 'secondary key chapters'}. Focus on related concepts.",
                        "type": "LEARN",
                        "weaknessData": w
                    })
                elif i == 4:
                    w = weaknesses_list[1] if len(weaknesses_list) > 1 else (weaknesses_list[0] if len(weaknesses_list) > 0 else None)
                    plan.append({
                        "day": day_name,
                        "title": "Subjective Practice Check",
                        "duration": f"{round(study_hours * 0.7, 1)} hrs",
                        "focus": w['topic'] if w else "Formulas & Definitions",
                        "description": f"Complete a practice set of 15 questions for {w['topic'] if w else 'topics'}. Review incorrect options.",
                        "type": "PRACTICE",
                        "weaknessData": w
                    })
                elif i == 5:
                    plan.append({
                        "day": day_name,
                        "title": "High-Fidelity Challenge Simulation",
                        "duration": f"{round(study_hours * 1.0, 1)} hrs",
                        "focus": "Full Subject Mock",
                        "description": "Start a Custom Mock Test with timer enabled. Simulate actual test environment.",
                        "type": "MOCK",
                        "weaknessData": None
                    })
                elif i == 6:
                    plan.append({
                        "day": day_name,
                        "title": "Weak Areas Re-evaluation",
                        "duration": f"{round(study_hours * 0.4, 1)} hrs",
                        "focus": "Weaknesses Review",
                        "description": "Analyze mock scores. Go over bookmark saved questions from challenge mode.",
                        "type": "ANALYZE",
                        "weaknessData": None
                    })
                elif i == 7:
                    plan.append({
                        "day": day_name,
                        "title": "Revision & Milestone Mock",
                        "duration": f"{round(study_hours * 0.9, 1)} hrs",
                        "focus": "Full Course Milestone",
                        "description": "Take a standard 50-question mock test to measure progress benchmark.",
                        "type": "MOCK",
                        "weaknessData": None
                    })
                    
        return Response({
            "plan": plan,
            "real_time_ai": gemini_api_key is not None
        })

    @action(detail=False, methods=['GET'], url_path='platform-stats', permission_classes=[permissions.IsAuthenticated])
    def platform_stats(self, request):
        """Admin-only endpoint: platform-wide assessment analytics."""
        if not request.user.is_staff:
            return Response({'error': 'Admin access required.'}, status=403)

        from django.db.models import Avg, Count, Sum

        all_completed = AssessmentSession.objects.filter(is_completed=True)
        total_sessions = all_completed.count()
        total_students = all_completed.values('user').distinct().count()
        avg_accuracy = all_completed.aggregate(avg=Avg('accuracy'))['avg'] or 0

        # Sessions by type
        practice_count = all_completed.filter(session_type='PRACTICE').count()
        mock_count = all_completed.filter(session_type='MOCK').count()

        # Sessions per day (last 30 days)
        from django.utils import timezone as tz
        from datetime import timedelta
        from django.db.models.functions import TruncDate
        thirty_days_ago = tz.now() - timedelta(days=30)
        sessions_per_day = (
            all_completed
            .filter(created_at__gte=thirty_days_ago)
            .annotate(date=TruncDate('created_at'))
            .values('date')
            .annotate(count=Count('id'))
            .order_by('date')
        )

        # Chapter-wise weakness (avg accuracy per chapter across all students)
        chapter_stats = {}
        all_answers = AssessmentAnswer.objects.filter(
            session__is_completed=True
        ).select_related('question__icai_topic__chapter')

        for ans in all_answers:
            q = ans.question
            chapter = None
            if q.icai_topic and q.icai_topic.chapter:
                chapter = q.icai_topic.chapter.name
            if not chapter:
                chapter = 'Uncategorized'
            if chapter not in chapter_stats:
                chapter_stats[chapter] = {'attempted': 0, 'correct': 0}
            chapter_stats[chapter]['attempted'] += 1
            if ans.is_correct:
                chapter_stats[chapter]['correct'] += 1

        chapter_list = []
        for ch, s in chapter_stats.items():
            acc = round((s['correct'] / s['attempted'] * 100), 1) if s['attempted'] > 0 else 0
            chapter_list.append({'chapter': ch, 'accuracy': acc, 'attempted': s['attempted']})
        chapter_list.sort(key=lambda x: x['accuracy'])

        # Top students by accuracy
        top_students = (
            all_completed
            .values('user__email', 'user__first_name', 'user__last_name')
            .annotate(avg_acc=Avg('accuracy'), total=Count('id'))
            .order_by('-avg_acc')[:10]
        )

        return Response({
            'total_sessions': total_sessions,
            'total_students': total_students,
            'avg_accuracy': round(avg_accuracy, 1),
            'practice_count': practice_count,
            'mock_count': mock_count,
            'sessions_per_day': list(sessions_per_day),
            'chapter_weakness': chapter_list[:20],
            'top_students': list(top_students),
        })

