from rest_framework import serializers
from subscriptions.models import SubscriptionPlan, UserSubscription, Payment, Coupon, PlatformSetting, SubscriptionAuditLog

class SubscriptionPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubscriptionPlan
        fields = '__all__'

class CouponSerializer(serializers.ModelSerializer):
    restricted_course_name = serializers.ReadOnlyField(source='restricted_course.name')
    class Meta:
        model = Coupon
        fields = '__all__'

class PlatformSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlatformSetting
        fields = '__all__'

class UserSubscriptionSerializer(serializers.ModelSerializer):
    user_email = serializers.ReadOnlyField(source='user.email')
    user_name = serializers.SerializerMethodField()
    plan_name = serializers.ReadOnlyField(source='plan.name')
    plan_duration = serializers.ReadOnlyField(source='plan.duration_days')
    plan_billing_cycle = serializers.ReadOnlyField(source='plan.billing_cycle')
    plan_scope = serializers.ReadOnlyField(source='plan.scope')
    course_name = serializers.SerializerMethodField()
    course_id = serializers.SerializerMethodField()
    subject_name = serializers.ReadOnlyField(source='subject.name')
    level_title = serializers.ReadOnlyField(source='level.name')
    is_active = serializers.SerializerMethodField()
    days_remaining = serializers.SerializerMethodField()
    # Linked payment info for the dashboard card
    amount_paid = serializers.SerializerMethodField()
    transaction_id = serializers.SerializerMethodField()
    plan_details = SubscriptionPlanSerializer(source='plan', read_only=True)

    class Meta:
        model = UserSubscription
        fields = [
            'id', 'user', 'user_email', 'user_name', 'plan', 'plan_name',
            'plan_duration', 'plan_billing_cycle', 'plan_scope', 'course_name', 'course_id',
            'start_date', 'end_date', 'is_active', 'days_remaining',
            'level', 'level_title', 'subject', 'subject_name',
            'group', 'calendar_month', 'exam_attempt', 'year',
            'amount_paid', 'transaction_id', 'plan_details', 'order_id',
        ]



    def get_is_active(self, obj):
        from django.utils import timezone
        return obj.is_active and obj.end_date > timezone.now()

    def get_days_remaining(self, obj):
        from django.utils import timezone
        diff = obj.end_date - timezone.now()
        return max(0, diff.days)

    def get_user_name(self, obj):
        if obj.user:
            full_name = f"{obj.user.first_name} {obj.user.last_name}".strip()
            return full_name or obj.user.email.split('@')[0]
        return ""

    def get_course_name(self, obj):
        if obj.plan and obj.plan.course_specific:
            return obj.plan.course_specific.name
        if obj.level and hasattr(obj.level, 'course'):
            try:
                return obj.level.course.name
            except Exception:
                pass
        return ""

    def get_course_id(self, obj):
        if obj.plan and obj.plan.course_specific_id:
            return obj.plan.course_specific_id
        if obj.level and hasattr(obj.level, 'course_id'):
            return obj.level.course_id
        return None


    def get_amount_paid(self, obj):
        # Get the amount from the linked payment
        pay = obj.payment_set.filter(status='SUCCESS').order_by('-created_at').first()
        if pay:
            return str(pay.amount)
        return None

    def get_transaction_id(self, obj):
        pay = obj.payment_set.filter(status='SUCCESS').order_by('-created_at').first()
        if pay:
            return pay.transaction_id
        return None


class PaymentSerializer(serializers.ModelSerializer):
    user_email = serializers.ReadOnlyField(source='user.email')
    user_name = serializers.SerializerMethodField()
    user_mobile = serializers.ReadOnlyField(source='user.mobile_number')
    plan_name = serializers.ReadOnlyField(source='plan.name')
    plan_price = serializers.ReadOnlyField(source='plan.price')
    plan_duration = serializers.ReadOnlyField(source='plan.duration_days')
    subscription_details = UserSubscriptionSerializer(source='subscription', read_only=True)
    expiry_date = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = [
            'id', 'user', 'user_email', 'user_name', 'user_mobile', 'plan', 'plan_name',
            'plan_price', 'plan_duration', 'amount', 'transaction_id', 'order_id', 'status',
            'created_at', 'coupon_code', 'discount_amount', 'original_amount',
            'gst_amount', 'base_amount', 'subscription_details', 'expiry_date'
        ]

    def get_user_name(self, obj):
        if obj.user:
            full_name = f"{obj.user.first_name} {obj.user.last_name}".strip()
            return full_name or obj.user.email.split('@')[0]
        return ""

    def get_expiry_date(self, obj):
        if obj.subscription:
            return obj.subscription.end_date
        return None


class SubscriptionAuditLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()
    subscription_plan_name = serializers.ReadOnlyField(source='subscription.plan.name')
    subscription_user_email = serializers.ReadOnlyField(source='subscription.user.email')

    class Meta:
        model = SubscriptionAuditLog
        fields = [
            'id', 'subscription', 'payment', 'actor', 'actor_name',
            'action', 'notes', 'old_end_date', 'new_end_date',
            'old_status', 'new_status', 'timestamp',
            'subscription_plan_name', 'subscription_user_email',
        ]

    def get_actor_name(self, obj):
        if obj.actor:
            full_name = f"{obj.actor.first_name} {obj.actor.last_name}".strip()
            return full_name or obj.actor.email.split('@')[0]
        return "System"

