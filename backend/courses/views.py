from rest_framework import viewsets, permissions
from courses.models import Category, Course, Level, Subject, Topic
from courses.serializers import CategorySerializer, CourseSerializer, LevelSerializer, SubjectSerializer, TopicSerializer


class IsStaffOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user and request.user.is_staff


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [IsStaffOrReadOnly]

class CourseViewSet(viewsets.ModelViewSet):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer
    permission_classes = [IsStaffOrReadOnly]

class LevelViewSet(viewsets.ModelViewSet):
    queryset = Level.objects.all()
    serializer_class = LevelSerializer
    permission_classes = [IsStaffOrReadOnly]

class SubjectViewSet(viewsets.ModelViewSet):
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer
    permission_classes = [IsStaffOrReadOnly]

    def perform_create(self, serializer):
        validated = serializer.validated_data
        level = validated.get('level')
        course = validated.get('course')

        if not level and course:
            level, _ = Level.objects.get_or_create(
                course=course,
                slug='general',
                defaults={'name': 'General', 'order': 0},
            )
            serializer.save(level=level, course=course)
        elif level and not course:
            serializer.save(course=level.course)
        else:
            serializer.save()

    def perform_update(self, serializer):
        validated = serializer.validated_data
        instance = serializer.instance
        course = validated.get('course', instance.course)
        level = validated.get('level', instance.level)

        if course and level and level.course_id != course.id:
            level, _ = Level.objects.get_or_create(
                course=course,
                slug='general',
                defaults={'name': 'General', 'order': 0},
            )
            serializer.save(level=level, course=course)
        elif course and not level:
            level, _ = Level.objects.get_or_create(
                course=course,
                slug='general',
                defaults={'name': 'General', 'order': 0},
            )
            serializer.save(level=level, course=course)
        else:
            serializer.save()
    
class TopicViewSet(viewsets.ModelViewSet):
    queryset = Topic.objects.all()
    serializer_class = TopicSerializer
    permission_classes = [IsStaffOrReadOnly]
