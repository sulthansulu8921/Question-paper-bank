import uuid
from django.db import models
from courses.models import Course, Subject, Topic, SubTopic
from django.conf import settings


class MaterialBase(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    course = models.ForeignKey(Course, on_delete=models.CASCADE, null=True, blank=True)
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE)
    topic = models.ForeignKey(Topic, on_delete=models.SET_NULL, null=True, blank=True)
    file_url = models.URLField(blank=True, null=True)
    pdf_file = models.FileField(upload_to='materials/pdfs/', blank=True, null=True)
    is_premium = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        abstract = True

    def __str__(self):
        return self.title


class QuestionPaper(MaterialBase):
    year = models.IntegerField(null=True, blank=True)
    marks = models.IntegerField(null=True, blank=True)
    source = models.CharField(max_length=100, blank=True)
    exam_type = models.CharField(max_length=100, blank=True, default='')


class AnswerPaper(MaterialBase):
    question_paper = models.OneToOneField(
        QuestionPaper, on_delete=models.CASCADE,
        related_name='suggested_answer', null=True, blank=True
    )


class Notes(MaterialBase):
    pass


class Video(MaterialBase):
    duration_seconds = models.IntegerField(default=0)


class MCQ(models.Model):
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE)
    topic = models.ForeignKey(Topic, on_delete=models.SET_NULL, null=True, blank=True)
    question_text = models.TextField()
    option_a = models.CharField(max_length=200)
    option_b = models.CharField(max_length=200)
    option_c = models.CharField(max_length=200)
    option_d = models.CharField(max_length=200)
    correct_option = models.CharField(max_length=1, choices=[('A', 'A'), ('B', 'B'), ('C', 'C'), ('D', 'D')])
    pdf_file = models.FileField(upload_to='materials/pdfs/', blank=True, null=True)
    is_premium = models.BooleanField(default=True)


