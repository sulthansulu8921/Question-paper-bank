import os
from django.conf import settings
from rest_framework import viewsets, permissions
from rest_framework.pagination import PageNumberPagination
from materials.models import (
    QuestionPaper, AnswerPaper, Notes, Video, MCQ, Bookmark, SubjectiveQuestion, SubQuestion, QuestionOption, Feedback,
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

        # Multi-tenant isolation: Platform-wide questions + institution-specific questions
        user = self.request.user
        from django.db.models import Q
        if user and user.is_authenticated:
            if user.is_superuser:
                inst_filter = params.get('institution_id')
                if inst_filter:
                    queryset = queryset.filter(institution_id=inst_filter)
            elif getattr(user, 'institution', None):
                queryset = queryset.filter(Q(is_platform_wide=True) | Q(institution=user.institution))
            else:
                queryset = queryset.filter(is_platform_wide=True)
        else:
            queryset = queryset.filter(is_platform_wide=True)

        if not (user and user.is_authenticated and (user.is_staff or user.is_superuser)):
            queryset = queryset.filter(status__in=['ACTIVE', 'PUBLISHED'])

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
import fitz  # PyMuPDF
import base64
import json
import re
import os
import requests as http_requests

def resolve_gemini_api_key(explicit_key=None):
    """
    Resolves the Gemini API Key from:
    1. Explicit key passed in request (user input / client)
    2. PlatformSetting model in the database
    3. GEMINI_API_KEY environment variable (.env)
    """
    if explicit_key and str(explicit_key).strip():
        return str(explicit_key).strip()
    try:
        from subscriptions.models import PlatformSetting
        ps = PlatformSetting.objects.filter(key="GEMINI_API_KEY").first()
        if ps and ps.value and ps.value.strip():
            return ps.value.strip()
    except Exception:
        pass
    env_key = os.environ.get('GEMINI_API_KEY')
    if env_key and env_key.strip():
        return env_key.strip()
    return None

def test_gemini_api_key(api_key):
    """Tests if a Gemini API Key is valid and active."""
    if not api_key:
        return False, None, "No API key provided."
    models = ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-flash-latest", "gemini-2.5-flash", "gemini-2.0-flash"]
    last_err = "Unknown error"
    for m in models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={api_key}"
        payload = {
            "contents": [{"parts": [{"text": "Reply with JSON: {\"status\": \"ok\"}"}]}],
            "generationConfig": {"temperature": 0, "responseMimeType": "application/json"}
        }
        try:
            r = http_requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=12)
            if r.status_code == 200:
                return True, m, "Connected successfully"
            else:
                last_err = f"HTTP {r.status_code}: {r.text[:200]}"
        except Exception as e:
            last_err = str(e)
    return False, None, last_err

def resolve_openai_api_key(explicit_key=None):
    """
    Resolves the OpenAI API Key from:
    1. Explicit key passed in request (user input / client)
    2. PlatformSetting model in the database
    3. OPENAI_API_KEY environment variable (.env)
    """
    if explicit_key and str(explicit_key).strip():
        return str(explicit_key).strip()
    try:
        from subscriptions.models import PlatformSetting
        ps = PlatformSetting.objects.filter(key="OPENAI_API_KEY").first()
        if ps and ps.value and ps.value.strip():
            return ps.value.strip()
    except Exception:
        pass
    env_key = os.environ.get('OPENAI_API_KEY')
    if env_key and env_key.strip():
        return env_key.strip()
    return None

def test_openai_api_key(api_key):
    """
    Tests if an OpenAI API Key is valid and active.
    Verifies authentication via /v1/models and checks quota availability.
    """
    if not api_key:
        return False, None, "No OpenAI API key provided."
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    try:
        r = http_requests.get("https://api.openai.com/v1/models", headers=headers, timeout=12)
        if r.status_code != 200:
            return False, None, f"OpenAI authentication failed (HTTP {r.status_code}): {r.text[:200]}"
        
        test_models = ["gpt-4o-mini", "gpt-4.1-mini", "gpt-5-mini", "gpt-5-nano"]
        for m in test_models:
            payload = {
                "model": m,
                "messages": [{"role": "user", "content": 'Respond with JSON: {"status": "ok"}'}],
                "max_tokens": 15
            }
            chat_r = http_requests.post("https://api.openai.com/v1/chat/completions", json=payload, headers=headers, timeout=15)
            if chat_r.status_code == 200:
                return True, m, "OpenAI API connected and active!"
            elif chat_r.status_code == 429:
                err_body = chat_r.json().get('error', {}) if 'application/json' in chat_r.headers.get('content-type', '') else {}
                if 'insufficient_quota' in str(err_body) or 'credit_balance_exhausted' in str(err_body):
                    return True, m, "OpenAI key authenticated successfully! (Note: 0 remaining credits on account. Top up at platform.openai.com/settings/organization/billing)"
                return True, m, f"Key authenticated (HTTP 429: {err_body.get('message', '')[:120]})"
        return True, "gpt-4o-mini", "OpenAI key authenticated successfully!"
    except Exception as e:
        return False, None, f"OpenAI connection error: {str(e)}"

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

def extract_mcq_options_from_text(text):
    """
    Extracts MCQ options labeled (a)-(d), (A)-(D), (i)-(iv), or (1)-(4) from a question string.
    Returns (cleaned_stem, options_list).
    """
    if not text:
        return text, []

    opt_pattern = re.compile(
        r'(?:^|\n)\s*(?:\((?P<id>[a-d]|[ivx]+|[1-4])\)|(?P<id2>[a-d]|[ivx]+|[1-4])[\.\)])\s*(?P<content>.*?)(?=(?:\n\s*(?:\((?:[a-d]|[ivx]+|[1-4])\)|(?:[a-d]|[ivx]+|[1-4])[\.\)]))|\Z)',
        re.IGNORECASE | re.DOTALL
    )

    matches = list(opt_pattern.finditer(text))
    if len(matches) >= 2:
        first_match_start = matches[0].start()
        stem = text[:first_match_start].strip()
        options = []
        for idx, m in enumerate(matches):
            opt_text = m.group('content').strip()
            opt_text = re.sub(r'(?i)\(?\s*\d+\s*Marks?\s*\)?', '', opt_text).strip()
            options.append({
                "text": opt_text,
                "is_correct": False,
                "order": idx
            })
        return stem, options
    return text, []

def reconcile_case_scenarios(questions):
    """
    Reconciles Case Scenarios and child sub-questions:
    If a Case Scenario question exists (or a narrative question that holds the case scenario context)
    followed by questions matching the scenario range (e.g. 1 to 5),
    bundle those questions into the parent Case Scenario's sub_questions list.
    """
    if not isinstance(questions, list) or len(questions) <= 1:
        return questions

    reconciled = []
    i = 0
    while i < len(questions):
        q = questions[i]
        q_text = str(q.get('question_text') or '')
        passage = str(q.get('case_scenario_passage') or '')
        q_type = str(q.get('question_type') or 'NORMAL').upper()
        full_text = f"{q_text} {passage}"

        is_cs = (
            q_type == 'CASE_SCENARIO' or
            bool(passage) or
            'case scenario' in full_text.lower() or
            'case study' in full_text.lower() or
            str(q.get('q_no', '')).upper().startswith('CS') or
            bool(re.search(r'(?i)\banswer\s+(?:the\s+following\s+)?(?:Question\s*(?:s|\s*Nos?\.?)|Q(?:s|\.|\s*Nos?\.?))?\s*\d+\s*(?:-|to)\s*\d+', full_text))
        )

        if not is_cs:
            reconciled.append(q)
            i += 1
            continue

        # Determine range of child questions
        range_m = re.search(r'(?i)\banswer\s+(?:the\s+following\s+)?(?:Question\s*(?:s|\s*Nos?\.?)|Q(?:s|\.|\s*Nos?\.?))?\s*(\d+)\s*(?:-|to)\s*(\d+)', full_text)
        start_no = int(range_m.group(1)) if range_m else 1
        end_no = int(range_m.group(2)) if range_m else 5

        # Format parent question
        q['question_type'] = 'CASE_SCENARIO'
        if not q.get('case_scenario_passage'):
            q['case_scenario_passage'] = q_text

        # Standardize and preserve original q_no
        orig_q_num = str(q.get('q_no') or q.get('question_number') or '').strip()
        cs_header_m = re.search(r'(?i)\bCase\s*(?:Scenario|Study)\s*(?:-|No\.?|#)?\s*([0-9]+|[IVXLCDM]+)\b', full_text)
        if cs_header_m:
            case_id = roman_to_int(cs_header_m.group(1))
            q['q_no'] = orig_q_num if (orig_q_num and not orig_q_num.upper().startswith('CS')) else str(case_id)
        elif not orig_q_num:
            q['q_no'] = "1"
        else:
            q['q_no'] = orig_q_num
        q['original_question_number'] = q['q_no']

        if not q.get('sub_questions'):
            q['sub_questions'] = q.get('subquestions') or []

        existing_sub_ids = {str(sq.get('identifier', '')) for sq in q['sub_questions']}

        # Absorb subsequent matching child questions
        j = i + 1
        while j < len(questions):
            candidate = questions[j]
            cand_q_no = str(candidate.get('q_no') or candidate.get('question_number') or '').strip()
            try:
                cand_int = int(re.sub(r'^[Qq]\.?\s*', '', cand_q_no))
            except ValueError:
                cand_int = None

            if cand_int is not None and start_no <= cand_int <= end_no:
                # This is a sub-question of this case scenario!
                cand_stem = str(candidate.get('question_text') or '')
                cand_opts = candidate.get('options') or []
                if not cand_opts or len(cand_opts) < 2:
                    stem, extracted_opts = extract_mcq_options_from_text(cand_stem)
                    if extracted_opts:
                        cand_stem = stem
                        cand_opts = extracted_opts

                cand_stem = re.sub(r'^\s*(?:Question\s*(?:No\.?)?|Q)?\s*\d+\s*[\.\)]?\s*', '', cand_stem).strip()

                letter_code = chr(97 + len(q['sub_questions']))
                sub_ident = f"{q['q_no']}({letter_code})"

                sq_item = {
                    "identifier": sub_ident,
                    "original_question_number": cand_q_no or str(cand_int),
                    "sub_question_number": sub_ident,
                    "question_text": cand_stem,
                    "marks": candidate.get('marks') or 2,
                    "question_type": "MCQ",
                    "options": cand_opts,
                    "correct_answer": candidate.get('correct_answer') or '',
                    "working_notes": candidate.get('working_notes') or '',
                    "table_data": candidate.get('table_data'),
                    "answer_table_data": candidate.get('answer_table_data')
                }
                if str(cand_int) not in existing_sub_ids and sub_ident not in existing_sub_ids:
                    q['sub_questions'].append(sq_item)
                    existing_sub_ids.add(str(cand_int))
                    existing_sub_ids.add(sub_ident)
                j += 1
            else:
                break

        # Also sanitize any existing sub-questions inside the Case Scenario
        for sq_idx, sq in enumerate(q.get('sub_questions', [])):
            sq_opts = sq.get('options') or []
            if not sq_opts or len(sq_opts) < 2:
                stem, extracted_opts = extract_mcq_options_from_text(sq.get('question_text', ''))
                if extracted_opts:
                    sq['question_text'] = re.sub(r'^\s*(?:Question\s*(?:No\.?)?|Q)?\s*\d+\s*[\.\)]?\s*', '', stem).strip()
                    sq['options'] = extracted_opts
                    sq['question_type'] = 'MCQ'
            if not sq.get('identifier'):
                sq['identifier'] = f"{q['q_no']}({chr(97 + sq_idx)})"

        q['subquestions'] = q['sub_questions']
        q['marks'] = sum(sq.get('marks', 2) for sq in q['sub_questions']) or (2 * (end_no - start_no + 1))
        reconciled.append(q)
        i = j

    return reconciled

