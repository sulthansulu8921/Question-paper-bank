from rest_framework import permissions

class IsSuperAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and (request.user.role == 'SUPER_ADMIN' or request.user.is_superuser))

class IsInstitutionAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'INSTITUTION_ADMIN')

class IsInstructor(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'INSTRUCTOR')

class IsStudent(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'STUDENT')

class TenantIsolationMixin:
    """
    Mixin to automatically enforce tenant isolation in viewsets.
    Enforces filtering querysets based on request.user.institution.
    """
    def get_queryset(self):
        user = self.request.user
        queryset = super().get_queryset()
        if not user or not user.is_authenticated:
            return queryset.none()
        
        if user.role == 'SUPER_ADMIN' or user.is_superuser:
            return queryset
            
        if hasattr(queryset.model, 'institution'):
            return queryset.filter(institution=user.institution)
            
        return queryset

class IsSuperUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)

class IsStaffOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and (
            request.user.is_staff or 
            request.user.is_superuser or 
            request.user.role in ['SUPER_ADMIN', 'INSTITUTION_ADMIN', 'INSTRUCTOR', 'QUESTION_ADMIN', 'COURSE_ADMIN']
        ))

class IsQuestionAdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        user = request.user
        return bool(user and user.is_authenticated and (
            user.is_superuser or 
            user.role in ['SUPER_ADMIN', 'QUESTION_ADMIN']
        ))

class IsCourseAdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        user = request.user
        return bool(user and user.is_authenticated and (
            user.is_superuser or 
            user.role in ['SUPER_ADMIN', 'COURSE_ADMIN']
        ))
