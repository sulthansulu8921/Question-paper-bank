from django.db import models
from django.conf import settings
from courses.models import Course, Subject, Level

class SubscriptionPlan(models.Model):
    LEVEL_CHOICES = [
        ('FOUNDATION', 'Foundation'),
        ('INTERMEDIATE', 'Intermediate'),
        ('FINAL', 'Final'),
    ]
    SCOPE_CHOICES = [
        ('PAPER_WISE', 'Paper Wise'),
        ('GROUP_WISE', 'Group Wise'),
    ]
    CYCLE_CHOICES = [
        ('ONE_TIME', 'One Time Payment'),
        ('MONTHLY', 'Monthly Subscription'),
        ('QUARTERLY', 'Quarterly Subscription'),
        ('HALF_YEARLY', 'Half-Yearly Subscription'),
        ('ANNUAL', 'Annual Subscription'),
        ('LIFETIME', 'Lifetime Access'),
        ('ATTEMPT_WISE', 'Attempt Wise'),
    ]

    name = models.CharField(max_length=100) # e.g. "Monthly Premium", "CA Foundation Full"
    price = models.DecimalField(max_digits=10, decimal_places=2)
    duration_days = models.IntegerField(default=30)
    description = models.TextField(blank=True)
    thumbnail = models.URLField(max_length=500, blank=True, null=True)
    status = models.CharField(max_length=20, default='ACTIVE', choices=[('ACTIVE', 'Active'), ('INACTIVE', 'Inactive')])
    
    category_specific = models.ForeignKey('courses.Category', on_delete=models.CASCADE, null=True, blank=True, related_name='subscription_plans')
    course_specific = models.ForeignKey(Course, on_delete=models.CASCADE, null=True, blank=True)
    level_specific = models.ForeignKey('courses.Level', on_delete=models.CASCADE, null=True, blank=True, related_name='subscription_plans')
    subject_specific = models.ForeignKey(Subject, on_delete=models.CASCADE, null=True, blank=True)

    # Extended configurator fields
    level_name = models.CharField(max_length=50, choices=LEVEL_CHOICES, null=True, blank=True)
    scope = models.CharField(max_length=20, choices=SCOPE_CHOICES, null=True, blank=True)
    billing_cycle = models.CharField(max_length=20, choices=CYCLE_CHOICES, null=True, blank=True)

    PLAN_TYPE_CHOICES = [
        ('QUESTIONS', 'Questions Only'),
        ('FULL_COURSE', 'Full Course'),
    ]
    plan_type = models.CharField(max_length=20, choices=PLAN_TYPE_CHOICES, default='FULL_COURSE')

    # Access control: how many questions per chapter can a user on this plan see
    # -1 = unlimited (premium), 0 = no access, N = first N questions only
    free_questions_per_chapter = models.IntegerField(
        default=3,
        help_text="Number of questions visible per chapter. Set -1 for unlimited (premium), 0 for no access."
    )

    # Granular access control flags
    video_access = models.BooleanField(default=True)
    notes_access = models.BooleanField(default=True)
    question_bank_access = models.BooleanField(default=True)
    mock_test_access = models.BooleanField(default=True)
    ai_assistant_access = models.BooleanField(default=True)
    live_class_access = models.BooleanField(default=True)
    download_permission = models.BooleanField(default=True)
    is_trial = models.BooleanField(default=False, help_text="If True, this plan will be automatically assigned to new users on signup.")

    # Date configuration fields
    purchase_start_date = models.DateTimeField(null=True, blank=True)
    purchase_end_date = models.DateTimeField(null=True, blank=True)
    fixed_expiry_date = models.DateTimeField(null=True, blank=True)

    def save(self, *args, **kwargs):
        if self.level_specific:
            lvl_name = self.level_specific.name.upper()
            if 'FOUNDATION' in lvl_name:
                self.level_name = 'FOUNDATION'
            elif 'INTERMEDIATE' in lvl_name:
                self.level_name = 'INTERMEDIATE'
            elif 'FINAL' in lvl_name:
                self.level_name = 'FINAL'
            else:
                self.level_name = self.level_specific.name[:50]
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

