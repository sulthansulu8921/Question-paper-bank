from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from subscriptions.models import Coupon, SubscriptionPlan

User = get_user_model()

class CouponRestrictionTests(APITestCase):
    def setUp(self):
        # Create test users
        self.user_matched = User.objects.create_user(
            username='user1',
            email='allowed@example.com',
            password='password123'
        )
        self.user_unmatched = User.objects.create_user(
            username='user2',
            email='denied@example.com',
            password='password123'
        )

        # Create subscription plan
        self.plan = SubscriptionPlan.objects.create(
            name='Test Plan',
            price=100.00,
            duration_days=30,
            billing_cycle='MONTHLY'
        )

        # Create coupons
        self.public_coupon = Coupon.objects.create(
            code='PUBLIC10',
            discount_percent=10,
            is_active=True
        )
        self.restricted_coupon = Coupon.objects.create(
            code='RESTRICTED50',
            discount_percent=50,
            restricted_email='allowed@example.com',
            is_active=True
        )

    def test_public_coupon_validation(self):
        """Anyone can validate a public coupon."""
        self.client.force_authenticate(user=self.user_unmatched)
        url = '/api/subscriptions/coupons/validate/'
        response = self.client.post(url, {'code': 'PUBLIC10'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['valid'])
        self.assertEqual(response.data['discount_percent'], 10)

    def test_restricted_coupon_validation_success(self):
        """User with matched email can validate restricted coupon."""
        self.client.force_authenticate(user=self.user_matched)
        url = '/api/subscriptions/coupons/validate/'
        response = self.client.post(url, {'code': 'RESTRICTED50'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['valid'])
        self.assertEqual(response.data['discount_percent'], 50)

    def test_restricted_coupon_validation_failure(self):
        """User with unmatched email cannot validate restricted coupon."""
        self.client.force_authenticate(user=self.user_unmatched)
        url = '/api/subscriptions/coupons/validate/'
        response = self.client.post(url, {'code': 'RESTRICTED50'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['valid'])
        self.assertIn('restricted', response.data['error'])

    def test_checkout_restricted_coupon_success(self):
        """Checkout succeeds if using matched restricted coupon."""
        self.client.force_authenticate(user=self.user_matched)
        url = '/api/subscriptions/my-subscriptions/'
        payload = {
            'plan_id': self.plan.id,
            'coupon_code': 'RESTRICTED50',
            'calendar_month': 'january',
            'year': 2026
        }
        response = self.client.post(url, payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_checkout_restricted_coupon_failure(self):
        """Checkout fails with 400 if using unmatched restricted coupon."""
        self.client.force_authenticate(user=self.user_unmatched)
        url = '/api/subscriptions/my-subscriptions/'
        payload = {
            'plan_id': self.plan.id,
            'coupon_code': 'RESTRICTED50',
            'calendar_month': 'january',
            'year': 2026
        }
        response = self.client.post(url, payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('restricted', response.data['error'])

    def test_monthly_billing_is_exactly_30_days(self):
        """Monthly subscriptions last exactly 30 days and ignore calendar alignment."""
        self.client.force_authenticate(user=self.user_matched)
        url = '/api/subscriptions/my-subscriptions/'
        payload = {
            'plan_id': self.plan.id,
            'calendar_month': 'january',
            'year': 2026
        }
        response = self.client.post(url, payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Check start and end date
        from datetime import timedelta
        from django.utils.dateparse import parse_datetime
        start_date = parse_datetime(response.data['start_date'])
        end_date = parse_datetime(response.data['end_date'])
        self.assertAlmostEqual((end_date - start_date).total_seconds(), timedelta(days=30).total_seconds(), delta=5)

    def test_block_duplicate_active_subscription(self):
        """Cannot purchase another subscription for same target until expired."""
        self.client.force_authenticate(user=self.user_matched)
        url = '/api/subscriptions/my-subscriptions/'
        payload = {
            'plan_id': self.plan.id,
            'calendar_month': 'january',
            'year': 2026
        }
        # First purchase succeeds
        response1 = self.client.post(url, payload)
        self.assertEqual(response1.status_code, status.HTTP_201_CREATED)

        # Second purchase fails because the first is still active
        response2 = self.client.post(url, payload)
        self.assertEqual(response2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('already have an active subscription', response2.data['error'])

    def test_allow_subscription_after_expiration(self):
        """Can purchase/upgrade again after previous subscription has expired."""
        self.client.force_authenticate(user=self.user_matched)
        url = '/api/subscriptions/my-subscriptions/'
        payload = {
            'plan_id': self.plan.id,
            'calendar_month': 'january',
            'year': 2026
        }
        # First purchase
        response1 = self.client.post(url, payload)
        self.assertEqual(response1.status_code, status.HTTP_201_CREATED)

        # Manually expire the first subscription
        from subscriptions.models import UserSubscription
        from django.utils import timezone
        from datetime import timedelta
        sub = UserSubscription.objects.get(id=response1.data['id'])
        sub.end_date = timezone.now() - timedelta(days=1)
        sub.save()

        # Second purchase succeeds now that it is expired
        response2 = self.client.post(url, payload)
        self.assertEqual(response2.status_code, status.HTTP_201_CREATED)

    def test_record_failed_payment(self):
        """Test that the record_failed endpoint correctly creates a FAILED payment entry."""
        from subscriptions.models import PlatformSetting
        PlatformSetting.objects.create(key="ENABLE_GST", value="true")
        self.client.force_authenticate(user=self.user_matched)
        url = '/api/subscriptions/payments/record_failed/'
        payload = {
            'plan_id': self.plan.id,
            'coupon_code': 'PUBLIC10',
            'error_description': 'Signature verification failed',
            'transaction_id': 'pay_test_failed_123'
        }
        response = self.client.post(url, payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Verify Payment object
        from subscriptions.models import Payment
        payment = Payment.objects.get(transaction_id__contains='pay_test_failed_123')
        self.assertEqual(payment.status, 'FAILED')
        self.assertEqual(payment.user, self.user_matched)
        self.assertEqual(payment.plan, self.plan)
        self.assertEqual(float(payment.original_amount), 100.00)
        self.assertEqual(float(payment.discount_amount), 10.00)
        self.assertEqual(float(payment.base_amount), 90.00)
        self.assertEqual(float(payment.gst_amount), 16.20)
        self.assertEqual(float(payment.amount), 106.20)
        self.assertIn('Signature verification failed', payment.transaction_id)

    def test_serializer_is_active_expiration(self):
        """Test that UserSubscriptionSerializer dynamically sets is_active based on end_date."""
        from django.utils import timezone
        from datetime import timedelta
        from subscriptions.models import UserSubscription
        from subscriptions.serializers import UserSubscriptionSerializer

        # Active subscription
        active_sub = UserSubscription.objects.create(
            user=self.user_matched,
            plan=self.plan,
            end_date=timezone.now() + timedelta(days=5),
            is_active=True
        )
        serializer1 = UserSubscriptionSerializer(active_sub)
        self.assertTrue(serializer1.data['is_active'])

        # Expired subscription
        expired_sub = UserSubscription.objects.create(
            user=self.user_matched,
            plan=self.plan,
            end_date=timezone.now() - timedelta(days=5),
            is_active=True
        )
        serializer2 = UserSubscriptionSerializer(expired_sub)
        self.assertFalse(serializer2.data['is_active'])


class SubscriptionPermissionTests(APITestCase):
    def setUp(self):
        self.superuser = User.objects.create_superuser(
            username='super@example.com',
            email='super@example.com',
            password='SuperPassword123!'
        )
        self.staff_user = User.objects.create_user(
            username='staff@example.com',
            email='staff@example.com',
            password='StaffPassword123!',
            is_staff=True
        )
        self.normal_user = User.objects.create_user(
            username='student@example.com',
            email='student@example.com',
            password='StudentPassword123!'
        )
        self.plan = SubscriptionPlan.objects.create(
            name='Test Plan',
            price=100.00,
            duration_days=30,
            billing_cycle='MONTHLY'
        )
        from subscriptions.models import UserSubscription
        from django.utils import timezone
        from datetime import timedelta
        self.subscription = UserSubscription.objects.create(
            user=self.normal_user,
            plan=self.plan,
            end_date=timezone.now() + timedelta(days=30),
            is_active=True
        )

    def test_superuser_can_list_coupons(self):
        self.client.force_authenticate(user=self.superuser)
        url = '/api/subscriptions/coupons/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_staff_cannot_list_coupons(self):
        self.client.force_authenticate(user=self.staff_user)
        url = '/api/subscriptions/coupons/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_superuser_can_extend_subscription(self):
        self.client.force_authenticate(user=self.superuser)
        url = f'/api/subscriptions/my-subscriptions/{self.subscription.id}/extend/'
        response = self.client.post(url, {'days': 10})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_staff_cannot_extend_subscription(self):
        self.client.force_authenticate(user=self.staff_user)
        url = f'/api/subscriptions/my-subscriptions/{self.subscription.id}/extend/'
        response = self.client.post(url, {'days': 10})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class CourseRestrictedCouponAndGstTests(APITestCase):
    def setUp(self):
        from courses.models import Course
        self.superuser = User.objects.create_superuser(
            username='admin_test',
            email='admin@example.com',
            password='password123'
        )
        self.student = User.objects.create_user(
            username='student_test',
            email='student@example.com',
            password='password123'
        )
        # Create courses
        self.course_intermediate = Course.objects.create(name="CA Intermediate", description="Intermediate Course")
        self.course_final = Course.objects.create(name="CA Final", description="Final Course")
        
        # Create Subscription Plans
        self.plan_intermediate = SubscriptionPlan.objects.create(
            name='Intermediate Plan',
            price=100.00,
            duration_days=30,
            billing_cycle='MONTHLY',
            course_specific=self.course_intermediate
        )
        self.plan_final = SubscriptionPlan.objects.create(
            name='Final Plan',
            price=200.00,
            duration_days=30,
            billing_cycle='MONTHLY',
            course_specific=self.course_final
        )
        
        # Create restricted coupon
        self.restricted_coupon = Coupon.objects.create(
            code='INTERONLY',
            discount_percent=50,
            restricted_course=self.course_intermediate,
            is_active=True
        )
        # Create public/global coupon
        self.global_coupon = Coupon.objects.create(
            code='GLOBALALL',
            discount_percent=10,
            is_active=True
        )

    def test_coupon_course_restriction_validation(self):
        self.client.force_authenticate(user=self.student)
        
        # 1. Validation fails if restricted coupon is applied without plan_id
        url = '/api/subscriptions/coupons/validate/'
        response = self.client.post(url, {'code': 'INTERONLY'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['valid'])
        self.assertIn('restricted', response.data['error'])

        # 2. Validation fails if restricted coupon is applied to an unmatched plan_id (Final plan)
        response = self.client.post(url, {'code': 'INTERONLY', 'plan_id': self.plan_final.id})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['valid'])
        self.assertIn('only valid for subscriptions in the course', response.data['error'])

        # 3. Validation succeeds if restricted coupon is applied to matched plan_id (Intermediate plan)
        response = self.client.post(url, {'code': 'INTERONLY', 'plan_id': self.plan_intermediate.id})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['valid'])
        self.assertEqual(response.data['discount_percent'], 50)

        # 4. Validation of global/unrestricted coupon succeeds without plan_id
        response = self.client.post(url, {'code': 'GLOBALALL'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['valid'])

    def test_coupon_course_restriction_checkout(self):
        self.client.force_authenticate(user=self.student)
        url = '/api/subscriptions/my-subscriptions/'
        
        # Checkout fails if using unmatched restricted coupon
        payload = {
            'plan_id': self.plan_final.id,
            'coupon_code': 'INTERONLY',
            'calendar_month': 'january',
            'year': 2026
        }
        response = self.client.post(url, payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('only valid for subscriptions in the course', response.data['error'])

        # Checkout succeeds if using matched restricted coupon
        payload['plan_id'] = self.plan_intermediate.id
        response = self.client.post(url, payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_global_gst_toggle_endpoints_and_checkout_calculation(self):
        from subscriptions.models import PlatformSetting, Payment
        # Verify get_gst_status default (defaults to False in models/views if not exists)
        self.client.force_authenticate(user=self.student)
        url_status = '/api/subscriptions/settings/get_gst_status/'
        response = self.client.get(url_status)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['enabled'])

        # Non-superuser cannot toggle GST status
        url_toggle = '/api/subscriptions/settings/toggle_gst/'
        response = self.client.post(url_toggle, {'enabled': True})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Superuser can toggle GST status to True
        self.client.force_authenticate(user=self.superuser)
        response = self.client.post(url_toggle, {'enabled': True})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['enabled'])

        # Verify status is now True
        self.client.force_authenticate(user=self.student)
        response = self.client.get(url_status)
        self.assertEqual(response.data['enabled'], True)

        # Superuser can toggle GST status to False
        self.client.force_authenticate(user=self.superuser)
        response = self.client.post(url_toggle, {'enabled': False})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['enabled'])

        # Verify status is now False
        self.client.force_authenticate(user=self.student)
        response = self.client.get(url_status)
        self.assertEqual(response.data['enabled'], False)

        # Checkout with GST disabled should have gst_amount = 0.0
        url_checkout = '/api/subscriptions/my-subscriptions/'
        payload = {
            'plan_id': self.plan_final.id,
            'calendar_month': 'january',
            'year': 2026
        }
        response = self.client.post(url_checkout, payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Verify Payment record
        payment = Payment.objects.filter(user=self.student, plan=self.plan_final).order_by('-created_at').first()
        self.assertIsNotNone(payment)
        self.assertEqual(float(payment.gst_amount), 0.0)
        self.assertEqual(float(payment.amount), 200.0)  # No GST added

        # Superuser toggles GST status back to True
        self.client.force_authenticate(user=self.superuser)
        response = self.client.post(url_toggle, {'enabled': True})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['enabled'])

        # Checkout with GST enabled should have gst_amount = 18% of price (18% of 100 = 18.0)
        self.client.force_authenticate(user=self.student)
        payload['plan_id'] = self.plan_intermediate.id
        response = self.client.post(url_checkout, payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Verify Payment record
        payment = Payment.objects.filter(user=self.student, plan=self.plan_intermediate).order_by('-created_at').first()
        self.assertIsNotNone(payment)
        self.assertEqual(float(payment.gst_amount), 18.0)
        self.assertEqual(float(payment.amount), 118.0)  # Base 100 + 18 GST


