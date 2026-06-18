"""
Management command: python manage.py send_expiry_notifications

Sends email reminders to students whose subscriptions are expiring in 1, 3, or 7 days.
Run this daily via a cron job or Render scheduled job.
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
from datetime import timedelta
from subscriptions.models import UserSubscription, SubscriptionAuditLog


class Command(BaseCommand):
    help = "Send subscription expiry email notifications (1, 7, 15, and 30 days before) and auto-deactivate expired plans."

    def handle(self, *args, **options):
        now = timezone.now()

        # 1. Automatic lockout/deactivation for expired subscriptions
        expired_subs = UserSubscription.objects.filter(is_active=True, end_date__lt=now)
        deactivated_count = 0
        for sub in expired_subs:
            sub.is_active = False
            sub.save()
            SubscriptionAuditLog.objects.create(
                subscription=sub,
                action='SUSPEND',
                notes="Automatically deactivated/locked out due to expiration"
            )
            deactivated_count += 1
        if deactivated_count > 0:
            self.stdout.write(self.style.SUCCESS(f"Deactivated {deactivated_count} expired subscriptions."))

        # 2. Expiry warning notifications
        thresholds = [1, 7, 15, 30]  # days before expiry to notify
        sent_count = 0

        for days in thresholds:
            window_start = now + timedelta(days=days - 1)
            window_end = now + timedelta(days=days)

            expiring_subs = UserSubscription.objects.filter(
                is_active=True,
                end_date__gte=window_start,
                end_date__lt=window_end,
            ).select_related('user', 'plan')

            for sub in expiring_subs:
                user = sub.user
                plan_name = sub.plan.name if sub.plan else 'your plan'
                expiry_str = sub.end_date.strftime('%d %b %Y')

                subject = f"⚠️ Your subscription expires in {days} day{'s' if days > 1 else ''}!"
                message = f"""
Dear {user.first_name or user.email},

This is a reminder that your subscription to "{plan_name}" will expire on {expiry_str} — in {days} day{'s' if days > 1 else ''}.

To continue uninterrupted access to all premium materials, mock tests, and suggested answers, please renew your plan before the expiry date.

👉 Renew now: https://app.qubook.in/dashboard/subscription

If you have already renewed, please disregard this email.

Regards,
The Qubook Team
                """.strip()

                try:
                    send_mail(
                         subject=subject,
                         message=message,
                         from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@qubook.in'),
                         recipient_list=[user.email],
                         fail_silently=False,
                    )
                    sent_count += 1
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"  Sent {days}-day notice to {user.email} (sub #{sub.id}, expires {expiry_str})"
                        )
                    )
                except Exception as e:
                    self.stderr.write(
                        self.style.ERROR(f"  Failed to send to {user.email}: {e}")
                    )

        self.stdout.write(
            self.style.SUCCESS(f"\nDone. Sent {sent_count} notification email(s).")
        )