def sanitize_extracted_questions(parsed):
    """
    Standardizes and validates raw questions extracted by any AI model (Gemini or OpenAI).
    Ensures:
    - Integer marks
    - Proper single-parent Case Scenario bundling with child sub-questions (1 to 5)
    - Normalization of question_type
    - Correct placement of [TABLE_1] after the first two paragraphs of case scenario passages
    - Normalization of cursor tables
    - Clean sub-questions and MCQ options (handling (i)-(iv) and (a)-(d))
    """
    if isinstance(parsed, dict) and "questions" in parsed:
        parsed = parsed["questions"]
    if not isinstance(parsed, list):
        return []

    # First reconcile any split Case Scenarios and child questions
    parsed = reconcile_case_scenarios(parsed)

    sanitized = []
    for idx, q in enumerate(parsed):
        if not isinstance(q, dict):
            continue
        q_num = str(q.get('q_no') or (idx + 1)).strip()
        q_text_val = str(q.get('question_text') or '').strip()
        passage_val = str(q.get('case_scenario_passage') or q.get('passage') or '').strip()

        ans_val = str(q.get('correct_answer') or '').strip()
        wn_val = str(q.get('working_notes') or '').strip()
        m_val = q.get('marks')
        try:
            m_int = int(m_val) if m_val is not None else 10
        except (ValueError, TypeError):
            m_int = 10
        q_type = str(q.get('question_type') or 'NORMAL').upper()
        if passage_val or q.get('is_case_scenario') or q_num.startswith('CS'):
            q_type = 'CASE_SCENARIO'
        if q_type not in ['NORMAL', 'MCQ', 'THEORY', 'CASE_SCENARIO']:
            q_type = 'NORMAL'

        if q_type == 'CASE_SCENARIO' and not passage_val and len(q_text_val) > 80:
            passage_val = q_text_val

        if not q_text_val and not passage_val:
            continue

        raw_opts = q.get('options') or []
        # If question is top-level MCQ and options aren't extracted yet, extract them
        if q_type != 'CASE_SCENARIO' and (not raw_opts or len(raw_opts) < 2):
            stem, extracted_opts = extract_mcq_options_from_text(q_text_val)
            if extracted_opts:
                q_text_val = stem
                raw_opts = extracted_opts
                q_type = 'MCQ'

        raw_table = q.get('table_data')
        # If case scenario has table_data, ensure it's normalized as cursor table
        # and ensure [TABLE_1] is positioned after the first 2 paragraphs if not already placed
        if raw_table and (q_type == 'CASE_SCENARIO' or passage_val):
            if isinstance(raw_table, dict) and 'headers' in raw_table:
                raw_table = [{'type': 'cursor', **raw_table}]
            elif isinstance(raw_table, list):
                raw_table = [{'type': 'cursor', **t} if isinstance(t, dict) and 'headers' in t else t for t in raw_table]

            if '[TABLE' not in passage_val:
                paras = [p.strip() for p in re.split(r'\n\s*\n', passage_val) if p.strip()]
                if len(paras) >= 2:
                    passage_val = paras[0] + "\n\n" + paras[1] + "\n\n[TABLE_1]\n\n" + "\n\n".join(paras[2:])
                else:
                    lines = [l.strip() for l in passage_val.split('\n') if l.strip()]
                    if len(lines) >= 2:
                        passage_val = lines[0] + "\n\n" + lines[1] + "\n\n[TABLE_1]\n\n" + "\n\n".join(lines[2:])
                    elif len(lines) == 1:
                        sentences = re.split(r'(?<=[.:])\s+', lines[0])
                        if len(sentences) >= 2:
                            passage_val = sentences[0] + "\n\n" + sentences[1] + "\n\n[TABLE_1]\n\n" + " ".join(sentences[2:])
                        else:
                            passage_val = lines[0] + "\n\n[TABLE_1]"
                    else:
                        passage_val = "[TABLE_1]\n\n" + passage_val

        sanitized_sub_qs = []
        for sq_idx, sq in enumerate(q.get('sub_questions') or []):
            sq_ident = str(sq.get('identifier') or (sq_idx + 1)).strip()
            sq_text = str(sq.get('question_text') or '').strip()
            sq_type = str(sq.get('question_type') or ('MCQ' if q_type == 'CASE_SCENARIO' else 'NORMAL')).upper()
            sq_opts = sq.get('options') or []
            if sq_type == 'MCQ' and (not sq_opts or len(sq_opts) < 2):
                stem, extracted_opts = extract_mcq_options_from_text(sq_text)
                if extracted_opts:
                    sq_text = stem
                    sq_opts = extracted_opts
            sanitized_sub_qs.append({
                "identifier": sq_ident,
                "question_text": sq_text,
                "marks": sq.get('marks') or (2 if q_type == 'CASE_SCENARIO' else 1),
                "question_type": sq_type,
                "options": sq_opts,
                "correct_answer": str(sq.get('correct_answer') or '').strip(),
                "working_notes": str(sq.get('working_notes') or '').strip(),
                "table_data": sq.get('table_data'),
                "answer_table_data": sq.get('answer_table_data')
            })

        sanitized.append({
            "q_no": q_num,
            "question_text": q_text_val,
            "case_scenario_passage": passage_val,
            "correct_answer": ans_val,
            "working_notes": wn_val,
            "marks": m_int,
            "question_type": q_type,
            "difficulty": q.get('difficulty') or 'MEDIUM',
            "table_data": raw_table,
            "answer_table_data": q.get('answer_table_data'),
            "options": raw_opts,
            "sub_questions": sanitized_sub_qs
        })
    return sanitized

def extract_questions_with_gemini(q_text, ans_text=None, api_key=None):
    """
    Uses Google Gemini AI to analyze raw exam PDF text, automatically detect
    question numbers (Q1, 1(a), 2, etc.), question texts, types, marks, options,
    tables, and automatically match or generate comprehensive answers & solutions.
    """
    key = resolve_gemini_api_key(api_key)
    if not key:
        return None, "No Gemini API Key found. Configure GEMINI_API_KEY in Admin Settings or Workspace."

    prompt = f"""You are an elite academic exam paper extractor and expert Chartered Accountancy (CA) professor.

Analyze the Question Paper text (and Answer Paper text if provided) and extract ALL questions into a structured JSON array.

CORE INSTRUCTIONS:
1. STRICT EXCLUSION - NEVER EXTRACT GENERAL EXAM INSTRUCTIONS AS QUESTIONS:
   - DO NOT extract instructions, rubric rules, structural notices, or candidate guidelines as questions!
   - Common non-questions to COMPLETELY IGNORE AND SKIP:
     * "The question paper comprises two parts, Part I and Part II."
     * "Part I comprises Case Scenario based Multiple Choice Questions (MCQs)"
     * "Part II comprises questions which require descriptive type answers."
     * "Question No. 1 is compulsory..."
     * "Attempt any four questions from the remaining five questions."
     * "Working notes should form part of the respective answers."
     * "Candidates are permitted to use non-programmable calculators."
     * "Answers to questions of Part I are to be given on OMR answer sheet."
   - ONLY extract actual test problems, questions, case studies, or MCQ prompts where a student must solve or calculate an answer!

2. QUESTION NUMBERS (CRITICAL):
   - Accurately identify every genuine question number (e.g. "1", "1(a)", "1(b)", "2", "3(a)", "4", "CS1", etc.) and set "q_no".
3. QUESTION TEXT:
   - Extract full problem statement including all instructions, financial numbers, facts, and guidelines in "question_text".
4. QUESTION TYPE & CASE SCENARIOS (CRITICAL):
   - "NORMAL" (Practical / Numerical problem)
   - "MCQ" (Multiple Choice Question)
   - "THEORY" (Theoretical / Descriptive question)
   - "CASE_SCENARIO" (Case study or comprehensive story with multiple child questions/MCQs)
   * CRITICAL RULES FOR CASE SCENARIOS (E.G. "Case Scenario I", "Case Scenario II"):
     - When an exam paper has "Case Scenario I" or "Case Scenario 1":
       The narrative text immediately following it often starts with a numbered paragraph like:
       "1. SBHA Ltd deals in business of manufacturing..." or "1. ABC Ltd..."
       WARNING: DO NOT EXTRACT "1. SBHA Ltd..." AS QUESTION 1!
       This numbered paragraph is the FIRST PARAGRAPH of the Case Scenario background story!
       The ENTIRE narrative story (all paragraphs from the start of Case Scenario I until "Based on the information given in above Case Scenario, answer the following Question Nos. 1-5") belongs to ONE SINGLE PARENT QUESTION!
     - Set "question_type": "CASE_SCENARIO".
     - Set "q_no": "CS1" (or "CS2", etc.).
     - Extract the entire narrative background context into "case_scenario_passage".
     - PRESERVE IN-POSITION TABLES (CRITICAL):
       If the case scenario text has a table (e.g. after the first two paragraphs, or between paragraphs), place "[TABLE_1]" directly inside "case_scenario_passage" at the EXACT position where the table appears in the original text (e.g. right after Paragraph 2). If there is a second table, place "[TABLE_2]" at its position.
       Extract the corresponding table(s) into "table_data" with "type": "cursor":
       [
         {{"type": "cursor", "headers": ["Header 1", "Header 2"], "rows": [["Val 1", "Val 2"]]}}
       ]
     - ALL child questions (e.g. Questions 1 to 5) under "Based on the information given in above Case Scenario, answer the following Question Nos. 1-5" MUST BE NESTED INSIDE "sub_questions" OF THIS ONE PARENT QUESTION!
       DO NOT create separate top-level questions for Questions 1-5!
       Each child MCQ in "sub_questions" MUST have:
       "identifier": "1", "question_text": "...", "question_type": "MCQ", "marks": 2,
       "options": [{{"text": "...", "is_correct": true/false, "order": 0}}, ...], (extract all options from (i), (ii), (iii), (iv) or (a), (b), (c), (d))
       "correct_answer": "Option letter and step-by-step rationale."
     - Parent question marks = 10 (or 2 marks * number of child questions).
     - Any subsequent independent questions (e.g. Questions 6, 7 under "Multiple Choice Questions") MUST be extracted as separate top-level questions!
5. MARKS:
   - Integer marks (e.g. 5, 10, 14, 16, 20). If unstated, default to 10 for practical/descriptive, 2 for MCQ.
6. MCQ OPTIONS:
   - If question is an MCQ, extract "options": [
       {{"text": "...", "is_correct": true/false, "order": 0}},
       {{"text": "...", "is_correct": true/false, "order": 1}},
       {{"text": "...", "is_correct": true/false, "order": 2}},
       {{"text": "...", "is_correct": true/false, "order": 3}}
     ]
7. SUB-QUESTIONS:
   - If a question has subparts (a, b, c) or (i, ii), put general intro in "question_text" and parts in "sub_questions" with "identifier", "question_text", "marks", "correct_answer", and "working_notes".
8. TABLES (CRITICAL - PRESERVE EXACT GRIDS):
   - For all 4-column Balance Sheets / Trial Balances (e.g. Particulars | Amount (₹) | Particulars | Amount (₹)), Schedule III statements, Journal entries, Ledgers, and financial tables:
     You MUST extract as clean JSON:
     {{"headers": ["Particulars", "Amount (₹)", "Particulars", "Amount (₹)"], "rows": [["Term Loans (Secured)", "40,00,000", "Investments (Non-current)", "9,00,000"], ...]}}
     DO NOT flatten 4-column tables into 2 columns! Preserve both the left side and right side as 4 separate columns!
     Put in "table_data" for question tables, and "answer_table_data" for solution tables.
9. ANSWERS & SOLUTIONS (MANDATORY AUTO-FILL):
   - If Answer Paper text is provided below: MATCH each question number to its exact model answer, journal entries, and solutions from the Answer Paper!
   - If NO Answer Paper is provided: As an expert CA professor, SOLVE the question step-by-step and write out the complete, rigorous model answer in "correct_answer" and supporting computations/ledger entries in "working_notes"!
   - Never leave "correct_answer" empty! Provide the comprehensive solution so the answer field is automatically filled.

OUTPUT FORMAT: Return STRICT JSON matching this schema:
[
  {{
    "q_no": "1",
    "question_text": "...",
    "case_scenario_passage": "Narrative passage text with [TABLE_1] positioned between paragraphs if applicable",
    "correct_answer": "Full step-by-step model solution and final result statement.",
    "working_notes": "Supporting calculations, journal entries, and notes.",
    "marks": 10,
    "question_type": "NORMAL",
    "difficulty": "MEDIUM",
    "table_data": null,
    "answer_table_data": null,
    "options": [],
    "sub_questions": [
      {{
        "identifier": "a",
        "question_text": "...",
        "marks": 5,
        "correct_answer": "...",
        "working_notes": "...",
        "question_type": "NORMAL",
        "table_data": null,
        "answer_table_data": null,
        "options": []
      }}
    ]
  }}
]

QUESTION PAPER CONTENT:
---
{q_text[:45000]}
---
"""
    if ans_text and ans_text.strip():
        prompt += f"""
ANSWER PAPER / SUGGESTED ANSWERS CONTENT:
---
{ans_text[:45000]}
---
CRITICAL: Match each extracted question above with its corresponding suggested answer from this Answer Paper content!
"""

    models_to_try = ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-flash-latest", "gemini-2.5-flash", "gemini-2.0-flash"]
    last_err = None

    for model in models_to_try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.1,
                "responseMimeType": "application/json"
            }
        }
        try:
            resp = http_requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=110)
            if resp.status_code == 200:
                res_data = resp.json()
                raw_text = res_data['candidates'][0]['content']['parts'][0]['text']
                clean_text = raw_text.strip()
                if clean_text.startswith("```"):
                    clean_text = re.sub(r'^```(?:json)?\s*', '', clean_text)
                    clean_text = re.sub(r'\s*```$', '', clean_text)
                parsed = json.loads(clean_text)
                sanitized = sanitize_extracted_questions(parsed)
                if sanitized:
                    return sanitized, None
            else:
                last_err = f"Gemini ({model}) HTTP {resp.status_code}: {resp.text[:250]}"
        except Exception as e:
            last_err = f"Gemini ({model}) error: {str(e)}"

    return None, last_err

