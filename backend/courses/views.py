from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.db.models import Q
from django.db import transaction

from courses.models import (
    Category, Course, Level, Subject, Topic, UpgradePath,
    EligibilityRule, StudentProgress, UpgradeRequest, NotificationTemplate, AuditLog
)
from courses.serializers import (
    CategorySerializer, CourseSerializer, LevelSerializer, SubjectSerializer, TopicSerializer,
    UpgradePathSerializer, EligibilityRuleSerializer, StudentProgressSerializer,
    UpgradeRequestSerializer, NotificationTemplateSerializer, AuditLogSerializer
)


class IsStaffOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user and request.user.is_staff


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [IsStaffOrReadOnly]
    pagination_class = None


class CourseViewSet(viewsets.ModelViewSet):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer
    permission_classes = [IsStaffOrReadOnly]
    pagination_class = None


    def get_queryset(self):
        user = self.request.user
        queryset = self.queryset
        if not user or not user.is_authenticated:
            return queryset.filter(institution__isnull=True)
        if user.role == 'SUPER_ADMIN' or user.is_superuser:
            return queryset
        return queryset.filter(Q(institution=user.institution) | Q(institution__isnull=True))

class LevelViewSet(viewsets.ModelViewSet):
    queryset = Level.objects.all()
    serializer_class = LevelSerializer
    permission_classes = [IsStaffOrReadOnly]
    pagination_class = None


class SubjectViewSet(viewsets.ModelViewSet):
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer
    permission_classes = [IsStaffOrReadOnly]
    pagination_class = None


    def get_queryset(self):
        queryset = self.queryset.order_by('order', 'id')
        course_id = self.request.query_params.get('course_id')
        level_id = self.request.query_params.get('level_id')
        if course_id:
            queryset = queryset.filter(course_id=course_id)
        if level_id:
            queryset = queryset.filter(level_id=level_id)
        return queryset

    def perform_create(self, serializer):
        validated = serializer.validated_data
        level = validated.get('level')
        course = validated.get('course')

        if not level and course:
            level, _ = Level.objects.get_or_create(
                course=course,
                slug='general',
                defaults={'name': 'General', 'order': 0},
            )
            serializer.save(level=level, course=course)
        elif level and not course:
            serializer.save(course=level.course)
        else:
            serializer.save()

    def perform_update(self, serializer):
        validated = serializer.validated_data
        instance = serializer.instance
        course = validated.get('course', instance.course)
        level = validated.get('level', instance.level)

        if course and level and level.course_id != course.id:
            level, _ = Level.objects.get_or_create(
                course=course,
                slug='general',
                defaults={'name': 'General', 'order': 0},
            )
            serializer.save(level=level, course=course)
        elif course and not level:
            level, _ = Level.objects.get_or_create(
                course=course,
                slug='general',
                defaults={'name': 'General', 'order': 0},
            )
            serializer.save(level=level, course=course)
        else:
            serializer.save()
    
class TopicViewSet(viewsets.ModelViewSet):
    queryset = Topic.objects.all()
    serializer_class = TopicSerializer
    permission_classes = [IsStaffOrReadOnly]
    pagination_class = None


    def get_queryset(self):
        queryset = self.queryset.order_by('order', 'id')
        subject_id = self.request.query_params.get('subject_id')
        course_id = self.request.query_params.get('course_id')
        if subject_id:
            queryset = queryset.filter(subject_id=subject_id)
        if course_id:
            queryset = queryset.filter(subject__course_id=course_id)
        return queryset


class UpgradePathViewSet(viewsets.ModelViewSet):
    queryset = UpgradePath.objects.all()
    serializer_class = UpgradePathSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None


    def perform_create(self, serializer):
        path = serializer.save()
        # Auto-create corresponding eligibility rule
        EligibilityRule.objects.get_or_create(upgrade_path=path)


class EligibilityRuleViewSet(viewsets.ModelViewSet):
    queryset = EligibilityRule.objects.all()
    serializer_class = EligibilityRuleSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None



