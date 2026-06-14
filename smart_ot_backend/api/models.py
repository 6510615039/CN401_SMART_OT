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
    phone        = models.CharField(max_length=20, blank=True, verbose_name='เบอร์โทร')
    notify_email = models.EmailField(blank=True, verbose_name='อีเมลสำหรับแจ้งเตือน')
    is_active    = models.BooleanField(default=True)

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
    TIME_PERIOD_CHOICES = [
        ('morning', 'กะเช้า (เริ่ม OT 16:00)'),
        ('normal',  'กะปกติ (เริ่ม OT 16:30)'),
    ]
    ATTENDANCE_STATUS_CHOICES = [
        ('present',  'มาทำงาน'),
        ('absent',   'ขาดงาน'),
        ('leave',    'ลา'),
        ('holiday',  'วันหยุด'),
    ]

    user              = models.ForeignKey(User, on_delete=models.CASCADE, related_name='time_logs')
    log_date          = models.DateField(verbose_name='วันที่')
    check_in          = models.TimeField(null=True, blank=True, verbose_name='เวลาเข้า')
    check_out         = models.TimeField(null=True, blank=True, verbose_name='เวลาออก')
    time_period       = models.CharField(max_length=10, choices=TIME_PERIOD_CHOICES, default='normal', verbose_name='กะ')
    attendance_status = models.CharField(max_length=10, choices=ATTENDANC