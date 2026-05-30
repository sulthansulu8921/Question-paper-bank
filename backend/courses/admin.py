from django.contrib import admin
from courses.models import Category, Course, Level, Subject, Topic, SubTopic

class LevelInline(admin.TabularInline):
    model = Level
    extra = 1
    fields = ['name', 'slug', 'description', 'order']

class SubjectInline(admin.TabularInline):
    model = Subject
    extra = 1
    fields = ['name', 'slug', 'code', 'description']

@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug', 'category', 'is_active', 'is_premium', 'monthly_price', 'created_at']
    list_editable = ['is_active', 'is_premium']
    list_filter = ['is_active', 'is_premium', 'category']
    search_fields = ['name', 'slug']
    prepopulated_fields = {'slug': ('name',)}
    inlines = [LevelInline]
    fieldsets = (
        ('Basic Info', {'fields': ('name', 'slug', 'category', 'short_description', 'description')}),
        ('Media', {'fields': ('thumbnail', 'banner', 'icon', 'color')}),
        ('Pricing & Access', {'fields': ('is_premium', 'monthly_price', 'yearly_price', 'is_active')}),
        ('SEO', {'fields': ('seo_title', 'seo_description', 'seo_keywords'), 'classes': ('collapse',)}),
    )

@admin.register(Level)
class LevelAdmin(admin.ModelAdmin):
    list_display = ['name', 'course', 'order']
    list_filter = ['course']
    inlines = [SubjectInline]

@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display = ['name', 'level', 'code']
    list_filter = ['level__course']
    search_fields = ['name', 'code']

admin.site.register(Category)
admin.site.register(Topic)
admin.site.register(SubTopic)
