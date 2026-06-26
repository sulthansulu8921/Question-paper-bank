from rest_framework import status, permissions, viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from django.utils import timezone
from datetime import date, timedelta
from django.db.models import F, Sum, Max, Avg
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
import os
import requests
import random
import json
from courses.models import Subject, Topic
from .models import (
    StudentStats, StudyStreak, Achievement, UserAchievement,
    ActivityLog, Quote, UpcomingExam, Assignment, MockTestResult, ChatMessage,
    StudySession, TimerSettings, SessionBreak
)
from .serializers import (
    StudentStatsSerializer, StudyStreakSerializer, AchievementSerializer,
    UserAchievementSerializer, ActivityLogSerializer, QuoteSerializer,
    UpcomingExamSerializer, AssignmentSerializer, MockTestResultSerializer,
    LeaderboardEntrySerializer, ChatMessageSerializer,
    StudySessionSerializer, TimerSettingsSerializer
)

User = get_user_model()

def safe_get_or_create_achievement(name, defaults):
    achievements = Achievement.objects.filter(name=name)
    if achievements.exists():
        ach = achievements.first()
        if achievements.count() > 1:
            Achievement.objects.filter(name=name).exclude(id=ach.id).delete()
        return ach, False
    else:
        try:
            return Achievement.objects.get_or_create(name=name, defaults=defaults)
        except Achievement.MultipleObjectsReturned:
            ach = Achievement.objects.filter(name=name).first()
            Achievement.objects.filter(name=name).exclude(id=ach.id).delete()
            return ach, False


class StudentStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        stats, _ = StudentStats.objects.get_or_create(user=request.user)
        serializer = StudentStatsSerializer(stats)
        return Response(serializer.data)

    def patch(self, request):
        stats, _ = StudentStats.objects.get_or_create(user=request.user)
        
        # Track study hours or answers manually if provided
        study_hours = request.data.get('add_study_hours')
        if study_hours:
            stats.total_study_hours += float(study_hours)

        questions_attempted = request.data.get('questions_attempted')
        if questions_attempted:
            stats.questions_attempted += int(questions_attempted)

        correct_answers = request.data.get('correct_answers')
        if correct_answers:
            stats.correct_answers += int(correct_answers)

        wrong_answers = request.data.get('wrong_answers')
        if wrong_answers:
            stats.wrong_answers += int(wrong_answers)

        # Recalculate average score
        total_answers = stats.correct_answers + stats.wrong_answers
        if total_answers > 0:
            stats.average_score = round((stats.correct_answers / total_answers) * 100, 1)

        # Track last activity
        last_url = request.data.get('last_activity_url')
        last_name = request.data.get('last_activity_name')
        if last_url:
            stats.last_activity_url = last_url
        if last_name:
            stats.last_activity_name = last_name

        stats.save()
        serializer = StudentStatsSerializer(stats)
        return Response(serializer.data)

