from django.db import models
from django.contrib.auth.models import AbstractUser
from django.db.models.signals import post_save
from django.dispatch import receiver

class Institution(models.Model):
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    domain = models.CharField(max_length=255, unique=True, null=True, blank=True)
    logo = models.URLField(max_length=500, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.slug:
            from django.utils.text import slugify
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

class User(AbstractUser):
    ROLE_CHOICES = [
        ('SUPER_ADMIN', 'Super Admin'),
        ('INSTITUTION_ADMIN', 'Institution Admin'),
        ('INSTRUCTOR', 'Instructor'),
        ('STUDENT', 'Student'),
    ]
    mobile_number = models.CharField(max_length=15, unique=True, null=True, blank=True)
    email = models.EmailField(unique=True)
    session_key = models.CharField(max_length=100, null=True, blank=True)
    selected_course = models.ForeignKey('courses.Course', on_delete=models.SET_NULL, null=True, blank=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='STUDENT')
    institution = models.ForeignKey(Institution, on_delete=models.SET_NULL, null=True, blank=True, related_name='users')

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    def __str__(self):
        return self.email


class Batch(models.Model):
    name = models.CharField(max_length=150)
    course = models.ForeignKey('courses.Course', on_delete=models.CASCADE, related_name='batches')
    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name='batches')
    instructors = models.ManyToManyField(User, related_name='assigned_batches', blank=True)
    students = models.ManyToManyField(User, related_name='enrolled_batches', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = 'Batches'

    def __str__(self):
        return f"{self.institution.name} - {self.name} ({self.course.name})"



class UserSettings(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='settings')
    dark_mode = models.BooleanField(default=False)
    email_notifs = models.BooleanField(default=True)
    push_notifs = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.user.email} Settings"

@receiver(post_save, sender=User)
def create_user_settings(sender, instance, created, **kwargs):
    if created:
        UserSettings.objects.create(user=instance)

@receiver(post_save, sender=User)
def save_user_settings(sender, instance, **kwargs):
    if hasattr(instance, 'settings'):
        instance.settings.save()


import random
import string
from django.utils import timezone
from datetime import timedelta

class OTP(models.Model):
    PURPOSE_CHOICES = [
        ('REGISTER', 'Registration'),
        ('FORGOT_PASSWORD', 'Forgot Password'),
    ]
    email = models.EmailField()
    code = models.CharField(max_length=6)
    purpose = models.CharField(max_length=20, choices=PURPOSE_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)
    is_used = models.BooleanField(default=False)

    def is_expired(self):
        # Expires in 10 minutes
        return timezone.now() > self.created_at + timedelta(minutes=10)

    @classmethod
    def generate_otp(cls, email, purpose):
        # Generate 6-digit numeric OTP
        code = "".join(random.choices(string.digits, k=6))
        # Deactivate any previous unused OTPs for this email and purpose
        cls.objects.filter(email=email, purpose=purpose, is_used=False).update(is_used=True)
        # Create new one
        return cls.objects.create(email=email, code=code, purpose=purpose)

    def __str__(self):
        return f"{self.email} - {self.code} ({self.purpose})"