class UserSubscription(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    plan = models.ForeignKey(SubscriptionPlan, on_delete=models.RESTRICT)
    start_date = models.DateTimeField(auto_now_add=True)
    end_date = models.DateTimeField()
    is_active = models.BooleanField(default=True)
    order_id = models.CharField(max_length=100, blank=True, null=True)

    # Dynamic purchase details
    level = models.ForeignKey(Level, on_delete=models.SET_NULL, null=True, blank=True)
    subject = models.ForeignKey(Subject, on_delete=models.SET_NULL, null=True, blank=True)
    group = models.CharField(max_length=20, null=True, blank=True) # GROUP_1, GROUP_2, ALL
    calendar_month = models.CharField(max_length=20, null=True, blank=True) # January, February, etc.
    exam_attempt = models.CharField(max_length=20, null=True, blank=True) # January, May, September, November
    year = models.IntegerField(null=True, blank=True)

class Payment(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    plan = models.ForeignKey(SubscriptionPlan, on_delete=models.SET_NULL, null=True, blank=True)
    subscription = models.ForeignKey(UserSubscription, on_delete=models.SET_NULL, null=True, blank=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    transaction_id = models.CharField(max_length=100, unique=True, null=True, blank=True)
    order_id = models.CharField(max_length=100, blank=True, null=True)
    status = models.CharField(max_length=20, choices=[('SUCCESS', 'Success'), ('PENDING', 'Pending'), ('FAILED', 'Failed')])
    created_at = models.DateTimeField(auto_now_add=True)
    
    # Coupon tracking fields
    coupon_code = models.CharField(max_length=50, null=True, blank=True)
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    original_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    
    # GST and base price tracking
    gst_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    base_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)

class Coupon(models.Model):
    code = models.CharField(max_length=50, unique=True)
    discount_percent = models.IntegerField(default=0) # percentage: 1 - 100
    restricted_email = models.EmailField(max_length=255, null=True, blank=True)
    restricted_course = models.ForeignKey('courses.Course', on_delete=models.SET_NULL, null=True, blank=True, related_name='coupons')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.code} ({self.discount_percent}% off)"

class PlatformSetting(models.Model):
    key = models.CharField(max_length=100, unique=True)
    value = models.CharField(max_length=255, default="true")
    description = models.TextField(blank=True)

    def __str__(self):
        return f"{self.key}: {self.value}"


class SubscriptionAuditLog(models.Model):
    """Permanent, immutable audit trail for all admin actions on subscriptions."""
    ACTION_CHOICES = [
        ('EXTEND', 'Extended'),
        ('SUSPEND', 'Suspended'),
        ('ACTIVATE', 'Activated'),
        ('REFUND', 'Refunded'),
        ('CANCEL', 'Cancelled'),
        ('CREATE', 'Created'),
    ]
    subscription = models.ForeignKey(
        UserSubscription, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='audit_logs'
    )
    payment = models.ForeignKey(
        Payment, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='audit_logs'
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='subscription_audit_logs'
    )
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    notes = models.TextField(blank=True)
    old_end_date = models.DateTimeField(null=True, blank=True)
    new_end_date = models.DateTimeField(null=True, blank=True)
    old_status = models.BooleanField(null=True, blank=True)
    new_status = models.BooleanField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.action} on sub#{self.subscription_id} by {self.actor} at {self.timestamp}"


class UserViewedPaper(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='viewed_papers')
    paper_id = models.IntegerField()
    viewed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'paper_id')


from django.db.models.signals import post_save
from django.dispatch import receiver

@receiver(post_save, sender=UserSubscription)
def grant_credits_on_subscription(sender, instance, created, **kwargs):
    if created and instance.is_active:
        plan = instance.plan
        # Study Pass has ai_assistant_access = False
        if not plan.ai_assistant_access:
            user = instance.user
            user.ai_credits = (user.ai_credits or 0) + 100
            user.save(update_fields=['ai_credits'])


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def grant_trial_subscription_on_signup(sender, instance, created, **kwargs):
    if created:
        trial_plan = SubscriptionPlan.objects.filter(is_trial=True, status='ACTIVE').first()
        if trial_plan:
            from django.utils import timezone
            from datetime import timedelta
            if not UserSubscription.objects.filter(user=instance, is_active=True).exists():
                UserSubscription.objects.create(
                    user=instance,
                    plan=trial_plan,
                    end_date=timezone.now() + timedelta(days=trial_plan.duration_days),
                    is_active=True
                )