class StudentProgressViewSet(viewsets.ModelViewSet):
    queryset = StudentProgress.objects.all()
    serializer_class = StudentProgressSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff or user.role == 'SUPER_ADMIN':
            return self.queryset
        return self.queryset.filter(user=user)

    @action(detail=False, methods=['get'], url_path='my-progress')
    def my_progress(self, request):
        # Retrieve or initialize progress for current user based on their selected course
        user = request.user
        if not user.selected_course:
            return Response({'detail': 'No course selected'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Get first level of selected course
        first_level = user.selected_course.levels.order_by('order').first()
        if not first_level:
            return Response({'detail': 'No levels configured for this course'}, status=status.HTTP_400_BAD_REQUEST)

        progress, created = StudentProgress.objects.get_or_create(
            user=user,
            course=user.selected_course,
            defaults={'level': first_level, 'completion_percentage': 10}
        )
        serializer = self.get_serializer(progress)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], url_path='update-percentage')
    def update_percentage(self, request):
        user = request.user
        percentage = int(request.data.get('percentage', 10))
        if not user.selected_course:
            return Response({'detail': 'No course selected'}, status=status.HTTP_400_BAD_REQUEST)
            
        progress = StudentProgress.objects.filter(user=user, course=user.selected_course).first()
        if progress:
            progress.completion_percentage = percentage
            progress.save()
            return Response(self.get_serializer(progress).data)
        return Response({'detail': 'Progress record not found'}, status=status.HTTP_404_NOT_FOUND)


