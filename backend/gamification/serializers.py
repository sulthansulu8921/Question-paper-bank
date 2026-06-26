from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import (
    StudentStats, StudyStreak, Achievement, UserAchievement,
    ActivityLog, Quote, UpcomingExam, Assignment, MockTestResult, ChatMessage,
    StudySession, TimerSettings, SessionBreak
)

User = get_user_model()

class UserMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'full_name', 'email')

    full_name = serializers.SerializerMethodField()

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip() or obj.username

class StudentStatsSerializer(serializers.ModelSerializer):
    user = UserMiniSerializer(read_only=True)
    class Meta:
        model = StudentStats
        fields = '__all__'

class StudyStreakSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudyStreak
        fields = '__all__'

class AchievementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Achievement
        fields = '__all__'

class UserAchievementSerializer(serializers.ModelSerializer):
    achievement = AchievementSerializer(read_only=True)
    class Meta:
        model = UserAchievement
        fields = '__all__'

class ActivityLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActivityLog
        fields = '__all__'

class QuoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Quote
        fields = '__all__'

class UpcomingExamSerializer(serializers.ModelSerializer):
    class Meta:
        model = UpcomingExam
        fields = '__all__'

class AssignmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Assignment
        fields = '__all__'

class MockTestResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = MockTestResult
        fields = '__all__'

class LeaderboardEntrySerializer(serializers.Serializer):
    rank = serializers.IntegerField()
    id = serializers.IntegerField()
    name = serializers.CharField()
    email = serializers.CharField()
    level = serializers.IntegerField()
    xp_points = serializers.IntegerField()
    current_streak = serializers.IntegerField()
    total_study_hours = serializers.FloatField()
    weekly_study_hours = serializers.FloatField()
    today_study_time = serializers.CharField()
    is_studying = serializers.BooleanField(default=False)


class ChatMessageSerializer(serializers.ModelSerializer):
    user_detail = UserMiniSerializer(source='user', read_only=True)

    class Meta:
        model = ChatMessage
        fields = ('id', 'user', 'user_detail', 'text', 'created_at')
        read_only_fields = ('user', 'created_at')


class SessionBreakSerializer(serializers.ModelSerializer):
    class Meta:
        model = SessionBreak
        fields = '__all__'


class TimerSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = TimerSettings
        fields = '__all__'


class StudySessionSerializer(serializers.ModelSerializer):
    breaks = SessionBreakSerializer(many=True, read_only=True)
    subject_name = serializers.CharField(read_only=True)
    topic_name = serializers.CharField(read_only=True)

    class Meta:
        model = StudySession
        fields = '__all__'