def extract_questions_with_openai(q_text, ans_text=None, api_key=None):
    """
    Uses OpenAI (gpt-4o-mini, gpt-4o, etc.) to analyze raw exam PDF text, automatically detect
    question numbers (Q1, 1(a), 2, etc.), question texts, types, marks, options,
    case scenario passages with positioned [TABLE_1], and match or generate answers.
    """
    key = resolve_openai_api_key(api_key)
    if not key:
        return None, "No OpenAI API Key found. Configure OPENAI_API_KEY in Admin Settings, Workspace, or request."

    prompt = f"""You are an elite academic exam paper extractor and expert Chartered Accountancy (CA) professor.

Analyze the Question Paper text (and Answer Paper text if provided) and extract ALL questions into a structured JSON array.

CORE INSTRUCTIONS:
1. STRICT EXCLUSION - NEVER EXTRACT GENERAL EXAM INSTRUCTIONS AS QUESTIONS:
   - DO NOT extract instructions, rubric rules, structural notices, or candidate guidelines as questions!
   - Common non-questions to COMPLETELY IGNORE AND SKIP:
     * "The question paper comprises two parts, Part I and Part II."
     * "Part I comprises Case Scenario based Multiple Choice Questions (MCQs)"
     * "Part II comprises questions which require descriptive type answers."
     * "Question No. 1 is compulsory..."
     * "Attempt any four questions from the remaining five questions."
     * "Working notes should form part of the respective answers."
     * "Candidates are permitted to use non-programmable calculators."
     * "Answers to questions of Part I are to be given on OMR answer sheet."
   - ONLY extract actual test problems, questions, case studies, or MCQ prompts where a student must solve or calculate an answer!

2. QUESTION NUMBERS (CRITICAL):
   - Accurately identify every genuine question number (e.g. "1", "1(a)", "1(b)", "2", "3(a)", "4", "CS1", etc.) and set "q_no".
3. QUESTION TEXT:
   - Extract full problem statement including all instructions, financial numbers, facts, and guidelines in "question_text".
4. QUESTION TYPE & CASE SCENARIOS (CRITICAL):
   - "NORMAL" (Practical / Numerical problem)
   - "MCQ" (Multiple Choice Question)
   - "THEORY" (Theoretical / Descriptive question)
   - "CASE_SCENARIO" (Case study or comprehensive story with multiple child questions/MCQs)
   * CRITICAL RULES FOR CASE SCENARIOS (E.G. "Case Scenario I", "Case Scenario II"):
     - When an exam paper has "Case Scenario I" or "Case Scenario 1":
       The narrative text immediately following it often starts with a numbered paragraph like:
       "1. SBHA Ltd deals in business of manufacturing..." or "1. ABC Ltd..."
       WARNING: DO NOT EXTRACT "1. SBHA Ltd..." AS QUESTION 1!
       This numbered paragraph is the FIRST PARAGRAPH of the Case Scenario background story!
       The ENTIRE narrative story (all paragraphs from the start of Case Scenario I until "Based on the information given in above Case Scenario, answer the following Question Nos. 1-5") belongs to ONE SINGLE PARENT QUESTION!
     - Set "question_type": "CASE_SCENARIO".
     - Set "q_no": "CS1" (or "CS2", etc.).
     - Extract the entire narrative background context into "case_scenario_passage".
     - PRESERVE IN-POSITION TABLES (CRITICAL):
       If the case scenario text has a table (e.g. after the first two paragraphs, or between paragraphs), place "[TABLE_1]" directly inside "case_scenario_passage" at the EXACT position where the table appears in the original text (e.g. right after Paragraph 2). If there is a second table, place "[TABLE_2]" at its position.
       Extract the corresponding table(s) into "table_data" with "type": "cursor":
       [
         {{"type": "cursor", "headers": ["Header 1", "Header 2"], "rows": [["Val 1", "Val 2"]]}}
       ]
     - ALL child questions (e.g. Questions 1 to 5) under "Based on the information given in above Case Scenario, answer the following Question Nos. 1-5" MUST BE NESTED INSIDE "sub_questions" OF THIS ONE PARENT QUESTION!
       DO NOT create separate top-level questions for Questions 1-5!
       Each child MCQ in "sub_questions" MUST have:
       "identifier": "1", "question_text": "...", "question_type": "MCQ", "marks": 2,
       "options": [{{"text": "...", "is_correct": true/false, "order": 0}}, ...], (extract all options from (i), (ii), (iii), (iv) or (a), (b), (c), (d))
       "correct_answer": "Option letter and step-by-step rationale."
     - Parent question marks = 10 (or 2 marks * number of child questions).
     - Any subsequent independent questions (e.g. Questions 6, 7 under "Multiple Choice Questions") MUST be extracted as separate top-level questions!
5. MARKS:
   - Integer marks (e.g. 5, 10, 14, 16, 20). If unstated, default to 10 for practical/descriptive, 2 for MCQ.
6. MCQ OPTIONS:
   - If question is an MCQ, extract "options": [
       {{"text": "...", "is_correct": true/false, "order": 0}},
       {{"text": "...", "is_correct": true/false, "order": 1}},
       {{"text": "...", "is_correct": true/false, "order": 2}},
       {{"text": "...", "is_correct": true/false, "order": 3}}
     ]
7. SUB-QUESTIONS:
   - If a question has subparts (a, b, c) or (i, ii), put general intro in "question_text" and parts in "sub_questions" with "identifier", "question_text", "marks", "correct_answer", and "working_notes".
8. TABLES (CRITICAL - PRESERVE EXACT GRIDS):
   - For all 4-column Balance Sheets / Trial Balances, Schedule III statements, Journal entries, Ledgers, and financial tables:
     Extract as clean JSON:
     {{"headers": ["Particulars", "Amount (₹)", "Particulars", "Amount (₹)"], "rows": [["Term Loans (Secured)", "40,00,000", "Investments (Non-current)", "9,00,000"], ...]}}
     DO NOT flatten 4-column tables into 2 columns! Preserve both the left side and right side as 4 separate columns!
     Put in "table_data" for question tables, and "answer_table_data" for solution tables.
9. ANSWERS & SOLUTIONS (MANDATORY AUTO-FILL):
   - If Answer Paper text is provided below: MATCH each question number to its exact model answer, journal entries, and solutions from the Answer Paper!
   - If NO Answer Paper is provided: As an expert CA professor, SOLVE the question step-by-step and write out the complete, rigorous model answer in "correct_answer" and supporting computations/ledger entries in "working_notes"!
   - Never leave "correct_answer" empty! Provide the comprehensive solution so the answer field is automatically filled.

OUTPUT FORMAT: Return a STRICT JSON object with key "questions":
{{
  "questions": [
    {{
      "q_no": "1",
      "question_text": "...",
      "case_scenario_passage": "Narrative passage text with [TABLE_1] positioned between paragraphs if applicable",
      "correct_answer": "Full step-by-step model solution and final result statement.",
      "working_notes": "Supporting calculations, journal entries, and notes.",
      "marks": 10,
      "question_type": "NORMAL",
      "difficulty": "MEDIUM",
      "table_data": null,
      "answer_table_data": null,
      "options": [],
      "sub_questions": []
    }}
  ]
}}

QUESTION PAPER CONTENT:
---
{q_text[:50000]}
---
"""
    if ans_text and ans_text.strip():
        prompt += f"""
ANSWER PAPER / SUGGESTED ANSWERS CONTENT:
---
{ans_text[:50000]}
---
CRITICAL: Match each extracted question above with its corresponding suggested answer from this Answer Paper content!
"""

    models_to_try = ["gpt-4o-mini", "gpt-4.1-mini", "gpt-5-mini", "gpt-4o"]
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    last_err = None

    for model in models_to_try:
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": "You are an elite academic exam paper extractor and expert Chartered Accountancy (CA) professor. Always output valid JSON object with key 'questions'."},
                {"role": "user", "content": prompt}
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.1
        }
        try:
            resp = http_requests.post("https://api.openai.com/v1/chat/completions", json=payload, headers=headers, timeout=120)
            if resp.status_code == 200:
                res_data = resp.json()
                content = res_data['choices'][0]['message']['content'].strip()
                parsed = json.loads(content)
                sanitized = sanitize_extracted_questions(parsed)
                if sanitized:
                    return sanitized, None
            else:
                err_body = resp.json().get('error', {}) if 'application/json' in resp.headers.get('content-type', '') else {}
                err_msg = err_body.get('message') or resp.text[:200]
                last_err = f"OpenAI ({model}) HTTP {resp.status_code}: {err_msg}"
                if resp.status_code == 429:
                    break
        except Exception as e:
            last_err = f"OpenAI ({model}) error: {str(e)}"

    return None, last_err

