from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from authentication.models import User
from authentication.serializers import UserSerializer

class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        # Support both 'email' and 'username' in the incoming request
        username = attrs.get('email') or attrs.get('username')
        if username:
            attrs[self.username_field] = str(username).strip().lower()
        return super().validate(attrs)

class EmailTokenObtainPairView(TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.user
        return Response({
            'access': str(serializer.validated_data['access']),
            'refresh': str(serializer.validated_data['refresh']),
            'user': UserSerializer(user).data,
        })

from rest_framework_simplejwt.tokens import RefreshToken

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (permissions.AllowAny,)
    serializer_class = UserSerializer

    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        user = User.objects.get(email=response.data['email'])
        refresh = RefreshToken.for_user(user)
        return Response({
            'user': response.data,
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        })

class ProfileView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        user = request.user
        
        # Extract potential full_name splitting
        if 'full_name' in request.data:
            parts = request.data['full_name'].split(' ')
            user.first_name = parts[0]
            user.last_name = ' '.join(parts[1:])
            
        if 'first_name' in request.data:
            user.first_name = request.data['first_name']
        if 'last_name' in request.data:
            user.last_name = request.data['last_name']
        
        user.save()

        # Update nested settings fields
        settings_data = request.data.get('settings', {})
        if settings_data and hasattr(user, 'settings'):
            if 'dark_mode' in settings_data:
                user.settings.dark_mode = settings_data['dark_mode']
            if 'email_notifs' in settings_data:
                user.settings.email_notifs = settings_data['email_notifs']
            if 'push_notifs' in settings_data:
                user.settings.push_notifs = settings_data['push_notifs']
            user.settings.save()

        serializer = UserSerializer(user)
        return Response(serializer.data)


class UserListView(generics.ListAPIView):
    """Admin endpoint to list all users."""
    queryset = User.objects.all().order_by('-date_joined')
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAdminUser]


class UserDetailView(generics.RetrieveUpdateAPIView):
    """Admin endpoint to view/update individual user (e.g., toggle is_staff)."""
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAdminUser]


class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        old_password = request.data.get('old_password')
        new_password = request.data.get('new_password')
        if not user.check_password(old_password):
            return Response({'error': 'Current password is incorrect.'}, status=400)
        user.set_password(new_password)
        user.save()
        return Response({'status': 'Password changed successfully.'})
