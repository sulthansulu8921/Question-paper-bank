from django.urls import path, include
from rest_framework.routers import DefaultRouter
from materials.views import (
    QuestionPaperViewSet, AnswerPaperViewSet, NotesViewSet, 
    VideoViewSet, MCQViewSet, BookmarkViewSet, SubjectiveQuestionViewSet, FeedbackViewSet,
    AdminDashboardStatsView, ExportQuestionsExcelView, ImportQuestionsExcelView,
    PDFQuestionExtractView, BulkSaveQuestionsView, UploadPDFView, GenericFileUploadView, ParseTextOnlyView,
    VideoProgressViewSet, MaterialDownloadViewSet, LiveClassViewSet, NotificationViewSet,
    AssessmentSessionViewSet, MockTestTemplateViewSet,
)

router = DefaultRouter()
router.register(r'question-papers', QuestionPaperViewSet)
router.register(r'answers', AnswerPaperViewSet)
router.register(r'notes', NotesViewSet)
router.register(r'videos', VideoViewSet)
router.register(r'mcqs', MCQViewSet)
router.register(r'subjective-questions', SubjectiveQuestionViewSet, basename='subjective-question')
router.register(r'bookmarks', BookmarkViewSet, basename='bookmark')
router.register(r'feedback', FeedbackViewSet, basename='feedback')
router.register(r'video-progress', VideoProgressViewSet, basename='video-progress')
router.register(r'downloads', MaterialDownloadViewSet, basename='download')
router.register(r'live-classes', LiveClassViewSet, basename='live-class')
router.register(r'notifications', NotificationViewSet, basename='notification')
router.register(r'assessment-sessions', AssessmentSessionViewSet, basename='assessment-session')
router.register(r'mock-templates', MockTestTemplateViewSet, basename='mock-template')


urlpatterns = [
    path('', include(router.urls)),
    path('dashboard-stats/', AdminDashboardStatsView.as_view(), name='dashboard-stats'),
    path('questions/export-excel/', ExportQuestionsExcelView.as_view(), name='export-excel'),
    path('questions/import-excel/', ImportQuestionsExcelView.as_view(), name='import-excel'),
    path('questions/extract-from-pdf/', PDFQuestionExtractView.as_view(), name='extract-from-pdf'),
    path('questions/bulk-save/', BulkSaveQuestionsView.as_view(), name='bulk-save'),
    path('questions/parse-text/', ParseTextOnlyView.as_view(), name='parse-text'),
    path('upload-pdf/', UploadPDFView.as_view(), name='upload-pdf'),
    path('upload-file/', GenericFileUploadView.as_view(), name='upload-file'),
]

