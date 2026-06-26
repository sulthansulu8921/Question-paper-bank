from django.db import models
from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver
from courses.models import Subject, Topic


class StudentStats(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='stats')
    xp_points = models.IntegerField(default=0)
    coins = models.IntegerField(default=0)
    level = models.IntegerField(default=1)
    total_study_hours = models.FloatField(default=0.0)
    questions_attempted = models.IntegerField(default=0)
    correct_answers = models.IntegerField(default=0)
    wrong_answers = models.IntegerField(default=0)
    average_score = models.FloatField(default=0.0)
    last_activity_url = models.CharField(max_length=255, blank=True, null=True)
    last_activity_name = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.email} - Level {self.level} ({self.xp_points} XP)"

    def add_xp(self, amount):
        self.xp_points += amount
        # Level up formula: level n needs level * 500 XP to level up
        while self.xp_points >= self.level * 500:
            self.xp_points -= self.level * 500
            self.level += 1
        self.save()

@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_student_stats(sender, instance, created, **kwargs):
    if created:
        StudentStats.objects.create(user=instance)

class StudyStreak(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='streak')
    current_streak = models.IntegerField(default=0)
    longest_streak = models.IntegerField(default=0)
    last_study_date = models.DateField(null=True, blank=True)
    # Stores bools for M, T, W, T, F, S, S (e.g. [true, false, ...])
    streak_days = models.JSONField(default=list)

    def __str__(self):
        return f"{self.user.email} - Streak: {self.current_streak} days"

@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_study_streak(sender, instance, created, **kwargs):
    if created:
        StudyStreak.objects.create(user=instance, streak_days=[False, False, False, False, False, False, False])

class Achievement(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField()
    badge_icon = models.CharField(max_length=50) # lucide icon name
    xp_reward = models.IntegerField(default=100)
    coins_reward = models.IntegerField(default=50)

    def __str__(self):
        return self.name

class UserAchievement(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='achievements')
    achievement = models.ForeignKey(Achievement, on_delete=models.CASCADE)
    unlocked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'achievement')

    def __str__(self):
        return f"{self.user.email} unlocked {self.achievement.name}"

class ActivityLog(models.Model):
    ACTIVITY_TYPES = [
        ('LESSON', 'Lesson View'),
        ('QUIZ', 'Quiz Completed'),
        ('QUESTION', 'Question Solved'),
        ('LOGIN', 'Daily Login'),
        ('BOOKMARK', 'Question Bookmarked'),
    ]
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='activity_logs')
    activity_type = models.CharField(max_length=20, choices=ACTIVITY_TYPES)
    description = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.email} | {self.activity_type} | {self.created_at}"

class Quote(models.Model):
    text = models.TextField()
    author = models.CharField(max_length=100, default="Unknown")
    day_of_year = models.IntegerField(null=True, blank=True, unique=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f'"{self.text[:30]}..." - {self.author}'

class UpcomingExam(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='upcoming_exams')
    title = models.CharField(max_length=200)
    date = models.DateField()
    description = models.TextField(blank=True)

    def __str__(self):
        return self.title

class Assignment(models.Model):
    STATUS_CHOICES = [('PENDING', 'Pending'), ('COMPLETED', 'Completed')]
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='assignments')
    title = models.CharField(max_length=200)
    due_date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')

    def __str__(self):
        return self.title

class MockTestResult(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='mock_test_results')
    title = models.CharField(max_length=200)
    score = models.IntegerField()
    total_marks = models.IntegerField()
    date = models.DateField()

    def __str__(self):
        return f"{self.title}: {self.score}/{self.total_marks}"


class ChatMessage(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='chat_messages')
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.email}: {self.text[:30]} at {self.created_at}"


class StudySession(models.Model):
    SESSION_TYPES = [
        ('POMODORO', 'Pomodoro'),
        ('DEEP_FOCUS', 'Deep Focus'),
        ('STOPWATCH', 'Stopwatch'),
        ('COUNTDOWN', 'Countdown'),
        ('CUSTOM', 'Custom')
    ]
    STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('PAUSED', 'Paused'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled')
    ]
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='study_sessions')
    subject = models.ForeignKey(Subject, on_delete=models.SET_NULL, null=True, blank=True, related_name='study_sessions')
    topic = models.ForeignKey(Topic, on_delete=models.SET_NULL, null=True, blank=True, related_name='study_sessions')
    subject_name = models.CharField(max_length=200, blank=True, null=True)
    topic_name = models.CharField(max_length=200, blank=True, null=True)
    study_goal = models.TextField(blank=True, null=True)
    session_type = models.CharField(max_length=20, choices=SESSION_TYPES, default='STOPWATCH')
    target_duration = models.IntegerField(default=0) # in seconds
    duration = models.IntegerField(default=0) # in seconds (actual elapsed active study time)
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    xp_earned = models.IntegerField(default=0)
    coins_earned = models.IntegerField(default=0)
    focus_percentage = models.FloatField(default=100.0)
    notes = models.TextField(blank=True, null=True)
    
    # State tracking for page reloads / reconnects
    is_paused = models.BooleanField(default=False)
    last_paused_at = models.DateTimeField(null=True, blank=True)
    total_paused_duration = models.IntegerField(default=0) # in seconds
    auto_saved_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'study_sessions'

    def __str__(self):
        return f"{self.user.email} - {self.session_type} ({self.duration}s)"


class TimerSettings(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='timer_settings')
    pomodoro_work_duration = models.IntegerField(default=1500) # 25 mins
    pomodoro_break_duration = models.IntegerField(default=300) # 5 mins
    short_break_duration = models.IntegerField(default=300)
    long_break_duration = models.IntegerField(default=900)
    auto_start_breaks = models.BooleanField(default=False)
    sound_enabled = models.BooleanField(default=True)
    sound_type = models.CharField(max_length=50, default='bell')

    class Meta:
        db_table = 'timer_settings'

    def __str__(self):
        return f"Timer settings for {self.user.email}"


class SessionBreak(models.Model):
    session = models.ForeignKey(StudySession, on_delete=models.CASCADE, related_name='breaks')
    started_at = models.DateTimeField()
    ended_at = models.DateTimeField(null=True, blank=True)
    duration = models.IntegerField(default=0) # in seconds

    class Meta:
        db_table = 'session_breaks'

    def __str__(self):
        return f"Break for session {self.session.id} ({self.duration}s)"


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_timer_settings(sender, instance, created, **kwargs):
    if created:
        TimerSettings.objects.get_or_create(user=instance)