class Bookmark(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    material_id = models.IntegerField()
    material_type = models.CharField(max_length=50)
    created_at = models.DateTimeField(auto_now_add=True)


class Scenario(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    import_batch = models.ForeignKey(
        'ImportBatch', on_delete=models.SET_NULL, null=True, blank=True, related_name='scenarios'
    )
    parent_question = models.ForeignKey(
        'SubjectiveQuestion', on_delete=models.CASCADE, null=True, blank=True, related_name='scenario_records'
    )
    scenario_text = models.TextField(blank=True, default='')
    source_document = models.ForeignKey(
        'SourceDocument', on_delete=models.SET_NULL, null=True, blank=True, related_name='scenarios'
    )
    source_page_start = models.IntegerField(null=True, blank=True)
    source_page_end = models.IntegerField(null=True, blank=True)
    table_data = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Scenario {str(self.id)[:8]} ({len(self.scenario_text)} chars)"

    @property
    def scenario_id(self):
        return self.id


class SubjectiveQuestion(models.Model):
    QUESTION_TYPE_CHOICES = [
        ('MCQ', 'MCQ'),
        ('NORMAL', 'Normal Question'),
        ('MIXED', 'Mixed Question'),
        ('THEORY', 'Theory Question'),
        ('CASE_SCENARIO', 'Case Scenario'),
    ]
    DIFFICULTY_CHOICES = [
        ('EASY', 'Easy'), ('MEDIUM', 'Medium'), ('HARD', 'Hard'), ('NONE', 'No Mention'),
    ]
    STATUS_CHOICES = [
        ('ACTIVE', 'Active'), ('DRAFT', 'Draft'),
        ('ARCHIVED', 'Archived'), ('PUBLISHED', 'Published'),
    ]

    # Legacy course structure (optional)
    subject = models.ForeignKey(
        Subject, on_delete=models.CASCADE,
        related_name='subjective_questions', null=True, blank=True
    )
    topic = models.ForeignKey(
        Topic, on_delete=models.CASCADE,
        related_name='subjective_questions', null=True, blank=True
    )
    sub_topic = models.ForeignKey(
        SubTopic, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='subjective_questions'
    )

    # ICAI master hierarchy (primary)
    icai_topic = models.ForeignKey(
        'master_data.ICAITopic', on_delete=models.CASCADE,
        null=True, blank=True, related_name='questions'
    )

    source = models.CharField(max_length=100)
    attempt = models.CharField(max_length=50, default='MAY')
    year = models.CharField(max_length=10)
    section = models.CharField(max_length=10, blank=True, null=True)
    q_no = models.CharField(max_length=20)

    question_type = models.CharField(max_length=15, choices=QUESTION_TYPE_CHOICES, default='NORMAL')
    marks = models.IntegerField(default=1)
    difficulty = models.CharField(max_length=20, choices=DIFFICULTY_CHOICES, default='MEDIUM')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    is_important = models.BooleanField(default=False)

    question_text = models.TextField(blank=True, default='')
    case_scenario_passage = models.TextField(blank=True, default='')
    correct_answer = models.TextField(blank=True, null=True)
    table_data = models.TextField(blank=True, null=True)
    formula_data = models.TextField(blank=True, null=True)
    answer_table_data = models.TextField(blank=True, null=True)
    # Parent-child and scenario relationships
    scenario = models.ForeignKey(
        Scenario, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='questions'
    )
    parent_question = models.ForeignKey(
        'self', on_delete=models.CASCADE,
        null=True, blank=True, related_name='child_questions'
    )
    original_question_number = models.CharField(max_length=50, blank=True, default='')
    sub_question_number = models.CharField(max_length=50, blank=True, default='')
    source_document = models.ForeignKey(
        'SourceDocument', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='questions'
    )
    chapter = models.ForeignKey(
        'master_data.ICAIChapter', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='questions'
    )

    pdf_url = models.URLField(blank=True, null=True)
    image_url = models.URLField(blank=True, null=True)
    tags = models.TextField(blank=True, null=True)
    explanation = models.TextField(blank=True, default='')
    related_concept = models.TextField(blank=True, default='')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='created_questions'
    )
    institution = models.ForeignKey(
        'authentication.Institution', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='subjective_questions'
    )
    is_platform_wide = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['topic__order', 'id']
        indexes = [
            models.Index(fields=['status'], name='question_status_idx'),
            models.Index(fields=['difficulty'], name='question_difficulty_idx'),
            models.Index(fields=['question_type'], name='question_type_idx'),
            models.Index(fields=['icai_topic'], name='question_icai_topic_idx'),
            models.Index(fields=['topic'], name='question_topic_idx'),
            models.Index(fields=['subject'], name='question_subject_idx'),
            models.Index(fields=['created_at'], name='question_created_at_idx'),
        ]


    def __str__(self):
        return f"{self.source} | {self.attempt} {self.year} | Q{self.q_no}"

    def save(self, *args, **kwargs):
        # Auto-resolve legacy Subject and Topic based on ICAI Topic
        if self.icai_topic_id:
            try:
                from courses.models import Subject, Topic
                paper_name = self.icai_topic.chapter.paper.name.lower()
                chapter_name = self.icai_topic.chapter.name

                subj = None
                if "advanced accounting" in paper_name or "accounting" in paper_name:
                    if "cost" in paper_name:
                        subj = Subject.objects.filter(id=4).first()
                    else:
                        subj = Subject.objects.filter(id=1).first()
                elif "corporate and other laws" in paper_name or "business laws" in paper_name:
                    subj = Subject.objects.filter(id=2).first()
                elif "direct tax" in paper_name or "goods and service tax" in paper_name or "gst" in paper_name or "taxation" in paper_name:
                    subj = Subject.objects.filter(id=3).first()
                elif "cost" in paper_name or "management accounting" in paper_name:
                    subj = Subject.objects.filter(id=4).first()
                elif "auditing" in paper_name:
                    subj = Subject.objects.filter(id=5).first()
                elif "financial management" in paper_name or "strategic management" in paper_name or "fm" in paper_name or "sm" in paper_name:
                    subj = Subject.objects.filter(id=6).first()

                if subj:
                    self.subject = subj
                    # Automatically find or create a Topic matching the ICAI Chapter name under this Subject
                    topic, _ = Topic.objects.get_or_create(
                        subject=subj,
                        name=chapter_name
                    )
                    self.topic = topic
            except Exception as e:
                # Fail-safe print to avoid interrupting DB saves
                print("Error auto-resolving legacy subject/topic in save():", e)

        super().save(*args, **kwargs)

    @property
    def icai_path(self):
        if not self.icai_topic_id:
            return None
        return self.icai_topic.full_path

    @property
    def question_id(self):
        return self.id


class SubQuestion(models.Model):
    TYPE_CHOICES = [('NORMAL', 'Theory'), ('MCQ', 'MCQ')]

    parent_question = models.ForeignKey(SubjectiveQuestion, on_delete=models.CASCADE, related_name='parts')
    scenario = models.ForeignKey(
        Scenario, on_delete=models.SET_NULL, null=True, blank=True, related_name='sub_questions'
    )
    original_question_number = models.CharField(max_length=50, blank=True, default='')
    sub_question_number = models.CharField(max_length=50, blank=True, default='')
    source_document = models.ForeignKey(
        'SourceDocument', on_delete=models.SET_NULL, null=True, blank=True, related_name='sub_questions'
    )
    matching_status = models.CharField(max_length=50, default='matched')
    identifier = models.CharField(max_length=50, blank=True)
    question_text = models.TextField()
    question_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='NORMAL')
    correct_answer = models.TextField(blank=True, null=True)
    table_data = models.TextField(blank=True, null=True)
    formula_data = models.TextField(blank=True, null=True)
    answer_table_data = models.TextField(blank=True, null=True)
    marks = models.IntegerField(default=1)
    image_url = models.URLField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['identifier']

    def __str__(self):
        return f"Part {self.identifier} of Q{self.parent_question.q_no}"


