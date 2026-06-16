from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.conf import settings
from django.http import HttpResponse
from datetime import timedelta, datetime
import uuid
import os
import razorpay
from calendar import monthrange

# ReportLab imports for invoice generation
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

from subscriptions.models import SubscriptionPlan, UserSubscription, Payment, Coupon, PlatformSetting
from subscriptions.serializers import SubscriptionPlanSerializer, UserSubscriptionSerializer, PaymentSerializer, CouponSerializer, PlatformSettingSerializer
from authentication.permissions import IsSuperUser

def is_gst_enabled():
    try:
        setting = PlatformSetting.objects.get(key="ENABLE_GST")
        return setting.value.lower() == "true"
    except PlatformSetting.DoesNotExist:
        return True

# Safe Razorpay configuration
RAZORPAY_KEY_ID = getattr(settings, 'RAZORPAY_KEY_ID', 'rzp_test_placeholder_key')
RAZORPAY_KEY_SECRET = getattr(settings, 'RAZORPAY_KEY_SECRET', 'placeholder_secret')
is_sandbox = (RAZORPAY_KEY_ID == 'rzp_test_placeholder_key')

class SubscriptionPlanViewSet(viewsets.ModelViewSet):
    queryset = SubscriptionPlan.objects.all().order_by('id')
    serializer_class = SubscriptionPlanSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), permissions.IsAdminUser()]
        return [permissions.AllowAny()]

class CouponViewSet(viewsets.ModelViewSet):
    queryset = Coupon.objects.all().order_by('-created_at')
    serializer_class = CouponSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'list', 'retrieve']:
            return [permissions.IsAuthenticated(), IsSuperUser()]
        return [permissions.IsAuthenticated()]

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def validate(self, request):
        code = request.data.get('code')
        plan_id = request.data.get('plan_id')
        if not code:
            return Response({'valid': False, 'error': 'Code is required'}, status=400)
        
        try:
            coupon = Coupon.objects.get(code__iexact=code.strip(), is_active=True)
            if coupon.restricted_email and coupon.restricted_email.strip().lower() != request.user.email.strip().lower():
                return Response({'valid': False, 'error': 'This coupon code is restricted to a different email address.'}, status=200)
            
            if coupon.restricted_course_id:
                if not plan_id:
                    return Response({'valid': False, 'error': 'This coupon is restricted to a specific course subscription.'}, status=200)
                try:
                    plan = SubscriptionPlan.objects.get(id=plan_id)
                    if plan.course_specific_id != coupon.restricted_course_id:
                        return Response({
                            'valid': False, 
                            'error': f'This coupon is only valid for subscriptions in the course "{coupon.restricted_course.name}".'
                        }, status=200)
                except SubscriptionPlan.DoesNotExist:
                    return Response({'valid': False, 'error': 'Selected subscription plan not found.'}, status=200)

            return Response({
                'valid': True,
                'code': coupon.code,
                'discount_percent': coupon.discount_percent
            })
        except Coupon.DoesNotExist:
            return Response({'valid': False, 'error': 'Invalid or expired coupon code'}, status=200)

