from django.core.mail import send_mail
from django.conf import settings
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from authentication.models import User, OTP
from authentication.serializers import UserSerializer
from authentication.permissions import IsSuperUser
from rest_framework.pagination import PageNumberPagination

# ── Custom throttle classes ────────────────────────────────────────────────
class OTPRateThrottle(AnonRateThrottle):
    """Max 5 OTP requests per hour per IP address."""
    rate = '5/hour'
    scope = 'otp'

class LoginRateThrottle(AnonRateThrottle):
    """Max 10 login attempts per hour per IP address."""
    rate = '10/hour'
    scope = 'login'

class UserListPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 200


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        # Support both 'email' and 'username' in the incoming request
        username = attrs.get('email') or attrs.get('username')
        if username:
            attrs[self.username_field] = str(username).strip().lower()
        
        # Validate password & get tokens
        data = super().validate(attrs)
        
        # Generate single-session key
        import uuid
        session_key = str(uuid.uuid4())
        self.user.session_key = session_key
        self.user.save(update_fields=['session_key'])
        
        # Manually generate tokens with the session_key custom claim
        refresh = RefreshToken.for_user(self.user)
        refresh['session_key'] = session_key
        refresh.access_token['session_key'] = session_key
        
        data['refresh'] = str(refresh)
        data['access'] = str(refresh.access_token)
        
        return data

