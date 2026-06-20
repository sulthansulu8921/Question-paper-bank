from django.db import migrations
from django.contrib.auth.hashers import make_password

def seed_admins(apps, schema_editor):
    User = apps.get_model('authentication', 'User')
    
    # 1. Muhammed Shafir Ali Admin
    shafir, created = User.objects.get_or_create(
        email='muhammedshafirali044@gmail.com',
        defaults={
            'username': 'muhammedshafirali044@gmail.com',
            'is_staff': True,
            'is_superuser': True,
            'role': 'SUPER_ADMIN',
            'password': make_password('S S Manzil@044')
        }
    )
    if not created:
        shafir.is_staff = True
        shafir.is_superuser = True
        shafir.role = 'SUPER_ADMIN'
        shafir.password = make_password('S S Manzil@044')
        shafir.save()

    # 2. Sulthan Shafeer Admin
    sulthan, created = User.objects.get_or_create(
        email='sulthanshafeer714@gmail.com',
        defaults={
            'username': 'sulthanshafeer714@gmail.com',
            'is_staff': True,
            'is_superuser': True,
            'role': 'SUPER_ADMIN',
            'password': make_password('Sulthan@714')
        }
    )
    if not created:
        sulthan.is_staff = True
        sulthan.is_superuser = True
        sulthan.role = 'SUPER_ADMIN'
        sulthan.password = make_password('Sulthan@714')
        sulthan.save()

    # 3. Revoke permissions for all other users
    User.objects.exclude(email__in=['muhammedshafirali044@gmail.com', 'sulthanshafeer714@gmail.com']).update(
        is_staff=False,
        is_superuser=False,
        role='STUDENT'
    )

def revoke_admins(apps, schema_editor):
    pass

class Migration(migrations.Migration):

    dependencies = [
        ('authentication', '0007_alter_user_role'),
    ]

    operations = [
        migrations.RunPython(seed_admins, reverse_code=revoke_admins),
    ]
