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

def user_has_active_subscription(user, subject, level=None):
    if not user or not user.is_authenticated:
        return False
    if user.is_staff or user.is_superuser:
        return True

    # Get active subscriptions
    active_subs = UserSubscription.objects.filter(
        user=user,
        is_active=True,
        end_date__gte=timezone.now()
    ).select_related('plan', 'level', 'subject')

    if not active_subs.exists():
        return False

    # If no specific subject is provided, any active subscription is fine
    if not subject:
        return True

    obj_level = level or getattr(subject, 'level', None)
    obj_level_name = obj_level.name.upper() if obj_level else ""

    for sub in active_subs:
        # Match level (Foundation, Intermediate, Final)
        sub_level_name = sub.plan.level_name.upper() if sub.plan.level_name else ""
        if sub_level_name not in obj_level_name:
            continue

        # Match scope
        if sub.plan.scope == 'PAPER_WISE':
            if sub.subject_id == subject.id:
                return True
        elif sub.plan.scope == 'GROUP_WISE':
            if sub.group == 'ALL':
                return True
            
            # Check group match
            sub_group = sub.group # 'GROUP_1', 'GROUP_2'
            obj_group = get_subject_group(subject)
            if sub_group == obj_group:
                return True

    return False

class HasActiveSubscriptionForContent(permissions.BasePermission):
    def has_permission(self, request, view):
        # We always let lists go through, but retrieve/object actions are checked or fields redacted
        return True

    def has_object_permission(self, request, view, obj):
        # If staff, superuser, or free content, allow access
        if request.user and (request.user.is_staff or request.user.is_superuser):
            return True

        is_premium = getattr(obj, 'is_premium', True)
        if not is_premium:
            return True

        # Extract subject and level
        subject = getattr(obj, 'subject', None)
        level = getattr(obj, 'level', None)

        if not subject and hasattr(obj, 'question_paper') and obj.question_paper:
            subject = getattr(obj.question_paper, 'subject', None)
            level = getattr(obj.question_paper, 'level', None)

        return user_has_active_subscription(request.user, subject, level)
