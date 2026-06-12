from rest_framework import serializers
from materials.models import (
    QuestionPaper, AnswerPaper, Notes, Video, MCQ, 
    Bookmark, SubjectiveQuestion, Feedback, SubQuestion, QuestionOption
)

def check_is_locked(instance, context):
    request = context.get('request') if context else None
    if not request or not request.user:
        return True
    user = request.user
    if user.is_staff or user.is_superuser:
        return False
        
    is_premium = getattr(instance, 'is_premium', True)
    if not is_premium:
        return False
        
    # Get subject and level
    subject = getattr(instance, 'subject', None)
    level = getattr(instance, 'level', None)
    
    if not subject and hasattr(instance, 'question_paper') and instance.question_paper:
        subject = getattr(instance.question_paper, 'subject', None)
        level = getattr(instance.question_paper, 'level', None)
        
    from subscriptions.permissions import user_has_active_subscription
    return not user_has_active_subscription(user, subject, level)

class QuestionOptionSerializer(serializers.ModelSerializer):
    question = serializers.PrimaryKeyRelatedField(read_only=True)
    sub_question = serializers.PrimaryKeyRelatedField(read_only=True)
    
    class Meta:
        model = QuestionOption
        fields = '__all__'

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        parent = getattr(instance, 'question', None) or (getattr(instance.sub_question, 'parent_question', None) if getattr(instance, 'sub_question', None) else None)
        is_locked = True
        if parent:
            is_locked = check_is_locked(parent, self.context)
        else:
            is_locked = False
            
        if is_locked:
            ret['is_correct'] = False
        return ret

class SubQuestionSerializer(serializers.ModelSerializer):
    options = QuestionOptionSerializer(many=True, required=False)
    parent_question = serializers.PrimaryKeyRelatedField(read_only=True)
    
    option_a = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    option_b = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    option_c = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    option_d = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    mcq_correct_option = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    
    class Meta:
        model = SubQuestion
        fields = '__all__'

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        parent = getattr(instance, 'parent_question', None)
        is_locked = True
        if parent:
            is_locked = check_is_locked(parent, self.context)
        else:
            is_locked = False
            
        if is_locked:
            ret['correct_answer'] = "[LOCKED]"
            ret['mcq_correct_option'] = "[LOCKED]"
        return ret

import re

