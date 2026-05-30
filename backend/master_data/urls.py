from django.urls import path, include
from rest_framework.routers import DefaultRouter
from master_data.views import (
    CALevelViewSet, ICAIPaperViewSet, ICAIChapterViewSet, ICAITopicViewSet,
    MasterDataTreeView, MasterDataStatsView,
)

router = DefaultRouter()
router.register(r'levels', CALevelViewSet, basename='ca-level')
router.register(r'papers', ICAIPaperViewSet, basename='icai-paper')
router.register(r'chapters', ICAIChapterViewSet, basename='icai-chapter')
router.register(r'topics', ICAITopicViewSet, basename='icai-topic')

urlpatterns = [
    path('', include(router.urls)),
    path('tree/', MasterDataTreeView.as_view(), name='master-tree'),
    path('stats/', MasterDataStatsView.as_view(), name='master-stats'),
]
