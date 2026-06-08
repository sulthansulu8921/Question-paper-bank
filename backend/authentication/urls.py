from django.urls import path
from authentication.views import (
    RegisterView, RegisterRequestOTPView, ProfileView, EmailTokenObtainPairView,
    UserListView, UserDetailView, ChangePasswordView, ForgotPasswordRequestOTPView,
    ForgotPasswordResetView, GoogleAuthView, GrantAdminView
)
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path('register/', RegisterView.as_view(), name='auth_register'),
    path('register/request-otp/', RegisterRequestOTPView.as_view(), name='register_request_otp'),
    path('login/', EmailTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('login/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('profile/', ProfileView.as_view(), name='auth_profile'),
    path('users/', UserListView.as_view(), name='user_list'),
    path('users/<int:pk>/', UserDetailView.as_view(), name='user_detail'),
    path('users/grant-admin/', GrantAdminView.as_view(), name='grant_admin'),
    path('change-password/', ChangePasswordView.as_view(), name='change_password'),
    path('forgot-password/request-otp/', ForgotPasswordRequestOTPView.as_view(), name='forgot_password_request_otp'),
    path('forgot-password/reset/', ForgotPasswordResetView.as_view(), name='forgot_password_reset'),
    path('google/', GoogleAuthView.as_view(), name='google_auth'),
]
