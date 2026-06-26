from django.db import models
from django.utils.text import slugify


class CALevel(models.Model):
    """CA Foundation | CA Intermediate | CA Final"""
    qualification = models.CharField(max_length=50, default='CA', db_index=True)
    name = models.CharField(max_length=120, unique=True)
    slug = models.SlugField(max_length=120, unique=True, blank=True)
    description = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'name']
        verbose_name = 'Course Level'
        verbose_name_plural = 'Course Levels'

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)
        try:
            from courses.models import Category, Course
            category_obj, _ = Category.objects.get_or_create(
                name=self.qualification
            )
            course_qs = Course.objects.filter(name__iexact=self.name)
            if course_qs.exists():
                course_qs.update(
                    name=self.name,
                    category=category_obj,
                    is_active=self.is_active
                )
            else:
                Course.objects.create(
                    name=self.name,
                    category=category_obj,
                    is_active=self.is_active,
                    short_description=f"{self.qualification} Stream - {self.name}",
                )
        except Exception:
            pass

    def delete(self, *args, **kwargs):
        name = self.name
        super().delete(*args, **kwargs)
        try:
            from courses.models import Course
            Course.objects.filter(name__iexact=name).delete()
        except Exception:
            pass

    def __str__(self):
        return self.name


class ICAIPaper(models.Model):
    """Paper 1 - Accounting, Paper 3A - Direct Tax, etc."""
    level = models.ForeignKey(CALevel, on_delete=models.CASCADE, related_name='papers')
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=20, blank=True)
    slug = models.SlugField(max_length=220, blank=True)
    description = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['order', 'name']
        unique_together = [['level', 'name']]
        verbose_name = 'Exam Paper'
        verbose_name_plural = 'Exam Papers'

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(f"{self.level.slug}-{self.name}")[:200]
            self.slug = base
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.level.name} › {self.name}"


class ICAIChapter(models.Model):
    paper = models.ForeignKey(ICAIPaper, on_delete=models.CASCADE, related_name='chapters')
    name = models.CharField(max_length=300)
    slug = models.SlugField(max_length=320, blank=True)
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['order', 'name']
        unique_together = [['paper', 'name']]
        verbose_name = 'Exam Chapter'
        verbose_name_plural = 'Exam Chapters'

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(f"{self.paper.slug}-{self.name}")[:300]
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class ICAITopic(models.Model):
    chapter = models.ForeignKey(ICAIChapter, on_delete=models.CASCADE, related_name='topics')
    name = models.CharField(max_length=300)
    slug = models.SlugField(max_length=320, blank=True)
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['order', 'name']
        unique_together = [['chapter', 'name']]
        verbose_name = 'Exam Topic'
        verbose_name_plural = 'Exam Topics'

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(f"{self.chapter.slug}-{self.name}")[:300]
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

    @property
    def full_path(self):
        p = self.chapter.paper
        return f"{p.level.name} › {p.name} › {self.chapter.name} › {self.name}"
