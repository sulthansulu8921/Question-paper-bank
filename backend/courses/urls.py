from django.urls import path, include
from rest_framework.routers import DefaultRouter
from courses.views import (
    CategoryViewSet, CourseViewSet, LevelViewSet, SubjectViewSet, TopicViewSet,
    UpgradePathViewSet, EligibilityRuleViewSet, StudentProgressViewSet,
    UpgradeRequestViewSet, NotificationTemplateViewSet, AuditLogViewSet,
    ProgressionAnalyticsView
)

router = DefaultRouter()
router.register(r'categories', CategoryViewSet)
router.register(r'courses', CourseViewSet)
router.register(r'levels', LevelViewSet)
router.register(r'subjects', SubjectViewSet)
router.register(r'topics', TopicViewSet)
router.register(r'progression-paths', UpgradePathViewSet)
router.register(r'eligibility-rules', EligibilityRuleViewSet)
router.register(r'student-progress', StudentProgressViewSet)
router.register(r'upgrade-requests', UpgradeRequestViewSet)
router.register(r'notification-templates', NotificationTemplateViewSet)
router.register(r'audit-logs', AuditLogViewSet)

urlpatterns = [
    path('progression-analytics/', ProgressionAnalyticsView.as_view(), name='progression-analytics'),
    path('', include(router.urls)),
]