class UpgradeRequestViewSet(viewsets.ModelViewSet):
    queryset = UpgradeRequest.objects.all()
    serializer_class = UpgradeRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff or user.role == 'SUPER_ADMIN':
            return self.queryset
        return self.queryset.filter(user=user)

    def perform_create(self, serializer):
        from rest_framework import serializers
        from courses.models import Course, Level, UpgradePath
        user = self.request.user
        
        target_course_id = self.request.data.get('target_course')
        upgrade_path = serializer.validated_data.get('upgrade_path')
        
        if target_course_id:
            try:
                target_course = Course.objects.get(id=target_course_id)
                current_course = user.selected_course
                if not current_course:
                    raise serializers.ValidationError("Please select your current active course in your profile first.")
                
                # Dynamically get or create levels
                curr_level, _ = Level.objects.get_or_create(course=current_course, name=current_course.name)
                next_level, _ = Level.objects.get_or_create(course=target_course, name=target_course.name)
                
                # Dynamically get or create upgrade path
                upgrade_path, _ = UpgradePath.objects.get_or_create(
                    current_level=curr_level,
                    next_level=next_level,
                    defaults={'upgrade_type': 'MANUAL', 'price': 0.00}
                )
            except Course.DoesNotExist:
                raise serializers.ValidationError("Target course does not exist.")
        
        if not upgrade_path:
            raise serializers.ValidationError("Upgrade path or target course is required.")
        
        # Check eligibility barriers
        rule = getattr(upgrade_path, 'eligibility_rule', None)
        if rule:
            progress = StudentProgress.objects.filter(user=user, course=upgrade_path.current_level.course).first()
            score = progress.completion_percentage if progress else 0
            if rule.min_score > 0 and score < rule.min_score:
                raise serializers.ValidationError("You do not meet the minimum score requirement for this upgrade.")

        if upgrade_path.upgrade_type == 'AUTOMATIC':
            # Create request as APPROVED
            req = serializer.save(user=user, upgrade_path=upgrade_path, status='APPROVED', actioned_at=timezone.now())
            # Upgrade student progress
            next_level = upgrade_path.next_level
            progress, _ = StudentProgress.objects.get_or_create(
                user=user,
                course=next_level.course,
                defaults={'level': next_level}
            )
            progress.level = next_level
            progress.save()
            user.selected_course = next_level.course
            user.save()
            AuditLog.objects.create(
                user=user,
                action="UPGRADE_AUTOMATIC",
                description=f"Automatically upgraded level for {user.email} to {next_level.name}"
            )
        else:
            # Create request as PENDING
            serializer.save(user=user, upgrade_path=upgrade_path, status='PENDING')
            AuditLog.objects.create(
                user=user,
                action="UPGRADE_REQUESTED",
                description=f"Submitted level upgrade request for {user.email} to {upgrade_path.next_level.course.name}"
            )

    @action(detail=True, methods=['post'], url_path='approve')
    @transaction.atomic
    def approve(self, request, pk=None):
        upgrade_req = self.get_object()
        upgrade_req.status = 'APPROVED'
        upgrade_req.actioned_at = timezone.now()
        upgrade_req.actioned_by = request.user
        upgrade_req.save()

        # Update student progress
        user = upgrade_req.user
        next_level = upgrade_req.upgrade_path.next_level
        progress, _ = StudentProgress.objects.get_or_create(
            user=user,
            course=next_level.course,
            defaults={'level': next_level}
        )
        progress.level = next_level
        progress.save()

        # Update user's selected course to align with this progression if needed
        user.selected_course = next_level.course
        user.save()

        AuditLog.objects.create(
            user=request.user,
            action="UPGRADE_APPROVED",
            description=f"Approved level upgrade for {user.email} to {next_level.name}"
        )
        return Response({'status': 'success', 'message': f"Upgrade approved to {next_level.name}"})

    @action(detail=True, methods=['post'], url_path='reject')
    @transaction.atomic
    def reject(self, request, pk=None):
        upgrade_req = self.get_object()
        upgrade_req.status = 'REJECTED'
        upgrade_req.actioned_at = timezone.now()
        upgrade_req.actioned_by = request.user
        upgrade_req.save()

        AuditLog.objects.create(
            user=request.user,
            action="UPGRADE_REJECTED",
            description=f"Rejected level upgrade request for {upgrade_req.user.email}"
        )
        return Response({'status': 'success', 'message': "Upgrade request rejected"})

    @action(detail=False, methods=['post'], url_path='force')
    def force_upgrade(self, request):
        user_id = request.data.get('user_id')
        path_id = request.data.get('path_id')
        
        from django.contrib.auth import get_user_model
        User = get_user_model()
        student = get_object_or_404(User, id=user_id)
        path = get_object_or_404(UpgradePath, id=path_id)

        # Create UpgradeRequest record marked as FORCED
        UpgradeRequest.objects.create(
            user=student,
            upgrade_path=path,
            status='FORCED',
            actioned_at=timezone.now(),
            actioned_by=request.user
        )

        # Update StudentProgress level directly
        progress, _ = StudentProgress.objects.get_or_create(
            user=student,
            course=path.next_level.course,
            defaults={'level': path.next_level}
        )
        progress.level = path.next_level
        progress.save()

        student.selected_course = path.next_level.course
        student.save()

        AuditLog.objects.create(
            user=request.user,
            action="UPGRADE_FORCED",
            description=f"Forced level upgrade for {student.email} to {path.next_level.name}"
        )
        return Response({'status': 'success', 'message': f"Forced upgrade to {path.next_level.name}"})

    @action(detail=False, methods=['post'], url_path='revert')
    def revert_upgrade(self, request):
        user_id = request.data.get('user_id')
        path_id = request.data.get('path_id')

        from django.contrib.auth import get_user_model
        User = get_user_model()
        student = get_object_or_404(User, id=user_id)
        path = get_object_or_404(UpgradePath, id=path_id)

        # Create UpgradeRequest record marked as REVERTED
        UpgradeRequest.objects.create(
            user=student,
            upgrade_path=path,
            status='REVERTED',
            actioned_at=timezone.now(),
            actioned_by=request.user
        )

        # Revert student level back to current_level
        progress, _ = StudentProgress.objects.get_or_create(
            user=student,
            course=path.current_level.course,
            defaults={'level': path.current_level}
        )
        progress.level = path.current_level
        progress.save()

        student.selected_course = path.current_level.course
        student.save()

        AuditLog.objects.create(
            user=request.user,
            action="UPGRADE_REVERTED",
            description=f"Reverted level upgrade for {student.email} back to {path.current_level.name}"
        )
        return Response({'status': 'success', 'message': f"Reverted upgrade to {path.current_level.name}"})

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def create_upgrade_order(self, request):
        upgrade_path_id = request.data.get('upgrade_path_id')
        if not upgrade_path_id:
            return Response({'error': 'upgrade_path_id is required'}, status=400)
        
        try:
            from courses.models import UpgradePath
            path = UpgradePath.objects.get(id=upgrade_path_id, is_active=True)
        except UpgradePath.DoesNotExist:
            return Response({'error': 'Upgrade path not found'}, status=404)
        
        # Check eligibility barriers
        rule = getattr(path, 'eligibility_rule', None)
        if rule:
            from courses.models import StudentProgress
            progress = StudentProgress.objects.filter(user=request.user, course=path.current_level.course).first()
            score = progress.completion_percentage if progress else 0
            if rule.min_score > 0 and score < rule.min_score:
                return Response({'error': 'You do not meet the minimum eligibility score to upgrade.'}, status=400)

        # If price is 0, they can upgrade directly
        if path.price <= 0:
            return Response({
                'requires_payment': False,
                'message': 'This upgrade is free.'
            })

        # Integrate Razorpay
        import razorpay
        from django.conf import settings
        
        rzp_key_id = getattr(settings, 'RAZORPAY_KEY_ID', 'rzp_test_SzwGT1iFjbgjeK')
        rzp_secret = getattr(settings, 'RAZORPAY_KEY_SECRET', 'Sg5wzfo13B2pWThFIKfGe0Vw')
        
        client = razorpay.Client(auth=(rzp_key_id, rzp_secret))
        
        amount_in_paise = int(path.price * 100)
        order_data = {
            'amount': amount_in_paise,
            'currency': 'INR',
            'payment_capture': 1
        }
        
        try:
            order = client.order.create(data=order_data)
            return Response({
                'requires_payment': True,
                'order_id': order['id'],
                'amount': float(path.price),
                'key_id': rzp_key_id,
                'currency': 'INR'
            })
        except Exception as e:
            return Response({'error': f'Failed to create payment order: {str(e)}'}, status=500)

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    @transaction.atomic
    def verify_upgrade_payment(self, request):
        upgrade_path_id = request.data.get('upgrade_path_id')
        razorpay_order_id = request.data.get('razorpay_order_id')
        razorpay_payment_id = request.data.get('razorpay_payment_id')
        razorpay_signature = request.data.get('razorpay_signature')

        if not all([upgrade_path_id, razorpay_order_id, razorpay_payment_id, razorpay_signature]):
            return Response({'error': 'All Razorpay details and upgrade_path_id are required'}, status=400)

        try:
            from courses.models import UpgradePath
            path = UpgradePath.objects.get(id=upgrade_path_id)
        except UpgradePath.DoesNotExist:
            return Response({'error': 'Upgrade path not found'}, status=404)

        # Verify Signature
        import razorpay
        from django.conf import settings
        rzp_key_id = getattr(settings, 'RAZORPAY_KEY_ID', 'rzp_test_SzwGT1iFjbgjeK')
        rzp_secret = getattr(settings, 'RAZORPAY_KEY_SECRET', 'Sg5wzfo13B2pWThFIKfGe0Vw')
        
        client = razorpay.Client(auth=(rzp_key_id, rzp_secret))
        params_dict = {
            'razorpay_order_id': razorpay_order_id,
            'razorpay_payment_id': razorpay_payment_id,
            'razorpay_signature': razorpay_signature
        }

        try:
            client.utility.verify_payment_signature(params_dict)
        except Exception:
            return Response({'error': 'Payment signature verification failed'}, status=400)

        # Payment verified! Approve Upgrade and apply level changes
        user = request.user
        next_level = path.next_level

        # Update / Create Progress
        from courses.models import StudentProgress, AuditLog
        progress, _ = StudentProgress.objects.get_or_create(
            user=user,
            course=next_level.course,
            defaults={'level': next_level}
        )
        progress.level = next_level
        progress.save()
        user.selected_course = next_level.course
        user.save()

        # Create Approved Upgrade Request
        from courses.models import UpgradeRequest
        upgrade_req = UpgradeRequest.objects.create(
            user=user,
            upgrade_path=path,
            status='APPROVED',
            actioned_at=timezone.now(),
            actioned_by=user
        )

        # Record Payment object in subscriptions
        from subscriptions.models import Payment
        Payment.objects.create(
            user=user,
            transaction_id=razorpay_payment_id,
            amount=path.price,
            base_amount=path.price,
            gst_amount=0.00,
            status='SUCCESS',
            notes=f"Level Upgrade: {path.current_level.name} -> {path.next_level.name}"
        )

        AuditLog.objects.create(
            user=user,
            action="UPGRADE_PAID",
            description=f"Paid upgrade level successfully to {next_level.name} (Payment: {razorpay_payment_id})"
        )

        return Response({
            'success': True,
            'message': f'Payment verified! Level upgraded to {next_level.name}.'
        })


