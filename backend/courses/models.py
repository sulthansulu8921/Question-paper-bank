from django.db import models
from django.utils.text import slugify

class Category(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.name

class Course(models.Model):
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True, related_name='courses')
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200, unique=True, blank=True)
    short_description = models.CharField(max_length=300, blank=True)
    description = models.TextField(blank=True)
    thumbnail = models.URLField(blank=True, null=True)
    banner = models.URLField(blank=True, null=True)
    icon = models.URLField(blank=True, null=True)
    color = models.CharField(max_length=20, default='#4F46E5')
    
    is_premium = models.BooleanField(default=True)
    monthly_price = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    yearly_price = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)
    is_archived = models.BooleanField(default=False)
    duration = models.CharField(max_length=100, blank=True, default='')
    validity_days = models.IntegerField(default=365)

    seo_title = models.CharField(max_length=200, blank=True)
    seo_description = models.TextField(blank=True)
    seo_keywords = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)
        try:
            from master_data.models import CALevel
            qualification_name = self.category.name if self.category else 'CA'
            calevel_qs = CALevel.objects.filter(name=self.name)
            if calevel_qs.exists():
                calevel_qs.update(
                    qualification=qualification_name,
                    is_active=self.is_active
                )
            else:
                CALevel.objects.create(
                    name=self.name,
                    qualification=qualification_name,
                    is_active=self.is_active,
                )
        except Exception:
            pass

    def delete(self, *args, **kwargs):
        name = self.name
        super().delete(*args, **kwargs)
        try:
            from master_data.models import CALevel
            CALevel.objects.filter(name=name).delete()
        except Exception:
            pass

    def __str__(self):
        return self.name

class Level(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='levels')
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=150, blank=True)
    description = models.TextField(blank=True)
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ['order']

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.course.name} – {self.name}"

class Subject(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='subjects', null=True, blank=True)
    level = models.ForeignKey(Level, on_delete=models.CASCADE, related_name='subjects')
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200, blank=True)
    code = models.CharField(max_length=50, blank=True)
    description = models.TextField(blank=True)
    order = models.IntegerField(default=0)

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

class Topic(models.Model):
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='topics')
    name = models.CharField(max_length=200)
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return self.name

class SubTopic(models.Model):
    topic = models.ForeignKey(Topic, on_delete=models.CASCADE, related_name='subtopics')
    name = models.CharField(max_length=200)
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return self.name
