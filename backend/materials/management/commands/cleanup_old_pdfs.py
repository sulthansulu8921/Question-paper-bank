import os
import time
from django.core.management.base import BaseCommand
from django.conf import settings
from django.utils import timezone
from datetime import timedelta


class Command(BaseCommand):
    help = 'Clean up temporary and uploaded PDF files older than 1 day (24 hours) to save disk space and cloud storage costs.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--days',
            type=int,
            default=1,
            help='Delete PDF files older than this number of days (default: 1 day / 24 hours)'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='List files that would be deleted without actually deleting them'
        )

    def handle(self, *args, **options):
        days = options['days']
        dry_run = options['dry_run']
        cutoff_time = time.time() - (days * 86400)
        
        media_root = getattr(settings, 'MEDIA_ROOT', None)
        if not media_root or not os.path.exists(media_root):
            self.stdout.write(self.style.WARNING(f"MEDIA_ROOT '{media_root}' does not exist or is not configured."))
            return

        target_dirs = [
            os.path.join(media_root, 'question_papers'),
            os.path.join(media_root, 'materials', 'pdfs'),
            os.path.join(media_root, 'temp_uploads'),
            os.path.join(media_root, 'temp'),
        ]

        deleted_count = 0
        total_freed_bytes = 0

        self.stdout.write(self.style.NOTICE(
            f"Scanning for PDF files older than {days} day(s) (Cutoff: {timezone.now() - timedelta(days=days)})..."
        ))

        for target_dir in target_dirs:
            if not os.path.exists(target_dir):
                continue

            for root, _, files in os.walk(target_dir):
                for filename in files:
                    if not filename.lower().endswith('.pdf'):
                        continue

                    file_path = os.path.join(root, filename)
                    try:
                        file_stat = os.stat(file_path)
                        # Check last modified time
                        if file_stat.st_mtime < cutoff_time:
                            size_bytes = file_stat.st_size
                            if dry_run:
                                self.stdout.write(f"[DRY-RUN] Would delete: {file_path} ({(size_bytes / 1024):.1f} KB)")
                            else:
                                os.remove(file_path)
                                self.stdout.write(self.style.SUCCESS(f"Deleted: {file_path} ({(size_bytes / 1024):.1f} KB)"))
                            deleted_count += 1
                            total_freed_bytes += size_bytes
                    except Exception as e:
                        self.stderr.write(self.style.ERROR(f"Error processing {file_path}: {e}"))

        mb_freed = total_freed_bytes / (1024 * 1024)
        if dry_run:
            self.stdout.write(self.style.SUCCESS(
                f"[DRY-RUN COMPLETE] {deleted_count} files would be deleted, freeing {mb_freed:.2f} MB."
            ))
        else:
            self.stdout.write(self.style.SUCCESS(
                f"[CLEANUP COMPLETE] Successfully deleted {deleted_count} old PDF files. Freed {mb_freed:.2f} MB of storage."
            ))
