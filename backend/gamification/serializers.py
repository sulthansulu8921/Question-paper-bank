from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import (
    StudentStats, StudyStreak, Achievement, UserAchievement,
    ActivityLog, Quote, UpcomingExam, Assignment, MockTestResult
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