def generate_answer_with_gemini(question_text, marks=10, q_type='NORMAL', subject='', table_data=None, api_key=None):
    """
    Generates a full step-by-step solution, working notes, and answer tables
    for a single question on-demand using Gemini AI.
    """
    key = resolve_gemini_api_key(api_key)
    if not key:
        return None, "No Gemini API Key found. Configure GEMINI_API_KEY in Admin Settings or Workspace."

    prompt = f"""You are an expert Chartered Accountancy (CA) professor and top exam evaluator.
Provide a complete, mathematically rigorous, and professionally formatted model answer and step-by-step solution for the following exam question.

Subject: {subject or 'Accountancy / Taxation / Corporate Law / Auditing'}
Question Type: {q_type}
Marks: {marks}

QUESTION:
{question_text}
"""
    if table_data:
        prompt += f"\nQUESTION TABLE/FINANCIAL DATA:\n{json.dumps(table_data) if isinstance(table_data, (dict, list)) else table_data}\n"

    prompt += """
Respond in STRICT JSON with this schema:
{
  "correct_answer": "Complete step-by-step model solution, explanations, and final answer statement.",
  "working_notes": "All supporting working notes, formulas, calculations, assumptions, or journal entries.",
  "answer_table_data": null or {"headers": ["Col1", "Col2"], "rows": [["val1", "val2"]]},
  "correct_mcq_option": null or "A" / "B" / "C" / "D" (if MCQ)
}
"""
    models = ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-flash-latest", "gemini-2.5-flash", "gemini-2.0-flash"]
    last_err = None
    for model in models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json"}
        }
        try:
            resp = http_requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=60)
            if resp.status_code == 200:
                data = resp.json()
                raw_text = data['candidates'][0]['content']['parts'][0]['text'].strip()
                if raw_text.startswith("```"):
                    raw_text = re.sub(r'^```(?:json)?\s*', '', raw_text)
                    raw_text = re.sub(r'\s*```$', '', raw_text)
                return json.loads(raw_text), None
            else:
                last_err = f"HTTP {resp.status_code}: {resp.text[:200]}"
        except Exception as e:
            last_err = str(e)
    return None, last_err