class StreakView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        streak, _ = StudyStreak.objects.get_or_create(user=request.user)
        serializer = StudyStreakSerializer(streak)
        return Response(serializer.data)

    def post(self, request):
        """Record study activity to automatically update the streak."""
        streak, _ = StudyStreak.objects.get_or_create(user=request.user)
        
        today = date.today()
        yesterday = today - timezone.timedelta(days=1)
        today_weekday = today.weekday() # 0 = Monday, ..., 6 = Sunday

        # Initialize streak_days array if empty or wrong size
        if not streak.streak_days or len(streak.streak_days) != 7:
            streak.streak_days = [False] * 7

        # Mark today as checked
        if not streak.streak_days[today_weekday]:
            streak.streak_days[today_weekday] = True

            # If user solved a question or logged in, award 15 XP
            stats, _ = StudentStats.objects.get_or_create(user=request.user)
            stats.add_xp(15)
            stats.coins += 5
            stats.save()

        # Calculate consecutive days
        if streak.last_study_date == today:
            pass  # Already studied today
        elif streak.last_study_date == yesterday:
            streak.current_streak += 1
            if streak.current_streak > streak.longest_streak:
                streak.longest_streak = streak.current_streak
            streak.last_study_date = today
        else:
            # Missed a day or first time
            streak.current_streak = 1
            # Reset other weekday ticks if last study was in a previous week
            if streak.last_study_date and (today - streak.last_study_date).days > 7:
                streak.streak_days = [False] * 7
                streak.streak_days[today_weekday] = True
            streak.last_study_date = today

        # Check if weekly cycle completed (all 7 days checked)
        if all(streak.streak_days):
            # Reset weekly calendar ticks but keep consecutive streak running!
            streak.streak_days = [False] * 7
            streak.streak_days[today_weekday] = True
            
            # Award "Weekly Warrior" XP bonus
            stats, _ = StudentStats.objects.get_or_create(user=request.user)
            stats.add_xp(100)
            stats.coins += 50
            stats.save()

        streak.save()

        # Log Activity
        ActivityLog.objects.create(
            user=request.user,
            activity_type='QUESTION',
            description="Recorded study activity for streak."
        )

        # Check for streak achievements
        self._check_streak_achievements(request.user, streak.current_streak)

        serializer = StudyStreakSerializer(streak)
        return Response(serializer.data)

    def _check_streak_achievements(self, user, current_streak):
        achievements_to_check = [
            {'name': 'First Step', 'req': 1, 'badge': 'footprints'},
            {'name': '3-Day Flash', 'req': 3, 'badge': 'zap'},
            {'name': 'Weekly Warrior', 'req': 7, 'badge': 'shield'},
            {'name': 'Consistency King', 'req': 30, 'badge': 'crown'},
        ]
        for ach_data in achievements_to_check:
            if current_streak >= ach_data['req']:
                ach, _ = safe_get_or_create_achievement(
                    name=ach_data['name'],
                    defaults={
                        'description': f"Maintain a study streak of {ach_data['req']} days.",
                        'badge_icon': ach_data['badge'],
                        'xp_reward': ach_data['req'] * 20,
                        'coins_reward': ach_data['req'] * 10
                    }
                )
                user_ach, created = UserAchievement.objects.get_or_create(user=user, achievement=ach)
                if created:
                    stats, _ = StudentStats.objects.get_or_create(user=user)
                    stats.add_xp(ach.xp_reward)
                    stats.coins += ach.coins_reward
                    stats.save()

class LeaderboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        sort_by = request.query_params.get('sort_by', 'xp')
        all_stats = StudentStats.objects.select_related('user', 'user__streak').all()
        
        today = timezone.localtime(timezone.now()).date()
        start_of_week = today - timezone.timedelta(days=6)
        
        # Aggregate today's and weekly durations
        today_durations = dict(
            StudySession.objects.filter(
                status='COMPLETED',
                started_at__date=today
            ).values('user_id').annotate(total=Sum('duration')).values_list('user_id', 'total')
        )
        
        weekly_durations = dict(
            StudySession.objects.filter(
                status='COMPLETED',
                started_at__date__gte=start_of_week
            ).values('user_id').annotate(total=Sum('duration')).values_list('user_id', 'total')
        )

        active_user_ids = set(
            StudySession.objects.filter(status='ACTIVE').values_list('user_id', flat=True)
        )
        
        leaderboard_data = []
        for stat in all_stats:
            streak_count = 0
            if hasattr(stat.user, 'streak'):
                streak_count = stat.user.streak.current_streak
            
            full_name = f"{stat.user.first_name} {stat.user.last_name}".strip() or stat.user.username
            
            seconds_today = today_durations.get(stat.user.id, 0) or 0
            h_today = seconds_today // 3600
            m_today = (seconds_today % 3600) // 60
            today_str = f"{h_today}h {m_today}m" if h_today > 0 else f"{m_today}m"
            
            seconds_weekly = weekly_durations.get(stat.user.id, 0) or 0
            weekly_hours = round(seconds_weekly / 3600.0, 1)
            
            total_hours = round(stat.total_study_hours, 1)
            is_studying = stat.user.id in active_user_ids
            
            leaderboard_data.append({
                'rank': 0,
                'id': stat.user.id,
                'name': full_name,
                'email': stat.user.email,
                'level': stat.level,
                'xp_points': stat.xp_points,
                'current_streak': streak_count,
                'total_study_hours': total_hours,
                'weekly_study_hours': weekly_hours,
                'today_study_time': today_str,
                'is_studying': is_studying
            })
            
        # Sort in python
        if sort_by == 'total_hours':
            leaderboard_data.sort(key=lambda x: x['total_study_hours'], reverse=True)
        elif sort_by == 'weekly_hours':
            leaderboard_data.sort(key=lambda x: x['weekly_study_hours'], reverse=True)
        elif sort_by == 'streak':
            leaderboard_data.sort(key=lambda x: x['current_streak'], reverse=True)
        else: # 'xp'
            leaderboard_data.sort(key=lambda x: (x['level'], x['xp_points']), reverse=True)
            
        for rank, entry in enumerate(leaderboard_data, 1):
            entry['rank'] = rank

        serializer = LeaderboardEntrySerializer(leaderboard_data, many=True)
        return Response(serializer.data)

class AchievementsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # Make sure standard achievements exist
        self._ensure_default_achievements()

        all_achievements = Achievement.objects.all()
        user_unlocked_ids = UserAchievement.objects.filter(user=request.user).values_list('achievement_id', flat=True)
        
        result = []
        for ach in all_achievements:
            unlocked = ach.id in user_unlocked_ids
            unlocked_at = None
            if unlocked:
                unlocked_at = UserAchievement.objects.get(user=request.user, achievement=ach).unlocked_at

            result.append({
                'id': ach.id,
                'name': ach.name,
                'description': ach.description,
                'badge_icon': ach.badge_icon,
                'xp_reward': ach.xp_reward,
                'coins_reward': ach.coins_reward,
                'unlocked': unlocked,
                'unlocked_at': unlocked_at
            })
        return Response(result)

    def _ensure_default_achievements(self):
        defaults = [
            ('First Step', 'Maintain a study streak of 1 days.', 'footprints', 20, 10),
            ('3-Day Flash', 'Maintain a study streak of 3 days.', 'zap', 60, 30),
            ('Weekly Warrior', 'Maintain a study streak of 7 days.', 'shield', 140, 70),
            ('Consistency King', 'Maintain a study streak of 30 days.', 'crown', 600, 300),
            ('QBank Master', 'Solve 10 questions in total.', 'award', 100, 50),
            ('Perfect Score', 'Score 100% on any mock test.', 'sparkles', 200, 100),
        ]
        for name, desc, icon, xp, coins in defaults:
            safe_get_or_create_achievement(
                name=name,
                defaults={
                    'description': desc,
                    'badge_icon': icon,
                    'xp_reward': xp,
                    'coins_reward': coins
                }
            )

class QuoteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        today = date.today()
        day_of_year = today.timetuple().tm_yday
        
        # Get active quote for today's day of the year
        quote = Quote.objects.filter(day_of_year=day_of_year, is_active=True).first()
        if not quote:
            # Fall back to any active quote
            quote = Quote.objects.filter(is_active=True).first()
            if not quote:
                # Pre-seed dynamic default quote
                quote = Quote.objects.create(
                    text="Consistency today leads to success tomorrow.",
                    author="qubook.in",
                    day_of_year=day_of_year
                )
        
        serializer = QuoteSerializer(quote)
        return Response(serializer.data)

