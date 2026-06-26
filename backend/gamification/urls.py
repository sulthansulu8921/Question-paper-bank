from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    StudentStatsView, StreakView, LeaderboardView, AchievementsView,
    QuoteView, ActivityLogView, UpcomingExamsView, AssignmentsView,
    MockTestResultsView, AdminGamificationActionsView, ChatMessageView,
    TimerSettingsViewSet, StudySessionViewSet, TimerAnalyticsView, TimerAIInsightsView
)

router = DefaultRouter()
router.register(r'timer/settings', TimerSettingsViewSet, basename='timer-settings')
router.register(r'timer/sessions', StudySessionViewSet, basename='timer-sessions')

urlpatterns = [
    path('', include(router.urls)),
    path('stats/', StudentStatsView.as_view(), name='stats'),
    path('streak/', StreakView.as_view(), name='streak'),
    path('leaderboard/', LeaderboardView.as_view(), name='leaderboard'),
    path('achievements/', AchievementsView.as_view(), name='achievements'),
    path('quote/', QuoteView.as_view(), name='quote'),
    path('activity/', ActivityLogView.as_view(), name='activity'),
    
    path('exams/', UpcomingExamsView.as_view(), name='exams'),
    path('exams/<int:pk>/', UpcomingExamsView.as_view(), name='exams-detail'),
    
    path('assignments/', AssignmentsView.as_view(), name='assignments'),
    path('assignments/<int:pk>/', AssignmentsView.as_view(), name='assignments-detail'),
    
    path('mock-tests/', MockTestResultsView.as_view(), name='mock-tests'),
    path('mock-tests/<int:pk>/', MockTestResultsView.as_view(), name='mock-tests-detail'),
    
    path('admin-action/', AdminGamificationActionsView.as_view(), name='admin-action'),
    path('chat/', ChatMessageView.as_view(), name='chat'),
    
    path('timer/analytics/', TimerAnalyticsView.as_view(), name='timer-analytics'),
    path('timer/ai-insights/', TimerAIInsightsView.as_view(), name='timer-ai-insights'),
]


