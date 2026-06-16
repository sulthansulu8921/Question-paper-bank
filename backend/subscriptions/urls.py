from django.urls import path, include
from rest_framework.routers import DefaultRouter
from subscriptions.views import SubscriptionPlanViewSet, UserSubscriptionViewSet, PaymentViewSet, CouponViewSet, PlatformSettingViewSet

router = DefaultRouter()
router.register(r'plans', SubscriptionPlanViewSet)
router.register(r'my-subscriptions', UserSubscriptionViewSet, basename='user-subscriptions')
router.register(r'payments', PaymentViewSet, basename='user-payments')
router.register(r'coupons', CouponViewSet, basename='coupons')
router.register(r'settings', PlatformSettingViewSet, basename='settings')

urlpatterns = [
    path('', include(router.urls)),
]

