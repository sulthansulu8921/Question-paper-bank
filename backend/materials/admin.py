from django.contrib import admin
from .models import (
    QuestionPaper, AnswerPaper, Notes, Video, MCQ, Bookmark,
    SubjectiveQuestion, Feedback, Scenario, Answer, SubQuestion
)

admin.site.register(QuestionPaper)
admin.site.register(AnswerPaper)
admin.site.register(Notes)
admin.site.register(Video)
admin.site.register(MCQ)
admin.site.register(Bookmark)
admin.site.register(SubjectiveQuestion)
admin.site.register(SubQuestion)
admin.site.register(Scenario)
admin.site.register(Answer)

@admin.register(Feedback)
class FeedbackAdmin(admin.ModelAdmin):
    list_display = ('user', 'material_type', 'material_id', 'is_resolved', 'created_at')
    list_filter = ('is_resolved', 'material_type', 'created_at')
    search_fields = ('user__email', 'message')
    readonly_fields = ('user', 'material_id', 'material_type', 'message', 'created_at')