class Answer(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    question = models.ForeignKey(
        SubjectiveQuestion, on_delete=models.CASCADE, related_name='answer_records'
    )
    sub_question = models.ForeignKey(
        SubQuestion, on_delete=models.CASCADE, null=True, blank=True, related_name='answer_records'
    )
    answer_content = models.TextField(blank=True, default='')
    answer_source_document = models.ForeignKey(
        'SourceDocument', on_delete=models.SET_NULL, null=True, blank=True, related_name='answers'
    )
    answer_source_page = models.IntegerField(null=True, blank=True)
    matching_status = models.CharField(max_length=50, default='matched')  # 'matched', 'needs_review', 'unmatched'
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Answer for Q{self.question_id} ({self.matching_status})"

    @property
    def answer_id(self):
        return self.id


class QuestionOption(models.Model):
    question = models.ForeignKey(
        SubjectiveQuestion, on_delete=models.CASCADE,
        related_name='options', null=True, blank=True
    )
    sub_question = models.ForeignKey(
        SubQuestion, on_delete=models.CASCADE,
        related_name='options', null=True, blank=True
    )
    text = models.TextField()
    is_correct = models.BooleanField(default=False)
    order = models.IntegerField(default=0)
    image_url = models.URLField(blank=True, null=True)

    class Meta:
        ordering = ['order']


class Feedback(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    material_id = models.IntegerField()
    material_type = models.CharField(max_length=50)
    message = models.TextField()
    is_resolved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Feedback by {self.user.email} on {self.material_type} #{self.material_id}"


class VideoProgress(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    video = models.ForeignKey('Video', on_delete=models.CASCADE)
    last_position_seconds = models.IntegerField(default=0)
    completion_percentage = models.IntegerField(default=0)
    is_completed = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'video')

    def __str__(self):
        return f"{self.user.email} - {self.video.title} ({self.completion_percentage}%)"


class MaterialDownload(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    material_title = models.CharField(max_length=200)
    material_type = models.CharField(max_length=50) # 'paper', 'notes'
    downloaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.email} downloaded {self.material_title} ({self.material_type})"


class LiveClass(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    course = models.ForeignKey('courses.Course', on_delete=models.CASCADE, null=True, blank=True)
    level = models.ForeignKey('courses.Level', on_delete=models.CASCADE, null=True, blank=True)
    subject = models.ForeignKey('courses.Subject', on_delete=models.CASCADE, null=True, blank=True)
    scheduled_time = models.DateTimeField()
    duration_minutes = models.IntegerField(default=60)
    meeting_platform = models.CharField(max_length=50, choices=[('ZOOM', 'Zoom'), ('MEET', 'Google Meet'), ('JITSI', 'Jitsi Meet')])
    meeting_link = models.URLField()
    recording_link = models.URLField(blank=True, null=True)
    status = models.CharField(max_length=20, default='SCHEDULED', choices=[('SCHEDULED', 'Scheduled'), ('LIVE', 'Live'), ('ENDED', 'Ended')])
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Live: {self.title} ({self.status})"


class Notification(models.Model):
    title = models.CharField(max_length=200)
    message = models.TextField()
    target_audience = models.CharField(max_length=50, choices=[('ALL', 'All Students'), ('COURSE', 'Course-wise'), ('SELECTED', 'Selected Students')])
    target_course = models.ForeignKey('courses.Course', on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


class AssessmentSession(models.Model):
    SESSION_TYPE_CHOICES = [
        ('PRACTICE', 'Practice Session'),
        ('MOCK', 'Mock Test'),
    ]
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='assessment_sessions')
    session_type = models.CharField(max_length=20, choices=SESSION_TYPE_CHOICES, default='PRACTICE')
    
    # Metadata for custom/templates
    title = models.CharField(max_length=200, blank=True)
    qualification = models.CharField(max_length=100, blank=True)
    course_level = models.CharField(max_length=100, blank=True)
    subject = models.CharField(max_length=200, blank=True)
    chapter = models.CharField(max_length=200, blank=True)
    topic = models.CharField(max_length=200, blank=True)
    
    # Configuration settings
    total_questions = models.IntegerField(default=10)
    difficulty = models.CharField(max_length=20, default='MIXED')
    mode = models.CharField(max_length=20, default='LEARNING') # LEARNING or CHALLENGE
    
    # Performance
    score = models.IntegerField(default=0)
    max_score = models.IntegerField(default=0)
    accuracy = models.FloatField(default=0.0) # percentage
    duration_seconds = models.IntegerField(default=0) # time taken
    
    is_completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.email} - {self.session_type} - {self.score}/{self.max_score} ({self.accuracy}%)"


class AssessmentAnswer(models.Model):
    session = models.ForeignKey(AssessmentSession, on_delete=models.CASCADE, related_name='answers')
    question = models.ForeignKey(SubjectiveQuestion, on_delete=models.CASCADE)
    selected_option = models.ForeignKey(QuestionOption, on_delete=models.SET_NULL, null=True, blank=True)
    typed_answer = models.TextField(blank=True, default='')
    is_correct = models.BooleanField(default=False)
    score_obtained = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Q{self.question.id} in Session {self.session.id} - Correct: {self.is_correct}"


class MockTestTemplate(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, default='')
    qualification = models.CharField(max_length=100)
    course_level = models.CharField(max_length=100, blank=True, default='')
    duration_minutes = models.IntegerField(default=60)
    total_questions = models.IntegerField(default=50)
    difficulty = models.CharField(max_length=20, default='MIXED')
    is_published = models.BooleanField(default=True)
    questions = models.ManyToManyField(SubjectiveQuestion, blank=True, related_name='mock_templates')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


class ImportBatch(models.Model):
    STATUS_CHOICES = [
        ('uploaded', 'Uploaded'),
        ('processing', 'Processing Documents'),
        ('extracted', 'Extracted'),
        ('needs_review', 'Needs Review'),
        ('approved', 'Approved'),
        ('published', 'Published to Question Bank'),
        ('failed', 'Processing Failed'),
        ('cancelled', 'Cancelled'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, default='AI Import Batch')
    ca_level = models.CharField(max_length=50, blank=True, default='CA Intermediate')
    level = models.ForeignKey('master_data.CALevel', null=True, blank=True, on_delete=models.SET_NULL, related_name='import_batches')
    paper = models.ForeignKey('master_data.ICAIPaper', null=True, blank=True, on_delete=models.SET_NULL, related_name='import_batches')
    chapter = models.ForeignKey('master_data.ICAIChapter', null=True, blank=True, on_delete=models.SET_NULL, related_name='import_batches')
    topic = models.ForeignKey('master_data.ICAITopic', null=True, blank=True, on_delete=models.SET_NULL, related_name='import_batches')

    exam_session = models.CharField(max_length=50, blank=True, default='August 2026')
    exam_year = models.IntegerField(null=True, blank=True, default=2026)
    source = models.CharField(max_length=150, blank=True, default='Mock Test Paper – Series II')

    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='uploaded', db_index=True)
    stage_label = models.CharField(max_length=150, default='Batch uploaded - Ready to process')
    progress_percent = models.IntegerField(default=0)
    error_message = models.TextField(null=True, blank=True)

    total_documents = models.IntegerField(default=0)
    total_questions_detected = models.IntegerField(default=0)
    matched_answers_count = models.IntegerField(default=0)
    missing_answers_count = models.IntegerField(default=0)
    tables_count = models.IntegerField(default=0)
    mcqs_count = models.IntegerField(default=0)
    duplicate_candidates_count = models.IntegerField(default=0)
    low_confidence_count = models.IntegerField(default=0)
    published_questions_count = models.IntegerField(default=0)

    batch_payload = models.JSONField(default=dict, blank=True)

    ai_provider = models.CharField(max_length=50, default='gemini')
    model_used = models.CharField(max_length=100, blank=True, default='gemini-3.5-flash')
    total_input_tokens = models.IntegerField(default=0)
    total_output_tokens = models.IntegerField(default=0)
    estimated_cost_usd = models.FloatField(default=0.0)
    processing_time_seconds = models.FloatField(default=0.0)

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='import_batches')
    institution = models.ForeignKey('authentication.Institution', on_delete=models.SET_NULL, null=True, blank=True, related_name='import_batches')
    is_platform_wide = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Import Batch {self.name} ({self.status})"


class QuestionImportJob(models.Model):
    STATUS_CHOICES = [
        ('uploaded', 'Uploaded'),
        ('extracting', 'Extracting Text & Tables'),
        ('parsing_questions', 'Parsing Question Paper'),
        ('parsing_answers', 'Parsing Answer Paper'),
        ('matching', 'Matching Questions with Answers'),
        ('validating', 'Validating Structure & Marks'),
        ('review_required', 'Ready for Review'),
        ('needs_review', 'Needs Review'),
        ('approved', 'Approved'),
        ('published', 'Published to Question Bank'),
        ('failed', 'Processing Failed'),
        ('cancelled', 'Cancelled'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    batch = models.ForeignKey(ImportBatch, on_delete=models.SET_NULL, null=True, blank=True, related_name='jobs')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='import_jobs')
    institution = models.ForeignKey('authentication.Institution', on_delete=models.SET_NULL, null=True, blank=True, related_name='import_jobs')
    is_platform_wide = models.BooleanField(default=True)

    # Uploaded PDFs
    question_pdf = models.FileField(upload_to='materials/import_jobs/question_pdfs/')
    answer_pdf = models.FileField(upload_to='materials/import_jobs/answer_pdfs/', null=True, blank=True)
    question_pdf_filename = models.CharField(max_length=255, blank=True)
    answer_pdf_filename = models.CharField(max_length=255, blank=True)

    # Processing state
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='uploaded', db_index=True)
    stage_label = models.CharField(max_length=150, default='Uploaded - Ready to process')
    progress_percent = models.IntegerField(default=0)
    error_message = models.TextField(null=True, blank=True)

    # Academic & Paper Target Metadata
    ca_level = models.CharField(max_length=50, blank=True, default='CA Intermediate')
    level = models.ForeignKey('master_data.CALevel', null=True, blank=True, on_delete=models.SET_NULL, related_name='import_jobs')
    paper = models.ForeignKey('master_data.ICAIPaper', null=True, blank=True, on_delete=models.SET_NULL, related_name='import_jobs')
    chapter = models.ForeignKey('master_data.ICAIChapter', null=True, blank=True, on_delete=models.SET_NULL, related_name='import_jobs')
    topic = models.ForeignKey('master_data.ICAITopic', null=True, blank=True, on_delete=models.SET_NULL, related_name='import_jobs')

    exam_session = models.CharField(max_length=50, blank=True, default='July 2026')
    exam_year = models.IntegerField(null=True, blank=True, default=2026)
    exam_date = models.CharField(max_length=50, blank=True, default='')
    source = models.CharField(max_length=150, blank=True, default='Mock Test Paper – Series I')
    maximum_marks = models.IntegerField(default=100)
    duration_minutes = models.IntegerField(default=180)

    # AI Model & Extraction Metadata
    extracted_metadata = models.JSONField(default=dict, blank=True)
    extracted_payload = models.JSONField(default=dict, blank=True)

    ai_provider = models.CharField(max_length=50, default='gemini')
    model_used = models.CharField(max_length=100, blank=True, default='')
    total_input_tokens = models.IntegerField(default=0)
    total_output_tokens = models.IntegerField(default=0)
    estimated_cost_usd = models.FloatField(default=0.0)
    processing_time_seconds = models.FloatField(default=0.0)

    published_question_count = models.IntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Import Job {str(self.id)[:8]} - {self.source} ({self.status})"


class SourceDocument(models.Model):
    FILE_TYPE_CHOICES = [
        ('QUESTION_PAPER', 'Question Paper'),
        ('SUGGESTED_ANSWER', 'Suggested Answer'),
        ('COMBINED', 'Combined Question & Answer'),
        ('UNKNOWN', 'Unclassified / Other'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    batch = models.ForeignKey(ImportBatch, on_delete=models.CASCADE, null=True, blank=True, related_name='documents')
    job = models.ForeignKey(QuestionImportJob, on_delete=models.CASCADE, null=True, blank=True, related_name='documents')
    institution = models.ForeignKey('authentication.Institution', on_delete=models.SET_NULL, null=True, blank=True, related_name='source_documents')
    file = models.FileField(upload_to='materials/import_batches/documents/')
    filename = models.CharField(max_length=255)
    file_hash = models.CharField(max_length=64, db_index=True)
    file_type = models.CharField(max_length=30, choices=FILE_TYPE_CHOICES, default='UNKNOWN')
    inferred_type = models.CharField(max_length=30, choices=FILE_TYPE_CHOICES, default='UNKNOWN')
    page_count = models.IntegerField(default=0)
    file_size_bytes = models.BigIntegerField(default=0)
    status = models.CharField(max_length=30, default='uploaded')
    extracted_text = models.TextField(blank=True, default='')
    extracted_metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.filename} ({self.file_type})"


class ImportAuditLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    batch = models.ForeignKey(ImportBatch, on_delete=models.CASCADE, null=True, blank=True, related_name='audit_logs')
    job = models.ForeignKey(QuestionImportJob, on_delete=models.CASCADE, null=True, blank=True, related_name='audit_logs')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=50)
    question_reference = models.CharField(max_length=100, blank=True, default='')
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.action} on {self.question_reference or 'batch'} by {self.user}"




