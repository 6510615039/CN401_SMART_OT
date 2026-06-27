from django.db import models
from django.contrib.auth.models import AbstractUser


class Department(models.Model):
    name        = models.CharField(max_length=200, verbose_name='ชื่อแผนก')
    code        = models.CharField(max_length=20, unique=True, verbose_name='รหัสแผนก')
    ot_budget   = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name='งบประมาณ OT (บาท)')
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'แผนก'

    def __str__(self):
        return self.name


class User(AbstractUser):
    ROLE_CHOICES = [
        ('admin',     'แอดมิน'),
        ('staff',     'พนักงาน'),
        ('depthead',  'หัวหน้างาน'),
        ('deptrep',   'ตัวแทนฝ่าย'),
        ('checker',   'ผู้ตรวจสอบ'),
        ('executive', 'ผู้บริหาร'),
    ]

    employee_id  = models.CharField(max_length=20, unique=True, blank=True, null=True, verbose_name='รหัสพนักงาน')
    role         = models.CharField(max_length=20, choices=ROLE_CHOICES, default='staff', verbose_name='บทบาท')
    extra_roles  = models.JSONField(default=list, blank=True, verbose_name='สิทธิ์เพิ่มเติม')
    department   = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True, related_name='members', verbose_name='แผนก')
    phone         = models.CharField(max_length=20, blank=True, verbose_name='เบอร์โทร')
    notify_email  = models.EmailField(blank=True, verbose_name='อีเมลสำหรับแจ้งเตือน')
    profile_image = models.TextField(blank=True, default='', verbose_name='รูปโปรไฟล์ (base64)')
    is_active     = models.BooleanField(default=True)

    @property
    def available_roles(self):
        """สิทธิ์ทั้งหมดที่ user นี้มี (staff + role หลัก + extra_roles)"""
        roles = ['staff']
        if self.role and self.role != 'staff' and self.role not in roles:
            roles.append(self.role)
        for r in (self.extra_roles or []):
            if r and r not in roles:
                roles.append(r)
        return roles

    def get_full_name(self):
        return f'{self.first_name} {self.last_name}'.strip() or self.username

    def __str__(self):
        return f'{self.get_full_name()} ({self.role})'


class Holiday(models.Model):
    TYPE_CHOICES = [
        ('official',      'วันหยุดราชการ'),
        ('compensation',  'วันหยุดชดเชย'),
        ('special',       'วันหยุดพิเศษ'),
    ]

    date       = models.DateField(verbose_name='วันที่')
    name       = models.CharField(max_length=200, verbose_name='ชื่อวันหยุด')
    holiday_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='official', verbose_name='ประเภท')
    year       = models.IntegerField(verbose_name='ปี พ.ศ.')
    is_system  = models.BooleanField(default=False, verbose_name='ระบบสร้างให้อัตโนมัติ')

    class Meta:
        ordering = ['date']
        unique_together = ['date']
        verbose_name = 'วันหยุด'

    def __str__(self):
        return f'{self.date} - {self.name}'


class SystemSettings(models.Model):
    max_ot_hours_weekday  = models.DecimalField(max_digits=4, decimal_places=1, default=4.0,  verbose_name='ชม. OT สูงสุดวันธรรมดา')
    max_ot_hours_holiday  = models.DecimalField(max_digits=4, decimal_places=1, default=7.0,  verbose_name='ชม. OT สูงสุดวันหยุด')
    rate_multiplier_weekday = models.DecimalField(max_digits=4, decimal_places=2, default=1.5, verbose_name='อัตราคูณวันธรรมดา')
    rate_multiplier_holiday = models.DecimalField(max_digits=4, decimal_places=2, default=3.0, verbose_name='อัตราคูณวันหยุด')
    notify_on_submit      = models.BooleanField(default=True,  verbose_name='แจ้งเตือนเมื่อยื่นคำร้อง')
    notify_on_approve     = models.BooleanField(default=True,  verbose_name='แจ้งเตือนเมื่ออนุมัติ')
    notify_on_reject      = models.BooleanField(default=True,  verbose_name='แจ้งเตือนเมื่อตีกลับ')
    # TU Employee API
    tu_api_url            = models.CharField(max_length=500, blank=True, default='', verbose_name='TU API Base URL')
    tu_api_key            = models.CharField(max_length=200, blank=True, default='', verbose_name='TU API Key')
    tu_api_enabled        = models.BooleanField(default=False, verbose_name='เปิดใช้ TU API')
    updated_at            = models.DateTimeField(auto_now=True)
    updated_by            = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        verbose_name = 'ตั้งค่าระบบ'

    def __str__(self):
        return 'System Settings'


