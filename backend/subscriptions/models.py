from django.db import models
from django.conf import settings
from courses.models import Course, Subject

class SubscriptionPlan(models.Model):
    name = models.CharField(max_length=100) # e.g. "Monthly Premium", "CA Foundation Full"
    price = models.DecimalField(max_digits=10, decimal_places=2)
    duration_days = models.IntegerField(default=30)
    description = models.TextField(blank=True)
    
    course_specific = models.ForeignKey(Course, on_delete=models.CASCADE, null=True, blank=True)
    subject_specific = models.ForeignKey(Subject, on_delete=models.CASCADE, null=True, blank=True)

    def __str__(self):
        return self.name

class UserSubscription(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    plan = models.ForeignKey(SubscriptionPlan, on_delete=models.RESTRICT)
    start_date = models.DateTimeField(auto_now_add=True)
    end_date = models.DateTimeField()
    is_active = models.BooleanField(default=True)

class Payment(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    transaction_id = models.CharField(max_length=100, unique=True, null=True, blank=True)
    status = models.CharField(max_length=20, choices=[('SUCCESS', 'Success'), ('PENDING', 'Pending'), ('FAILED', 'Failed')])
    created_at = models.DateTimeField(auto_now_add=True)
