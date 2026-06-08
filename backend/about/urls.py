from django.urls import path, include
from rest_framework.routers import DefaultRouter
from about.views import TeamMemberViewSet, GalleryImageViewSet, ContactMessageCreateView, SiteSettingsView, NewsletterSubscriptionCreateView

router = DefaultRouter()
router.register(r'team', TeamMemberViewSet)
router.register(r'gallery', GalleryImageViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('contact/', ContactMessageCreateView.as_view(), name='contact_message'),
    path('settings/', SiteSettingsView.as_view(), name='site_settings'),
    path('newsletter/', NewsletterSubscriptionCreateView.as_view(), name='newsletter_subscribe'),
]
