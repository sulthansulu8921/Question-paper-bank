import os
import django
from datetime import date, timedelta

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from django.contrib.auth import get_user_model
from gamification.models import Achievement, Quote, UpcomingExam, Assignment, MockTestResult, StudentStats, StudyStreak

User = get_user_model()

def seed_achievements():
    achievements = [
        ('First Step', 'Maintain a study streak of 1 day.', 'footprints', 20, 10),
        ('3-Day Flash', 'Maintain a study streak of 3 days.', 'zap', 60, 30),
        ('Weekly Warrior', 'Maintain a study streak of 7 days.', 'shield', 140, 70),
        ('Consistency King', 'Maintain a study streak of 30 days.', 'crown', 600, 300),
        ('QBank Master', 'Solve 10 questions in total.', 'award', 100, 50),
        ('Perfect Score', 'Score 100% on any mock test.', 'sparkles', 200, 100),
    ]
    for name, desc, icon, xp, coins in achievements:
        Achievement.objects.get_or_create(
            name=name,
            defaults={
                'description': desc,
                'badge_icon': icon,
                'xp_reward': xp,
                'coins_reward': coins
            }
        )
    print("Seeded Achievements.")

def seed_quotes():
    quotes = [
        ("Consistency today leads to success tomorrow.", "qubook.in"),
        ("The secret of getting ahead is getting started.", "Mark Twain"),
        ("It always seems impossible until it's done.", "Nelson Mandela"),
        ("Believe you can and you're halfway there.", "Theodore Roosevelt"),
        ("Quality is not an act, it is a habit.", "Aristotle"),
        ("Your talent determines what you can do. Your motivation determines how much you are willing to do. Your attitude determines how well you do it.", "Lou Holtz"),
        ("Success is the sum of small efforts, repeated day in and day out.", "Robert Collier"),
        ("Start where you are. Use what you have. Do what you can.", "Arthur Ashe"),
        ("Opportunities don't happen, you create them.", "Chris Grosser"),
        ("Don't watch the clock; do what it does. Keep going.", "Sam Levenson"),
    ]
    for i, (text, author) in enumerate(quotes, 1):
        Quote.objects.update_or_create(
            day_of_year=i,
            defaults={
                'text': text,
                'author': author,
                'is_active': True
            }
        )
    print("Seeded Quotes.")

def seed_widgets_for_users():
    users = User.objects.all()
    today = date.today()
    
    for user in users:
        # Verify stats and streaks exist
        stats, _ = StudentStats.objects.get_or_create(user=user)
        # Give some initial values to make dashboard beautiful
        if stats.xp_points == 0:
            stats.xp_points = 350
            stats.coins = 120
            stats.level = 2
            stats.total_study_hours = 24.5
            stats.questions_attempted = 18
            stats.correct_answers = 14
            stats.wrong_answers = 4
            stats.average_score = 77.8
            stats.save()
            
        streak, _ = StudyStreak.objects.get_or_create(user=user)
        if streak.current_streak == 0:
            streak.current_streak = 5
            streak.longest_streak = 12
            streak.last_study_date = today - timedelta(days=1)
            streak.streak_days = [True, True, True, True, True, False, False]
            streak.save()

        # Seed Upcoming Exams
        UpcomingExam.objects.get_or_create(
            user=user,
            title="CA Intermediate Group 1 Exam",
            defaults={
                'date': today + timedelta(days=45),
                'description': "National level ICAI exam for Group 1 syllabus."
            }
        )
        UpcomingExam.objects.get_or_create(
            user=user,
            title="Mock Test: Advanced Accounting",
            defaults={
                'date': today + timedelta(days=5),
                'description': "Full length simulated mock exam."
            }
        )

        # Seed Assignments
        Assignment.objects.get_or_create(
            user=user,
            title="Submit AS 10 Revision Sheet",
            defaults={
                'due_date': today + timedelta(days=2),
                'status': 'PENDING'
            }
        )
        Assignment.objects.get_or_create(
            user=user,
            title="Complete Chapter 3 MCQ Sheet",
            defaults={
                'due_date': today + timedelta(days=6),
                'status': 'PENDING'
            }
        )
        Assignment.objects.get_or_create(
            user=user,
            title="Review Nov 2025 Past Paper Questions",
            defaults={
                'due_date': today - timedelta(days=1),
                'status': 'COMPLETED'
            }
        )

        # Seed Mock Test Results
        MockTestResult.objects.get_or_create(
            user=user,
            title="Mock Exam 1: Advanced Accounting",
            defaults={
                'score': 85,
                'total_marks': 100,
                'date': today - timedelta(days=14)
            }
        )
        MockTestResult.objects.get_or_create(
            user=user,
            title="Mock Exam 2: Corporate Law",
            defaults={
                'score': 72,
                'total_marks': 100,
                'date': today - timedelta(days=7)
            }
        )
    print("Seeded User widgets, stats, and streaks.")

if __name__ == '__main__':
    seed_achievements()
    seed_quotes()
    seed_widgets_for_users()
    print("Gamification seed completed successfully!")
