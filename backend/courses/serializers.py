from rest_framework import serializers
from courses.models import Category, Course, Level, Subject, Topic

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'

class SubjectSerializer(serializers.ModelSerializer):
    course_name = serializers.CharField(source='course.name', read_only=True)
    level_name = serializers.CharField(source='level.name', read_only=True)

    class Meta:
        model = Subject
        fields = '__all__'

class LevelSerializer(serializers.ModelSerializer):
    subjects = SubjectSerializer(many=True, read_only=True)
    class Meta:
        model = Level
        fields = ['id', 'name', 'slug', 'description', 'order', 'subjects']

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
            'seo_title', 'seo_description', 'category_name', 'levels',
            'subjects_count',
        ]

    def get_subjects_count(self, obj):
        return obj.subjects.count()

class TopicSerializer(serializers.ModelSerializer):
    class Meta:
        model = Topic
        fields = '__all__'