def generate_answer_with_openai(question_text, marks=10, q_type='NORMAL', subject='', table_data=None, api_key=None):
    """
    Generates a full step-by-step solution, working notes, and answer tables
    for a single question on-demand using OpenAI API.
    """
    key = resolve_openai_api_key(api_key)
    if not key:
        return None, "No OpenAI API Key found. Configure OPENAI_API_KEY in Admin Settings, Workspace, or request."

    prompt = f"""You are an expert Chartered Accountancy (CA) professor and top exam evaluator.
Provide a complete, mathematically rigorous, and professionally formatted model answer and step-by-step solution for the following exam question.

Subject: {subject or 'Accountancy / Taxation / Corporate Law / Auditing'}
Question Type: {q_type}
Marks: {marks}

QUESTION:
{question_text}
"""
    if table_data:
        prompt += f"\nQUESTION TABLE/FINANCIAL DATA:\n{json.dumps(table_data) if isinstance(table_data, (dict, list)) else table_data}\n"

    prompt += """
Respond in STRICT JSON object with this schema:
{
  "correct_answer": "Complete step-by-step model solution, explanations, and final answer statement.",
  "working_notes": "All supporting working notes, formulas, calculations, assumptions, or journal entries.",
  "answer_table_data": null or {"headers": ["Col1", "Col2"], "rows": [["val1", "val2"]]},
  "correct_mcq_option": null or "A" / "B" / "C" / "D" (if MCQ)
}
"""
    models = ["gpt-4o-mini", "gpt-4.1-mini", "gpt-5-mini", "gpt-4o"]
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    last_err = None

    for model in models:
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": "You are an expert Chartered Accountancy (CA) professor. Always output valid JSON object."},
                {"role": "user", "content": prompt}
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.1
        }
        try:
            resp = http_requests.post("https://api.openai.com/v1/chat/completions", json=payload, headers=headers, timeout=60)
            if resp.status_code == 200:
                data = resp.json()
                raw_text = data['choices'][0]['message']['content'].strip()
                return json.loads(raw_text), None
            else:
                err_body = resp.json().get('error', {}) if 'application/json' in resp.headers.get('content-type', '') else {}
                err_msg = err_body.get('message') or resp.text[:200]
                last_err = f"OpenAI HTTP {resp.status_code}: {err_msg}"
                if resp.status_code == 429:
                    break
        except Exception as e:
            last_err = str(e)

    return None, last_err


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
    case_scenario_pattern = re.compile(r'(?i)\bCase\s*(?:Scenario|Study)\s*(?:-|No\.?|#)?\s*([0-9]+|[IVXLCDM]+)\b')
    anchor_pattern = re.compile(r'(?i)\banswer\s+(?:the\s+following\s+)?(?:Question\s*(?:s|\s*Nos?\.?)|Q(?:s|\.|\s*Nos?\.?))?\s*(\d+)\s*(?:-|to)\s*(\d+)')
    section_break_pattern = re.compile(r'(?i)^\s*(?:Multiple\s+Choice\s+Questions|Part\s*(?:-|:)?\s*(?:[IVXLCDM]+|[A-D])\b|Division\s*(?:-|:)?\s*[A-D]\b|Section\s*(?:-|:)?\s*[A-D]\b)')
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
    case_scenario_questions_started = False
    case_start = None
    case_end = None
    in_explanation = False

    for line in cleaned_lines:
        stripped = line
        # Check for Case Scenario start
        case_match = case_scenario_pattern.search(stripped)
        if case_match:
            case_raw = case_match.group(1)
            case_num = roman_to_int(case_raw)
            current_q = {
                "q_no": f"CS{case_num}",
                "question_text": stripped,
                "case_scenario_passage": "",
                "marks": 10,
                "question_type": "CASE_SCENARIO",
                "difficulty": "MEDIUM",
                "attempt": attempt,
                "year": year,
                "sub_questions": []
            }
            questions.append(current_q)
            current_sq = None
            in_case_scenario = True
            case_scenario_questions_started = False
            case_start = None
            case_end = None
            in_explanation = False
            continue

        # Check section break (e.g. Multiple Choice Questions / Part II) ending case scenario
        if in_case_scenario and section_break_pattern.search(stripped):
            in_case_scenario = False
            case_scenario_questions_started = False
            current_sq = None
            continue

        # Range detection / narrative passage under Case Scenario
        if in_case_scenario and not case_scenario_questions_started:
            anchor_match = anchor_pattern.search(stripped)
            if anchor_match:
                case_start = int(anchor_match.group(1))
                case_end = int(anchor_match.group(2))
                case_scenario_questions_started = True
                if current_q:
                    if current_q.get("case_scenario_passage"):
                        current_q["case_scenario_passage"] += "\n\n" + stripped
                    else:
                        current_q["case_scenario_passage"] = stripped
                continue
            else:
                # Still narrative passage! Even if paragraph starts with e.g. "1. SBHA Ltd..."
                if current_q:
                    if current_q.get("case_scenario_passage"):
                        current_q["case_scenario_passage"] += "\n\n" + stripped
                    else:
                        current_q["case_scenario_passage"] = stripped
                continue

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

                if in_case_scenario and case_scenario_questions_started:
                    if case_start is not None and case_end is not None:
                        if case_start <= q_num_int <= case_end:
                            is_scenario_sub = True
                        else:
                            in_case_scenario = False
                    elif q_num_int <= 5:
                        is_scenario_sub = True

                if is_scenario_sub:
                    current_sq = {
                        "identifier": q_num,
                        "question_text": stripped,
                        "marks": 2,
                        "question_type": "MCQ",
                        "options": [],
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
                    case_scenario_questions_started = False
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
                if in_case_scenario and not case_scenario_questions_started:
                    if current_q.get("case_scenario_passage"):
                        current_q["case_scenario_passage"] += "\n\n" + stripped
                    else:
                        current_q["case_scenario_passage"] = stripped
                else:
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
            if q["q_no"].startswith("CS") or q.get("question_type") == "CASE_SCENARIO":
                q["question_type"] = "CASE_SCENARIO"
                q["marks"] = sum(sq.get("marks", 2) for sq in q["sub_questions"]) or 10
            else:
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

                # Extract MCQ options for sub-questions
                stem, opts = extract_mcq_options_from_text(sq.get("question_text", ""))
                if opts:
                    clean_stem = re.sub(r'^\s*(?:Question\s*(?:No\.?)?|Q)?\s*\d+\s*[\.\)]?\s*', '', stem).strip()
                    sq["question_text"] = clean_stem or stem
                    sq["options"] = opts
                    sq["question_type"] = "MCQ"
                else:
                    sq_text_lower = sq["question_text"].lower()
                    if "choose the correct" in sq_text_lower or ("(a)" in sq_text_lower and "(b)" in sq_text_lower) or ("(a)" in sq_text_lower and "option" in sq_text_lower):
                        sq["question_type"] = "MCQ"
                    elif any(term in sq_text_lower for term in ["calculate", "compute", "prepare", "journalize", "ledger"]):
                        sq["question_type"] = "NORMAL"
                    else:
                        sq["question_type"] = "THEORY"

            # Merge back normal questions with MCQ option sub-questions
            if not q["q_no"].startswith("CS") and q.get("question_type") != "CASE_SCENARIO" and len(q["sub_questions"]) == 4:
                idents = [s["identifier"].lower() for s in q["sub_questions"]]
                if idents in (["a", "b", "c", "d"], ["i", "ii", "iii", "iv"], ["1", "2", "3", "4"]):
                    is_mcq = True
                    question_verbs = ["explain", "discuss", "calculate", "compute", "prepare", "define", "distinguish", "state", "write"]
                    for s in q["sub_questions"]:
                        s_text_lower = s["question_text"].lower()
                        if any(verb in s_text_lower for verb in question_verbs) and len(s_text_lower) > 60:
                            is_mcq = False
                            break
                    if is_mcq:
                        q["options"] = [
                            {
                                "text": s["question_text"],
                                "is_correct": False,
                                "order": idx
                            }
                            for idx, s in enumerate(q["sub_questions"])
                        ]
                        q["question_type"] = "MCQ"
                        q["marks"] = 2
                        q["sub_questions"] = []
            continue

        # Top-level question processing
        stem, opts = extract_mcq_options_from_text(q.get("question_text", ""))
        if opts:
            clean_stem = re.sub(r'^\s*(?:Question\s*(?:No\.?)?|Q)?\s*\d+\s*[\.\)]?\s*', '', stem).strip()
            q["question_text"] = clean_stem or stem
            q["options"] = opts
            q["question_type"] = "MCQ"
            q["marks"] = q.get("marks") or 2
        else:
            text_lower = q["question_text"].lower()
            if "choose the correct" in text_lower or ("(a)" in text_lower and "(b)" in text_lower) or ("(a)" in text_lower and "option" in text_lower):
                q["question_type"] = "MCQ"
            elif any(term in text_lower for term in ["calculate", "compute", "prepare", "journalize", "ledger"]):
                q["question_type"] = "NORMAL"
            else:
                q["question_type"] = "THEORY"

    # Reconcile Case Scenarios and bundle child questions
    questions = reconcile_case_scenarios(questions)

    return questions, attempt, year


class PDFQuestionExtractView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsStaffOrReadOnly]
    parser_classes = [MultiPartParser]

    def post(self, request):
        trigger_background_pdf_cleanup()
        pdf_file = request.FILES.get('pdf') or request.FILES.get('question_pdf')
        answer_pdf_file = request.FILES.get('answer_pdf')

        if not pdf_file and not answer_pdf_file:
            return Response({'error': 'No PDF file provided. Upload as form-data field "pdf", "question_pdf", or "answer_pdf".'}, status=400)

        def extract_text_and_tables_from_pdf(file_obj):
            if not file_obj:
                return "", [], False, 0
            try:
                pdf_bytes = file_obj.read()
                doc = fitz.open(stream=pdf_bytes, filetype='pdf')
            except Exception as e:
                return "", [], False, 0

            pages_text = []
            pages_images_b64 = []
            merged_elements = []

            for page_num, page in enumerate(doc):
                mat = fitz.Matrix(1.8, 1.8)
                pix = page.get_pixmap(matrix=mat)
                img_bytes = pix.tobytes("png")
                pages_images_b64.append(base64.b64encode(img_bytes).decode('utf-8'))
                pages_text.append(page.get_text().strip())

                table_bboxes = []
                try:
                    tables = page.find_tables()
                    for tab in tables:
                        table_bboxes.append(tab.bbox)
                        y0 = tab.bbox[1]
                        tab_data = tab.extract()
                        html_table = convert_table_to_html(tab_data)
                        if html_table:
                            merged_elements.append((page_num, y0, html_table, 'table'))
                except Exception:
                    pass

                blocks = page.get_text("blocks")
                for b in blocks:
                    x0, y0, x1, y1, block_text, block_no, block_type = b
                    block_text = block_text.strip()
                    if not block_text:
                        continue
                    in_table = False
                    bx_center = (x0 + x1) / 2.0
                    by_center = (y0 + y1) / 2.0
                    for tbox in table_bboxes:
                        tx0, ty0, tx1, ty1 = tbox
                        if (tx0 - 2) <= bx_center <= (tx1 + 2) and (ty0 - 2) <= by_center <= (ty1 + 2):
                            in_table = True
                            break
                    if not in_table:
                        merged_elements.append((page_num, y0, block_text, 'text'))

            doc.close()
            total_text = '\n\n--- PAGE BREAK ---\n\n'.join(pages_text)
            avg_chars = len(total_text.strip()) / max(len(pages_text), 1)
            is_scanned = avg_chars < 150

            merged_elements.sort(key=lambda x: (x[0], x[1]))
            ordered_lines = []
            for item in merged_elements:
                pg, y, val, item_type = item
                if item_type == 'table':
                    ordered_lines.append(f"\n\n{val}\n\n")
                else:
                    ordered_lines.append(val)

            full_text = "\n".join(ordered_lines)
            return full_text, pages_images_b64, is_scanned, len(pages_text)

        # Process main/question PDF
        q_text, pages_images_b64, is_scanned, total_pages = extract_text_and_tables_from_pdf(pdf_file)

        # Process separate answer PDF if provided
        ans_text = ""
        if answer_pdf_file:
            ans_text, _, _, _ = extract_text_and_tables_from_pdf(answer_pdf_file)

        provider_param = str(request.data.get('provider') or request.data.get('engine') or '').lower()
        use_gemini_param = str(request.data.get('use_gemini', 'true')).lower() in ('true', '1', 'yes')
        gemini_api_key = request.data.get('gemini_api_key')
        openai_api_key = request.data.get('openai_api_key')

        questions = []
        engine_used = 'regex'
        ai_powered = False
        advisory = None
        extracted_attempt = 'MAY'
        extracted_year = '2025'

        if q_text and (provider_param in ('openai', 'gemini', 'auto') or use_gemini_param):
            if provider_param == 'openai':
                providers_to_try = ['openai', 'gemini']
            elif provider_param == 'gemini':
                providers_to_try = ['gemini', 'openai']
            else:
                has_oai = bool(resolve_openai_api_key(openai_api_key))
                providers_to_try = ['openai', 'gemini'] if has_oai else ['gemini', 'openai']

            attempted_errors = []
            for p in providers_to_try:
                if p == 'openai':
                    oai_qs, oai_err = extract_questions_with_openai(
                        q_text=q_text,
                        ans_text=ans_text if answer_pdf_file else None,
                        api_key=openai_api_key
                    )
                    if oai_qs and len(oai_qs) > 0:
                        questions = oai_qs
                        engine_used = 'openai'
                        ai_powered = True
                        advisory = "Successfully parsed question numbers, options, and auto-filled answers with OpenAI."
                        break
                    else:
                        attempted_errors.append(f"OpenAI: {oai_err or 'No questions extracted'}")
                elif p == 'gemini':
                    gemini_qs, gemini_err = extract_questions_with_gemini(
                        q_text=q_text,
                        ans_text=ans_text if answer_pdf_file else None,
                        api_key=gemini_api_key
                    )
                    if gemini_qs and len(gemini_qs) > 0:
                        questions = gemini_qs
                        engine_used = 'gemini'
                        ai_powered = True
                        advisory = "Successfully parsed question numbers, options, and automatically filled answers with Gemini AI."
                        if provider_param == 'openai':
                            advisory = "OpenAI had insufficient credits or rate limit; automatically fell back to Gemini AI!"
                        break
                    else:
                        attempted_errors.append(f"Gemini: {gemini_err or 'No questions extracted'}")

            if not questions:
                # Graceful fallback to regex parser
                questions, extracted_attempt, extracted_year = parse_questions_from_raw_text(q_text)
                engine_used = 'regex_fallback'
                ai_powered = False
                advisory = f"AI providers unavailable ({'; '.join(attempted_errors)}), used local parser fallback."
        elif q_text:
            questions, extracted_attempt, extracted_year = parse_questions_from_raw_text(q_text)
            engine_used = 'regex'

        # If regex or fallback was used and a separate answer PDF was provided, map answers
        if engine_used in ('regex', 'regex_fallback') and answer_pdf_file and ans_text:
            ans_questions, _, _ = parse_questions_from_raw_text(ans_text)
            ans_map = {}
            for aq in ans_questions:
                if aq.get('q_no'):
                    ans_map[str(aq['q_no'])] = aq.get('correct_answer') or aq.get('answer') or aq.get('question_text')
                for asq in aq.get('sub_questions', []):
                    if asq.get('identifier'):
                        ans_map[f"{aq.get('q_no', '1')}_{asq['identifier'].lower()}"] = asq.get('correct_answer') or asq.get('answer') or asq.get('question_text')

            for q in questions:
                q_num = str(q.get('q_no', ''))
                if q_num in ans_map and not q.get('correct_answer'):
                    q['correct_answer'] = ans_map[q_num]
                for sq in q.get('sub_questions', []):
                    sq_key = f"{q_num}_{sq.get('identifier', '').lower()}"
                    if sq_key in ans_map and not sq.get('correct_answer'):
                        sq['correct_answer'] = ans_map[sq_key]

        # Clean out any non-question exam instruction headers accidentally captured
        instruction_triggers = [
            "question paper comprises",
            "part i comprises",
            "part ii comprises",
            "part iii comprises",
            "case scenario based multiple choice",
            "questions which require descriptive",
            "all questions are compulsory",
            "working notes should form part",
            "candidates are permitted",
            "candidates are allowed",
            "answers to questions of part",
            "answers are to be given on omr",
            "answers are to be written in",
            "do not write anything on",
            "instructions to candidates",
            "reading time"
        ]
        sanitized_questions = []
        for q in questions:
            q_text_low = (q.get('question_text') or '').lower().strip()
            is_instruction = any(trig in q_text_low for trig in instruction_triggers)
            if is_instruction and len(q_text_low) < 300:
                continue
            sanitized_questions.append(q)
        questions = sanitized_questions

        # Metadata params
        auto_save = str(request.data.get('auto_save', '')).lower() in ('true', '1', 'yes')
        source = request.data.get('source')
        attempt = request.data.get('attempt') or extracted_attempt
        year = request.data.get('year') or extracted_year
        subject_id = request.data.get('subject_id')
        icai_topic_id = request.data.get('icai_topic_id') or request.data.get('topic_id')

        saved_ids = []
        file_url = None

        if auto_save and pdf_file:
            from django.core.files.storage import default_storage
            file_path = default_storage.save(f'question_papers/{pdf_file.name}', pdf_file)
            file_url = request.build_absolute_uri(default_storage.url(file_path))
            saved_ids = save_extracted_questions_to_db(
                questions=questions,
                source=source,
                attempt=attempt,
                year=year,
                subject_id=subject_id,
                icai_topic_id=icai_topic_id,
                user=request.user,
                pdf_url=file_url
            )

        return Response({
            'questions': questions,
            'raw_question_text': q_text or '',
            'raw_answer_text': ans_text if answer_pdf_file else '',
            'total_extracted': len(questions),
            'engine': engine_used,
            'ai_powered': ai_powered,
            'advisory': advisory,
            'is_scanned': is_scanned,
            'pages': total_pages,
            'auto_saved': auto_save,
            'saved_count': len(saved_ids),
            'saved_ids': saved_ids,
            'file_url': file_url,
            'page_images': pages_images_b64 if is_scanned else []
        }, status=200)



