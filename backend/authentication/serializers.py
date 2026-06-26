from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from authentication.models import User, UserSettings, Institution, Batch
from courses.models import Course

class UserSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserSettings
        fields = ['dark_mode', 'email_notifs', 'push_notifs']

class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    settings = UserSettingsSerializer(read_only=True)
    subscription_tier = serializers.SerializerMethodField()
    selected_course = serializers.PrimaryKeyRelatedField(
        queryset=Course.objects.all(),
        required=False,
        allow_null=True
    )
    selected_course_name = serializers.SerializerMethodField()
    selected_course_category = serializers.SerializerMethodField()
    role = serializers.CharField(required=False, default='STUDENT')
    institution = serializers.PrimaryKeyRelatedField(
        queryset=Institution.objects.all(),
        required=False,
        allow_null=True
    )
    institution_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'email', 'mobile_number', 'first_name', 'last_name', 'full_name', 
            'password', 'settings', 'is_staff', 'is_superuser', 'subscription_tier', 
            'date_joined', 'last_login', 'selected_course', 'selected_course_name',
            'selected_course_category', 'role', 'institution', 'institution_name',
            'ai_credits'
        ]
        extra_kwargs = {'password': {'write_only': True}}
    
    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip()

    def get_selected_course_name(self, obj):
        return obj.selected_course.name if obj.selected_course else None

    def get_selected_course_category(self, obj):
        if obj.selected_course and obj.selected_course.category:
            return obj.selected_course.category.name
        return None

    def get_institution_name(self, obj):
        return obj.institution.name if obj.institution else None

    def get_subscription_tier(self, obj):
        from subscriptions.models import UserSubscription
        from django.utils import timezone
        active_sub = UserSubscription.objects.filter(
            user=obj,
            is_active=True,
            end_date__gte=timezone.now()
        ).select_related('plan', 'level', 'subject').first()
        if active_sub:
            details = []
            if active_sub.level:
                details.append(active_sub.level.name)
            if active_sub.plan.scope == 'PAPER_WISE' and active_sub.subject:
                details.append(active_sub.subject.name)
            elif active_sub.plan.scope == 'GROUP_WISE' and active_sub.group:
                details.append(active_sub.group.replace('_', ' ').title())
            
            period = []
            if active_sub.plan.billing_cycle == 'MONTHLY' and active_sub.calendar_month:
                period.append(f"{active_sub.calendar_month}")
            elif active_sub.plan.billing_cycle == 'ATTEMPT_WISE' and active_sub.exam_attempt:
                period.append(f"{active_sub.exam_attempt} Attempt")
            if active_sub.year:
                period.append(str(active_sub.year))
            
            period_str = " ".join(period)
            details_str = " - ".join(details)
            tier_suffix = "Mentor Pass" if active_sub.plan.ai_assistant_access else "Study Pass"
            
            if details_str and period_str:
                return f"{details_str} - {tier_suffix} ({period_str})"
            elif details_str:
                return f"{details_str} - {tier_suffix}"
            return f"{active_sub.plan.name} - {tier_suffix}"
        return "Free Account"


    def validate_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as e:
            raise serializers.ValidationError(list(e.messages))
        return value

    def create(self, validated_data):
        mobile = validated_data.get('mobile_number')
        if mobile is not None:
            mobile = str(mobile).strip()
        user = User.objects.create_user(
            email=validated_data['email'],
            username=validated_data['email'],
            password=validated_data['password'],
            mobile_number=mobile or None,
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            selected_course=validated_data.get('selected_course'),
            role=validated_data.get('role', 'STUDENT'),
            institution=validated_data.get('institution')
        )
        return user

class InstitutionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Institution
        fields = ['id', 'name', 'slug', 'domain', 'logo', 'created_at']

class BatchSerializer(serializers.ModelSerializer):
    course_name = serializers.ReadOnlyField(source='course.name')
    institution_name = serializers.ReadOnlyField(source='institution.name')
    instructors_list = serializers.SerializerMethodField()
    students_list = serializers.SerializerMethodField()

    class Meta:
        model = Batch
        fields = ['id', 'name', 'course', 'course_name', 'institution', 'institution_name', 'instructors', 'instructors_list', 'students', 'students_list', 'created_at']

    def get_instructors_list(self, obj):
        return [{'id': u.id, 'name': u.get_full_name(), 'email': u.email} for u in obj.instructors.all()]

    def get_students_list(self, obj):
        return [{'id': u.id, 'name': u.get_full_name(), 'email': u.email} for u in obj.students.all()]
