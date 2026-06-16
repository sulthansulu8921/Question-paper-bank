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
        ('MONTHLY', 'Monthly'),
        ('ATTEMPT_WISE', 'Attempt Wise'),
    ]

    name = models.CharField(max_length=100) # e.g. "Monthly Premium", "CA Foundation Full"
    price = models.DecimalField(max_digits=10, decimal_places=2)
    duration_days = models.IntegerField(default=30)
    description = models.TextField(blank=True)
    
    course_specific = models.ForeignKey(Course, on_delete=models.CASCADE, null=True, blank=True)
    subject_specific = models.ForeignKey(Subject, on_delete=models.CASCADE, null=True, blank=True)

    # Extended configurator fields
    level_name = models.CharField(max_length=50, choices=LEVEL_CHOICES, null=True, blank=True)
    scope = models.CharField(max_length=20, choices=SCOPE_CHOICES, null=True, blank=True)
    billing_cycle = models.CharField(max_length=20, choices=CYCLE_CHOICES, null=True, blank=True)

    # Access control: how many questions per chapter can a user on this plan see
    # -1 = unlimited (premium), 0 = no access, N = first N questions only
    free_questions_per_chapter = models.IntegerField(
        default=3,
        help_text="Number of questions visible per chapter. Set -1 for unlimited (premium), 0 for no access."
    )

    def __str__(self):
        return self.name

class UserSubscription(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    plan = models.ForeignKey(SubscriptionPlan, on_delete=models.RESTRICT)
    start_date = models.DateTimeField(auto_now_add=True)
    end_date = models.DateTimeField()
    is_active = models.BooleanField(default=True)

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
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    transaction_id = models.CharField(max_length=100, unique=True, null=True, blank=True)
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