def save_extracted_questions_to_db(questions, source=None, attempt=None, year=None, subject_id=None, icai_topic_id=None, status='ACTIVE', user=None, pdf_url=None):
    import datetime
    created_ids = []
    subject = None
    if subject_id:
        try:
            subject = Subject.objects.filter(id=int(subject_id)).first()
        except Exception:
            pass

    icai_topic = None
    if icai_topic_id:
        try:
            from master_data.models import ICAITopic
            icai_topic = ICAITopic.objects.filter(id=int(icai_topic_id)).first()
        except Exception:
            pass

    for q in questions:
        q_source = source or q.get('source') or 'MTP-01'
        q_attempt = attempt or q.get('attempt') or 'MAY'
        q_year = str(year or q.get('year') or datetime.datetime.now().year)
        q_sec = q.get('section') or ''
        q_no = str(q.get('q_no') or '1')
        q_type = q.get('question_type') or 'NORMAL'
        
        try:
            q_marks = int(q.get('marks') or 1)
        except (ValueError, TypeError):
            q_marks = 1

        q_diff = q.get('difficulty') or 'MEDIUM'
        q_text = q.get('question_text') or ''
        q_ans = q.get('correct_answer') or q.get('answer') or ''

        t_data = q.get('table_data')
        if isinstance(t_data, (dict, list)):
            t_data = json.dumps(t_data)
        elif t_data and not isinstance(t_data, str):
            t_data = str(t_data)

        ans_t_data = q.get('answer_table_data')
        if isinstance(ans_t_data, (dict, list)):
            ans_t_data = json.dumps(ans_t_data)
        elif ans_t_data and not isinstance(ans_t_data, str):
            ans_t_data = str(ans_t_data)

        parent_q = SubjectiveQuestion.objects.create(
            source=q_source,
            attempt=q_attempt,
            year=q_year,
            section=q_sec,
            q_no=q_no,
            question_type=q_type,
            marks=q_marks,
            difficulty=q_diff,
            question_text=q_text,
            correct_answer=q_ans,
            table_data=t_data,
            answer_table_data=ans_t_data,
            pdf_url=pdf_url,
            status=status or 'ACTIVE',
            subject=subject,
            icai_topic=icai_topic,
            created_by=user if (user and hasattr(user, 'is_authenticated') and user.is_authenticated) else None
        )

        for idx, opt in enumerate(q.get('options', [])):
            if isinstance(opt, str):
                opt_text, is_corr = opt, False
            else:
                opt_text = opt.get('text', '')
                is_corr = bool(opt.get('is_correct', False))
            if opt_text:
                QuestionOption.objects.create(
                    question=parent_q,
                    text=opt_text,
                    is_correct=is_corr,
                    order=idx
                )

        sub_qs = q.get('sub_questions') or q.get('parts') or []
        for sq in sub_qs:
            sq_ident = sq.get('identifier') or ''
            sq_text = sq.get('question_text') or ''
            sq_type = sq.get('question_type') or 'NORMAL'
            sq_ans = sq.get('correct_answer') or sq.get('answer') or ''
            try:
                sq_marks = int(sq.get('marks') or 1)
            except (ValueError, TypeError):
                sq_marks = 1

            sq_t_data = sq.get('table_data')
            if isinstance(sq_t_data, (dict, list)):
                sq_t_data = json.dumps(sq_t_data)
            elif sq_t_data and not isinstance(sq_t_data, str):
                sq_t_data = str(sq_t_data)

            sq_ans_t_data = sq.get('answer_table_data')
            if isinstance(sq_ans_t_data, (dict, list)):
                sq_ans_t_data = json.dumps(sq_ans_t_data)
            elif sq_ans_t_data and not isinstance(sq_ans_t_data, str):
                sq_ans_t_data = str(sq_ans_t_data)

            sub_obj = SubQuestion.objects.create(
                parent_question=parent_q,
                identifier=sq_ident,
                question_text=sq_text,
                question_type=sq_type,
                correct_answer=sq_ans,
                table_data=sq_t_data,
                answer_table_data=sq_ans_t_data,
                marks=sq_marks
            )

            for idx, opt in enumerate(sq.get('options', [])):
                if isinstance(opt, str):
                    opt_text, is_corr = opt, False
                else:
                    opt_text = opt.get('text', '')
                    is_corr = bool(opt.get('is_correct', False))
                if opt_text:
                    QuestionOption.objects.create(
                        sub_question=sub_obj,
                        text=opt_text,
                        is_correct=is_corr,
                        order=idx
                    )

        created_ids.append(parent_q.id)

    return created_ids


class BulkSaveQuestionsView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsStaffOrReadOnly]

    def post(self, request):
        questions = request.data.get('questions', [])
        if not questions:
            return Response({'error': 'No questions array provided.'}, status=400)

        source = request.data.get('source')
        attempt = request.data.get('attempt')
        year = request.data.get('year')
        subject_id = request.data.get('subject_id')
        pdf_url = request.data.get('pdf_url')

        saved_ids = save_extracted_questions_to_db(
            questions=questions,
            source=source,
            attempt=attempt,
            year=year,
            subject_id=subject_id,
            user=request.user,
            pdf_url=pdf_url
        )

        return Response({
            'message': f'Successfully saved {len(saved_ids)} questions to Question Bank.',
            'saved_count': len(saved_ids),
            'saved_ids': saved_ids
        }, status=201)


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


class AIGenerateAnswerView(APIView):
    """
    On-demand AI solution generator for an individual question.
    Produces complete step-by-step model answer, working notes, journal entries, and tables
    using OpenAI or Google Gemini with automatic failover.
    """
    permission_classes = [permissions.IsAuthenticated, IsStaffOrReadOnly]

    def post(self, request):
        question_text = request.data.get('question_text', '').strip()
        if not question_text:
            return Response({'error': 'question_text is required.'}, status=400)

        marks = request.data.get('marks', 10)
        q_type = request.data.get('question_type', 'NORMAL')
        subject = request.data.get('subject', '')
        table_data = request.data.get('table_data')
        provider = str(request.data.get('provider') or 'auto').lower()
        gemini_api_key = request.data.get('gemini_api_key')
        openai_api_key = request.data.get('openai_api_key')

        providers_to_try = []
        if provider == 'openai':
            providers_to_try = ['openai', 'gemini']
        elif provider == 'gemini':
            providers_to_try = ['gemini', 'openai']
        else:
            has_oai = bool(resolve_openai_api_key(openai_api_key))
            providers_to_try = ['openai', 'gemini'] if has_oai else ['gemini', 'openai']

        result = None
        engine_used = None
        failover_note = None
        errors = []

        for p in providers_to_try:
            if p == 'openai':
                res, err = generate_answer_with_openai(
                    question_text=question_text,
                    marks=marks,
                    q_type=q_type,
                    subject=subject,
                    table_data=table_data,
                    api_key=openai_api_key
                )
                if res:
                    result = res
                    engine_used = 'openai'
                    break
                else:
                    errors.append(f"OpenAI: {err}")
            elif p == 'gemini':
                res, err = generate_answer_with_gemini(
                    question_text=question_text,
                    marks=marks,
                    q_type=q_type,
                    subject=subject,
                    table_data=table_data,
                    api_key=gemini_api_key
                )
                if res:
                    result = res
                    engine_used = 'gemini'
                    if provider == 'openai':
                        failover_note = "OpenAI had insufficient credits or rate limit; generated solution with Gemini AI."
                    break
                else:
                    errors.append(f"Gemini: {err}")

        if result:
            return Response({
                'success': True,
                'correct_answer': result.get('correct_answer', ''),
                'working_notes': result.get('working_notes', ''),
                'answer_table_data': result.get('answer_table_data'),
                'correct_mcq_option': result.get('correct_mcq_option'),
                'engine': engine_used,
                'failover_note': failover_note
            }, status=200)
        else:
            return Response({
                'success': False,
                'error': f"Failed to generate solution. ({'; '.join(errors)})"
            }, status=500)


class TestGeminiKeyView(APIView):
    """
    Endpoint to test and configure the Gemini API Key.
    GET: checks if an active key is configured.
    POST: verifies the provided key against Google Gemini API and optionally saves to PlatformSetting.
    """
    permission_classes = [permissions.IsAuthenticated, IsStaffOrReadOnly]

    def get(self, request):
        key = resolve_gemini_api_key()
        if key:
            masked = key[:6] + "..." + key[-4:] if len(key) > 10 else "***"
            return Response({
                'has_key': True,
                'masked_key': masked
            }, status=200)
        return Response({'has_key': False}, status=200)

    def post(self, request):
        test_key = request.data.get('gemini_api_key', '').strip() or resolve_gemini_api_key()
        if not test_key:
            return Response({'valid': False, 'error': 'No Gemini API key provided.'}, status=400)

        save_flag = str(request.data.get('save', '')).lower() in ('true', '1', 'yes')
        valid, model, details = test_gemini_api_key(test_key)

        if valid:
            if save_flag:
                try:
                    from subscriptions.models import PlatformSetting
                    PlatformSetting.objects.update_or_create(
                        key="GEMINI_API_KEY",
                        defaults={"value": test_key, "description": "Google Gemini API Key for question & answer auto-fill"}
                    )
                except Exception as e:
                    print("Could not persist key to PlatformSetting:", e)
            return Response({
                'valid': True,
                'model': model,
                'message': f'Gemini AI is connected successfully using model {model}!'
            }, status=200)
        else:
            return Response({
                'valid': False,
                'error': f'Failed to authenticate with Gemini API: {str(details)[:300]}'
            }, status=400)


class TestOpenAIKeyView(APIView):
    """
    Endpoint to test and configure the OpenAI API Key.
    GET: checks if an active key is configured.
    POST: verifies the provided key against OpenAI API and optionally saves to PlatformSetting.
    """
    permission_classes = [permissions.IsAuthenticated, IsStaffOrReadOnly]

    def get(self, request):
        key = resolve_openai_api_key()
        if key:
            masked = key[:7] + "..." + key[-4:] if len(key) > 12 else "***"
            return Response({
                'has_key': True,
                'masked_key': masked
            }, status=200)
        return Response({'has_key': False}, status=200)

    def post(self, request):
        test_key = request.data.get('openai_api_key', '').strip() or resolve_openai_api_key()
        if not test_key:
            return Response({'valid': False, 'error': 'No OpenAI API key provided.'}, status=400)

        save_flag = str(request.data.get('save', '')).lower() in ('true', '1', 'yes')
        valid, model, details = test_openai_api_key(test_key)

        if valid:
            if save_flag:
                try:
                    from subscriptions.models import PlatformSetting
                    PlatformSetting.objects.update_or_create(
                        key="OPENAI_API_KEY",
                        defaults={"value": test_key, "description": "OpenAI API Key for question & answer auto-fill"}
                    )
                except Exception as e:
                    print("Could not persist OpenAI key to PlatformSetting:", e)
            return Response({
                'valid': True,
                'model': model,
                'message': details
            }, status=200)
        else:
            return Response({
                'valid': False,
                'error': f'Failed to authenticate with OpenAI API: {str(details)[:300]}'
            }, status=400)


class AIStatusView(APIView):
    """
    Returns configured status of both Gemini and OpenAI AI providers.
    """
    permission_classes = [permissions.IsAuthenticated, IsStaffOrReadOnly]

    def get(self, request):
        gemini_key = resolve_gemini_api_key()
        openai_key = resolve_openai_api_key()

        return Response({
            'gemini': {
                'has_key': bool(gemini_key),
                'masked_key': (gemini_key[:6] + "..." + gemini_key[-4:]) if (gemini_key and len(gemini_key) > 10) else None,
                'provider': 'gemini'
            },
            'openai': {
                'has_key': bool(openai_key),
                'masked_key': (openai_key[:7] + "..." + openai_key[-4:]) if (openai_key and len(openai_key) > 12) else None,
                'provider': 'openai'
            },
            'active_provider': 'openai' if openai_key else ('gemini' if gemini_key else 'none')
        }, status=200)




