from rest_framework import serializers
from materials.models import (
    QuestionPaper, AnswerPaper, Notes, Video, MCQ, 
    Bookmark, SubjectiveQuestion, Feedback, SubQuestion, QuestionOption
)

class QuestionOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionOption
        fields = '__all__'

class SubQuestionSerializer(serializers.ModelSerializer):
    options = QuestionOptionSerializer(many=True, required=False)
    
    class Meta:
        model = SubQuestion
        fields = '__all__'

class SubjectiveQuestionSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True, allow_null=True)
    topic_name = serializers.CharField(source='topic.name', read_only=True, allow_null=True)
    sub_topic_name = serializers.CharField(source='sub_topic.name', read_only=True, allow_null=True)
    icai_path = serializers.CharField(read_only=True, allow_null=True)
    icai_topic_name = serializers.CharField(source='icai_topic.name', read_only=True, allow_null=True)
    icai_chapter_name = serializers.CharField(source='icai_topic.chapter.name', read_only=True, allow_null=True)
    icai_paper_name = serializers.CharField(source='icai_topic.chapter.paper.name', read_only=True, allow_null=True)
    icai_level_name = serializers.CharField(source='icai_topic.chapter.paper.level.name', read_only=True, allow_null=True)
    parts = SubQuestionSerializer(many=True, required=False)
    options = QuestionOptionSerializer(many=True, required=False)

    class Meta:
        model = SubjectiveQuestion
        fields = '__all__'

    def create(self, validated_data):
        parts_data = validated_data.pop('parts', [])
        options_data = validated_data.pop('options', [])
        
        question = SubjectiveQuestion.objects.create(**validated_data)
        
        # Handle top-level options
        for opt in options_data:
            QuestionOption.objects.create(question=question, **opt)
            
        # Handle sub-questions and their options
        for part_data in parts_data:
            part_options = part_data.pop('options', [])
            part = SubQuestion.objects.create(parent_question=question, **part_data)
            for p_opt in part_options:
                QuestionOption.objects.create(sub_question=part, **p_opt)
                
        return question

    def update(self, instance, validated_data):
        parts_data = validated_data.pop('parts', [])
        options_data = validated_data.pop('options', [])
        
        instance = super().update(instance, validated_data)
        
        # Sync top-level options
        instance.options.all().delete()
        for opt in options_data:
            QuestionOption.objects.create(question=instance, **opt)
            
        # Sync parts and their options
        instance.parts.all().delete()
        for part_data in parts_data:
            part_options = part_data.pop('options', [])
            part = SubQuestion.objects.create(parent_question=instance, **part_data)
            for p_opt in part_options:
                QuestionOption.objects.create(sub_question=part, **p_opt)
                
        return instance

class QuestionPaperSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True)

    class Meta:
        model = QuestionPaper
        fields = '__all__'

class AnswerPaperSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    question_paper_title = serializers.CharField(source='question_paper.title', read_only=True)

    class Meta:
        model = AnswerPaper
        fields = '__all__'

class NotesSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notes
        fields = '__all__'

class VideoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Video
        fields = '__all__'

class MCQSerializer(serializers.ModelSerializer):
    class Meta:
        model = MCQ
        fields = '__all__'

class BookmarkSerializer(serializers.ModelSerializer):
    class Meta:
        model = Bookmark
        fields = '__all__'
        read_only_fields = ('user',)

class FeedbackSerializer(serializers.ModelSerializer):
    class Meta:
        model = Feedback
        fields = '__all__'
        read_only_fields = ('user',)
