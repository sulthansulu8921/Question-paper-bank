from django.urls import path, include
from rest_framework.routers import DefaultRouter
from subscriptions.views import SubscriptionPlanViewSet, UserSubscriptionViewSet, PaymentViewSet

router = DefaultRouter()
router.register(r'plans', SubscriptionPlanViewSet)
router.register(r'my-subscriptions', UserSubscriptionViewSet, basename='user-subscriptions')
router.register(r'payments', PaymentViewSet, basename='user-payments')

urlpatterns = [
    path('', include(router.urls)),
]
