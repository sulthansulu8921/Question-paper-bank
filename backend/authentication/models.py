from django.db import models
from django.contrib.auth.models import AbstractUser
from django.db.models.signals import post_save
from django.dispatch import receiver

class User(AbstractUser):
    mobile_number = models.CharField(max_length=15, unique=True, null=True, blank=True)
    email = models.EmailField(unique=True)
    # is_premium shortcut can be tracked dynamically via UserSubscription, but useful for caching maybe
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    def __str__(self):
        return self.email

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