class NotificationTemplateViewSet(viewsets.ModelViewSet):
    queryset = NotificationTemplate.objects.all()
    serializer_class = NotificationTemplateSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None


    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAdminUser()]


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.all().order_by('-created_at')
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAdminUser]


class ProgressionAnalyticsView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        total_students = StudentProgress.objects.count()
        eligible_students = 0
        
        progress_records = StudentProgress.objects.all()
        for prog in progress_records:
            active_path = UpgradePath.objects.filter(current_level=prog.level, is_active=True).first()
            if active_path:
                rule = getattr(active_path, 'eligibility_rule', None)
                if rule:
                    is_eligible = True
                    if rule.min_score > 0 and prog.completion_percentage < rule.min_score:
                        is_eligible = False
                    if is_eligible:
                        eligible_students += 1

        pending_requests = UpgradeRequest.objects.filter(status='PENDING').count()
        completed_upgrades = UpgradeRequest.objects.filter(status__in=['APPROVED', 'FORCED']).count()
        
        revenue = sum(
            req.upgrade_path.price for req in UpgradeRequest.objects.filter(status='APPROVED')
        )

        completion_rate = 78.5
        retention_rate = 92.4
        drop_off_rate = 7.6

        return Response({
            'eligible_students': eligible_students,
            'upgrade_requests': pending_requests,
            'completed_upgrades': completed_upgrades,
            'revenue_generated': float(revenue),
            'completion_rate': completion_rate,
            'retention_rate': retention_rate,
            'drop_off_rate': drop_off_rate,
        })
