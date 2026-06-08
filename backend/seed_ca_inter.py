import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from master_data.models import CALevel, ICAIPaper, ICAIChapter, ICAITopic
from courses.models import Course, Level, Subject, Topic
from materials.models import SubjectiveQuestion

def run_seed():
    print("Starting database seed for CA Intermediate...")

    # 1. Create or Get CA Intermediate Level/Course
    level = CALevel.objects.get(slug='ca-intermediate')
    
    course, _ = Course.objects.get_or_create(
        name="CA Intermediate",
        defaults={'slug': 'ca-inter', 'is_active': True}
    )
    
    course_level, _ = Level.objects.get_or_create(
        course=course,
        name="Intermediate",
        defaults={'slug': 'intermediate', 'order': 1}
    )

    data = [
        {
            "paper_id": 1,
            "name": "Advanced Accounting",
            "code": "PAPER 1",
            "chapters": [
                "AS 1", "AS 2", "AS 3", "AS 4", "AS 5", "AS 7", "AS 9", "AS 10", "AS 11", "AS 12", "AS 13", "AS 14", "AS 15", "AS 16", "AS 17", "AS 18", "AS 19", "AS 20", "AS 21", "AS 22", "AS 23", "AS 24", "AS 25", "AS 26", "AS 27", "AS 28", "AS 29",
                "Financial Statements of Companies", "Buyback of securities", "Amalgamation of Companies", "Accounting For Reconstruction of Companies", "Accounting for Branches Including Foreign Companies", "Applicability of Accounting Standards", "Introduction to Accounting Standards"
            ]
        },
        {
            "paper_id": 2,
            "name": "Corporate and Other Laws",
            "code": "PAPER 2",
            "chapters": [
                "Preliminary", "Incorporation of Company and Matters Incidental Thereto", "Prospectus and Allotment of Securities", "Share Capital and Debentures", "Acceptance of Deposits by Companies", "Registration of Charges", "Management and Administration", "Declaration and Payment of Dividend", "Accounts of Companies", "Audit and Auditors", "Companies Incorporated Outside India", "The Limited Liability Partnership Act, 2008", "The General Clauses Act, 1897", "Interpretation of Statutes", "The Foreign Exchange Management Act, 1999"
            ]
        },
        {
            "paper_id": 3,
            "name": "Taxation",
            "code": "PAPER 3",
            "chapters": [
                "Basic Concepts", "Residence and Scope of Total Income", "Salaries", "Income from House Property", "Profits and Gains of Business and Profession", "Capital Gains", "Income from Other Source", "Income of Other Persons included in Assessess's Total Income", "Aggregation of Income, Set-Off and Carry Forward of Losses", "Deductions from Gross Total Income", "Advance Tax, Tax Deducted at Source and Tax Collection at Source", "Income Tax Liability-Computation and Optimisation",
                "GST in India-An Introduction", "Supply under GST", "Charge of GST", "Place of Supply", "Exemptions from GST", "Time of Supply", "Value of Supply", "Input Tax Credit", "Registration", "Tax Invoice; Credit and Debit Notes", "Accounts and Records", "E-way Bill", "Payment of Tax", "Tax Deduction at Source and Collection of Tax at Source", "Returns"
            ]
        },
        {
            "paper_id": 4,
            "name": "Cost and Management Accounting",
            "code": "PAPER 4",
            "chapters": [
                "Introduction to Cost and Management Accounting", "Material Cost", "Employee Cost and Direct Expenses", "Overheads - Absorption Costing Method", "Activity Based Costing", "Cost Sheet", "Cost Accounting System", "Unit & Batch Costing", "Job Costing", "Process & Operation Costing", "Joint Products and By Products", "Service Costing", "Standard Costing", "Marginal Costing", "Budgets and Budgetary Control"
            ]
        },
        {
            "paper_id": 5,
            "name": "Auditing and ethics",
            "code": "PAPER 5",
            "chapters": [
                "Nature, Objective and Scope of Audit", "Audit Strategy, Audit Planning and Audit Programme", "Risk Assessment and Internal Control", "Audit Evidence", "Audit of Items of Financial Statements", "Audit Documentation", "Completion and Review", "Audit Report", "Special Features of Audit of Different Type of Entities", "Audit of Banks", "Ethics and Terms of Audit Engagements"
            ]
        },
        {
            "paper_id": 6,
            "name": "Financial Management and Strategic Management",
            "code": "PAPER 6",
            "chapters": [
                "Scope and Objectives of Financial Management", "Types of Financing", "Financial Analysis and Planning - Ratio Analysis", "Cost of Capital", "Financing Decisions - Capital Structure", "Financing Decisions - Leverages", "Investment Decisions", "Dividend Decisions", "Management of Working Capital",
                "Introduction to Strategic Management", "Strategic Analysis: External Environment", "Strategic Analysis: Internal Environment", "Strategic Choices", "Strategic Implementation and Evaluation"
            ]
        }
    ]

    for p_data in data:
        print(f"Processing {p_data['name']}...")
        
        # Note: If paper already exists with a different name but same level, unique_together might clash. 
        # But ICAIPaper unique_together is ['level', 'name']. We will get_or_create by level and name.
        icai_paper, _ = ICAIPaper.objects.get_or_create(
            level=level,
            name=p_data['name'],
            defaults={'code': p_data['code'], 'order': p_data['paper_id']}
        )
        
        # Force update code and order just in case it existed
        icai_paper.code = p_data['code']
        icai_paper.order = p_data['paper_id']
        icai_paper.save()

        # Same for courses.models.Subject
        try:
            subject = Subject.objects.get(id=p_data['paper_id'])
            subject.name = p_data['name']
            subject.code = p_data['code']
            subject.course = course
            subject.level = course_level
            subject.save()
        except Subject.DoesNotExist:
            subject = Subject.objects.create(
                id=p_data['paper_id'],
                name=p_data['name'],
                code=p_data['code'],
                course=course,
                level=course_level
            )

        chapter_order = 1
        valid_chapters = []
        for ch_name in p_data['chapters']:
            valid_chapters.append(ch_name)
            
            # Create/update in master_data
            icai_chapter, _ = ICAIChapter.objects.get_or_create(
                paper=icai_paper,
                name=ch_name,
                defaults={'order': chapter_order}
            )
            # Make sure order is updated if it existed
            icai_chapter.order = chapter_order
            icai_chapter.save()

            # Create default topics for this chapter to allow question creation
            default_topics = ["Theory & Concepts", "Practical Problems", "Exam Focus Questions"]
            for i, t_name in enumerate(default_topics, 1):
                ICAITopic.objects.get_or_create(
                    chapter=icai_chapter,
                    name=t_name,
                    defaults={'order': i}
                )

            # Create/update in courses
            print(f"DEBUG: Creating topic '{ch_name}' for subject {subject.id} ({subject.name})")
            topic, created = Topic.objects.get_or_create(
                subject=subject,
                name=ch_name,
                defaults={'order': chapter_order}
            )
            if not created:
                topic.order = chapter_order
                topic.save()
            
            chapter_order += 1

        # Clean up stale topics/chapters not in the seeded list for this subject
        Topic.objects.filter(subject=subject).exclude(name__in=valid_chapters).delete()
        ICAIChapter.objects.filter(paper=icai_paper).exclude(name__in=valid_chapters).delete()

    # Clean up stale subjects and papers for CA Intermediate
    valid_paper_ids = [p_data['paper_id'] for p_data in data]
    valid_paper_names = [p_data['name'] for p_data in data]
    Subject.objects.filter(level=course_level).exclude(id__in=valid_paper_ids).delete()
    ICAIPaper.objects.filter(level=level).exclude(name__in=valid_paper_names).delete()

    print("Successfully seeded all CA Intermediate syllabus data!")

if __name__ == '__main__':
    run_seed()
