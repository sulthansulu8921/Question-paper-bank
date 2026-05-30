from rest_framework import viewsets, permissions
from materials.models import QuestionPaper, AnswerPaper, Notes, Video, MCQ, Bookmark, SubjectiveQuestion, Feedback
from materials.serializers import (
    QuestionPaperSerializer, AnswerPaperSerializer, NotesSerializer, 
    VideoSerializer, MCQSerializer, BookmarkSerializer, SubjectiveQuestionSerializer, FeedbackSerializer
)
from rest_framework.views import APIView
from rest_framework.response import Response
from courses.models import Subject
from django.contrib.auth import get_user_model
User = get_user_model()

class IsStaffOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user and request.user.is_staff

class SubjectiveQuestionViewSet(viewsets.ModelViewSet):
    queryset = SubjectiveQuestion.objects.all()
    serializer_class = SubjectiveQuestionSerializer
    permission_classes = [IsStaffOrReadOnly]

    def get_queryset(self):
        queryset = SubjectiveQuestion.objects.all()
        subject_id = self.request.query_params.get('subject_id')
        if subject_id:
            queryset = queryset.filter(subject_id=subject_id)
        return queryset

class QuestionPaperViewSet(viewsets.ModelViewSet):
    queryset = QuestionPaper.objects.all()
    serializer_class = QuestionPaperSerializer
    permission_classes = [IsStaffOrReadOnly]

class AnswerPaperViewSet(viewsets.ModelViewSet):
    queryset = AnswerPaper.objects.all()
    serializer_class = AnswerPaperSerializer
    permission_classes = [IsStaffOrReadOnly]

class NotesViewSet(viewsets.ModelViewSet):
    queryset = Notes.objects.all()
    serializer_class = NotesSerializer
    permission_classes = [IsStaffOrReadOnly]

class VideoViewSet(viewsets.ModelViewSet):
    queryset = Video.objects.all()
    serializer_class = VideoSerializer
    permission_classes = [IsStaffOrReadOnly]

class MCQViewSet(viewsets.ModelViewSet):
    queryset = MCQ.objects.all()
    serializer_class = MCQSerializer
    permission_classes = [IsStaffOrReadOnly]

class BookmarkViewSet(viewsets.ModelViewSet):
    serializer_class = BookmarkSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Bookmark.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

from .models import Feedback
from .serializers import FeedbackSerializer

class FeedbackViewSet(viewsets.ModelViewSet):
    serializer_class = FeedbackSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Admin can view all, users view their own
        if self.request.user.is_staff:
            return Feedback.objects.all()
        return Feedback.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class AdminDashboardStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]

    def get(self, request):
        stats = {
            "total_questions": SubjectiveQuestion.objects.count(),
            "total_subjects": Subject.objects.count(),
            "mcq_questions": MCQ.objects.count(),
            "theory_questions": SubjectiveQuestion.objects.count(), # Considering subjective as theory
            "total_users": User.objects.count(),
            "total_uploads": QuestionPaper.objects.count() + SubjectiveQuestion.objects.count(),
            "recent_activity": []
        }

        # Add recent questions to activity
        recent_questions = SubjectiveQuestion.objects.order_by('-created_at')[:5]
        for q in recent_questions:
            stats["recent_activity"].append({
                "type": "question",
                "text": f"New question added for {q.topic.name if q.topic else 'Subject'}",
                "user": "System",
                "time": q.created_at
            })

        # Add recent feedbacks to activity
        recent_feedbacks = Feedback.objects.order_by('-created_at')[:5]
        for f in recent_feedbacks:
            stats["recent_activity"].append({
                "type": "feedback",
                "text": f"New feedback: {f.message[:50]}...",
                "user": f.user.email,
                "time": f.created_at
            })

        # Sort combined activity by time
        stats["recent_activity"].sort(key=lambda x: x["time"], reverse=True)
        stats["recent_activity"] = stats["recent_activity"][:8]

        return Response(stats)
