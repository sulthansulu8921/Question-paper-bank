from django.contrib import admin
from about.models import TeamMember, GalleryImage, ContactMessage, SiteSettings, NewsletterSubscription

@admin.register(TeamMember)
class TeamMemberAdmin(admin.ModelAdmin):
    list_display = ['name', 'role', 'order', 'is_active']
    list_editable = ['order', 'is_active']
    search_fields = ['name', 'role']

@admin.register(GalleryImage)
class GalleryImageAdmin(admin.ModelAdmin):
    list_display = ['title', 'category', 'uploaded_at', 'is_active']
    list_editable = ['is_active']
    list_filter = ['category']

@admin.register(ContactMessage)
class ContactMessageAdmin(admin.ModelAdmin):
    list_display = ['full_name', 'email', 'subject', 'created_at', 'is_read']
    list_editable = ['is_read']
    readonly_fields = ['full_name', 'email', 'mobile', 'subject', 'message', 'created_at']
    search_fields = ['full_name', 'email', 'subject']

@admin.register(SiteSettings)
class SiteSettingsAdmin(admin.ModelAdmin):
    def has_add_permission(self, request):
        return not SiteSettings.objects.exists()

@admin.register(NewsletterSubscription)
class NewsletterSubscriptionAdmin(admin.ModelAdmin):
    list_display = ['email', 'subscribed_at']
    search_fields = ['email']
