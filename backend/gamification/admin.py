from django.contrib import admin
from .models import (
    StudentStats, StudyStreak, Achievement, UserAchievement,
    ActivityLog, Quote, UpcomingExam, Assignment, MockTestResult
)

@admin.register(StudentStats)
class StudentStatsAdmin(admin.ModelAdmin):
    list_display = ('user', 'level', 'xp_points', 'coins', 'total_study_hours')
    search_fields = ('user__email', 'user__username')

@admin.register(StudyStreak)
class StudyStreakAdmin(admin.ModelAdmin):
    list_display = ('user', 'current_streak', 'longest_streak', 'last_study_date')
    search_fields = ('user__email',)

@admin.register(Achievement)
class AchievementAdmin(admin.ModelAdmin):
    list_display = ('name', 'badge_icon', 'xp_reward', 'coins_reward')
    search_fields = ('name',)

@admin.register(UserAchievement)
class UserAchievementAdmin(admin.ModelAdmin):
    list_display = ('user', 'achievement', 'unlocked_at')
    search_fields = ('user__email', 'achievement__name')

@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ('user', 'activity_type', 'created_at')
    list_filter = ('activity_type', 'created_at')
    search_fields = ('user__email', 'description')

@admin.register(Quote)
class QuoteAdmin(admin.ModelAdmin):
    list_display = ('text', 'author', 'day_of_year', 'is_active')
    search_fields = ('text', 'author')

@admin.register(UpcomingExam)
class UpcomingExamAdmin(admin.ModelAdmin):
    list_display = ('user', 'title', 'date')
    search_fields = ('user__email', 'title')

@admin.register(Assignment)
class AssignmentAdmin(admin.ModelAdmin):
    list_display = ('user', 'title', 'due_date', 'status')
    list_filter = ('status', 'due_date')
    search_fields = ('user__email', 'title')

@admin.register(MockTestResult)
class MockTestResultAdmin(admin.ModelAdmin):
    list_display = ('user', 'title', 'score', 'total_marks', 'date')
    search_fields = ('user__email', 'title')
