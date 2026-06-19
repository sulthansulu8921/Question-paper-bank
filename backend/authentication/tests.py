from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from django.core import mail
from django.contrib.auth import get_user_model
from authentication.models import OTP, User
from datetime import timedelta
from django.utils import timezone

class OTPAuthenticationTests(APITestCase):
    def setUp(self):
        self.user_data = {
            'email': 'testuser@example.com',
            'password': 'Password123!',
            'confirm_password': 'Password123!',
            'full_name': 'Test User',
            'mobile_number': '+919999999999'
        }
        self.existing_user = get_user_model().objects.create_user(
            email='existing@example.com',
            username='existing@example.com',
            password='Password123!',
            mobile_number='+918888888888',
            first_name='Existing',
            last_name='User'
        )

    def test_register_request_otp_success(self):
        url = reverse('register_request_otp')
        response = self.client.post(url, {'email': 'newuser@example.com'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('message', response.data)
        
        # Check database
        self.assertTrue(OTP.objects.filter(email='newuser@example.com', purpose='REGISTER').exists())
        # Check email sent
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('Your Registration OTP', mail.outbox[0].subject)

    def test_register_request_otp_duplicate_email(self):
        url = reverse('register_request_otp')
        response = self.client.post(url, {'email': self.existing_user.email}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
        self.assertFalse(OTP.objects.filter(email=self.existing_user.email, purpose='REGISTER').exists())

    def test_register_success_with_valid_otp(self):
        # 1. Request OTP
        request_otp_url = reverse('register_request_otp')
        self.client.post(request_otp_url, {'email': 'newuser@example.com'}, format='json')
        otp_record = OTP.objects.get(email='newuser@example.com', purpose='REGISTER')

        # 2. Register
        register_url = reverse('auth_register')
        payload = {
            'email': 'newuser@example.com',
            'password': 'NewPassword123!',
            'first_name': 'New',
            'last_name': 'User',
            'mobile_number': '+917777777777',
            'otp': otp_record.code
        }
        response = self.client.post(register_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

        # OTP should be marked as used
        otp_record.refresh_from_db()
        self.assertTrue(otp_record.is_used)

        # User should exist in DB
        self.assertTrue(get_user_model().objects.filter(email='newuser@example.com').exists())

    def test_register_fails_with_invalid_otp(self):
        register_url = reverse('auth_register')
        payload = {
            'email': 'newuser@example.com',
            'password': 'NewPassword123!',
            'first_name': 'New',
            'last_name': 'User',
            'mobile_number': '+917777777777',
            'otp': '999999' # Incorrect OTP
        }
        response = self.client.post(register_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
        self.assertFalse(get_user_model().objects.filter(email='newuser@example.com').exists())

    def test_register_fails_with_expired_otp(self):
        # Create an expired OTP in database
        otp_record = OTP.objects.create(
            email='newuser@example.com',
            code='123456',
            purpose='REGISTER'
        )
        # Artificially set created_at back by 11 minutes
        otp_record.created_at = timezone.now() - timedelta(minutes=11)
        otp_record.save()

        register_url = reverse('auth_register')
        payload = {
            'email': 'newuser@example.com',
            'password': 'NewPassword123!',
            'first_name': 'New',
            'last_name': 'User',
            'mobile_number': '+917777777777',
            'otp': '123456'
        }
        response = self.client.post(register_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
        self.assertFalse(get_user_model().objects.filter(email='newuser@example.com').exists())

    def test_forgot_password_request_otp_success(self):
        url = reverse('forgot_password_request_otp')
        response = self.client.post(url, {'email': self.existing_user.email}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('message', response.data)
        
        # Check database
        self.assertTrue(OTP.objects.filter(email=self.existing_user.email, purpose='FORGOT_PASSWORD').exists())
        # Check email sent
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('Your Password Reset OTP', mail.outbox[0].subject)

    def test_forgot_password_request_otp_nonexistent_email(self):
        url = reverse('forgot_password_request_otp')
        response = self.client.post(url, {'email': 'doesnotexist@example.com'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)

    def test_forgot_password_reset_success(self):
        # 1. Request OTP
        request_otp_url = reverse('forgot_password_request_otp')
        self.client.post(request_otp_url, {'email': self.existing_user.email}, format='json')
        otp_record = OTP.objects.get(email=self.existing_user.email, purpose='FORGOT_PASSWORD')

        # 2. Reset password
        reset_url = reverse('forgot_password_reset')
        payload = {
            'email': self.existing_user.email,
            'otp': otp_record.code,
            'password': 'NewSecurePassword99!'
        }
        response = self.client.post(reset_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('message', response.data)

        # Check OTP used
        otp_record.refresh_from_db()
        self.assertTrue(otp_record.is_used)

        # Verify login with new password works
        login_url = reverse('token_obtain_pair')
        login_response = self.client.post(login_url, {
            'email': self.existing_user.email,
            'password': 'NewSecurePassword99!'
        }, format='json')
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        self.assertIn('access', login_response.data)

    def test_forgot_password_reset_fails_invalid_otp(self):
        reset_url = reverse('forgot_password_reset')
        payload = {
            'email': self.existing_user.email,
            'otp': '999999',
            'password': 'NewSecurePassword99!'
        }
        response = self.client.post(reset_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)


class AdminUserManagementTests(APITestCase):
    def setUp(self):
        self.admin_user = get_user_model().objects.create_superuser(
            email='admin@example.com',
            username='admin@example.com',
            password='AdminPassword123!'
        )
        self.normal_user = get_user_model().objects.create_user(
            email='student@example.com',
            username='student@example.com',
            password='StudentPassword123!'
        )

    def test_admin_can_delete_user(self):
        self.client.force_authenticate(user=self.admin_user)
        url = reverse('user_detail', kwargs={'pk': self.normal_user.id})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(get_user_model().objects.filter(id=self.normal_user.id).exists())

    def test_admin_cannot_delete_self(self):
        self.client.force_authenticate(user=self.admin_user)
        url = reverse('user_detail', kwargs={'pk': self.admin_user.id})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['error'], "Administrators cannot delete their own accounts.")
        self.assertTrue(get_user_model().objects.filter(id=self.admin_user.id).exists())

    def test_non_admin_cannot_delete_user(self):
        self.client.force_authenticate(user=self.normal_user)
        url = reverse('user_detail', kwargs={'pk': self.normal_user.id})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_grant_admin_privileges_by_email_success(self):
        self.client.force_authenticate(user=self.admin_user)
        url = reverse('grant_admin')
        response = self.client.post(url, {'email': self.normal_user.email, 'role': 'QUESTION_ADMIN'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.normal_user.refresh_from_db()
        self.assertTrue(self.normal_user.is_staff)
        self.assertEqual(self.normal_user.role, 'QUESTION_ADMIN')

    def test_grant_admin_invalid_role(self):
        self.client.force_authenticate(user=self.admin_user)
        url = reverse('grant_admin')
        response = self.client.post(url, {'email': self.normal_user.email, 'role': 'INVALID_ROLE'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_admin_can_update_user_role(self):
        self.client.force_authenticate(user=self.admin_user)
        # First grant admin role
        self.normal_user.is_staff = True
        self.normal_user.role = 'QUESTION_ADMIN'
        self.normal_user.save()

        url = reverse('user_detail', kwargs={'pk': self.normal_user.id})
        response = self.client.patch(url, {'role': 'COURSE_ADMIN'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.normal_user.refresh_from_db()
        self.assertEqual(self.normal_user.role, 'COURSE_ADMIN')

    def test_grant_admin_non_existent_email(self):
        self.client.force_authenticate(user=self.admin_user)
        url = reverse('grant_admin')
        response = self.client.post(url, {'email': 'nonexistent@example.com'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_grant_admin_invalid_email(self):
        self.client.force_authenticate(user=self.admin_user)
        url = reverse('grant_admin')
        response = self.client.post(url, {'email': ''}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_non_admin_cannot_grant_admin(self):
        self.client.force_authenticate(user=self.normal_user)
        url = reverse('grant_admin')
        response = self.client.post(url, {'email': self.normal_user.email}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class MultiTenantSaaSTests(APITestCase):
    """
    Tests for multi-tenant data isolation.
    All institutions, categories, courses and batches below are generic test fixtures only.
    In production, all such data is created exclusively by admins via the admin panel.
    """
    def setUp(self):
        from authentication.models import Institution, Batch
        from courses.models import Category, Course
        # Generic test institutions — not real data; created by admin in production
        self.inst1 = Institution.objects.create(name="Test Institution A", domain="testa.test")
        self.inst2 = Institution.objects.create(name="Test Institution B", domain="testb.test")

        # Generic test category and course — admin creates these in production
        self.category = Category.objects.create(name="Test Category")
        self.course = Course.objects.create(name="Test Course", category=self.category)

        self.super_admin = get_user_model().objects.create_superuser(
            email='superadmin@test.com', username='superadmin@test.com', password='Password123!', role='SUPER_ADMIN'
        )
        self.inst_admin1 = get_user_model().objects.create_user(
            email='admin1@test.com', username='admin1@test.com', password='Password123!',
            role='INSTITUTION_ADMIN', institution=self.inst1, is_staff=True
        )
        self.inst_admin2 = get_user_model().objects.create_user(
            email='admin2@test.com', username='admin2@test.com', password='Password123!',
            role='INSTITUTION_ADMIN', institution=self.inst2, is_staff=True
        )

        # Generic test batches — admin creates these in production
        self.batch1 = Batch.objects.create(name="Batch A", institution=self.inst1, course=self.course)
        self.batch2 = Batch.objects.create(name="Batch B", institution=self.inst2, course=self.course)

    def test_tenant_isolation_batches(self):
        # Authenticate as Oxford Admin
        self.client.force_authenticate(user=self.inst_admin1)
        url = reverse('batch-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Determine if paginated or flat list
        results = response.data['results'] if 'results' in response.data else response.data
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['name'], "Batch A")

        # Authenticate as Cambridge Admin
        self.client.force_authenticate(user=self.inst_admin2)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        results = response.data['results'] if 'results' in response.data else response.data
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['name'], "Batch B")

    def test_super_admin_sees_all_batches(self):
        self.client.force_authenticate(user=self.super_admin)
        url = reverse('batch-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        results = response.data['results'] if 'results' in response.data else response.data
        self.assertEqual(len(results), 2)

