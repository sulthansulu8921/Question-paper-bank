from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ChatSessionViewSet, ChatMessageListAPIView, ChatAPIView

router = DefaultRouter()
router.register(r'sessions', ChatSessionViewSet, basename='sessions')

urlpatterns = [
    path('', include(router.urls)),
    path('sessions/<int:session_id>/messages/', ChatMessageListAPIView.as_view(), name='session-messages'),
    path('sessions/<int:session_id>/message/', ChatAPIView.as_view(), name='session-send-message'),
]
