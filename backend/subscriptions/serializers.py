from rest_framework import serializers
from subscriptions.models import SubscriptionPlan, UserSubscription, Payment, Coupon

class SubscriptionPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubscriptionPlan
        fields = '__all__'

class CouponSerializer(serializers.ModelSerializer):
    class Meta:
        model = Coupon
        fields = '__all__'

class UserSubscriptionSerializer(serializers.ModelSerializer):
    user_email = serializers.ReadOnlyField(source='user.email')
    plan_name = serializers.ReadOnlyField(source='plan.name')
    subject_name = serializers.ReadOnlyField(source='subject.name')
    level_title = serializers.ReadOnlyField(source='level.name')
    is_active = serializers.SerializerMethodField()

    class Meta:
        model = UserSubscription
        fields = [
            'id', 'user', 'user_email', 'plan', 'plan_name', 
            'start_date', 'end_date', 'is_active',
            'level', 'level_title', 'subject', 'subject_name', 
            'group', 'calendar_month', 'exam_attempt', 'year'
        ]

    def get_is_active(self, obj):
        from django.utils import timezone
        return obj.is_active and obj.end_date > timezone.now()

class PaymentSerializer(serializers.ModelSerializer):
    user_email = serializers.ReadOnlyField(source='user.email')
    user_name = serializers.SerializerMethodField()
    user_mobile = serializers.ReadOnlyField(source='user.mobile_number')
    plan_name = serializers.ReadOnlyField(source='plan.name')
    plan_price = serializers.ReadOnlyField(source='plan.price')
    plan_duration = serializers.ReadOnlyField(source='plan.duration_days')

    class Meta:
        model = Payment
        fields = [
            'id', 'user', 'user_email', 'user_name', 'user_mobile', 'plan', 'plan_name',
            'plan_price', 'plan_duration', 'amount', 'transaction_id', 'status',
            'created_at', 'coupon_code', 'discount_amount', 'original_amount',
            'gst_amount', 'base_amount'
        ]

    def get_user_name(self, obj):
        if obj.user:
            full_name = f"{obj.user.first_name} {obj.user.last_name}".strip()
            return full_name or obj.user.email.split('@')[0]
        return ""

