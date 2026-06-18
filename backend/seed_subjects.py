import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from courses.models import Course, Level, Subject

def seed_subjects():
    # Foundation
    try:
        foundation_level = Level.objects.get(id=52)
        foundation_course = Course.objects.get(id=42)
        foundation_subs = [
            ("Paper 1: Accounting", "P1", "accounting"),
            ("Paper 2: Business Laws", "P2", "business-laws"),
            ("Paper 3: Quantitative Aptitude", "P3", "quantitative-aptitude"),
            ("Paper 4: Business Economics", "P4", "business-economics"),
        ]
        for name, code, slug in foundation_subs:
            Subject.objects.get_or_create(
                level=foundation_level,
                course=foundation_course,
                name=name,
                code=code,
                slug=slug
            )
        print("Foundation subjects seeded successfully!")
    except Exception as e:
        print("Error seeding Foundation subjects:", e)

    # Intermediate
    try:
        inter_level = Level.objects.get(id=51)
        inter_course = Course.objects.get(id=43)
        inter_subs = [
            ("Paper 1: Advanced Accounting", "P1", "advanced-accounting"),
            ("Paper 2: Corporate and Other Laws", "P2", "corporate-and-other-laws"),
            ("Paper 3: Taxation", "P3", "taxation"),
            ("Paper 4: Cost and Management Accounting", "P4", "cost-and-management-accounting"),
            ("Paper 5: Auditing and Ethics", "P5", "auditing-and-ethics"),
            ("Paper 6: Financial Management and Strategic Management", "P6", "fm-sm"),
        ]
        for name, code, slug in inter_subs:
            Subject.objects.get_or_create(
                level=inter_level,
                course=inter_course,
                name=name,
                code=code,
                slug=slug
            )
        print("Intermediate subjects seeded successfully!")
    except Exception as e:
        print("Error seeding Intermediate subjects:", e)

    # Final
    try:
        final_level = Level.objects.get(id=53)
        final_course = Course.objects.get(id=44)
        final_subs = [
            ("Paper 1: Financial Reporting", "P1", "financial-reporting"),
            ("Paper 2: Advanced Financial Management", "P2", "advanced-financial-management"),
            ("Paper 3: Advanced Auditing, Assurance and Professional Ethics", "P3", "advanced-auditing"),
            ("Paper 4: Direct Tax Laws & International Taxation", "P4", "direct-tax-laws"),
            ("Paper 5: Indirect Tax Laws", "P5", "indirect-tax-laws"),
            ("Paper 6: Integrated Business Solutions", "P6", "integrated-business-solutions"),
        ]
        for name, code, slug in final_subs:
            Subject.objects.get_or_create(
                level=final_level,
                course=final_course,
                name=name,
                code=code,
                slug=slug
            )
        print("Final subjects seeded successfully!")
    except Exception as e:
        print("Error seeding Final subjects:", e)

if __name__ == '__main__':
    seed_subjects()
