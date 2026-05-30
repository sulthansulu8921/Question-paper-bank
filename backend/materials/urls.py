from django.urls import path, include
from rest_framework.routers import DefaultRouter
from materials.views import (
    QuestionPaperViewSet, AnswerPaperViewSet, NotesViewSet, 
    VideoViewSet, MCQViewSet, BookmarkViewSet, SubjectiveQuestionViewSet, FeedbackViewSet,
    AdminDashboardStatsView
)

router = DefaultRouter()
router.register(r'question-papers', QuestionPaperViewSet)
router.register(r'answers', AnswerPaperViewSet)
router.register(r'notes', NotesViewSet)
router.register(r'videos', VideoViewSet)
router.register(r'mcqs', MCQViewSet)
router.register(r'subjective-questions', SubjectiveQuestionViewSet)
router.register(r'bookmarks', BookmarkViewSet, basename='bookmark')
router.register(r'feedback', FeedbackViewSet, basename='feedback')

urlpatterns = [
    path('', include(router.urls)),
    path('dashboard-stats/', AdminDashboardStatsView.as_view(), name='dashboard-stats'),
]
