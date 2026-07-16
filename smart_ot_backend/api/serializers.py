from rest_framework import serializers
from .models import User, Department, OTRequest, Holiday, SystemSettings, TimeLog, ImportHistory, AuditLog, Notification


class DepartmentSerializer(serializers.ModelSerializer):
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = Department
        fields = ['id', 'name', 'code', 'member_count']

    def get_member_count(self, obj):
        return obj.members.filter(is_active=True).count()


class UserSerializer(serializers.ModelSerializer):
    department_name  = serializers.CharField(source='department.name', read_only=True)
    full_name        = serializers.SerializerMethodField()
    available_roles  = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'full_name', 'first_name', 'last_name',
            'email', 'employee_id', 'role', 'extra_roles', 'available_roles',
            'department', 'department_name',
            'phone', 'notify_email', 'profile_image', 'is_active',
        ]

    def get_full_name(self, obj):
        return obj.get_full_name()

    def get_available_roles(self, obj):
        return obj.available_roles


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = [
            'username', 'password', 'first_name', 'last_name',
            'email', 'employee_id', 'role', 'department', 'phone', 'notify_email',
        ]

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class HolidaySerializer(serializers.ModelSerializer):
    class Meta:
        model = Holiday
        fields = ['id', 'date', 'name', 'holiday_type', 'year', 'is_system']
        read_only_fields = ['is_system']


class SystemSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemSettings
        fields = [
            'id',
            'max_ot_hours_weekday', 'max_ot_hours_holiday',
            'rate_multiplier_weekday', 'rate_multiplier_holiday',
            'notify_on_submit', 'notify_on_approve', 'notify_on_reject',
            'tu_api_url', 'tu_api_key', 'tu_api_enabled',
            'updated_at',
        ]
        read_only_fields = ['updated_at']


class OTRequestSerializer(serializers.ModelSerializer):
    staff_name        = serializers.CharField(source='staff.get_full_name', read_only=True)
    department_name   = serializers.CharField(source='department.name', read_only=True)
    status_display    = serializers.CharField(source='get_status_display', read_only=True)
    day_type_display  = serializers.CharField(source='get_day_type_display', read_only=True)
    rep_document_url  = serializers.SerializerMethodField(read_only=True)

    def get_rep_document_url(self, obj):
        if obj.rep_document:
            request = self.context.get('request')
            url = obj.rep_document.url
            return request.build_absolute_uri(url) if request else url
        return None

    class Meta:
        model = OTRequest
        fields = [
            'id', 'staff', 'staff_name', 'department', 'department_name',
            'work_date', 'day_type', 'day_type_display',
            'start_time', 'end_time', 'ot_hours', 'rate_per_hour',
            'work_detail', 'location', 'amount',
            'status', 'status_display',
            'head_note', 'rep_note', 'rep_document_url', 'checker_note',
            'head_approved_at', 'rep_forwarded_at', 'checker_approved_at',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'staff', 'department', 'day_type', 'ot_hours', 'rate_per_hour', 'amount', 'status',
            'head_approved_at', 'rep_forwarded_at', 'checker_approved_at', 'created_at', 'updated_at',
        ]


class TimeLogSerializer(serializers.ModelSerializer):
    user_name       = serializers.CharField(source='user.get_full_name', read_only=True)
    department_name = serializers.CharField(source='user.department.name', read_only=True)
    employee_id     = serializers.CharField(source='user.employee_id', read_only=True)

    class Meta:
        model = TimeLog
        fields = [
            'id', 'user', 'user_name', 'employee_id', 'department_name',
            'log_date', 'check_in', 'check_out',
            'time_period', 'attendance_status',
            'imported_at',
        ]


class ImportHistorySerializer(serializers.ModelSerializer):
    imported_by_name = serializers.CharField(source='imported_by.get_full_name', read_only=True)

    class Meta:
        model = ImportHistory
        fields = [
            'id', 'filename', 'imported_by', 'imported_by_name',
            'imported_at', 'status', 'total_rows', 'success_rows', 'error_rows', 'error_detail',
        ]

class AuditLogSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)

    class Meta:
        model = AuditLog
        fields = ['id', 'user', 'user_name', 'action', 'model_name', 'object_id', 'detail', 'ip_address', 'created_at']


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['id', 'recipient', 'message', 'notif_type', 'ot_request', 'is_read', 'created_at']
        read_only_fields = ['created_at']
