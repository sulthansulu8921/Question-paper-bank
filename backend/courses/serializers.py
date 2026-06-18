from rest_framework import serializers
from courses.models import (
    Category, Course, Level, Subject, Topic, UpgradePath,
    EligibilityRule, StudentProgress, UpgradeRequest, NotificationTemplate, AuditLog
)

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'

class SubjectSerializer(serializers.ModelSerializer):
    course_name = serializers.CharField(source='course.name', read_only=True)
    level_name = serializers.CharField(source='level.name', read_only=True)
    qualification_name = serializers.CharField(source='course.category.name', read_only=True)

    class Meta:
        model = Subject
        fields = '__all__'

class LevelSerializer(serializers.ModelSerializer):
    subjects = SubjectSerializer(many=True, read_only=True)
    class Meta:
        model = Level
        fields = ['id', 'course', 'name', 'slug', 'description', 'order', 'duration', 'subjects']

class CourseSerializer(serializers.ModelSerializer):
    category_name = serializers.ReadOnlyField(source='category.name')
    levels = LevelSerializer(many=True, read_only=True)
    subjects_count = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = [
            'id', 'name', 'slug', 'short_description', 'description',
            'thumbnail', 'banner', 'icon', 'color',
            'is_premium', 'monthly_price', 'yearly_price', 'is_active',
            'is_archived', 'duration', 'validity_days',
            'seo_title', 'seo_description', 'category', 'category_name', 'levels',
            'subjects_count',
        ]

    def get_subjects_count(self, obj):
        return obj.subjects.count()

class TopicSerializer(serializers.ModelSerializer):
    class Meta:
        model = Topic
        fields = '__all__'

class EligibilityRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = EligibilityRule
        fields = '__all__'

class UpgradePathSerializer(serializers.ModelSerializer):
    eligibility_rule = EligibilityRuleSerializer(read_only=True)
    current_level_name = serializers.CharField(source='current_level.name', read_only=True)
    next_level_name = serializers.CharField(source='next_level.name', read_only=True)
    course_name = serializers.CharField(source='current_level.course.name', read_only=True)

    class Meta:
        model = UpgradePath
        fields = '__all__'

class StudentProgressSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source='user.email', read_only=True)
    course_name = serializers.CharField(source='course.name', read_only=True)
    level_name = serializers.CharField(source='level.name', read_only=True)

    class Meta:
        model = StudentProgress
        fields = '__all__'

class UpgradeRequestSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source='user.email', read_only=True)
    upgrade_path_detail = UpgradePathSerializer(source='upgrade_path', read_only=True)
    actioned_by_email = serializers.CharField(source='actioned_by.email', read_only=True)
    upgrade_path = serializers.PrimaryKeyRelatedField(
        queryset=UpgradePath.objects.all(),
        required=False,
        allow_null=True
    )

    class Meta:
        model = UpgradeRequest
        fields = '__all__'
        read_only_fields = ['user']

class NotificationTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationTemplate
        fields = '__all__'

class AuditLogSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source='user.email', read_only=True)

    class Meta:
        model = AuditLog
        fields = '__all__'
