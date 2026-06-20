from django.db import models
from django.utils.text import slugify
from django.conf import settings

class Category(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    icon = models.CharField(max_length=100, blank=True, default='')
    status = models.CharField(max_length=20, default='ACTIVE', choices=[('ACTIVE', 'Active'), ('INACTIVE', 'Inactive')])

    def __str__(self):
        return self.name

class Course(models.Model):
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True, related_name='courses')
    institution = models.ForeignKey('authentication.Institution', on_delete=models.SET_NULL, null=True, blank=True, related_name='courses')
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200, unique=True, blank=True)
    short_description = models.CharField(max_length=300, blank=True)
    description = models.TextField(blank=True)
    thumbnail = models.URLField(blank=True, null=True)
    banner = models.URLField(blank=True, null=True)
    icon = models.URLField(blank=True, null=True)
    color = models.CharField(max_length=20, default='#4F46E5')
    
    is_premium = models.BooleanField(default=True)
    monthly_price = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    yearly_price = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)
    is_archived = models.BooleanField(default=False)
    duration = models.CharField(max_length=100, blank=True, default='')
    validity_days = models.IntegerField(default=365)

    seo_title = models.CharField(max_length=200, blank=True)
    seo_description = models.TextField(blank=True)
    seo_keywords = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)
        try:
            from master_data.models import CALevel
            qualification_name = self.category.name if self.category else 'CA'
            calevel_qs = CALevel.objects.filter(name__iexact=self.name)
            if calevel_qs.exists():
                calevel_qs.update(
                    name=self.name,
                    qualification=qualification_name,
                    is_active=self.is_active
                )
            else:
                CALevel.objects.create(
                    name=self.name,
                    qualification=qualification_name,
                    is_active=self.is_active,
                )
        except Exception:
            pass

    def delete(self, *args, **kwargs):
        name = self.name
        super().delete(*args, **kwargs)
        try:
            from master_data.models import CALevel
            CALevel.objects.filter(name__iexact=name).delete()
        except Exception:
            pass

    def __str__(self):
        return self.name

class Level(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='levels')
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=150, blank=True)
    description = models.TextField(blank=True)
    order = models.IntegerField(default=0)
    duration = models.CharField(max_length=100, blank=True, default='')

    class Meta:
        ordering = ['order']

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.course.name} – {self.name}"

class Subject(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='subjects', null=True, blank=True)
    level = models.ForeignKey(Level, on_delete=models.CASCADE, related_name='subjects')
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200, blank=True)
    code = models.CharField(max_length=50, blank=True)
    description = models.TextField(blank=True)
    order = models.IntegerField(default=0)

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

class Topic(models.Model):
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='topics')
    name = models.CharField(max_length=200)
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return self.name

class SubTopic(models.Model):
    topic = models.ForeignKey(Topic, on_delete=models.CASCADE, related_name='subtopics')
    name = models.CharField(max_length=200)
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return self.name


class UpgradePath(models.Model):
    current_level = models.ForeignKey(Level, on_delete=models.CASCADE, related_name='outgoing_paths')
    next_level = models.ForeignKey(Level, on_delete=models.CASCADE, related_name='incoming_paths')
    upgrade_type = models.CharField(max_length=20, default='MANUAL', choices=[('AUTOMATIC', 'Automatic'), ('MANUAL', 'Manual')])
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    button_text = models.CharField(max_length=100, default='Pay & Upgrade')
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.current_level.name} -> {self.next_level.name} ({self.upgrade_type})"


class EligibilityRule(models.Model):
    upgrade_path = models.OneToOneField(UpgradePath, on_delete=models.CASCADE, related_name='eligibility_rule')
    min_score = models.IntegerField(default=0)
    attendance_requirement = models.IntegerField(default=0)
    mock_test_completion = models.BooleanField(default=False)
    assignment_completion = models.BooleanField(default=False)
    manual_approval_required = models.BooleanField(default=False)

    def __str__(self):
        return f"Rule for {self.upgrade_path}"


class StudentProgress(models.Model):
    STATUS_CHOICES = [
        ('IN_PROGRESS', 'In Progress'),
        ('PASSED', 'Passed'),
        ('FAILED', 'Failed')
    ]
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='course_progress')
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    level = models.ForeignKey(Level, on_delete=models.CASCADE)
    completion_percentage = models.IntegerField(default=0)
    progress_data = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=20, default='IN_PROGRESS', choices=STATUS_CHOICES)

    class Meta:
        unique_together = ('user', 'course')

    def __str__(self):
        return f"{self.user.email} - {self.course.name} Level: {self.level.name} ({self.completion_percentage}%)"


class UpgradeRequest(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('FORCED', 'Forced'),
        ('REVERTED', 'Reverted')
    ]
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='upgrade_requests')
    upgrade_path = models.ForeignKey(UpgradePath, on_delete=models.CASCADE)
    status = models.CharField(max_length=20, default='PENDING', choices=STATUS_CHOICES)
    requested_at = models.DateTimeField(auto_now_add=True)
    actioned_at = models.DateTimeField(null=True, blank=True)
    actioned_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='actioned_upgrades')

    def __str__(self):
        return f"{self.user.email} Request: {self.upgrade_path} [{self.status}]"


class NotificationTemplate(models.Model):
    CHANNEL_CHOICES = [
        ('EMAIL', 'Email'),
        ('SMS', 'SMS'),
        ('PUSH', 'Push Notification'),
        ('WHATSAPP', 'WhatsApp')
    ]
    name = models.CharField(max_length=150)
    channel = models.CharField(max_length=20, choices=CHANNEL_CHOICES)
    subject = models.CharField(max_length=255, blank=True, default='')
    body = models.TextField()
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.name} ({self.channel})"


class AuditLog(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=255)
    description = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.action} at {self.created_at} by {self.user}"