# ─────────────────────────────────────────────────────────────
import threading
import time as _time

def _sweep_old_pdfs(days=1):
    try:
        cutoff_time = _time.time() - (days * 86400)
        media_root = getattr(settings, 'MEDIA_ROOT', None)
        if not media_root or not os.path.exists(media_root):
            return
        target_dirs = [
            os.path.join(media_root, 'question_papers'),
            os.path.join(media_root, 'materials', 'pdfs'),
            os.path.join(media_root, 'temp_uploads'),
            os.path.join(media_root, 'temp'),
        ]
        for target_dir in target_dirs:
            if not os.path.exists(target_dir):
                continue
            for root, _, files in os.walk(target_dir):
                for filename in files:
                    if filename.lower().endswith('.pdf'):
                        file_path = os.path.join(root, filename)
                        try:
                            if os.stat(file_path).st_mtime < cutoff_time:
                                os.remove(file_path)
                        except Exception:
                            pass
    except Exception:
        pass

def trigger_background_pdf_cleanup():
    t = threading.Thread(target=_sweep_old_pdfs, args=(1,), daemon=True)
    t.start()

class UploadPDFView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsStaffOrReadOnly]
    parser_classes = [MultiPartParser]

    def post(self, request):
        trigger_background_pdf_cleanup()
        pdf_file = request.FILES.get('pdf')
        if not pdf_file:
            return Response({'error': 'No PDF file provided. Send as form-data field "pdf".'}, status=400)

        if not pdf_file.name.lower().endswith('.pdf'):
            return Response({'error': 'Only PDF files are accepted.'}, status=400)

        # Optional metadata from request
        title       = request.data.get('title', os.path.splitext(pdf_file.name)[0])
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
            
            url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent"
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


import logging
from django.db import transaction

logger = logging.getLogger(__name__)

from materials.models import QuestionImportJob, ImportBatch, SourceDocument, ImportAuditLog
from materials.serializers import (
    QuestionImportJobListSerializer, QuestionImportJobDetailSerializer,
    ImportBatchListSerializer, ImportBatchDetailSerializer,
    SourceDocumentSerializer, ImportAuditLogSerializer
)
from materials.ai_worker import start_import_job_async, start_import_batch_async
from materials.ai_importer import (
    publish_approved_questions_to_database, publish_approved_batch_to_database,
    infer_document_type, auto_pair_batch_documents, compute_file_hash,
    extract_document_metadata_fast
)
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

class QuestionImportJobViewSet(viewsets.ModelViewSet):
    queryset = QuestionImportJob.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsStaffOrReadOnly]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return QuestionImportJob.objects.none()
        if user.is_superuser:
            return QuestionImportJob.objects.all()
        from django.db.models import Q
        if getattr(user, 'institution', None):
            return QuestionImportJob.objects.filter(
                Q(institution=user.institution) | Q(created_by=user)
            )
        return QuestionImportJob.objects.filter(created_by=user)

    def get_serializer_class(self):
        if self.action in ['list']:
            return QuestionImportJobListSerializer
        return QuestionImportJobDetailSerializer

    def create(self, request, *args, **kwargs):
        qp_file = request.FILES.get('question_pdf')
        ans_file = request.FILES.get('answer_pdf')

        if not qp_file:
            return Response({'error': 'Question Paper PDF is required.'}, status=400)

        # Optional metadata overrides
        ca_level = request.data.get('ca_level', 'CA Intermediate')
        level_id = request.data.get('level_id')
        paper_id = request.data.get('paper_id')
        chapter_id = request.data.get('chapter_id')
        topic_id = request.data.get('topic_id')
        exam_session = request.data.get('exam_session', 'July 2026')
        exam_year_raw = request.data.get('exam_year', '2026')
        source = request.data.get('source', 'Mock Test Paper – Series I')
        auto_process = str(request.data.get('auto_process', 'true')).lower() in ('true', '1', 'yes')

        try:
            exam_year = int(exam_year_raw) if exam_year_raw else 2026
        except (ValueError, TypeError):
            exam_year = 2026

        user = request.user if request.user.is_authenticated else None
        user_inst = getattr(user, 'institution', None) if user else None
        is_plat_wide = request.data.get('is_platform_wide')
        if is_plat_wide is not None:
            is_platform_wide = str(is_plat_wide).lower() in ('true', '1', 'yes')
        else:
            is_platform_wide = (user_inst is None)

        target_question_type = str(request.data.get('target_question_type', 'ALL')).upper()
        if target_question_type not in ('ALL', 'MCQ', 'DESCRIPTIVE', 'CASE_SCENARIO'):
            target_question_type = 'ALL'

        job = QuestionImportJob.objects.create(
            created_by=user,
            institution=user_inst,
            is_platform_wide=is_platform_wide,
            question_pdf=qp_file,
            answer_pdf=ans_file,
            question_pdf_filename=qp_file.name,
            answer_pdf_filename=ans_file.name if ans_file else '',
            status='uploaded',
            stage_label='Uploaded - Ready to process',
            progress_percent=0,
            ca_level=ca_level,
            level_id=level_id if level_id else None,
            paper_id=paper_id if paper_id else None,
            chapter_id=chapter_id if chapter_id else None,
            topic_id=topic_id if topic_id else None,
            exam_session=exam_session,
            exam_year=exam_year,
            source=source,
            extracted_metadata={'target_question_type': target_question_type}
        )

        if auto_process:
            start_import_job_async(job.id)

        serializer = QuestionImportJobDetailSerializer(job, context={'request': request})
        return Response(serializer.data, status=201)

    @action(detail=True, methods=['get'])
    def status(self, request, pk=None):
        job = self.get_object()
        return Response({
            'id': str(job.id),
            'status': job.status,
            'stage_label': job.stage_label,
            'progress_percent': job.progress_percent,
            'error_message': job.error_message,
            'model_used': job.model_used,
            'total_tokens': job.total_input_tokens + job.total_output_tokens,
            'processing_time_seconds': job.processing_time_seconds,
            'question_count': job.extracted_payload.get('validation', {}).get('question_count', 0) if job.extracted_payload else 0
        })

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        job = self.get_object()
        if job.status in ['extracting', 'parsing_questions', 'parsing_answers', 'matching', 'validating']:
            return Response({'message': 'Job is already running.', 'status': job.status})
        
        job.status = 'extracting'
        job.stage_label = 'Starting AI extraction pipeline...'
        job.progress_percent = 5
        job.error_message = None
        job.save()

        start_import_job_async(job.id)
        return Response({'message': 'Extraction pipeline started.', 'status': job.status})

    @action(detail=True, methods=['post'], url_path='reprocess')
    def reprocess(self, request, pk=None):
        job = self.get_object()
        job.status = 'extracting'
        job.stage_label = 'Reprocessing document with AI pipeline...'
        job.progress_percent = 5
        job.error_message = None
        job.save()

        start_import_job_async(job.id)
        return Response({'message': 'Job reprocessing started.', 'status': job.status})

    @action(detail=True, methods=['post'], url_path='link-answer')
    def link_answer(self, request, pk=None):
        job = self.get_object()
        ans_file = request.FILES.get('answer_pdf') or request.FILES.get('file')
        if not ans_file:
            return Response({'error': 'Answer PDF file is required.'}, status=400)

        job.answer_pdf = ans_file
        job.answer_pdf_filename = ans_file.name
        job.status = 'extracting'
        job.stage_label = f'Answer PDF "{ans_file.name}" linked. Resuming AI processing...'
        job.progress_percent = 10
        job.error_message = None
        job.save()

        start_import_job_async(job.id)
        return Response({
            'message': f'Answer PDF "{ans_file.name}" linked successfully. Pipeline resumed.',
            'status': job.status
        })

    @action(detail=True, methods=['post'], url_path='rematch')
    def rematch(self, request, pk=None):
        job = self.get_object()
        payload = job.extracted_payload or {}
        sections = payload.get('sections', [])
        all_questions = []
        for sec in sections:
            all_questions.extend(sec.get('questions', []))

        from materials.ai_importer import (
            match_questions_and_answers, validate_extracted_dataset,
            classify_and_enrich_questions
        )
        raw_answers = payload.get('raw_answers', [])
        if all_questions and raw_answers:
            matched_qs, ans_stats = match_questions_and_answers(all_questions, raw_answers)
            enriched_qs = classify_and_enrich_questions(matched_qs, job)
            validation = validate_extracted_dataset(enriched_qs)
            sec_dict = {}
            for q in enriched_qs:
                s_name = q.get('section', 'General')
                sec_dict.setdefault(s_name, []).append(q)
            new_sections = [{"section_name": k, "questions": v} for k, v in sec_dict.items()]
            payload['sections'] = new_sections
            payload['answer_statistics'] = ans_stats
            payload['validation'] = validation
            job.extracted_payload = payload
            job.save()
            return Response({'message': 'Questions and answers re-matched successfully.', 'validation': validation})
        else:
            job.status = 'extracting'
            job.stage_label = 'Re-running extraction and matching pipeline...'
            job.progress_percent = 10
            job.save()
            start_import_job_async(job.id)
            return Response({'message': 'Pipeline triggered for re-extraction and matching.', 'status': job.status})

    @action(detail=True, methods=['put', 'patch'])
    def payload(self, request, pk=None):
        job = self.get_object()
        new_payload = request.data.get('payload') or request.data
        if not isinstance(new_payload, dict):
            return Response({'error': 'Invalid payload format, expected JSON object.'}, status=400)
        
        job.extracted_payload = new_payload
        job.save()
        return Response({'message': 'Draft payload saved successfully.', 'status': job.status})

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        job = self.get_object()
        payload = job.extracted_payload or {}
        sections = payload.get('sections', [])
        question_id = request.data.get('question_id')
        approve_all = str(request.data.get('approve_all', 'false')).lower() in ('true', '1', 'yes')

        modified = 0
        for sec in sections:
            for q in sec.get('questions', []):
                if approve_all or (question_id and q.get('question_id') == question_id):
                    q['is_approved'] = True
                    modified += 1

        job.extracted_payload = payload
        job.save()
        return Response({'message': f'Approved {modified} questions.', 'status': job.status})

    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        job = self.get_object()
        approved_only = str(request.data.get('approved_only', 'false')).lower() in ('true', '1', 'yes')
        count, err = publish_approved_questions_to_database(job, approved_only=approved_only)
        if err and count == 0:
            return Response({'error': err}, status=400)
        return Response({
            'message': f'Successfully published {count} questions to the live question bank.',
            'published_count': count,
            'warnings': err,
            'status': job.status
        })

    @action(detail=True, methods=['get'], url_path='audit-logs')
    def audit_logs(self, request, pk=None):
        job = self.get_object()
        logs = job.audit_logs.all()
        serializer = ImportAuditLogSerializer(logs, many=True)
        return Response(serializer.data)


