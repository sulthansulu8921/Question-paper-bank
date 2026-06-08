from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.utils import timezone
from datetime import date
from django.db.models import F
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from .models import (
    StudentStats, StudyStreak, Achievement, UserAchievement,
    ActivityLog, Quote, UpcomingExam, Assignment, MockTestResult
)
from .serializers import (
    StudentStatsSerializer, StudyStreakSerializer, AchievementSerializer,
    UserAchievementSerializer, ActivityLogSerializer, QuoteSerializer,
    UpcomingExamSerializer, AssignmentSerializer, MockTestResultSerializer,
    LeaderboardEntrySerializer
)

User = get_user_model()

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
                ach, _ = Achievement.objects.get_or_create(
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
        # Rank users by Level and XP points descending
        all_stats = StudentStats.objects.select_related('user', 'user__streak').order_by('-level', '-xp_points', 'id')
        
        leaderboard_data = []
        for rank, stat in enumerate(all_stats, 1):
            streak_count = 0
            if hasattr(stat.user, 'streak'):
                streak_count = stat.user.streak.current_streak
            
            full_name = f"{stat.user.first_name} {stat.user.last_name}".strip() or stat.user.username
            
            leaderboard_data.append({
                'rank': rank,
                'id': stat.user.id,
                'name': full_name,
                'email': stat.user.email,
                'level': stat.level,
                'xp_points': stat.xp_points,
                'current_streak': streak_count
            })

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
            Achievement.objects.get_or_create(
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
