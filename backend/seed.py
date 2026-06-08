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
    name="AS 10",
    defaults={'subject': subject, 'order': 8}
)
topic2, _ = Topic.objects.get_or_create(
    name="AS 12",
    defaults={'subject': subject, 'order': 10}
)
topic3, _ = Topic.objects.get_or_create(
    name="AS 16",
    defaults={'subject': subject, 'order': 14}
)
topic4, _ = Topic.objects.get_or_create(
    name="Financial Statements of Companies",
    defaults={'subject': subject, 'order': 28}
)
topic5, _ = Topic.objects.get_or_create(
    name="Amalgamation of Companies",
    defaults={'subject': subject, 'order': 30}
)
topic6, _ = Topic.objects.get_or_create(
    name="Accounting for Branches Including Foreign Companies",
    defaults={'subject': subject, 'order': 32}
)

# Clear existing subjective questions first
SubjectiveQuestion.objects.filter(subject=subject).delete()

# Predefined detailed questions for specific topics
detailed_questions = [
    {'topic_name': 'AS 10', 'source': 'MTP-01', 'year': 'MAY, 2026', 'q_no': '1(a)', 'marks': 6, 'is_important': False, 'q_text': 'State the conditions under which property, plant and equipment should be recognized as an asset as per AS 10.'},
    {'topic_name': 'AS 12', 'source': 'MTP-01', 'year': 'MAY, 2026', 'q_no': '1(b)', 'marks': 4, 'is_important': False, 'q_text': 'Explain the accounting treatment of government grants related to depreciable assets as per AS 12.'},
    {'topic_name': 'AS 16', 'source': 'MTP-01', 'year': 'MAY, 2026', 'q_no': '1(c)', 'marks': 4, 'is_important': False, 'q_text': 'Define borrowing costs and explain the capitalization period as per AS 16.'},
    {'topic_name': 'AS 12', 'source': 'MTP-01', 'year': 'MAY, 2026', 'q_no': '2(a)', 'marks': 10, 'is_important': False, 'q_text': 'Explain presentation of grants in financial statements.'},
    {'topic_name': 'AS 16', 'source': 'MTP-01', 'year': 'MAY, 2026', 'q_no': '2(b)', 'marks': 4, 'is_important': False, 'q_text': 'Detailed calculation of borrowing costs.'},
    {'topic_name': 'AS 16', 'source': 'MTP-01', 'year': 'MAY, 2026', 'q_no': '3(b)', 'marks': 4, 'is_important': True, 'q_text': 'Distinguish between exchange differences and borrowing costs.'},
    {'topic_name': 'Financial Statements of Companies', 'source': 'MTP-01', 'year': 'MAY, 2026', 'q_no': '4(a)', 'marks': 6, 'is_important': False, 'q_text': 'Prepare the Balance Sheet of Qubook Ltd. as on 31st March 2026 as per Schedule III.'},
    {'topic_name': 'Amalgamation of Companies', 'source': 'MTP-02', 'year': 'NOV, 2025', 'q_no': '5(a)', 'marks': 8, 'is_important': False, 'q_text': 'Calculate the purchase consideration under pooling of interest method for amalgamation of company A and company B.'},
    {'topic_name': 'Accounting for Branches Including Foreign Companies', 'source': 'MTP-02', 'year': 'NOV, 2025', 'q_no': '5(b)', 'marks': 12, 'is_important': True, 'q_text': 'Explain the rules for translating the financial statements of an integral foreign branch as per AS 11.'},
]

# Create detailed questions
for dq in detailed_questions:
    try:
        t_obj = Topic.objects.get(subject=subject, name=dq['topic_name'])
        SubjectiveQuestion.objects.create(
            subject=subject,
            topic=t_obj,
            source=dq['source'],
            year=dq['year'],
            q_no=dq['q_no'],
            marks=dq['marks'],
            is_important=dq['is_important'],
            question_text=dq['q_text'],
            correct_answer="Detailed step-by-step solution is available in the qubook.in answers section.",
            status="PUBLISHED"
        )
    except Topic.DoesNotExist:
        pass

# Seed a default mock question for all other topics of Advanced Accounting so that every single chapter is visible
all_topics = Topic.objects.filter(subject=subject).order_by('order')
for i, topic in enumerate(all_topics, 1):
    # Check if a question already exists for this topic
    if not SubjectiveQuestion.objects.filter(topic=topic).exists():
        # Generate a question number based on its index or topic order
        q_num = f"{i}"
        SubjectiveQuestion.objects.create(
            subject=subject,
            topic=topic,
            source="MTP-01",
            year="MAY, 2026",
            q_no=q_num,
            marks=5,
            is_important=False,
            question_text=f"Identify the major compliance rules, recognition criteria, and disclosures required for {topic.name}.",
            correct_answer=f"Refer to the standard ICAI textbook chapters and qubook.in revision notes for detailed guidance on {topic.name}.",
            status="PUBLISHED"
        )

