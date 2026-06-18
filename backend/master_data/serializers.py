from rest_framework import serializers
from master_data.models import CALevel, ICAIPaper, ICAIChapter, ICAITopic


class ICAITopicSerializer(serializers.ModelSerializer):
    chapter_name = serializers.CharField(source='chapter.name', read_only=True)
    paper_name = serializers.CharField(source='chapter.paper.name', read_only=True)
    level_name = serializers.CharField(source='chapter.paper.level.name', read_only=True)
    chapter_id = serializers.IntegerField(source='chapter.id', read_only=True)
    paper_id = serializers.IntegerField(source='chapter.paper.id', read_only=True)
    level_id = serializers.IntegerField(source='chapter.paper.level.id', read_only=True)
    full_path = serializers.CharField(read_only=True)

    class Meta:
        model = ICAITopic
        fields = [
            'id', 'chapter', 'name', 'slug', 'order', 'is_active',
            'chapter_name', 'paper_name', 'level_name',
            'chapter_id', 'paper_id', 'level_id', 'full_path',
        ]


class ICAIChapterSerializer(serializers.ModelSerializer):
    paper_name = serializers.CharField(source='paper.name', read_only=True)
    level_name = serializers.CharField(source='paper.level.name', read_only=True)
    topics = ICAITopicSerializer(many=True, read_only=True)
    topic_count = serializers.SerializerMethodField()

    class Meta:
        model = ICAIChapter
        fields = [
            'id', 'paper', 'name', 'slug', 'order', 'is_active',
            'paper_name', 'level_name', 'topics', 'topic_count',
        ]

    def get_topic_count(self, obj):
        return obj.topics.count()


class ICAIPaperSerializer(serializers.ModelSerializer):
    level_name = serializers.CharField(source='level.name', read_only=True)
    chapters = ICAIChapterSerializer(many=True, read_only=True)
    chapter_count = serializers.SerializerMethodField()

    class Meta:
        model = ICAIPaper
        fields = [
            'id', 'level', 'name', 'code', 'slug', 'description', 'order', 'is_active',
            'level_name', 'chapters', 'chapter_count',
        ]

    def get_chapter_count(self, obj):
        return obj.chapters.count()


class CALevelSerializer(serializers.ModelSerializer):
    papers = ICAIPaperSerializer(many=True, read_only=True)
    paper_count = serializers.SerializerMethodField()

    class Meta:
        model = CALevel
        fields = ['id', 'qualification', 'name', 'slug', 'description', 'order', 'is_active', 'papers', 'paper_count']

    def get_paper_count(self, obj):
        return obj.papers.count()


class CALevelListSerializer(serializers.ModelSerializer):
    paper_count = serializers.IntegerField(read_only=True)
    chapter_count = serializers.IntegerField(read_only=True)
    topic_count = serializers.IntegerField(read_only=True)
    course_id = serializers.SerializerMethodField()

    class Meta:
        model = CALevel
        fields = [
            'id', 'qualification', 'name', 'slug', 'order', 'is_active',
            'paper_count', 'chapter_count', 'topic_count', 'course_id',
        ]

    def get_course_id(self, obj):
        """
        Returns the courses.Course ID that was auto-created when this CALevel was saved.
        Used by the frontend registration form to pass the correct selected_course ID.
        """
        try:
            from courses.models import Course
            course = Course.objects.filter(name=obj.name).first()
            return course.id if course else None
        except Exception:
            return None
