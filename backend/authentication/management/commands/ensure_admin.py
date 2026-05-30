from django.core.management.base import BaseCommand
from authentication.models import User

DEFAULT_EMAIL = 'admin@qbankpro.com'
DEFAULT_PASSWORD = 'Admin@123'


class Command(BaseCommand):
    help = 'Create or reset the QBank Pro admin account with known credentials.'

    def add_arguments(self, parser):
        parser.add_argument('--email', default=DEFAULT_EMAIL)
        parser.add_argument('--password', default=DEFAULT_PASSWORD)

    def handle(self, *args, **options):
        email = options['email'].strip().lower()
        password = options['password']

        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                'username': email,
                'first_name': 'QBank',
                'last_name': 'Admin',
                'is_staff': True,
                'is_superuser': True,
                'is_active': True,
            },
        )

        if not created:
            user.is_staff = True
            user.is_superuser = True
            user.is_active = True

        user.set_password(password)
        user.save()

        action = 'Created' if created else 'Updated'
        self.stdout.write(self.style.SUCCESS(
            f'{action} admin user:\n  Email:    {email}\n  Password: {password}'
        ))