class OTRequest(models.Model):
    STATUS_CHOICES = [
        ('draft',           'ร่าง'),
        ('submitted',       'ยื่นแล้ว'),
        ('head_approved',   'หัวหน้าอนุมัติ'),
        ('head_rejected',   'หัวหน้าตีกลับ'),
        ('rep_forwarded',   'ตัวแทนส่งต่อแล้ว'),
        ('checker_approved','ผู้ตรวจสอบอนุมัติ'),
        ('checker_rejected','ผู้ตรวจสอบตีกลับ'),
        ('completed',       'เสร็จสิ้น'),
    ]

    DAY_TYPE_CHOICES = [
        ('weekday', 'วันธรรมดา'),
        ('holiday', 'วันหยุด'),
    ]

    staff        = models.ForeignKey(User, on_delete=models.CASCADE, related_name='ot_requests', verbose_name='พนักงาน')
    department   = models.ForeignKey(Department, on_delete=models.CASCADE, verbose_name='แผนก')
    work_date    = models.DateField(verbose_name='วันที่ทำงาน OT')
    day_type     = models.CharField(max_length=10, choices=DAY_TYPE_CHOICES, verbose_name='ประเภทวัน')
    start_time   = models.TimeField(verbose_name='เวลาเริ่ม')
    end_time     = models.TimeField(verbose_name='เวลาสิ้นสุด')
    ot_hours     = models.DecimalField(max_digits=5, decimal_places=2, verbose_name='จำนวนชั่วโมง OT')
    rate_per_hour = models.DecimalField(max_digits=6, decimal_places=2, default=0, verbose_name='อัตราค่าตอบแทน (บาท/ชม.)')
    work_detail  = models.TextField(verbose_name='รายละเอียดงาน')
    location     = models.CharField(max_length=200, blank=True, verbose_name='สถานที่')
    amount       = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='ค่าตอบแทน (บาท)')
    status       = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft', verbose_name='สถานะ')

    # Approval chain
    head_approved_by   = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='head_approvals')
    head_approved_at   = models.DateTimeField(null=True, blank=True)
    head_note          = models.TextField(blank=True, verbose_name='หมายเหตุหัวหน้า')

    rep_forwarded_by   = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='rep_forwards')
    rep_forwarded_at   = models.DateTimeField(null=True, blank=True)
    rep_note           = models.TextField(blank=True, verbose_name='หมายเหตุตัวแทนแผนก')

    checker_approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='checker_approvals')
    checker_approved_at = models.DateTimeField(null=True, blank=True)
    checker_note        = models.TextField(blank=True, verbose_name='หมายเหตุผู้ตรวจสอบ')

    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-work_date']
        verbose_name = 'คำร้อง OT'

    def __str__(self):
        return f'{self.staff.get_full_name()} - {self.work_date} ({self.status})'


class TimeLog(models.Model):
    user        = models.ForeignKey(User, on_delete=models.CASCADE, related_name='time_logs')
    log_date    = models.DateField(verbose_name='วันที่')
    check_in    = models.TimeField(null=True, blank=True, verbose_name='เวลาเข้า')
    check_out   = models.TimeField(null=True, blank=True, verbose_name='เวลาออก')
    source_file       = models.CharField(max_length=200, blank=True, verbose_name='ไฟล์ต้นทาง')
    time_period       = models.CharField(max_length=10, choices=[('เช้า', 'เช้า'), ('ปกติ', 'ปกติ')], blank=True, verbose_name='กะการทำงาน')
    attendance_status = models.CharField(max_length=50, blank=True, verbose_name='สถานะเข้างาน')
    imported_at       = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-log_date']
        unique_together = ['user', 'log_date']
        verbose_name = 'ข้อมูลเวลา'

    def __str__(self):
        return f'{self.user.get_full_name()} - {self.log_date}'


