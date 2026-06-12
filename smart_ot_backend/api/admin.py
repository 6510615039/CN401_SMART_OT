from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, Department, OTRequest, Holiday, SystemSettings, TimeLog, ImportHistory, AuditLog

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ['username', 'get_full_name', 'role', 'department', 'employee_id', 'is_active']
    list_filter = ['role', 'department', 'is_active']
    fieldsets = BaseUserAdmin.fieldsets + (
        ('ข้อมูลระบบ', {'fields': ('employee_id', 'role', 'department', 'phone', 'notify_email')}),
    )

admin.site.register(Department)
admin.site.register(Holiday)
admin.site.register(SystemSettings)
admin.site.register(OTRequest)
admin.site.register(TimeLog)
admin.site.register(ImportHistory)
admin.site.register(AuditLog)