class UserSubscriptionViewSet(viewsets.ModelViewSet):
    serializer_class = UserSubscriptionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if self.request.user and (self.request.user.is_staff or self.request.user.is_superuser):
            return UserSubscription.objects.all().order_by('-start_date')
        return UserSubscription.objects.filter(user=self.request.user).order_by('-start_date')

    def create(self, request, *args, **kwargs):
        plan_id = request.data.get('plan_id')
        coupon_code = request.data.get('coupon_code')
        level_id = request.data.get('level_id')
        subject_id = request.data.get('subject_id')
        group = request.data.get('group')
        calendar_month = request.data.get('calendar_month')
        exam_attempt = request.data.get('exam_attempt')
        year = request.data.get('year')

        if not plan_id:
            return Response({'error': 'plan_id is required'}, status=400)

        try:
            plan = SubscriptionPlan.objects.get(id=plan_id)
        except SubscriptionPlan.DoesNotExist:
            return Response({'error': 'Plan not found'}, status=404)

        # 1. Coupon validation if coupon_code is provided
        discount_percent = 0
        discount_amount = 0.0
        if coupon_code:
            try:
                coupon = Coupon.objects.get(code__iexact=coupon_code.strip(), is_active=True)
                if coupon.restricted_email and coupon.restricted_email.strip().lower() != request.user.email.strip().lower():
                    return Response({'error': 'This coupon code is restricted to a different email address.'}, status=400)
                if coupon.restricted_course_id and plan.course_specific_id != coupon.restricted_course_id:
                    return Response({'error': f'This coupon is only valid for subscriptions in the course "{coupon.restricted_course.name}".'}, status=400)
                discount_percent = coupon.discount_percent
                discount_amount = round((float(plan.price) * discount_percent) / 100, 2)
            except Coupon.DoesNotExist:
                return Response({'error': 'Invalid or inactive coupon'}, status=400)

        # 2. Block duplicate active subscription
        existing_active = UserSubscription.objects.filter(
            user=request.user,
            plan=plan,
            is_active=True,
            end_date__gt=timezone.now()
        )
        if level_id:
            existing_active = existing_active.filter(level_id=level_id)
        if subject_id:
            existing_active = existing_active.filter(subject_id=subject_id)
        elif group:
            existing_active = existing_active.filter(group=group)

        if existing_active.exists():
            return Response({'error': 'You already have an active subscription for this target plan.'}, status=400)

        # 3. Calculate start and end date
        start_date = timezone.now()
        end_date = start_date + timedelta(days=plan.duration_days)
        year_val = int(year) if year else start_date.year

        months_map = {
            'january': 1, 'february': 2, 'march': 3, 'april': 4, 'may': 5, 'june': 6,
            'july': 7, 'august': 8, 'september': 9, 'october': 10, 'november': 11, 'december': 12,
            'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
            'jul': 7, 'aug': 8, 'sep': 9, 'sept': 9, 'oct': 10, 'nov': 11, 'dec': 12
        }

        if plan.billing_cycle == 'ATTEMPT_WISE' and exam_attempt:
            attempt_name = exam_attempt.strip().lower()
            if attempt_name in months_map:
                month_num = months_map[attempt_name]
                last_day = monthrange(year_val, month_num)[1]
                end_date = datetime(year_val, month_num, last_day, 23, 59, 59, tzinfo=timezone.get_current_timezone())
                if end_date <= start_date:
                    year_val += 1
                    last_day = monthrange(year_val, month_num)[1]
                    end_date = datetime(year_val, month_num, last_day, 23, 59, 59, tzinfo=timezone.get_current_timezone())

        # Create subscription
        subscription = UserSubscription.objects.create(
            user=request.user,
            plan=plan,
            start_date=start_date,
            end_date=end_date,
            is_active=True,
            level_id=level_id,
            subject_id=subject_id,
            group=group,
            calendar_month=calendar_month,
            exam_attempt=exam_attempt,
            year=year_val
        )

        # Create payment
        subtotal = max(0.0, float(plan.price) - discount_amount)
        gst_amount = round(subtotal * 0.18, 2) if is_gst_enabled() else 0.0
        total_amount = round(subtotal + gst_amount, 2)

        Payment.objects.create(
            user=request.user,
            plan=plan,
            amount=total_amount,
            base_amount=subtotal,
            gst_amount=gst_amount,
            transaction_id=f"TXN-{uuid.uuid4().hex[:8].upper()}",
            status='SUCCESS',
            coupon_code=coupon_code.strip() if coupon_code else None,
            discount_amount=discount_amount,
            original_amount=plan.price
        )

        serializer = self.get_serializer(subscription)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def notifications(self, request):
        active_subs = UserSubscription.objects.filter(
            user=request.user,
            is_active=True,
            end_date__gte=timezone.now()
        )
        
        alerts = []
        for sub in active_subs:
            # calculate days remaining
            diff = sub.end_date - timezone.now()
            days_left = max(0, diff.days)
            
            if days_left == 0:
                alerts.append({
                    'id': f"alert-today-{sub.id}",
                    'type': 'DANGER',
                    'title': 'Subscription Expires Today',
                    'message': f"Your premium access to '{sub.plan.name}' expires today. Renew now to avoid losing access to study materials.",
                    'days_left': 0
                })
            elif days_left <= 3:
                alerts.append({
                    'id': f"alert-3day-{sub.id}",
                    'type': 'WARNING',
                    'title': 'Subscription Expiring in 3 Days',
                    'message': f"Your subscription '{sub.plan.name}' will expire in {days_left} days. Upgrade or renew now to continue learning without interruption.",
                    'days_left': days_left
                })
            elif days_left <= 7:
                alerts.append({
                    'id': f"alert-7day-{sub.id}",
                    'type': 'WARNING',
                    'title': 'Subscription Expiring Soon',
                    'message': f"Your subscription '{sub.plan.name}' will expire in {days_left} days. Plan your renewal ahead.",
                    'days_left': days_left
                })
            elif days_left <= 15:
                alerts.append({
                    'id': f"alert-15day-{sub.id}",
                    'type': 'INFO',
                    'title': 'Subscription Expiry Notice',
                    'message': f"Your subscription '{sub.plan.name}' has {days_left} days left of active premium access.",
                    'days_left': days_left
                })
                
        return Response(alerts)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsSuperUser])
    def extend(self, request, pk=None):
        sub = self.get_object()
        days = request.data.get('days')
        if not days:
            return Response({'error': 'days is required'}, status=400)
        try:
            days = int(days)
        except ValueError:
            return Response({'error': 'days must be an integer'}, status=400)

        sub.end_date = sub.end_date + timedelta(days=days)
        sub.is_active = True
        sub.save()
        return Response(UserSubscriptionSerializer(sub).data)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsSuperUser])
    def suspend(self, request, pk=None):
        sub = self.get_object()
        sub.is_active = False
        sub.save()
        return Response(UserSubscriptionSerializer(sub).data)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsSuperUser])
    def activate(self, request, pk=None):
        sub = self.get_object()
        sub.is_active = True
        if sub.end_date <= timezone.now():
            sub.end_date = timezone.now() + timedelta(days=30)
        sub.save()
        return Response(UserSubscriptionSerializer(sub).data)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsSuperUser])
    def refund(self, request, pk=None):
        sub = self.get_object()
        sub.is_active = False
        sub.save()

        # Find and invalidate payment
        payment = Payment.objects.filter(user=sub.user, plan=sub.plan, status='SUCCESS').order_by('-created_at').first()
        if payment:
            payment.status = 'FAILED'
            payment.save()
            
        return Response(UserSubscriptionSerializer(sub).data)

class PaymentViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = PaymentSerializer

    def get_queryset(self):
        if self.request.user and self.request.user.is_superuser and self.request.query_params.get('all') == 'true':
            return Payment.objects.all().order_by('-created_at')
        return Payment.objects.filter(user=self.request.user).order_by('-created_at')

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def record_failed(self, request):
        plan_id = request.data.get('plan_id')
        transaction_id = request.data.get('transaction_id')
        coupon_code = request.data.get('coupon_code')
        error_description = request.data.get('error_description')

        if not plan_id:
            return Response({'error': 'plan_id is required'}, status=400)

        try:
            plan = SubscriptionPlan.objects.get(id=plan_id)
        except SubscriptionPlan.DoesNotExist:
            return Response({'error': 'Plan not found'}, status=404)

        base_price = float(plan.price)
        discount_percent = 0
        discount_amount = 0.0
        if coupon_code:
            try:
                coupon = Coupon.objects.get(code__iexact=coupon_code.strip(), is_active=True)
                if not coupon.restricted_email or coupon.restricted_email.strip().lower() == request.user.email.strip().lower():
                    if not coupon.restricted_course_id or plan.course_specific_id == coupon.restricted_course_id:
                        discount_percent = coupon.discount_percent
                        discount_amount = round((base_price * discount_percent) / 100, 2)
            except Coupon.DoesNotExist:
                pass

        subtotal = max(0.0, base_price - discount_amount)
        if is_gst_enabled():
            gst_amount = round(subtotal * 0.18, 2)
        else:
            gst_amount = 0.0
        total_amount = round(subtotal + gst_amount, 2)

        # Generate a mock failed transaction ID if none provided
        txn_id = transaction_id or f"FAIL-{uuid.uuid4().hex[:8].upper()}"
        if error_description:
            txn_id = f"{txn_id} ({error_description[:40]})"

        payment = Payment.objects.create(
            user=request.user,
            plan=plan,
            amount=total_amount,
            base_amount=subtotal,
            gst_amount=gst_amount,
            transaction_id=txn_id,
            status='FAILED',
            coupon_code=coupon_code.strip() if coupon_code else None,
            discount_amount=discount_amount,
            original_amount=plan.price
        )

        return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def create_order(self, request):
        plan_id = request.data.get('plan_id')
        coupon_code = request.data.get('coupon_code')

        if not plan_id:
            return Response({'error': 'plan_id is required'}, status=400)

        try:
            plan = SubscriptionPlan.objects.get(id=plan_id)
        except SubscriptionPlan.DoesNotExist:
            return Response({'error': 'Plan not found'}, status=404)

        base_price = float(plan.price)
        discount_percent = 0
        discount_amount = 0.0
        if coupon_code:
            try:
                coupon = Coupon.objects.get(code__iexact=coupon_code.strip(), is_active=True)
                if not coupon.restricted_email or coupon.restricted_email.strip().lower() == request.user.email.strip().lower():
                    if not coupon.restricted_course_id or plan.course_specific_id == coupon.restricted_course_id:
                        discount_percent = coupon.discount_percent
                        discount_amount = round((base_price * discount_percent) / 100, 2)
            except Coupon.DoesNotExist:
                pass

        subtotal = max(0.0, base_price - discount_amount)
        if is_gst_enabled():
            gst_amount = round(subtotal * 0.18, 2)
        else:
            gst_amount = 0.0
        total_amount = round(subtotal + gst_amount, 2)
        amount_in_paise = int(total_amount * 100)

        order_id = f"order_mock_{uuid.uuid4().hex[:12].upper()}"
        if not is_sandbox:
            try:
                client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
                razorpay_order = client.order.create({
                    'amount': amount_in_paise,
                    'currency': 'INR',
                    'payment_capture': '1'
                })
                order_id = razorpay_order['id']
            except Exception as e:
                print("Razorpay Error:", e)
                pass

        return Response({
            'order_id': order_id,
            'amount': amount_in_paise,
            'currency': 'INR',
            'base_amount': base_price,
            'discount_amount': discount_amount,
            'gst_amount': gst_amount,
            'total_amount': total_amount,
            'razorpay_key_id': RAZORPAY_KEY_ID,
            'is_sandbox': is_sandbox
        })

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def verify_payment(self, request):
        payment_id = request.data.get('razorpay_payment_id')
        order_id = request.data.get('razorpay_order_id')
        signature = request.data.get('razorpay_signature')

        plan_id = request.data.get('plan_id')
        level_id = request.data.get('level_id')
        subject_id = request.data.get('subject_id')
        group = request.data.get('group')
        calendar_month = request.data.get('calendar_month')
        exam_attempt = request.data.get('exam_attempt')
        year = request.data.get('year')
        coupon_code = request.data.get('coupon_code')

        if not plan_id:
            return Response({'error': 'plan_id is required'}, status=400)

        try:
            plan = SubscriptionPlan.objects.get(id=plan_id)
        except SubscriptionPlan.DoesNotExist:
            return Response({'error': 'Plan not found'}, status=404)

        verified = False
        if is_sandbox or (order_id and order_id.startswith('order_mock_')):
            verified = True
        else:
            try:
                client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
                params_dict = {
                    'razorpay_order_id': order_id,
                    'razorpay_payment_id': payment_id,
                    'razorpay_signature': signature
                }
                client.utility.verify_payment_signature(params_dict)
                verified = True
            except Exception as e:
                print("Razorpay verification failed:", e)
                return Response({'error': 'Payment verification failed'}, status=400)

        if not verified:
            return Response({'error': 'Payment verification failed'}, status=400)

        # Invalidate duplicates
        dup_filter = UserSubscription.objects.filter(user=request.user, is_active=True)
        if level_id:
            dup_filter = dup_filter.filter(level_id=level_id)
        if subject_id:
            dup_filter = dup_filter.filter(subject_id=subject_id)
        elif group:
            dup_filter = dup_filter.filter(group=group)
        dup_filter.update(is_active=False)

        # Dates
        start_date = timezone.now()
        end_date = start_date + timedelta(days=plan.duration_days)
        year_val = int(year) if year else start_date.year

        months_map = {
            'january': 1, 'february': 2, 'march': 3, 'april': 4, 'may': 5, 'june': 6,
            'july': 7, 'august': 8, 'september': 9, 'october': 10, 'november': 11, 'december': 12,
            'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
            'jul': 7, 'aug': 8, 'sep': 9, 'sept': 9, 'oct': 10, 'nov': 11, 'dec': 12
        }

        base_price = float(plan.price)
        discount_percent = 0
        discount_amount = 0.0
        if coupon_code:
            try:
                coupon = Coupon.objects.get(code__iexact=coupon_code.strip(), is_active=True)
                if not coupon.restricted_email or coupon.restricted_email.strip().lower() == request.user.email.strip().lower():
                    if not coupon.restricted_course_id or plan.course_specific_id == coupon.restricted_course_id:
                        discount_percent = coupon.discount_percent
                        discount_amount = round((base_price * discount_percent) / 100, 2)
            except Coupon.DoesNotExist:
                pass

        subtotal = max(0.0, base_price - discount_amount)
        if is_gst_enabled():
            gst_amount = round(subtotal * 0.18, 2)
        else:
            gst_amount = 0.0
        total_amount = round(subtotal + gst_amount, 2)

        if plan.billing_cycle == 'ATTEMPT_WISE' and exam_attempt:
            attempt_name = exam_attempt.strip().lower()
            if attempt_name in months_map:
                month_num = months_map[attempt_name]
                last_day = monthrange(year_val, month_num)[1]
                end_date = datetime(year_val, month_num, last_day, 23, 59, 59, tzinfo=timezone.get_current_timezone())
                if end_date <= start_date:
                    year_val += 1
                    last_day = monthrange(year_val, month_num)[1]
                    end_date = datetime(year_val, month_num, last_day, 23, 59, 59, tzinfo=timezone.get_current_timezone())

        # Create Subscription
        subscription = UserSubscription.objects.create(
            user=request.user,
            plan=plan,
            start_date=start_date,
            end_date=end_date,
            is_active=True,
            level_id=level_id,
            subject_id=subject_id,
            group=group,
            calendar_month=calendar_month,
            exam_attempt=exam_attempt,
            year=year_val
        )

        # Create Payment
        Payment.objects.create(
            user=request.user,
            plan=plan,
            amount=total_amount,
            base_amount=subtotal,
            gst_amount=gst_amount,
            transaction_id=payment_id or f"TXN-{uuid.uuid4().hex[:8].upper()}",
            status='SUCCESS',
            coupon_code=coupon_code.strip() if coupon_code else None,
            discount_amount=discount_amount,
            original_amount=plan.price
        )

        return Response(UserSubscriptionSerializer(subscription).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def download_invoice(self, request, pk=None):
        try:
            payment = Payment.objects.get(pk=pk)
        except Payment.DoesNotExist:
            return Response({'error': 'Payment record not found'}, status=404)

        if not request.user.is_superuser and payment.user != request.user:
            return Response({'error': 'Permission denied'}, status=403)

        response = HttpResponse(content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="invoice_{payment.transaction_id}.pdf"'

        doc = SimpleDocTemplate(response, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
        story = []
        styles = getSampleStyleSheet()

        title_style = ParagraphStyle(
            'InvoiceTitle',
            parent=styles['Heading1'],
            fontName='Helvetica-Bold',
            fontSize=24,
            textColor=colors.HexColor('#1E293B'),
            spaceAfter=15
        )
        h2_style = ParagraphStyle(
            'Heading2',
            parent=styles['Heading2'],
            fontName='Helvetica-Bold',
            fontSize=14,
            textColor=colors.HexColor('#475569'),
            spaceAfter=10
        )
        body_style = ParagraphStyle(
            'InvoiceBody',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=10,
            textColor=colors.HexColor('#334155'),
            leading=14
        )
        body_bold = ParagraphStyle(
            'InvoiceBodyBold',
            parent=body_style,
            fontName='Helvetica-Bold'
        )

        logo_path = os.path.join(settings.BASE_DIR, '../frontend/public/logo-light.png')
        logo_img = None
        if os.path.exists(logo_path):
            try:
                # 799 x 232 aspect ratio ~ 3.44:1
                logo_img = Image(logo_path, width=103.3, height=30)
            except Exception as e:
                print(f"Error loading logo in invoice: {e}")

        if logo_img:
            header_title_style = ParagraphStyle(
                'InvoiceHeaderTitle',
                parent=styles['Heading1'],
                fontName='Helvetica-Bold',
                fontSize=20,
                textColor=colors.HexColor('#1E293B'),
                alignment=2 # Right aligned
            )
            header_data = [[logo_img, Paragraph("TAX INVOICE", header_title_style)]]
            header_table = Table(header_data, colWidths=[200, 320])
            header_table.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ('ALIGN', (1,0), (1,0), 'RIGHT'),
                ('PADDING', (0,0), (-1,-1), 0),
            ]))
            story.append(header_table)
        else:
            story.append(Paragraph("QUBOOK TAX INVOICE", title_style))
        story.append(Spacer(1, 15))

        billing_info = [
            [Paragraph("<b>Provider:</b><br/>Qubook.in Learning Platform<br/>GSTIN: 27AAAAA1111A1Z1<br/>Support: support@qubook.in", body_style),
             Paragraph(f"<b>Invoice To:</b><br/>{payment.user.first_name} {payment.user.last_name}<br/>Email: {payment.user.email}<br/>Date: {payment.created_at.strftime('%d-%m-%Y %H:%M')}", body_style)]
        ]
        t1 = Table(billing_info, colWidths=[260, 260])
        t1.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('PADDING', (0,0), (-1,-1), 0),
        ]))
        story.append(t1)
        story.append(Spacer(1, 20))

        story.append(Paragraph("Transaction Summary", h2_style))
        story.append(Spacer(1, 5))

        headers = [Paragraph("<b>Description</b>", body_bold), 
                   Paragraph("<b>Original Price</b>", body_bold), 
                   Paragraph("<b>Discount</b>", body_bold),
                   Paragraph("<b>Base Price</b>", body_bold), 
                   Paragraph("<b>GST (18%)</b>", body_bold), 
                   Paragraph("<b>Total Paid</b>", body_bold)]
        
        row1 = [
            Paragraph(f"Subscription: {payment.plan.name if payment.plan else 'Premium Access'}", body_style),
            Paragraph(f"INR {payment.original_amount}", body_style),
            Paragraph(f"INR {payment.discount_amount}", body_style),
            Paragraph(f"INR {payment.base_amount}", body_style),
            Paragraph(f"INR {payment.gst_amount}", body_style),
            Paragraph(f"INR {payment.amount}", body_bold)
        ]
        
        table_data = [headers, row1]
        t2 = Table(table_data, colWidths=[150, 75, 65, 75, 75, 80])
        t2.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F1F5F9')),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('PADDING', (0,0), (-1,-1), 8),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ]))
        story.append(t2)
        story.append(Spacer(1, 40))

        story.append(Paragraph("Thank you for learning with Qubook! This is an electronically generated tax invoice. No signature required.", body_style))

        doc.build(story)
        return response

class PlatformSettingViewSet(viewsets.ModelViewSet):
    queryset = PlatformSetting.objects.all()
    serializer_class = PlatformSettingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'toggle_gst']:
            return [permissions.IsAuthenticated(), IsSuperUser()]
        return [permissions.IsAuthenticated()]

    @action(detail=False, methods=['get'])
    def get_gst_status(self, request):
        enabled = is_gst_enabled()
        return Response({'enabled': enabled})

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsSuperUser])
    def toggle_gst(self, request):
        enabled = request.data.get('enabled')
        if enabled is None:
            return Response({'error': 'enabled is required'}, status=400)
        if isinstance(enabled, str):
            enabled = enabled.lower() in ['true', '1', 'yes']
        setting, _ = PlatformSetting.objects.get_or_create(key="ENABLE_GST")
        setting.value = "true" if enabled else "false"
        setting.save()
        return Response({'enabled': setting.value.lower() == "true"})
