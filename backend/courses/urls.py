from django.urls import path, include
from rest_framework.routers import DefaultRouter
from courses.views import CategoryViewSet, CourseViewSet, LevelViewSet, SubjectViewSet, TopicViewSet

router = DefaultRouter()
router.register(r'categories', CategoryViewSet)
router.register(r'courses', CourseViewSet)
router.register(r'levels', LevelViewSet)
router.register(r'subjects', SubjectViewSet)
router.register(r'topics', TopicViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
