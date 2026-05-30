from rest_framework import viewsets, generics, permissions
from rest_framework.response import Response
from about.models import TeamMember, GalleryImage, ContactMessage, SiteSettings
from about.serializers import TeamMemberSerializer, GalleryImageSerializer, ContactMessageSerializer, SiteSettingsSerializer

class TeamMemberViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = TeamMember.objects.filter(is_active=True)
    serializer_class = TeamMemberSerializer
    permission_classes = [permissions.AllowAny]

class GalleryImageViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = GalleryImage.objects.filter(is_active=True)
    serializer_class = GalleryImageSerializer
    permission_classes = [permissions.AllowAny]
    filterset_fields = ['category']

class ContactMessageCreateView(generics.CreateAPIView):
    queryset = ContactMessage.objects.all()
    serializer_class = ContactMessageSerializer
    permission_classes = [permissions.AllowAny]

class SiteSettingsView(generics.RetrieveAPIView):
    serializer_class = SiteSettingsSerializer
    permission_classes = [permissions.AllowAny]

    def get_object(self):
        obj, _ = SiteSettings.objects.get_or_create(pk=1)
        return obj
