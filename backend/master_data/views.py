from django.db.models import Count
from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from master_data.models import CALevel, ICAIPaper, ICAIChapter, ICAITopic
from master_data.serializers import (
    CALevelSerializer, CALevelListSerializer,
    ICAIPaperSerializer, ICAIChapterSerializer, ICAITopicSerializer,
)
from materials.models import SubjectiveQuestion


class IsStaffOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user and request.user.is_staff


class CALevelViewSet(viewsets.ModelViewSet):
    queryset = CALevel.objects.filter(is_active=True)
    permission_classes = [IsStaffOrReadOnly]

    def get_serializer_class(self):
        if self.action == 'list':
            return CALevelListSerializer
        return CALevelSerializer

    def get_queryset(self):
        qs = CALevel.objects.filter(is_active=True).annotate(
            paper_count=Count('papers', distinct=True),
            chapter_count=Count('papers__chapters', distinct=True),
            topic_count=Count('papers__chapters__topics', distinct=True),
        )
        return qs.order_by('order')

    @action(detail=True, methods=['get'])
    def tree(self, request, pk=None):
        level = self.get_object()
        papers = ICAIPaper.objects.filter(level=level, is_active=True).prefetch_related(
            'chapters__topics'
        ).order_by('order')
        return Response({
            'level': CALevelSerializer(level).data,
            'papers': ICAIPaperSerializer(papers, many=True).data,
        })


class ICAIPaperViewSet(viewsets.ModelViewSet):
    queryset = ICAIPaper.objects.filter(is_active=True)
    serializer_class = ICAIPaperSerializer
    permission_classes = [IsStaffOrReadOnly]

    def get_queryset(self):
        qs = ICAIPaper.objects.filter(is_active=True).select_related('level')
        level_id = self.request.query_params.get('level_id')
        if level_id:
            qs = qs.filter(level_id=level_id)
        return qs.order_by('order')


class ICAIChapterViewSet(viewsets.ModelViewSet):
    queryset = ICAIChapter.objects.filter(is_active=True)
    serializer_class = ICAIChapterSerializer
    permission_classes = [IsStaffOrReadOnly]

    def get_queryset(self):
        qs = ICAIChapter.objects.filter(is_active=True).select_related('paper', 'paper__level')
        paper_id = self.request.query_params.get('paper_id')
        level_id = self.request.query_params.get('level_id')
        if paper_id:
            qs = qs.filter(paper_id=paper_id)
        if level_id:
            qs = qs.filter(paper__level_id=level_id)
        return qs.prefetch_related('topics').order_by('order')


class ICAITopicViewSet(viewsets.ModelViewSet):
    queryset = ICAITopic.objects.filter(is_active=True)
    serializer_class = ICAITopicSerializer
    permission_classes = [IsStaffOrReadOnly]

    def get_queryset(self):
        qs = ICAITopic.objects.filter(is_active=True).select_related(
            'chapter', 'chapter__paper', 'chapter__paper__level'
        )
        chapter_id = self.request.query_params.get('chapter_id')
        paper_id = self.request.query_params.get('paper_id')
        level_id = self.request.query_params.get('level_id')
        if chapter_id:
            qs = qs.filter(chapter_id=chapter_id)
        if paper_id:
            qs = qs.filter(chapter__paper_id=paper_id)
        if level_id:
            qs = qs.filter(chapter__paper__level_id=level_id)
        return qs.order_by('order')


class MasterDataTreeView(APIView):
    """Full ICAI hierarchy for admin panel."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        levels = CALevel.objects.filter(is_active=True).order_by('order')
        tree = []
        for level in levels:
            papers_data = []
            for paper in ICAIPaper.objects.filter(level=level, is_active=True).order_by('order'):
                chapters_data = []
                for chapter in ICAIChapter.objects.filter(paper=paper, is_active=True).order_by('order'):
                    topics = list(
                        ICAITopic.objects.filter(chapter=chapter, is_active=True)
                        .order_by('order')
                        .values('id', 'name', 'order')
                    )
                    q_count = SubjectiveQuestion.objects.filter(icai_topic__chapter=chapter).count()
                    chapters_data.append({
                        'id': chapter.id,
                        'name': chapter.name,
                        'order': chapter.order,
                        'topics': topics,
                        'question_count': q_count,
                    })
                papers_data.append({
                    'id': paper.id,
                    'name': paper.name,
                    'code': paper.code,
                    'order': paper.order,
                    'chapters': chapters_data,
                    'chapter_count': len(chapters_data),
                })
            tree.append({
                'id': level.id,
                'name': level.name,
                'slug': level.slug,
                'order': level.order,
                'papers': papers_data,
                'paper_count': len(papers_data),
            })
        return Response(tree)


class MasterDataStatsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({
            'levels': CALevel.objects.filter(is_active=True).count(),
            'papers': ICAIPaper.objects.filter(is_active=True).count(),
            'chapters': ICAIChapter.objects.filter(is_active=True).count(),
            'topics': ICAITopic.objects.filter(is_active=True).count(),
            'questions': SubjectiveQuestion.objects.count(),
        })