class ImportBatchViewSet(viewsets.ModelViewSet):
    queryset = ImportBatch.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsStaffOrReadOnly]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return ImportBatch.objects.none()
        if user.is_superuser:
            return ImportBatch.objects.all()
        from django.db.models import Q
        if getattr(user, 'institution', None):
            return ImportBatch.objects.filter(
                Q(institution=user.institution) | Q(created_by=user)
            )
        return ImportBatch.objects.filter(created_by=user)

    def get_serializer_class(self):
        if self.action in ['list']:
            return ImportBatchListSerializer
        return ImportBatchDetailSerializer

    def create(self, request, *args, **kwargs):
        uploaded_files = request.FILES.getlist('files') or request.FILES.getlist('files[]')
        if not uploaded_files:
            qp = request.FILES.get('question_pdf')
            ans = request.FILES.get('answer_pdf')
            if qp:
                uploaded_files.append(qp)
            if ans:
                uploaded_files.append(ans)

        if not uploaded_files:
            return Response({'error': 'At least one PDF file is required to create an import batch.'}, status=400)

        name = request.data.get('name') or f"AI Batch {request.data.get('source', 'CA Paper')} - {timezone.now().strftime('%d %b %Y, %H:%M')}"
        ca_level = request.data.get('ca_level', 'CA Intermediate')
        level_id = request.data.get('level_id')
        paper_id = request.data.get('paper_id')
        chapter_id = request.data.get('chapter_id')
        topic_id = request.data.get('topic_id')
        exam_session = request.data.get('exam_session', 'August 2026')
        exam_year_raw = request.data.get('exam_year', '2026')
        source = request.data.get('source', 'Mock Test Paper – Series II')
        auto_process = str(request.data.get('auto_process', 'true')).lower() in ('true', '1', 'yes')

        try:
            exam_year = int(exam_year_raw) if exam_year_raw else 2026
        except (ValueError, TypeError):
            exam_year = 2026

        user = request.user if request.user.is_authenticated else None
        user_inst = getattr(user, 'institution', None) if user else None
        is_plat_wide = request.data.get('is_platform_wide')
        if is_plat_wide is not None:
            is_platform_wide = str(is_plat_wide).lower() in ('true', '1', 'yes')
        else:
            is_platform_wide = (user_inst is None)

        file_types_raw = request.data.get('file_types')
        file_types_map = {}
        if file_types_raw:
            try:
                if isinstance(file_types_raw, str):
                    parsed_types = json.loads(file_types_raw)
                else:
                    parsed_types = file_types_raw
                if isinstance(parsed_types, dict):
                    file_types_map = parsed_types
                elif isinstance(parsed_types, list):
                    for idx, t in enumerate(parsed_types):
                        if idx < len(uploaded_files):
                            file_types_map[uploaded_files[idx].name] = t
            except Exception:
                pass

        target_question_type = str(request.data.get('target_question_type', 'ALL')).upper()
        if target_question_type not in ('ALL', 'MCQ', 'DESCRIPTIVE', 'CASE_SCENARIO'):
            target_question_type = 'ALL'

        with transaction.atomic():
            batch = ImportBatch.objects.create(
                created_by=user,
                institution=user_inst,
                is_platform_wide=is_platform_wide,
                name=name,
                ca_level=ca_level,
                level_id=level_id if level_id else None,
                paper_id=paper_id if paper_id else None,
                chapter_id=chapter_id if chapter_id else None,
                topic_id=topic_id if topic_id else None,
                exam_session=exam_session,
                exam_year=exam_year,
                source=source,
                status='uploaded',
                stage_label=f"Uploaded {len(uploaded_files)} document(s) - Initializing",
                progress_percent=0,
                total_documents=len(uploaded_files),
                batch_payload={'target_question_type': target_question_type}
            )

            saved_docs = []
            seen_hashes_in_batch = set()

            for f in uploaded_files:
                doc_record = SourceDocument.objects.create(
                    batch=batch,
                    institution=user_inst,
                    file=f,
                    filename=f.name,
                    file_hash='',
                    file_size_bytes=f.size,
                    file_type=file_types_map.get(f.name, 'UNKNOWN'),
                    status='uploaded'
                )

                try:
                    f_hash = compute_file_hash(doc_record.file.path)
                    doc_record.file_hash = f_hash
                    
                    import fitz
                    pdoc = fitz.open(doc_record.file.path)
                    doc_record.page_count = len(pdoc)
                    pdoc.close()

                    meta = extract_document_metadata_fast(doc_record.file.path)
                    doc_record.extracted_metadata = meta
                    doc_record.inferred_type = meta.get('inferred_type', 'UNKNOWN')
                    if doc_record.file_type == 'UNKNOWN':
                        doc_record.file_type = meta.get('inferred_type', 'UNKNOWN')

                    if f_hash in seen_hashes_in_batch:
                        doc_record.status = 'duplicate'
                        meta['is_duplicate'] = True
                        meta['duplicate_reason'] = 'Duplicate file uploaded in the same batch'
                        doc_record.extracted_metadata = meta

                    seen_hashes_in_batch.add(f_hash)
                    doc_record.save()
                except Exception as e:
                    logger.warning(f"Error inspecting uploaded source doc: {e}")

                saved_docs.append(doc_record)

            # Filter out exact duplicate files from pairing
            active_docs = [d for d in saved_docs if d.status != 'duplicate']
            pairs = auto_pair_batch_documents(active_docs)
            created_jobs = []
            for p in pairs:
                qp_doc = p['qp']
                ans_doc = p.get('ans')
                qp_meta = getattr(qp_doc, 'extracted_metadata', {}) or {}

                # Resolve paper if possible
                job_paper_id = paper_id
                if not job_paper_id and qp_meta.get('subject'):
                    from master_data.models import ICAIPaper
                    subj_str = qp_meta['subject'].lower()
                    matched_p = ICAIPaper.objects.filter(name__icontains=subj_str).first()
                    if matched_p:
                        job_paper_id = matched_p.id

                job = QuestionImportJob.objects.create(
                    batch=batch,
                    created_by=user,
                    institution=user_inst,
                    is_platform_wide=is_platform_wide,
                    question_pdf=qp_doc.file,
                    answer_pdf=ans_doc.file if ans_doc else None,
                    question_pdf_filename=qp_doc.filename,
                    answer_pdf_filename=ans_doc.filename if ans_doc else '',
                    status='uploaded',
                    stage_label='Document pair linked to batch',
                    progress_percent=0,
                    ca_level=ca_level or qp_meta.get('course', 'CA Intermediate'),
                    level_id=level_id if level_id else None,
                    paper_id=job_paper_id if job_paper_id else None,
                    chapter_id=chapter_id if chapter_id else None,
                    topic_id=topic_id if topic_id else None,
                    exam_session=exam_session or qp_meta.get('exam_session', 'MAY'),
                    exam_year=exam_year or qp_meta.get('exam_year', 2026),
                    source=source or qp_meta.get('series_title', 'Mock Test Paper'),
                    extracted_metadata={'target_question_type': target_question_type}
                )
                qp_doc.job = job
                qp_doc.save()
                if ans_doc and ans_doc.id != qp_doc.id:
                    ans_doc.job = job
                    ans_doc.save()
                created_jobs.append(job)

            ImportAuditLog.objects.create(
                batch=batch,
                user=user,
                action='CREATE_BATCH',
                details={'documents_count': len(saved_docs), 'jobs_count': len(created_jobs)}
            )

        if auto_process and created_jobs:
            start_import_batch_async(batch.id)

        serializer = ImportBatchDetailSerializer(batch, context={'request': request})
        return Response(serializer.data, status=201)

    @action(detail=True, methods=['get'])
    def status(self, request, pk=None):
        batch = self.get_object()
        return Response({
            'id': str(batch.id),
            'name': batch.name,
            'status': batch.status,
            'stage_label': batch.stage_label,
            'progress_percent': batch.progress_percent,
            'error_message': batch.error_message,
            'total_documents': batch.total_documents,
            'total_questions_detected': batch.total_questions_detected,
            'matched_answers_count': batch.matched_answers_count,
            'missing_answers_count': batch.missing_answers_count,
            'tables_count': batch.tables_count,
            'mcqs_count': batch.mcqs_count,
            'duplicate_candidates_count': batch.duplicate_candidates_count,
            'low_confidence_count': batch.low_confidence_count,
            'published_questions_count': batch.published_questions_count,
            'model_used': batch.model_used,
            'total_tokens': batch.total_input_tokens + batch.total_output_tokens,
            'processing_time_seconds': batch.processing_time_seconds,
            'jobs_count': batch.jobs.count()
        })

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        batch = self.get_object()
        if batch.status in ['processing']:
            return Response({'message': 'Batch is already processing.', 'status': batch.status})
        
        batch.status = 'processing'
        batch.stage_label = 'Starting batch AI extraction pipeline...'
        batch.progress_percent = 5
        batch.error_message = None
        batch.save()

        start_import_batch_async(batch.id)
        return Response({'message': 'Batch processing started.', 'status': batch.status})

    @action(detail=True, methods=['post'], url_path='reprocess')
    def reprocess(self, request, pk=None):
        batch = self.get_object()
        batch.status = 'processing'
        batch.stage_label = 'Reprocessing batch with AI pipeline...'
        batch.progress_percent = 5
        batch.error_message = None
        batch.save()

        start_import_batch_async(batch.id)
        return Response({'message': 'Batch reprocessing started.', 'status': batch.status})

    @action(detail=True, methods=['get', 'put', 'patch'])
    def payload(self, request, pk=None):
        batch = self.get_object()
        if request.method == 'GET':
            return Response({'payload': batch.batch_payload or {}, 'status': batch.status})
        new_payload = request.data.get('payload') or request.data
        if not isinstance(new_payload, dict):
            return Response({'error': 'Invalid payload format, expected JSON object.'}, status=400)
        
        batch.batch_payload = new_payload
        batch.save()
        return Response({'message': 'Batch draft payload saved successfully.', 'status': batch.status})

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        batch = self.get_object()
        approve_all = str(request.data.get('approve_all', 'true')).lower() in ('true', '1', 'yes')
        question_id = request.data.get('question_id')
        job_id = request.data.get('job_id')

        modified = 0
        jobs_qs = batch.jobs.filter(id=job_id) if job_id else batch.jobs.all()
        for j in jobs_qs:
            payload = j.extracted_payload or {}
            sections = payload.get('sections', [])
            for sec in sections:
                for q in sec.get('questions', []):
                    if approve_all or (question_id and q.get('question_id') == question_id):
                        q['is_approved'] = True
                        modified += 1
            j.extracted_payload = payload
            j.save()

        ImportAuditLog.objects.create(
            batch=batch,
            user=request.user if request.user.is_authenticated else None,
            action='APPROVE_QUESTIONS',
            details={'modified_count': modified, 'approve_all': approve_all}
        )

        return Response({'message': f'Approved {modified} questions in batch.', 'status': batch.status})

    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        batch = self.get_object()
        approved_only = str(request.data.get('approved_only', 'false')).lower() in ('true', '1', 'yes')
        count, err = publish_approved_batch_to_database(batch, approved_only=approved_only)
        if err and count == 0:
            return Response({'error': err}, status=400)
        return Response({
            'message': f'Successfully published {count} questions to the live question bank.',
            'published_count': count,
            'warnings': err,
            'status': batch.status
        })

    @action(detail=True, methods=['get'], url_path='audit-logs')
    def audit_logs(self, request, pk=None):
        batch = self.get_object()
        logs = batch.audit_logs.all()
        serializer = ImportAuditLogSerializer(logs, many=True)
        return Response(serializer.data)



