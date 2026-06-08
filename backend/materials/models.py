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


class SubjectiveQuestion(models.Model):
    QUESTION_TYPE_CHOICES = [
        ('MCQ', 'MCQ'),
        ('NORMAL', 'Normal Question'),
        ('MIXED', 'Mixed Question'),
        ('THEORY', 'Theory Question'),
        ('CASE_SCENARIO', 'Case Scenario'),
    ]
    DIFFICULTY_CHOICES = [
        ('EASY', 'Easy'), ('MEDIUM', 'Medium'), ('HARD', 'Hard'),
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
        'master_data.ICAITopic', on_delete=models.SET_NULL,
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

    pdf_url = models.URLField(blank=True, null=True)
    image_url = models.URLField(blank=True, null=True)
    tags = models.TextField(blank=True, null=True)
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


class SubQuestion(models.Model):
    TYPE_CHOICES = [('NORMAL', 'Theory'), ('MCQ', 'MCQ')]

    parent_question = models.ForeignKey(SubjectiveQuestion, on_delete=models.CASCADE, related_name='parts')
    identifier = models.CharField(max_length=10, blank=True)
    question_text = models.TextField()
    question_type = models.CharField(max_length=10, choices=TYPE_CHOICES, default='NORMAL')
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
