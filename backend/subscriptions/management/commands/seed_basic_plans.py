from django.core.management.base import BaseCommand
from django.db import transaction
from decimal import Decimal
from subscriptions.models import SubscriptionPlan

class Command(BaseCommand):
    help = "Seeds Basic subscription plan counterparts for existing active plans"

    def handle(self, *args, **options):
        self.stdout.write("Starting subscription plans seeding...")
        
        with transaction.atomic():
            # Get all active plans
            active_plans = list(SubscriptionPlan.objects.filter(status='ACTIVE'))
            
            created_count = 0
            updated_count = 0
            
            for plan in active_plans:
                # If plan name already contains Basic, skip it
                if "basic" in plan.name.lower():
                    continue
                
                # Clean up name if it contains Premium already
                original_name = plan.name
                if " (premium)" in original_name.lower():
                    original_name = original_name.replace(" (Premium)", "").replace(" (premium)", "")
                
                # Make sure the current plan has (Premium) in its name and ai_assistant_access=True
                if not plan.name.endswith(" (Premium)"):
                    plan.name = f"{original_name} (Premium)"
                    plan.ai_assistant_access = True
                    plan.save()
                    updated_count += 1
                    self.stdout.write(f"Updated '{original_name}' to '{plan.name}' (Premium)")
                
                # Check if a Basic counterpart already exists
                basic_name = f"{original_name} (Basic)"
                basic_exists = SubscriptionPlan.objects.filter(
                    name=basic_name,
                    level_specific=plan.level_specific,
                    scope=plan.scope,
                    billing_cycle=plan.billing_cycle,
                    course_specific=plan.course_specific
                ).exists()
                
                if not basic_exists:
                    # Calculate basic price (60% of Premium, rounded to nearest 9 or integer)
                    premium_price = float(plan.price)
                    basic_price = round(premium_price * 0.6)
                    # Let's keep it clean
                    if basic_price < 49:
                        basic_price = 49
                    
                    # Duplicate the plan as Basic
                    basic_plan = SubscriptionPlan.objects.create(
                        name=basic_name,
                        price=Decimal(str(basic_price)),
                        duration_days=plan.duration_days,
                        description=f"Affordable access plan. Includes Notes, MCQs, PYQs, Mock Tests, Learning Mode, Study Timer, Streaks, Study Groups. Does not include AI Features.",
                        status='ACTIVE',
                        category_specific=plan.category_specific,
                        course_specific=plan.course_specific,
                        level_specific=plan.level_specific,
                        subject_specific=plan.subject_specific,
                        level_name=plan.level_name,
                        scope=plan.scope,
                        billing_cycle=plan.billing_cycle,
                        plan_type=plan.plan_type,
                        free_questions_per_chapter=plan.free_questions_per_chapter,
                        video_access=plan.video_access,
                        notes_access=plan.notes_access,
                        question_bank_access=plan.question_bank_access,
                        mock_test_access=plan.mock_test_access,
                        ai_assistant_access=False, # Basic plan has NO AI!
                        live_class_access=plan.live_class_access,
                        download_permission=plan.download_permission,
                        purchase_start_date=plan.purchase_start_date,
                        purchase_end_date=plan.purchase_end_date,
                        fixed_expiry_date=plan.fixed_expiry_date,
                    )
                    created_count += 1
                    self.stdout.write(f"Created Basic plan '{basic_plan.name}' for price ₹{basic_price}")

            self.stdout.write(self.style.SUCCESS(f"Done! Updated {updated_count} plans and created {created_count} Basic plans."))