class EmailTokenObtainPairView(TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer
    throttle_classes = [LoginRateThrottle]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.user
        return Response({
            'access': str(serializer.validated_data['access']),
            'refresh': str(serializer.validated_data['refresh']),
            'user': UserSerializer(user).data,
        })

class RegisterRequestOTPView(APIView):
    permission_classes = (permissions.AllowAny,)
    throttle_classes = [OTPRateThrottle]

    def post(self, request):
        from django.utils import timezone
        from datetime import timedelta
        email = request.data.get('email', '').strip().lower()
        if not email:
            return Response({'error': 'Email is required.'}, status=400)
        
        if User.objects.filter(email=email).exists():
            return Response({'error': 'A user with this email already exists.'}, status=400)
        
        # Clean up expired OTPs older than 24h to keep the DB table lean
        OTP.objects.filter(created_at__lt=timezone.now() - timedelta(hours=24)).delete()

        otp = OTP.generate_otp(email, 'REGISTER')
        
        # Send Email
        subject = f"Your Registration OTP: {otp.code}"
        message = f"Hello,\n\nYour one-time password (OTP) for registration is: {otp.code}.\n\nThis OTP is valid for 10 minutes.\n\nBest regards,\nqubook.in Team"
        try:
            send_mail(
                subject,
                message,
                settings.DEFAULT_FROM_EMAIL,
                [email],
                fail_silently=False
            )
        except Exception as e:
            return Response({'error': f"Failed to send email: {str(e)}"}, status=500)
            
        return Response({'message': 'OTP sent successfully to your email.'})

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (permissions.AllowAny,)
    serializer_class = UserSerializer

    def create(self, request, *args, **kwargs):
        email = request.data.get('email', '').strip().lower()
        otp_code = request.data.get('otp', '').strip()
        
        if not otp_code:
            return Response({'error': 'OTP verification code is required.'}, status=400)
            
        # Verify OTP
        otp_record = OTP.objects.filter(
            email=email,
            code=otp_code,
            purpose='REGISTER',
            is_used=False
        ).order_by('-created_at').first()
        
        if not otp_record or otp_record.is_expired():
            return Response({'error': 'Invalid or expired OTP code.'}, status=400)
            
        # Mark OTP as used
        otp_record.is_used = True
        otp_record.save()
        
        response = super().create(request, *args, **kwargs)
        user = User.objects.get(email=response.data['email'])
        
        # Generate single-session key
        import uuid
        session_key = str(uuid.uuid4())
        user.session_key = session_key
        user.save(update_fields=['session_key'])
        
        refresh = RefreshToken.for_user(user)
        refresh['session_key'] = session_key
        refresh.access_token['session_key'] = session_key
        
        return Response({
            'user': response.data,
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        })

class ForgotPasswordRequestOTPView(APIView):
    permission_classes = (permissions.AllowAny,)
    throttle_classes = [OTPRateThrottle]

    def post(self, request):
        from django.utils import timezone
        from datetime import timedelta
        email = request.data.get('email', '').strip().lower()
        if not email:
            return Response({'error': 'Email is required.'}, status=400)
            
        if not User.objects.filter(email=email).exists():
            return Response({'error': 'No account exists with this email address.'}, status=400)

        # Clean up expired OTPs older than 24h
        OTP.objects.filter(created_at__lt=timezone.now() - timedelta(hours=24)).delete()
            
        otp = OTP.generate_otp(email, 'FORGOT_PASSWORD')
        
        # Send Email
        subject = f"Your Password Reset OTP: {otp.code}"
        message = f"Hello,\n\nYour one-time password (OTP) to reset your password is: {otp.code}.\n\nThis OTP is valid for 10 minutes.\n\nBest regards,\nqubook.in Team"
        try:
            send_mail(
                subject,
                message,
                settings.DEFAULT_FROM_EMAIL,
                [email],
                fail_silently=False
            )
        except Exception as e:
            return Response({'error': f"Failed to send email: {str(e)}"}, status=500)
            
        return Response({'message': 'OTP sent successfully to your email.'})

class ForgotPasswordResetView(APIView):
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        email = request.data.get('email', '').strip().lower()
        otp_code = request.data.get('otp', '').strip()
        new_password = request.data.get('password')
        
        if not email or not otp_code or not new_password:
            return Response({'error': 'Email, OTP code, and new password are required.'}, status=400)
            
        # Verify OTP
        otp_record = OTP.objects.filter(
            email=email,
            code=otp_code,
            purpose='FORGOT_PASSWORD',
            is_used=False
        ).order_by('-created_at').first()
        
        if not otp_record or otp_record.is_expired():
            return Response({'error': 'Invalid or expired OTP code.'}, status=400)
            
        # Mark OTP as used
        otp_record.is_used = True
        otp_record.save()
        
        try:
            user = User.objects.get(email=email)
            user.set_password(new_password)
            user.save()
        except User.DoesNotExist:
            return Response({'error': 'User does not exist.'}, status=404)
            
        return Response({'message': 'Password reset successfully. You can now login with your new password.'})

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
        if 'email' in request.data:
            new_email = request.data['email'].strip().lower()
            if new_email and new_email != user.email:
                if User.objects.filter(email=new_email).exclude(id=user.id).exists():
                    return Response({'error': 'A user with this email already exists.'}, status=400)
                user.email = new_email
                user.username = new_email
        if 'mobile_number' in request.data:
            user.mobile_number = request.data['mobile_number']
        
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
    """Admin endpoint to list all users with pagination (50 per page)."""
    queryset = User.objects.all().order_by('-date_joined')
    serializer_class = UserSerializer
    permission_classes = [IsSuperUser]
    pagination_class = UserListPagination


class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Admin endpoint to view/update/delete individual user (e.g., toggle is_staff)."""
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsSuperUser]

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance == request.user:
            return Response(
                {"error": "Administrators cannot delete their own accounts."},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().destroy(request, *args, **kwargs)


class GrantAdminView(APIView):
    """Admin endpoint to grant admin privileges to a user by email."""
    permission_classes = [IsSuperUser]

    def post(self, request):
        email = request.data.get('email', '').strip().lower()
        if not email:
            return Response({'error': 'Email address is required.'}, status=400)
        
        try:
            user = User.objects.get(email=email)
            user.is_staff = True
            user.save()
            return Response({
                'message': f"Admin privileges granted to {email} successfully.",
                'user': UserSerializer(user).data
            })
        except User.DoesNotExist:
            return Response({'error': f"No registered user found with email '{email}'."}, status=404)


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


import requests
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken

class GoogleAuthView(APIView):
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        token = request.data.get('token')
        if not token:
            return Response({'error': 'Google token is required.'}, status=400)

        # Verify Google Token via tokeninfo endpoint
        try:
            google_response = requests.get(
                f"https://oauth2.googleapis.com/tokeninfo?id_token={token}",
                timeout=10
            )
        except Exception as e:
            return Response({'error': f"Failed to reach Google API: {str(e)}"}, status=500)

        if google_response.status_code != 200:
            return Response({'error': 'Invalid Google token.'}, status=400)

        payload = google_response.json()
        email = payload.get('email')
        if not email:
            return Response({'error': 'Email field not returned from Google.'}, status=400)

        email = email.strip().lower()

        # Check if user already exists
        user = User.objects.filter(email=email).first()
        created = False

        if not user:
            # Register user
            given_name = payload.get('given_name', '')
            family_name = payload.get('family_name', '')
            
            # Create user model instance
            from django.utils.crypto import get_random_string
            user = User.objects.create_user(
                email=email,
                username=email,
                first_name=given_name,
                last_name=family_name,
                password=get_random_string(32)
            )
            created = True

        # Generate JWT Tokens
        import uuid
        session_key = str(uuid.uuid4())
        user.session_key = session_key
        user.save(update_fields=['session_key'])

        refresh = RefreshToken.for_user(user)
        refresh['session_key'] = session_key
        refresh.access_token['session_key'] = session_key

        return Response({
            'user': UserSerializer(user).data,
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'created': created
        })