class ImportHistory(models.Model):
    STATUS_CHOICES = [
        ('success', 'สำเร็จ'),
        ('failed',  'ล้มเหลว'),
        ('partial', 'สำเร็จบางส่วน'),
    ]

    filename     = models.CharField(max_length=200)
    imported_by  = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    imported_at  = models.DateTimeField(auto_now_add=True)
    status       = models.CharField(max_length=10, choices=STATUS_CHOICES)
    total_rows   = models.IntegerField(default=0)
    success_rows = models.IntegerField(default=0)
    error_rows   = models.IntegerField(default=0)
    error_detail = models.TextField(blank=True)
    rows_data    = models.JSONField(null=True, blank=True)

    class Meta:
        ordering = ['-imported_at']
        verbose_name = 'ประวัติการนำเข้า'


class AuditLog(models.Model):
    user       = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    action     = models.CharField(max_length=200, verbose_name='การกระทำ')
    model_name = models.CharField(max_length=100, blank=True)
    object_id  = models.CharField(max_length=50, blank=True)
    detail     = models.TextField(blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Audit Log'

    def __str__(self):
        return f'{self.user} - {self.action} ({self.created_at})'


class OTDeadline(models.Model):
    """กำหนดวันปิดรับคำร้อง OT รายเดือน
    thai_month: รูปแบบ 'YYYY-MM' ปีพุทธศักราช เช่น '2569-06'
    deadline_date: วันที่ปิดรับ (ปีคริสต์ศักราช) เช่น 2026-06-10
    """
    thai_month    = models.CharField(max_length=7, unique=True, verbose_name='เดือน (พ.ศ.)')
    deadline_date = models.DateField(verbose_name='วันปิดรับ')
    note          = models.CharField(max_length=200, blank=True, verbose_name='หมายเหตุ')
    created_by    = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                      related_name='ot_deadlines_created')
    created_at    = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-thai_month']
        verbose_name = 'กำหนดวันปิดรับ OT'

    def __str__(self):
        return f'{self.thai_month} → {self.deadline_date}'


class Notification(models.Model):
    NOTIF_TYPES = [
        ('ot_submitted',        'ยื่นคำร้อง OT ใหม่'),
        ('ot_head_approved',    'หัวหน้าอนุมัติ'),
        ('ot_head_rejected',    'หัวหน้าตีกลับ'),
        ('ot_rep_forwarded',    'ตัวแทนส่งต่อแล้ว'),
        ('ot_checker_approved', 'ผู้ตรวจสอบอนุมัติ'),
        ('ot_checker_rejected', 'ผู้ตรวจสอบตีกลับ'),
        ('no_ot_declared',      'แจ้งไม่มีโอทีประจำเดือน'),
    ]

    recipient  = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    message    = models.TextField(verbose_name='ข้อความ')
    notif_type = models.CharField(max_length=30, choices=NOTIF_TYPES)
    ot_request = models.ForeignKey('OTRequest', on_delete=models.SET_NULL, null=True, blank=True, related_name='notifications')
    is_read    = models.BooleanField(default=False, verbose_name='อ่านแล้ว')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'การแจ้งเตือน'

    def __str__(self):
        return f'{self.recipient.get_full_name()} — {self.notif_type}'


class NoOTDeclaration(models.Model):
    department  = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='no_ot_declarations')
    declared_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='no_ot_declarations')
    greg_year   = models.PositiveIntegerField()
    month       = models.PositiveSmallIntegerField()
    note        = models.TextField(blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('department', 'greg_year', 'month')
        ordering = ['-greg_year', '-month']

    def __str__(self):
        return f'{self.department} {self.greg_year}/{self.month:02d}'
