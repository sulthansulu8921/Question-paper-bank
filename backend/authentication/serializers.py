from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from authentication.models import User, UserSettings

class UserSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserSettings
        fields = ['dark_mode', 'email_notifs', 'push_notifs']

class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    settings = UserSettingsSerializer(read_only=True)
    subscription_tier = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'email', 'mobile_number', 'first_name', 'last_name', 'full_name', 'password', 'settings', 'is_staff', 'subscription_tier']
        extra_kwargs = {'password': {'write_only': True}}
    
    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip()

    def get_subscription_tier(self, obj):
        from subscriptions.models import UserSubscription
        from django.utils import timezone
        active_sub = UserSubscription.objects.filter(
            user=obj,
            is_active=True,
            end_date__gte=timezone.now()
        ).first()
        if active_sub:
            return active_sub.plan.name
        return "Free Account"

    def validate_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as e:
            raise serializers.ValidationError(list(e.messages))
        return value

    def create(self, validated_data):
        user = User.objects.create_user(
            email=validated_data['email'],
            username=validated_data['email'],
            password=validated_data['password'],
            mobile_number=validated_data.get('mobile_number', ''),
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', '')
        )
        return user
