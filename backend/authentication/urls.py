from django.urls import path, include
from rest_framework.routers import DefaultRouter
from authentication.views import (
    RegisterView, RegisterRequestOTPView, ProfileView, EmailTokenObtainPairView,
    UserListView, UserDetailView, ChangePasswordView, ForgotPasswordRequestOTPView,
    ForgotPasswordResetView, GoogleAuthView, GrantAdminView,
    UserSuspendView, UserActivateView, UserResetPasswordView,
    InstitutionViewSet, BatchViewSet
)
from rest_framework_simplejwt.views import TokenRefreshView

router = DefaultRouter()
router.register('institutions', InstitutionViewSet, basename='institution')
router.register('batches', BatchViewSet, basename='batch')

urlpatterns = [
    path('', include(router.urls)),
    path('register/', RegisterView.as_view(), name='auth_register'),
    path('register/request-otp/', RegisterRequestOTPView.as_view(), name='register_request_otp'),
    path('login/', EmailTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('login/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('profile/', ProfileView.as_view(), name='auth_profile'),
    path('users/', UserListView.as_view(), name='user_list'),
    path('users/<int:pk>/', UserDetailView.as_view(), name='user_detail'),
    path('users/<int:pk>/suspend/', UserSuspendView.as_view(), name='user_suspend'),
    path('users/<int:pk>/activate/', UserActivateView.as_view(), name='user_activate'),
    path('users/<int:pk>/reset-password/', UserResetPasswordView.as_view(), name='user_reset_password'),
    path('users/grant-admin/', GrantAdminView.as_view(), name='grant_admin'),
    path('change-password/', ChangePasswordView.as_view(), name='change_password'),
    path('forgot-password/request-otp/', ForgotPasswordRequestOTPView.as_view(), name='forgot_password_request_otp'),
    path('forgot-password/reset/', ForgotPasswordResetView.as_view(), name='forgot_password_reset'),
    path('google/', GoogleAuthView.as_view(), name='google_auth'),
]
