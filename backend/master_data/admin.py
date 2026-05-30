from django.contrib import admin
from master_data.models import CALevel, ICAIPaper, ICAIChapter, ICAITopic


class ICAIPaperInline(admin.TabularInline):
    model = ICAIPaper
    extra = 0


@admin.register(CALevel)
class CALevelAdmin(admin.ModelAdmin):
    list_display = ('name', 'order', 'is_active')
    inlines = [ICAIPaperInline]


class ICAIChapterInline(admin.TabularInline):
    model = ICAIChapter
    extra = 0


@admin.register(ICAIPaper)
class ICAIPaperAdmin(admin.ModelAdmin):
    list_display = ('name', 'level', 'code', 'order')
    list_filter = ('level',)
    inlines = [ICAIChapterInline]


class ICAITopicInline(admin.TabularInline):
    model = ICAITopic
    extra = 0


@admin.register(ICAIChapter)
class ICAIChapterAdmin(admin.ModelAdmin):
    list_display = ('name', 'paper', 'order')
    list_filter = ('paper__level', 'paper')
    inlines = [ICAITopicInline]


@admin.register(ICAITopic)
class ICAITopicAdmin(admin.ModelAdmin):
    list_display = ('name', 'chapter', 'order')
    list_filter = ('chapter__paper__level',)
