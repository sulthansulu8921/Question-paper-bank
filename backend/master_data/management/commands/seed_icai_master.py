from django.core.management.base import BaseCommand
from django.db import transaction
from master_data.models import CALevel, ICAIPaper, ICAIChapter, ICAITopic
from master_data.icai_seed_data import ICAI_MASTER, DEFAULT_TOPICS


class Command(BaseCommand):
    help = 'Seed complete ICAI CA master database (Levels, Papers, Chapters, Topics)'

    def add_arguments(self, parser):
        parser.add_argument('--reset', action='store_true', help='Delete existing ICAI master data before seeding')

    @transaction.atomic
    def handle(self, *args, **options):
        if options['reset']:
            ICAITopic.objects.all().delete()
            ICAIChapter.objects.all().delete()
            ICAIPaper.objects.all().delete()
            CALevel.objects.all().delete()
            self.stdout.write(self.style.WARNING('Cleared existing ICAI master data.'))

        level_count = paper_count = chapter_count = topic_count = 0

        for level_data in ICAI_MASTER:
            level, _ = CALevel.objects.update_or_create(
                name=level_data['name'],
                defaults={'order': level_data['order'], 'is_active': True},
            )
            level_count += 1

            for paper_data in level_data['papers']:
                paper, _ = ICAIPaper.objects.update_or_create(
                    level=level,
                    name=paper_data['name'],
                    defaults={
                        'code': paper_data.get('code', ''),
                        'order': paper_data['order'],
                        'is_active': True,
                    },
                )
                paper_count += 1

                for ch_order, chapter_name in enumerate(paper_data['chapters'], start=1):
                    chapter, _ = ICAIChapter.objects.update_or_create(
                        paper=paper,
                        name=chapter_name,
                        defaults={'order': ch_order, 'is_active': True},
                    )
                    chapter_count += 1

                    for t_order, topic_name in enumerate(DEFAULT_TOPICS, start=1):
                        _, created = ICAITopic.objects.update_or_create(
                            chapter=chapter,
                            name=topic_name,
                            defaults={'order': t_order, 'is_active': True},
                        )
                        if created:
                            topic_count += 1
                        else:
                            topic_count += 1

        self.stdout.write(self.style.SUCCESS(
            f'ICAI Master seeded: {level_count} levels, {paper_count} papers, '
            f'{chapter_count} chapters, {topic_count} topics'
        ))
