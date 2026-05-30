from rest_framework import viewsets, permissions
from subscriptions.models import SubscriptionPlan, UserSubscription, Payment
from subscriptions.serializers import SubscriptionPlanSerializer, UserSubscriptionSerializer, PaymentSerializer

class SubscriptionPlanViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SubscriptionPlan.objects.all()
    serializer_class = SubscriptionPlanSerializer
    permission_classes = [permissions.AllowAny]

class UserSubscriptionViewSet(viewsets.ModelViewSet):
    serializer_class = UserSubscriptionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if self.request.user and self.request.user.is_staff:
            return UserSubscription.objects.all()
        return UserSubscription.objects.filter(user=self.request.user)

    def create(self, request, *args, **kwargs):
        from rest_framework.response import Response
        from rest_framework import status
        from django.utils import timezone
        from datetime import timedelta
        import uuid

        plan_id = request.data.get('plan_id')
        if not plan_id:
            return Response({'error': 'plan_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            plan = SubscriptionPlan.objects.get(id=plan_id)
        except SubscriptionPlan.DoesNotExist:
            return Response({'error': 'Subscription plan not found'}, status=status.HTTP_404_NOT_FOUND)

        # Deactivate previous active subscriptions for this user
        UserSubscription.objects.filter(user=request.user, is_active=True).update(is_active=False)

        # Create new subscription
        start_date = timezone.now()
        end_date = start_date + timedelta(days=plan.duration_days)
        
        subscription = UserSubscription.objects.create(
            user=request.user,
            plan=plan,
            start_date=start_date,
            end_date=end_date,
            is_active=True
        )

        # Log a mock payment
        Payment.objects.create(
            user=request.user,
            amount=plan.price,
            transaction_id=f"TXN-{uuid.uuid4().hex[:8].upper()}",
            status='SUCCESS'
        )

        serializer = self.get_serializer(subscription)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

class PaymentViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if self.request.user and self.request.user.is_staff:
            return Payment.objects.all()
        return Payment.objects.filter(user=self.request.user)
