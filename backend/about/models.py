from django.db import models

class TeamMember(models.Model):
    name = models.CharField(max_length=150)
    role = models.CharField(max_length=100)
    image = models.URLField(blank=True, null=True)
    description = models.TextField(blank=True)
    social_links = models.JSONField(default=dict, blank=True)  # {"linkedin": "", "twitter": ""}
    order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.name} — {self.role}"


class GalleryImage(models.Model):
    title = models.CharField(max_length=200, blank=True)
    image = models.URLField()
    category = models.CharField(max_length=100, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['-uploaded_at']

    def __str__(self):
        return self.title or "Gallery Image"


class ContactMessage(models.Model):
    full_name = models.CharField(max_length=150)
    email = models.EmailField()
    mobile = models.CharField(max_length=20, blank=True)
    subject = models.CharField(max_length=200)
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.full_name}: {self.subject}"


class SiteSettings(models.Model):
    """Singleton model for editable site-wide settings."""
    contact_email = models.EmailField(default='support@studypartner.in')
    contact_phone = models.CharField(max_length=20, blank=True)
    whatsapp_number = models.CharField(max_length=20, blank=True)
    office_address = models.TextField(blank=True)
    support_hours = models.CharField(max_length=100, default='Mon–Sat, 9am–6pm IST')
    google_maps_embed_url = models.URLField(blank=True)
    about_intro = models.TextField(blank=True)

    class Meta:
        verbose_name = "Site Settings"

    def __str__(self):
        return "Site Settings"