def parse_mcq_options_helper(question_text, correct_answer_text):
    if not question_text:
        return question_text, []
        
    text = question_text.replace('\r', '')
    
    # Try parenthesized format first: (a) option, (A) option
    options_match = list(re.finditer(r'(?i)\(([a-d])\)\s*(.+?)(?=\s*(?:\([a-d]\)|$))', text, re.DOTALL))
    
    if len(options_match) < 2:
        # Try bracketed format: [a] option, [A] option
        options_match = list(re.finditer(r'(?i)\[([a-d])\]\s*(.+?)(?=\s*(?:\[[a-d]\]|$))', text, re.DOTALL))
        
    if len(options_match) < 2:
        # Try dot format: a. option, A. option
        options_match = list(re.finditer(r'(?i)(?:^|\n)\s*([a-d])\.\s*(.+?)(?=\s*(?:(?:\n\s*[a-d]\.)|$))', text, re.DOTALL))
        
    if len(options_match) >= 2:
        # Check correct answer letter
        correct_letter = None
        if correct_answer_text:
            ans_match = re.search(r'(?i)\b([a-d])\b', correct_answer_text)
            if ans_match:
                correct_letter = ans_match.group(1).upper()
                
        options_list = []
        for idx, match in enumerate(options_match):
            label = match.group(1).upper()
            opt_text = match.group(2).strip()
            
            is_correct = False
            if correct_letter:
                is_correct = (label == correct_letter)
            elif correct_answer_text and correct_answer_text.strip().lower() == opt_text.lower():
                is_correct = True
                
            options_list.append({
                'text': opt_text,
                'is_correct': is_correct,
                'order': idx
            })
            
        # Clean options from text
        first_match_start = options_match[0].start()
        cleaned_text = text[:first_match_start].strip()
        
        # If no option marked correct, check if any option text matches correct answer
        if not any(opt['is_correct'] for opt in options_list) and correct_answer_text:
            for opt in options_list:
                if opt['text'].lower() in correct_answer_text.lower():
                    opt['is_correct'] = True
                    break
                    
        return cleaned_text, options_list
        
    return question_text, []

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
        
        # Auto-parse options from text if MCQ and options_data is empty
        question_text = validated_data.get('question_text', '')
        question_type = validated_data.get('question_type', 'NORMAL')
        correct_answer = validated_data.get('correct_answer', '')
        
        if question_type == 'MCQ' and not options_data:
            cleaned_text, parsed_options = parse_mcq_options_helper(question_text, correct_answer)
            if parsed_options:
                validated_data['question_text'] = cleaned_text
                options_data = parsed_options
        
        question = SubjectiveQuestion.objects.create(**validated_data)
        
        # Handle top-level options
        for opt in options_data:
            QuestionOption.objects.create(question=question, **opt)
            
        # Handle sub-questions and their options
        for part_data in parts_data:
            opt_a = part_data.pop('option_a', None)
            opt_b = part_data.pop('option_b', None)
            opt_c = part_data.pop('option_c', None)
            opt_d = part_data.pop('option_d', None)
            mcq_corr = part_data.pop('mcq_correct_option', None)
            
            part_options = part_data.pop('options', [])
            part_type = part_data.get('question_type', 'NORMAL')
            
            if part_type == 'MCQ' and not part_options:
                if any([opt_a, opt_b, opt_c, opt_d]):
                    opts_to_add = [
                        ('A', opt_a),
                        ('B', opt_b),
                        ('C', opt_c),
                        ('D', opt_d),
                    ]
                    for idx, (label, text) in enumerate(opts_to_add):
                        if text:
                            is_corr = (mcq_corr is not None and mcq_corr.strip().upper() == label)
                            part_options.append({
                                'text': text,
                                'is_correct': is_corr,
                                'order': idx
                            })
                else:
                    part_text = part_data.get('question_text', '')
                    part_ans = part_data.get('correct_answer', '')
                    cleaned_text, parsed_options = parse_mcq_options_helper(part_text, part_ans)
                    if parsed_options:
                        part_data['question_text'] = cleaned_text
                        part_options = parsed_options
                        
            part = SubQuestion.objects.create(parent_question=question, **part_data)
            for p_opt in part_options:
                QuestionOption.objects.create(sub_question=part, **p_opt)
                
        return question

    def update(self, instance, validated_data):
        parts_data = validated_data.pop('parts', [])
        options_data = validated_data.pop('options', [])
        
        # Auto-parse options from text if MCQ and options_data is empty
        question_text = validated_data.get('question_text', instance.question_text)
        question_type = validated_data.get('question_type', instance.question_type)
        correct_answer = validated_data.get('correct_answer', instance.correct_answer)
        
        if question_type == 'MCQ' and not options_data:
            cleaned_text, parsed_options = parse_mcq_options_helper(question_text, correct_answer)
            if parsed_options:
                validated_data['question_text'] = cleaned_text
                options_data = parsed_options
                
        instance = super().update(instance, validated_data)
        
        # Sync top-level options
        instance.options.all().delete()
        for opt in options_data:
            QuestionOption.objects.create(question=instance, **opt)
            
        # Sync parts and their options
        instance.parts.all().delete()
        for part_data in parts_data:
            opt_a = part_data.pop('option_a', None)
            opt_b = part_data.pop('option_b', None)
            opt_c = part_data.pop('option_c', None)
            opt_d = part_data.pop('option_d', None)
            mcq_corr = part_data.pop('mcq_correct_option', None)
            
            part_options = part_data.pop('options', [])
            part_type = part_data.get('question_type', 'NORMAL')
            
            if part_type == 'MCQ' and not part_options:
                if any([opt_a, opt_b, opt_c, opt_d]):
                    opts_to_add = [
                        ('A', opt_a),
                        ('B', opt_b),
                        ('C', opt_c),
                        ('D', opt_d),
                    ]
                    for idx, (label, text) in enumerate(opts_to_add):
                        if text:
                            is_corr = (mcq_corr is not None and mcq_corr.strip().upper() == label)
                            part_options.append({
                                'text': text,
                                'is_correct': is_corr,
                                'order': idx
                            })
                else:
                    part_text = part_data.get('question_text', '')
                    part_ans = part_data.get('correct_answer', '')
                    cleaned_text, parsed_options = parse_mcq_options_helper(part_text, part_ans)
                    if parsed_options:
                        part_data['question_text'] = cleaned_text
                        part_options = parsed_options
                        
            part = SubQuestion.objects.create(parent_question=instance, **part_data)
            for p_opt in part_options:
                QuestionOption.objects.create(sub_question=part, **p_opt)
                
        return instance

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        is_locked = check_is_locked(instance, self.context)
        ret['is_locked'] = is_locked
        if is_locked:
            ret['correct_answer'] = "[LOCKED]"
            ret['pdf_url'] = None
            ret['image_url'] = None
        return ret

class QuestionPaperSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True)

    class Meta:
        model = QuestionPaper
        fields = '__all__'

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        is_locked = check_is_locked(instance, self.context)
        ret['is_locked'] = is_locked
        if is_locked:
            ret['file_url'] = None
            ret['pdf_file'] = None
        return ret

class AnswerPaperSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    question_paper_title = serializers.CharField(source='question_paper.title', read_only=True)

    class Meta:
        model = AnswerPaper
        fields = '__all__'

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        is_locked = check_is_locked(instance, self.context)
        ret['is_locked'] = is_locked
        if is_locked:
            ret['file_url'] = None
            ret['pdf_file'] = None
        return ret

class NotesSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    topic_name = serializers.CharField(source='topic.name', read_only=True)

    class Meta:
        model = Notes
        fields = '__all__'

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        is_locked = check_is_locked(instance, self.context)
        ret['is_locked'] = is_locked
        if is_locked:
            ret['file_url'] = None
            ret['pdf_file'] = None
        return ret

class VideoSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    topic_name = serializers.CharField(source='topic.name', read_only=True)

    class Meta:
        model = Video
        fields = '__all__'

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        is_locked = check_is_locked(instance, self.context)
        ret['is_locked'] = is_locked
        if is_locked:
            ret['file_url'] = None
        return ret

class MCQSerializer(serializers.ModelSerializer):
    class Meta:
        model = MCQ
        fields = '__all__'

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        is_locked = check_is_locked(instance, self.context)
        ret['is_locked'] = is_locked
        if is_locked:
            ret['correct_option'] = "[LOCKED]"
            ret['pdf_file'] = None
        return ret

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
