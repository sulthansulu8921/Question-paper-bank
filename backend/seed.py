import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from courses.models import Course, Subject, Topic
from materials.models import SubjectiveQuestion

# Create a mock course and subject if empty
course, _ = Course.objects.get_or_create(
    name="CA Intermediate",
    defaults={'slug': 'ca-inter', 'is_active': True}
)

subject, _ = Subject.objects.get_or_create(
    name="Advanced Accounting",
    defaults={'course': course, 'code': 'PAPER 1'}
)

topic1, _ = Topic.objects.get_or_create(
    name="Advanced Capital Budgeting Decisions",
    defaults={'subject': subject, 'order': 1}
)
topic2, _ = Topic.objects.get_or_create(
    name="Foreign Exchange Exposure and Risk Management",
    defaults={'subject': subject, 'order': 2}
)
topic3, _ = Topic.objects.get_or_create(
    name="Theoretical Questions",
    defaults={'subject': subject, 'order': 3}
)
topic4, _ = Topic.objects.get_or_create(
    name="Business Valuation",
    defaults={'subject': subject, 'order': 4}
)
topic5, _ = Topic.objects.get_or_create(
    name="Derivatives Analysis",
    defaults={'subject': subject, 'order': 5}
)
topic6, _ = Topic.objects.get_or_create(
    name="Portfolio Management",
    defaults={'subject': subject, 'order': 6}
)

# Mock data mapping
questions_data = [
    {'topic': topic1, 'source': 'MTP-01', 'year': 'MAY, 2026', 'q_no': '1(a)', 'marks': 6, 'is_important': False},
    {'topic': topic2, 'source': 'MTP-01', 'year': 'MAY, 2026', 'q_no': '1(b)', 'marks': 4, 'is_important': False},
    {'topic': topic3, 'source': 'MTP-01', 'year': 'MAY, 2026', 'q_no': '1(c)', 'marks': 4, 'is_important': False},
    {'topic': topic2, 'source': 'MTP-01', 'year': 'MAY, 2026', 'q_no': '2(a)', 'marks': 10, 'is_important': False},
    {'topic': topic3, 'source': 'MTP-01', 'year': 'MAY, 2026', 'q_no': '2(b)', 'marks': 4, 'is_important': False},
    {'topic': topic3, 'source': 'MTP-01', 'year': 'MAY, 2026', 'q_no': '3(b)', 'marks': 4, 'is_important': True},
    {'topic': topic4, 'source': 'MTP-01', 'year': 'MAY, 2026', 'q_no': '4(a)', 'marks': 6, 'is_important': False},
    {'topic': topic5, 'source': 'MTP-02', 'year': 'NOV, 2025', 'q_no': '5(a)', 'marks': 8, 'is_important': False},
    {'topic': topic6, 'source': 'MTP-02', 'year': 'NOV, 2025', 'q_no': '5(b)', 'marks': 12, 'is_important': True},
]

for q_data in questions_data:
    SubjectiveQuestion.objects.get_or_create(
        subject=subject,
        topic=q_data['topic'],
        source=q_data['source'],
        year=q_data['year'],
        q_no=q_data['q_no'],
        defaults={'marks': q_data['marks'], 'is_important': q_data['is_important']}
    )

print("Database seeded with mock questions.")

from subscriptions.models import SubscriptionPlan
plans_data = [
    {'name': 'Basic Monthly', 'price': 499.00, 'duration_days': 30, 'description': 'Access to all theory questions, notes, and mock tests for 30 days.'},
    {'name': 'Standard Annual', 'price': 3999.00, 'duration_days': 365, 'description': 'Full premium access to all courses, answers, and analytical database for a full year.'},
    {'name': 'CA Foundation Pro', 'price': 1499.00, 'duration_days': 180, 'description': 'Targeted access to CA Foundation master papers and solutions for 6 months.'},
]

for p_data in plans_data:
    SubscriptionPlan.objects.get_or_create(
        name=p_data['name'],
        defaults={
            'price': p_data['price'],
            'duration_days': p_data['duration_days'],
            'description': p_data['description']
        }
    )
print("Database seeded with subscription plans.")
