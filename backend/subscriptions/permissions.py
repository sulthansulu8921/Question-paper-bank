from django.utils import timezone
from rest_framework import permissions
from .models import UserSubscription

def get_subject_group(subject):
    if not subject:
        return "ALL"
    name = subject.name.lower()
    # Group 1
    if "accounting" in name and "cost" not in name:
        return "GROUP_1"
    if "corporate" in name or "other laws" in name or "business laws" in name:
        return "GROUP_1"
    if "taxation" in name or "direct tax" in name or "indirect tax" in name or "gst" in name:
        return "GROUP_1"
    # Group 2
    if "cost" in name or "management accounting" in name:
        return "GROUP_2"
    if "auditing" in name or "assurance" in name or "ethics" in name:
        return "GROUP_2"
    if "financial management" in name or "fm" in name or "strategic management" in name or "sm" in name:
        return "GROUP_2"
    return "ALL"

def user_has_active_subscription(user, subject, level=None, check_type=None):
    if not user or not user.is_authenticated:
        return False
    if user.is_staff or user.is_superuser or user.role in ['SUPER_ADMIN', 'INSTITUTION_ADMIN', 'INSTRUCTOR']:
        return True

    # Get active subscriptions
    active_subs = UserSubscription.objects.filter(
        user=user,
        is_active=True,
        end_date__gte=timezone.now()
    ).select_related('plan', 'level', 'subject')

    if not active_subs.exists():
        return False

    for sub in active_subs:
        plan = sub.plan

        # Feature checks
        if check_type:
            if check_type == 'video' and not getattr(plan, 'video_access', True):
                continue
            if check_type == 'notes' and not getattr(plan, 'notes_access', True):
                continue
            if check_type == 'questions' and not getattr(plan, 'question_bank_access', True):
                continue
            if check_type == 'mock_test' and not getattr(plan, 'mock_test_access', True):
                continue
            if check_type == 'ai' and not getattr(plan, 'ai_assistant_access', True):
                continue
            if check_type == 'live_class' and not getattr(plan, 'live_class_access', True):
                continue
            if check_type == 'download' and not getattr(plan, 'download_permission', True):
                continue

        # Subject/Level check
        if subject:
            obj_level = level or getattr(subject, 'level', None)
            obj_course = getattr(obj_level, 'course', None) if obj_level else getattr(subject, 'course', None)
            obj_category = getattr(obj_course, 'category', None) if obj_course else None
            obj_level_name = obj_level.name.upper() if obj_level else ""

            # 1. Match category (stream) if specified on the plan
            if plan.category_specific_id and obj_category:
                if plan.category_specific_id != obj_category.id:
                    continue

            # 2. Match course if specified on the plan
            if plan.course_specific_id and obj_course:
                if plan.course_specific_id != obj_course.id:
                    continue

            # 3. Match level specific if specified on the plan
            if plan.level_specific_id and obj_level:
                if plan.level_specific_id != obj_level.id:
                    continue
            # Fallback to legacy level check if level_specific is not specified
            elif plan.level_name:
                sub_level_name = plan.level_name.upper()
                if sub_level_name not in obj_level_name:
                    continue

            # 4. Match subject specific if specified on the plan
            if plan.subject_specific_id and subject:
                if plan.subject_specific_id != subject.id:
                    continue

            # 5. Check scope match
            if plan.scope == 'PAPER_WISE':
                if sub.subject_id and sub.subject_id != subject.id:
                    continue
            elif plan.scope == 'GROUP_WISE':
                if sub.group != 'ALL':
                    sub_group = sub.group # 'GROUP_1', 'GROUP_2'
                    obj_group = get_subject_group(subject)
                    if sub_group != obj_group:
                        continue

        return True

    return False

class HasActiveSubscriptionForContent(permissions.BasePermission):
    def has_permission(self, request, view):
        return True

    def has_object_permission(self, request, view, obj):
        if request.user and (request.user.is_staff or request.user.is_superuser or request.user.role in ['SUPER_ADMIN', 'INSTITUTION_ADMIN', 'INSTRUCTOR']):
            return True

        is_premium = getattr(obj, 'is_premium', True)
        if not is_premium:
            return True

        subject = getattr(obj, 'subject', None)
        level = getattr(obj, 'level', None)

        if not subject and hasattr(obj, 'question_paper') and obj.question_paper:
            subject = getattr(obj.question_paper, 'subject', None)
            level = getattr(obj.question_paper, 'level', None)

        return user_has_active_subscription(request.user, subject, level)

class BaseGranularAccessPermission(permissions.BasePermission):
    check_type = None

    def has_permission(self, request, view):
        # Allow reading list but enforce per-object access (or allow list if they have active sub)
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        if request.user and (request.user.is_staff or request.user.is_superuser or request.user.role in ['SUPER_ADMIN', 'INSTITUTION_ADMIN', 'INSTRUCTOR']):
            return True

        is_premium = getattr(obj, 'is_premium', True)
        if not is_premium:
            return True

        subject = getattr(obj, 'subject', None)
        level = getattr(obj, 'level', None)

        if not subject and hasattr(obj, 'question_paper') and obj.question_paper:
            subject = getattr(obj.question_paper, 'subject', None)
            level = getattr(obj.question_paper, 'level', None)

        return user_has_active_subscription(request.user, subject, level, check_type=self.check_type)

class HasVideoAccess(BaseGranularAccessPermission):
    check_type = 'video'

class HasNotesAccess(BaseGranularAccessPermission):
    check_type = 'notes'

class HasQuestionBankAccess(BaseGranularAccessPermission):
    check_type = 'questions'

class HasMockTestAccess(BaseGranularAccessPermission):
    check_type = 'mock_test'

class HasAIAssistantAccess(permissions.BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_staff or request.user.is_superuser or request.user.role in ['SUPER_ADMIN', 'INSTITUTION_ADMIN', 'INSTRUCTOR']:
            return True
        # AI assistant requires active subscription with AI access OR user must have remaining credits
        if user_has_active_subscription(request.user, None, check_type='ai'):
            return True
        return getattr(request.user, 'ai_credits', 0) > 0

class HasLiveClassAccess(BaseGranularAccessPermission):
    check_type = 'live_class'

class HasDownloadPermission(BaseGranularAccessPermission):
    check_type = 'download'