class ActivityLogView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        logs = ActivityLog.objects.filter(user=request.user).order_by('-created_at')[:20]
        serializer = ActivityLogSerializer(logs, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = ActivityLogSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user)
            
            # Award XP for recording activity
            stats, _ = StudentStats.objects.get_or_create(user=request.user)
            stats.add_xp(10)
            stats.coins += 2
            stats.save()

            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class UpcomingExamsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        exams = UpcomingExam.objects.filter(user=request.user).order_by('date')
        serializer = UpcomingExamSerializer(exams, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = UpcomingExamSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        exam = get_object_or_404(UpcomingExam, pk=pk, user=request.user)
        exam.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

class AssignmentsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        assignments = Assignment.objects.filter(user=request.user).order_by('due_date')
        serializer = AssignmentSerializer(assignments, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = AssignmentSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request, pk):
        assignment = get_object_or_404(Assignment, pk=pk, user=request.user)
        serializer = AssignmentSerializer(assignment, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        assignment = get_object_or_404(Assignment, pk=pk, user=request.user)
        assignment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

class MockTestResultsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        results = MockTestResult.objects.filter(user=request.user).order_by('-date')
        serializer = MockTestResultSerializer(results, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = MockTestResultSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user)
            
            # Award XP for attempting tests
            stats, _ = StudentStats.objects.get_or_create(user=request.user)
            score = int(request.data.get('score'))
            total = int(request.data.get('total_marks'))
            percent = (score / total) * 100
            
            stats.add_xp(50)
            stats.coins += 20
            
            # Award Perfect Score Achievement if 100%
            if percent >= 100.0:
                ach = Achievement.objects.filter(name='Perfect Score').first()
                if ach:
                    UserAchievement.objects.get_or_create(user=request.user, achievement=ach)

            stats.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        result = get_object_or_404(MockTestResult, pk=pk, user=request.user)
        result.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

class AdminGamificationActionsView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        action = request.data.get('action')
        target_user_id = request.data.get('user_id')
        user = get_object_or_404(User, pk=target_user_id)

        stats, _ = StudentStats.objects.get_or_create(user=user)
        streak, _ = StudyStreak.objects.get_or_create(user=user)

        if action == 'AWARD_XP':
            amount = int(request.data.get('amount', 0))
            stats.add_xp(amount)
            return Response({'status': 'success', 'xp_points': stats.xp_points, 'level': stats.level})
            
        elif action == 'AWARD_COINS':
            amount = int(request.data.get('amount', 0))
            stats.coins += amount
            stats.save()
            return Response({'status': 'success', 'coins': stats.coins})

        elif action == 'RESET_STREAK':
            streak.current_streak = 0
            streak.last_study_date = None
            streak.streak_days = [False] * 7
            streak.save()
            return Response({'status': 'success', 'current_streak': 0})

        return Response({'error': 'Invalid action'}, status=status.HTTP_400_BAD_REQUEST)


class ChatMessageView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        twenty_four_hours_ago = timezone.now() - timedelta(hours=24)
        ChatMessage.objects.filter(created_at__lt=twenty_four_hours_ago).delete()
        messages = ChatMessage.objects.filter(created_at__gte=twenty_four_hours_ago).order_by('created_at')
        serializer = ChatMessageSerializer(messages, many=True)
        return Response(serializer.data)

    def post(self, request):
        twenty_four_hours_ago = timezone.now() - timedelta(hours=24)
        ChatMessage.objects.filter(created_at__lt=twenty_four_hours_ago).delete()
        serializer = ChatMessageSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class TimerSettingsViewSet(viewsets.ModelViewSet):
    serializer_class = TimerSettingsSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return TimerSettings.objects.filter(user=self.request.user)

    @action(detail=False, methods=['get', 'post'], url_path='my-settings')
    def my_settings(self, request):
        settings, _ = TimerSettings.objects.get_or_create(user=request.user)
        if request.method == 'POST':
            serializer = self.get_serializer(settings, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)
        serializer = self.get_serializer(settings)
        return Response(serializer.data)


class StudySessionViewSet(viewsets.ModelViewSet):
    serializer_class = StudySessionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return StudySession.objects.filter(user=self.request.user).order_by('-started_at')

    @action(detail=False, methods=['get'], url_path='active')
    def active(self, request):
        session = StudySession.objects.filter(
            user=self.request.user, 
            status__in=['ACTIVE', 'PAUSED']
        ).first()
        if session:
            elapsed = session.duration
            if session.status == 'ACTIVE':
                now = timezone.now()
                delta = (now - session.started_at).total_seconds() - session.total_paused_duration
                elapsed = max(int(delta), 0)
            
            serializer = self.get_serializer(session)
            data = serializer.data
            data['duration'] = elapsed
            return Response(data)
        return Response(None, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='start')
    def start_session(self, request):
        existing = StudySession.objects.filter(
            user=request.user, 
            status__in=['ACTIVE', 'PAUSED']
        ).first()
        if existing:
            return Response(
                {"error": "A study session is already active."}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        subject_id = request.data.get('subject_id')
        topic_id = request.data.get('topic_id')
        study_goal = request.data.get('study_goal', '')
        session_type = request.data.get('session_type', 'STOPWATCH')
        target_duration = int(request.data.get('target_duration', 0))

        subject = None
        topic = None
        subject_name = ""
        topic_name = ""

        if subject_id:
            try:
                subject = Subject.objects.get(id=subject_id)
                subject_name = subject.name
            except Subject.DoesNotExist:
                pass
        
        if topic_id:
            try:
                topic = Topic.objects.get(id=topic_id)
                topic_name = topic.name
            except Topic.DoesNotExist:
                pass

        session = StudySession.objects.create(
            user=request.user,
            subject=subject,
            topic=topic,
            subject_name=subject_name,
            topic_name=topic_name,
            study_goal=study_goal,
            session_type=session_type,
            target_duration=target_duration,
            status='ACTIVE',
            started_at=timezone.now(),
            duration=0,
            is_paused=False,
            total_paused_duration=0
        )
        serializer = self.get_serializer(session)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='pause')
    def pause_session(self, request, pk=None):
        session = self.get_object()
        if session.status != 'ACTIVE':
            return Response(
                {"error": "Session is not active."}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        now = timezone.now()
        delta = (now - session.started_at).total_seconds() - session.total_paused_duration
        session.duration = max(int(delta), 0)
        
        session.status = 'PAUSED'
        session.is_paused = True
        session.last_paused_at = now
        session.save()

        SessionBreak.objects.create(
            session=session,
            started_at=now
        )

        serializer = self.get_serializer(session)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='resume')
    def resume_session(self, request, pk=None):
        session = self.get_object()
        if session.status != 'PAUSED':
            return Response(
                {"error": "Session is not paused."}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        now = timezone.now()
        last_break = session.breaks.filter(ended_at__isnull=True).order_by('-started_at').first()
        if last_break:
            last_break.ended_at = now
            last_break.duration = int((now - last_break.started_at).total_seconds())
            last_break.save()
            session.total_paused_duration += last_break.duration

        session.status = 'ACTIVE'
        session.is_paused = False
        session.last_paused_at = None
        session.save()

        serializer = self.get_serializer(session)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='autosave')
    def autosave(self, request, pk=None):
        session = self.get_object()
        if session.status not in ['ACTIVE', 'PAUSED']:
            return Response(
                {"error": "Session is not active or paused."}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        duration = int(request.data.get('duration', session.duration))
        session.duration = duration
        session.save()
        return Response({"status": "success", "duration": session.duration})

    @action(detail=True, methods=['post'], url_path='end')
    def end_session(self, request, pk=None):
        session = self.get_object()
        if session.status not in ['ACTIVE', 'PAUSED']:
            return Response(
                {"error": "Session is already closed."}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        now = timezone.now()
        if session.status == 'PAUSED':
            last_break = session.breaks.filter(ended_at__isnull=True).order_by('-started_at').first()
            if last_break:
                last_break.ended_at = now
                last_break.duration = int((now - last_break.started_at).total_seconds())
                last_break.save()
                session.total_paused_duration += last_break.duration

        delta = (now - session.started_at).total_seconds() - session.total_paused_duration
        session.duration = max(int(delta), 0)
        session.status = 'COMPLETED'
        session.ended_at = now
        session.notes = request.data.get('notes', '')

        minutes = session.duration / 60.0
        xp_earned = max(int(minutes), 1) if session.duration >= 10 else 0
        coins_earned = max(int(minutes / 5.0), 1) if session.duration >= 60 else 0

        if session.target_duration > 0 and session.duration >= session.target_duration:
            xp_earned += int(session.target_duration / 60.0 * 0.2)
            coins_earned += max(int(session.target_duration / 300.0 * 0.2), 1)

        session.xp_earned = xp_earned
        session.coins_earned = coins_earned

        total_time = (now - session.started_at).total_seconds()
        if total_time > 0:
            break_ratio = session.total_paused_duration / total_time
            focus_score = round(max((1.0 - break_ratio) * 100.0, 0.0), 1)
            session.focus_percentage = focus_score
        else:
            session.focus_percentage = 100.0

        session.save()

        stats, _ = StudentStats.objects.get_or_create(user=request.user)
        stats.add_xp(xp_earned)
        stats.coins += coins_earned
        stats.total_study_hours += (session.duration / 3600.0)
        stats.save()

        streak, _ = StudyStreak.objects.get_or_create(user=request.user)
        today = date.today()
        yesterday = today - timedelta(days=1)
        today_weekday = today.weekday()

        if not streak.streak_days or len(streak.streak_days) != 7:
            streak.streak_days = [False] * 7

        if not streak.streak_days[today_weekday]:
            streak.streak_days[today_weekday] = True
            stats.add_xp(15)
            stats.coins += 5
            stats.save()

        if streak.last_study_date == today:
            pass
        elif streak.last_study_date == yesterday:
            streak.current_streak += 1
            if streak.current_streak > streak.longest_streak:
                streak.longest_streak = streak.current_streak
            streak.last_study_date = today
        else:
            streak.current_streak = 1
            if streak.last_study_date and (today - streak.last_study_date).days > 7:
                streak.streak_days = [False] * 7
                streak.streak_days[today_weekday] = True
            streak.last_study_date = today

        if all(streak.streak_days):
            streak.streak_days = [False] * 7
            streak.streak_days[today_weekday] = True
            stats.add_xp(100)
            stats.coins += 50
            stats.save()
        
        streak.save()

        return Response({
            "session_id": session.id,
            "duration": session.duration,
            "xp_earned": xp_earned,
            "coins_earned": coins_earned,
            "focus_score": session.focus_percentage,
            "level": stats.level,
            "streak": streak.current_streak
        })

    @action(detail=True, methods=['post'], url_path='cancel')
    def cancel_session(self, request, pk=None):
        session = self.get_object()
        if session.status not in ['ACTIVE', 'PAUSED']:
            return Response(
                {"error": "Session is already closed."}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        session.status = 'CANCELLED'
        session.ended_at = timezone.now()
        session.save()
        return Response({"status": "cancelled"})


class TimerAnalyticsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        today = timezone.localtime(timezone.now()).date()
        
        today_seconds = StudySession.objects.filter(
            user=user, 
            status='COMPLETED', 
            started_at__date=today
        ).aggregate(total=Sum('duration'))['total'] or 0

        start_of_week = today - timedelta(days=6)
        weekly_seconds = StudySession.objects.filter(
            user=user, 
            status='COMPLETED', 
            started_at__date__gte=start_of_week
        ).aggregate(total=Sum('duration'))['total'] or 0

        start_of_month = today - timedelta(days=29)
        monthly_seconds = StudySession.objects.filter(
            user=user, 
            status='COMPLETED', 
            started_at__date__gte=start_of_month
        ).aggregate(total=Sum('duration'))['total'] or 0

        stats, _ = StudentStats.objects.get_or_create(user=user)
        total_hours = stats.total_study_hours

        session_count = StudySession.objects.filter(
            user=user, 
            status='COMPLETED'
        ).count()

        avg_seconds = StudySession.objects.filter(
            user=user, 
            status='COMPLETED'
        ).aggregate(avg=Sum('duration'))['avg'] or 0
        if session_count > 0:
            avg_seconds = int(avg_seconds / session_count)

        longest_seconds = StudySession.objects.filter(
            user=user, 
            status='COMPLETED'
        ).aggregate(max_dur=Max('duration'))['max_dur'] or 0

        subject_data = StudySession.objects.filter(
            user=user, 
            status='COMPLETED'
        ).values('subject_name').annotate(total=Sum('duration')).order_by('-total')
        
        subject_hours = []
        for item in subject_data:
            name = item['subject_name'] or 'General'
            hours = round((item['total'] or 0) / 3600.0, 2)
            subject_hours.append({'subject': name, 'hours': hours})

        heatmap_data = StudySession.objects.filter(
            user=user, 
            status='COMPLETED', 
            started_at__date__gte=start_of_month
        ).values('started_at__date').annotate(total=Sum('duration')).order_by('started_at__date')
        
        heatmap = {}
        for i in range(30):
            d = start_of_month + timedelta(days=i)
            heatmap[d.isoformat()] = 0
            
        for item in heatmap_data:
            date_str = item['started_at__date'].isoformat()
            if date_str in heatmap:
                heatmap[date_str] = round((item['total'] or 0) / 3600.0, 2)

        avg_focus = StudySession.objects.filter(
            user=user, 
            status='COMPLETED'
        ).aggregate(avg=Avg('focus_percentage'))['avg'] or 100.0

        completed_targets = StudySession.objects.filter(
            user=user, 
            status='COMPLETED', 
            target_duration__gt=0, 
            duration__gte=F('target_duration')
        ).count()
        
        total_targets = StudySession.objects.filter(
            user=user, 
            status='COMPLETED', 
            target_duration__gt=0
        ).count()

        target_rate = (completed_targets / total_targets * 100.0) if total_targets > 0 else 85.0
        productivity_score = round((avg_focus * 0.6) + (target_rate * 0.4), 1)

        return Response({
            "today_hours": round(today_seconds / 3600.0, 2),
            "today_minutes": int(today_seconds // 60),
            "weekly_hours": round(weekly_seconds / 3600.0, 2),
            "monthly_hours": round(monthly_seconds / 3600.0, 2),
            "total_hours": round(total_hours, 2),
            "session_count": session_count,
            "average_session_minutes": int(avg_seconds // 60),
            "longest_session_minutes": int(longest_seconds // 60),
            "subject_hours": subject_hours,
            "heatmap": heatmap,
            "focus_score": round(avg_focus, 1),
            "productivity_score": productivity_score
        })


class TimerAIInsightsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        sessions = StudySession.objects.filter(user=user, status='COMPLETED').order_by('-started_at')[:10]
        session_list = []
        for s in sessions:
            session_list.append(
                f"- Date: {s.started_at.date().isoformat()}, Subject: {s.subject_name or 'General'}, "
                f"Duration: {round(s.duration / 60.0, 1)}m, Focus: {s.focus_percentage}%, Goal: {s.study_goal or 'N/A'}"
            )
        
        context_str = "\n".join(session_list)
        gemini_api_key = os.environ.get('GEMINI_API_KEY')
        
        if not gemini_api_key:
            mock_insights = {
                "best_study_time": "Early Morning (6:00 AM - 9:00 AM)",
                "weak_subjects": "Ind AS 16 (Property, Plant and Equipment)",
                "daily_recommendation": "Spend 45 minutes practicing mock MCQs on Depreciation methods in Ind AS 16.",
                "suggested_break_time": "5 minutes break after every 25 minutes of study (Pomodoro setup).",
                "productivity_insights": (
                    "Your focus level is highest during morning study sessions, averaging 94%. "
                    "However, sessions in the late afternoon (4:00 PM - 7:00 PM) show an increase in break frequency, "
                    "reducing focus to 78%. Consider studying core concepts early and doing light revisions later."
                ),
                "revision_reminder": "Ind AS 16 - Re-evaluate asset revaluation adjustments from CA Intermediate Accounts."
            }
            return Response(mock_insights)

        system_instruction = (
            "You are 'qubook.in AI Study Coach', analyzing a student's timer study sessions to generate "
            "actionable study insights.\n"
            "Analyze the list of study sessions provided, and output a JSON object containing these EXACT keys:\n"
            "- best_study_time: string\n"
            "- weak_subjects: string\n"
            "- daily_recommendation: string\n"
            "- suggested_break_time: string\n"
            "- productivity_insights: string\n"
            "- revision_reminder: string\n"
            "Format the output strictly as valid JSON, with no other text, Markdown boxes, or formatting."
        )

        user_prompt = f"Here is my study history:\n{context_str}\n\nPlease generate my productivity recommendations."
        
        url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
        headers = {
            "x-goog-api-key": gemini_api_key
        }
        payload = {
            "contents": [{
                "role": "user",
                "parts": [{"text": user_prompt}]
            }],
            "systemInstruction": {
                "parts": [{"text": system_instruction}]
            }
        }

        try:
            response = requests.post(url, json=payload, headers=headers, timeout=20)
            if response.status_code == 200:
                res_data = response.json()
                text_response = res_data['candidates'][0]['content']['parts'][0]['text']
                if "```json" in text_response:
                    text_response = text_response.split("```json")[1].split("```")[0].strip()
                elif "```" in text_response:
                    text_response = text_response.split("```")[1].strip()
                
                parsed = json.loads(text_response)
                return Response(parsed)
            else:
                raise Exception("Failed API call")
        except Exception:
            return Response({
                "best_study_time": "Late Evening (8:00 PM - 11:00 PM)",
                "weak_subjects": "Accounts & Ind AS Standards",
                "daily_recommendation": "Review Ind AS 16 notes and solve 10 MCQs from Practice Hub.",
                "suggested_break_time": "10 minutes break after every 50 minutes of deep focus.",
                "productivity_insights": "You are maintaining a strong streak. Focus levels are highest when goals are defined.",
                "revision_reminder": "Revise Ind AS 16 ledger entries and balance sheet presentation."
            })