print("Database seeded with mock questions.")

from subscriptions.models import SubscriptionPlan
plans_data = [
    # Foundation Plans
    {
        'name': 'CA Foundation Paper Wise Attempt',
        'price': 200.00,
        'duration_days': 120,
        'description': 'Access to a single CA Foundation subject for a full exam attempt cycle.',
        'level_name': 'FOUNDATION',
        'scope': 'PAPER_WISE',
        'billing_cycle': 'ATTEMPT_WISE'
    },
    {
        'name': 'CA Foundation Paper Wise Monthly',
        'price': 75.00,
        'duration_days': 30,
        'description': 'Access to a single CA Foundation subject for a calendar month.',
        'level_name': 'FOUNDATION',
        'scope': 'PAPER_WISE',
        'billing_cycle': 'MONTHLY'
    },
    {
        'name': 'CA Foundation Group Wise Attempt',
        'price': 800.00,
        'duration_days': 120,
        'description': 'Full access to all CA Foundation subjects for a full exam attempt cycle.',
        'level_name': 'FOUNDATION',
        'scope': 'GROUP_WISE',
        'billing_cycle': 'ATTEMPT_WISE'
    },
    {
        'name': 'CA Foundation Group Wise Monthly',
        'price': 300.00,
        'duration_days': 30,
        'description': 'Full access to all CA Foundation subjects for a calendar month.',
        'level_name': 'FOUNDATION',
        'scope': 'GROUP_WISE',
        'billing_cycle': 'MONTHLY'
    },
    # Intermediate Plans
    {
        'name': 'CA Intermediate Paper Wise Attempt',
        'price': 300.00,
        'duration_days': 120,
        'description': 'Access to a single CA Intermediate subject for a full exam attempt cycle.',
        'level_name': 'INTERMEDIATE',
        'scope': 'PAPER_WISE',
        'billing_cycle': 'ATTEMPT_WISE'
    },
    {
        'name': 'CA Intermediate Paper Wise Monthly',
        'price': 100.00,
        'duration_days': 30,
        'description': 'Access to a single CA Intermediate subject for a calendar month.',
        'level_name': 'INTERMEDIATE',
        'scope': 'PAPER_WISE',
        'billing_cycle': 'MONTHLY'
    },
    {
        'name': 'CA Intermediate Group Wise Attempt',
        'price': 900.00,
        'duration_days': 120,
        'description': 'Access to a specific CA Intermediate group for a full exam attempt cycle.',
        'level_name': 'INTERMEDIATE',
        'scope': 'GROUP_WISE',
        'billing_cycle': 'ATTEMPT_WISE'
    },
    {
        'name': 'CA Intermediate Group Wise Monthly',
        'price': 300.00,
        'duration_days': 30,
        'description': 'Access to a specific CA Intermediate group for a calendar month.',
        'level_name': 'INTERMEDIATE',
        'scope': 'GROUP_WISE',
        'billing_cycle': 'MONTHLY'
    },
    # Final Plans
    {
        'name': 'CA Final Paper Wise Attempt',
        'price': 400.00,
        'duration_days': 120,
        'description': 'Access to a single CA Final subject for a full exam attempt cycle.',
        'level_name': 'FINAL',
        'scope': 'PAPER_WISE',
        'billing_cycle': 'ATTEMPT_WISE'
    },
    {
        'name': 'CA Final Paper Wise Monthly',
        'price': 150.00,
        'duration_days': 30,
        'description': 'Access to a single CA Final subject for a calendar month.',
        'level_name': 'FINAL',
        'scope': 'PAPER_WISE',
        'billing_cycle': 'MONTHLY'
    },
    {
        'name': 'CA Final Group Wise Attempt',
        'price': 1200.00,
        'duration_days': 120,
        'description': 'Access to a specific CA Final group for a full exam attempt cycle.',
        'level_name': 'FINAL',
        'scope': 'GROUP_WISE',
        'billing_cycle': 'ATTEMPT_WISE'
    },
    {
        'name': 'CA Final Group Wise Monthly',
        'price': 450.00,
        'duration_days': 30,
        'description': 'Access to a specific CA Final group for a calendar month.',
        'level_name': 'FINAL',
        'scope': 'GROUP_WISE',
        'billing_cycle': 'MONTHLY'
    },
]

for p_data in plans_data:
    SubscriptionPlan.objects.update_or_create(
        level_name=p_data['level_name'],
        scope=p_data['scope'],
        billing_cycle=p_data['billing_cycle'],
        defaults={
            'name': p_data['name'],
            'price': p_data['price'],
            'duration_days': p_data['duration_days'],
            'description': p_data['description']
        }
    )
print("Database seeded with CA subscription plans.")

