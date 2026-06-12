"""
คำสั่ง: python manage.py seed_data
สร้างข้อมูลตัวอย่างสำหรับ demo ทุก role
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import date, time
from api.models import User, Department, Holiday, SystemSettings, OTRequest, TimeLog


THAI_HOLIDAYS_2568 = [
    (date(2025, 1, 1),   'วันขึ้นปีใหม่'),
    (date(2025, 2, 12),  'วันมาฆบูชา'),
    (date(2025, 4, 6),   'วันจักรี'),
    (date(2025, 4, 13),  'วันสงกรานต์'),
    (date(2025, 4, 14),  'วันสงกรานต์'),
    (date(2025, 4, 15),  'วันสงกรานต์'),
    (date(2025, 5, 1),   'วันแรงงานแห่งชาติ'),
    (date(2025, 5, 5),   'วันฉัตรมงคล'),
    (date(2025, 5, 12),  'วันวิสาขบูชา'),
    (date(2025, 6, 3),   'วันเฉลิมพระชนมพรรษาสมเด็จพระราชินี'),
    (date(2025, 7, 28),  'วันเฉลิมพระชนมพรรษา ร.10'),
    (date(2025, 8, 12),  'วันแม่แห่งชาติ'),
    (date(2025, 10, 13), 'วันนวมินทรมหาราช'),
    (date(2025, 10, 23), 'วันปิยมหาราช'),
    (date(2025, 12, 5),  'วันพ่อแห่งชาติ'),
    (date(2025, 12, 10), 'วันรัฐธรรมนูญ'),
    (date(2025, 12, 31), 'วันสิ้นปี'),
]


class Command(BaseCommand):
    help = 'สร้างข้อมูลตัวอย่างสำหรับ demo'

    def handle(self, *args, **kwargs):
        self.stdout.write('🌱 เริ่ม seed data...')

        # 1. Departments
        dept_data = [
            ('งานทะเบียนนักศึกษา', 'REG'),
            ('งานหลักสูตร',         'CUR'),
            ('งานประเมินผล',        'EVA'),
            ('งานสารสนเทศ',         'IT'),
            ('งานการเงิน',          'FIN'),
        ]
        depts = {}
        for name, code in dept_data:
            d, _ = Department.objects.get_or_create(code=code, defaults={'name': name})
            depts[code] = d
        self.stdout.write('  ✅ Departments')

        # 2. Users (ทุก role)
        users_data = [
            # username, password, fname, lname, emp_id, role, dept_code, email
            ('admin',     'admin1234',  'ขวัญ',    'ใจดี',     'AD-001',   'admin',     'IT',  'kwan@tu.ac.th'),
            ('somchai',   'staff1234',  'สมชาย',   'สุขใจ',    'EMP-1024', 'staff',     'REG', 'somchai@tu.ac.th'),
            ('onanong',   'head1234',   'อรอนงค์', 'ใจกล้า',   'EMP-2001', 'depthead',  'REG', 'onanong@tu.ac.th'),
            ('panadda',   'rep1234',    'ปนัดดา',  'แสนดี',    'EMP-2014', 'deptrep',   'REG', 'panadda@tu.ac.th'),
            ('checker',   'chk1234',   'ยุ่น',     'ตรวจสอบ',  'CHK-001',  'checker',   'FIN', 'yun@tu.ac.th'),
            ('exec',      'exec1234',  'วิเชียร',  'ผู้นำ',    'EXE-001',  'executive', 'IT',  'wichian@tu.ac.th'),
            # นักศึกษาทดสอบด้วย @dome
            ('s6512345678', 'dome1234', 'นักศึกษา', 'ทดสอบ',  'STD-001',  'staff',     'REG', 's6512345678@dome.tu.ac.th'),
        ]
        users = {}
        for uname, pwd, fname, lname, emp_id, role, dept_code, email in users_data:
            if not User.objects.filter(username=uname).exists():
                u = User.objects.create_user(
                    username=uname, password=pwd,
                    first_name=fname, last_name=lname,
                    employee_id=emp_id, role=role,
                    department=depts[dept_code], email=email,
                )
                users[uname] = u
            else:
                users[uname] = User.objects.get(username=uname)
        self.stdout.write('  ✅ Users (ทุก role)')

        # 3. System Settings
        SystemSettings.objects.get_or_create(pk=1, defaults={
            'max_ot_hours_weekday': 4, 'max_ot_hours_holiday': 7,
            'rate_multiplier_weekday': 1.5, 'rate_multiplier_holiday': 3.0,
        })
        self.stdout.write('  ✅ System Settings')

        # 4. Holidays 2568
        for d, name in THAI_HOLIDAYS_2568:
            Holiday.objects.get_or_create(date=d, defaults={
                'name': name, 'holiday_type': 'official',
                'year': 2568, 'is_system': True,
            })
        # วันหยุดชดเชย
        Holiday.objects.get_or_create(
            date=date(2025, 4, 18),
            defaults={'name': 'ชดเชยวันสงกรานต์', 'holiday_type': 'compensation', 'year': 2568, 'is_system': False}
        )
        self.stdout.write('  ✅ Holidays 2568')

        # 5. OT Requests ตัวอย่าง
        sample_ots = [
            (users['somchai'], depts['REG'], date(2025, 5, 3),  time(17,0), time(21,0), 4.0, 'ปิดภาคการศึกษา ต้องอัปเดตข้อมูล', 'submitted'),
            (users['somchai'], depts['REG'], date(2025, 5, 10), time(17,0), time(19,0), 2.0, 'จัดทำรายงานผล', 'head_approved'),
            (users['somchai'], depts['REG'], date(2025, 4, 13), time(8,0),  time(15,0), 7.0, 'เปิดระบบลงทะเบียน (วันสงกรานต์)', 'checker_approved'),
            (users['somchai'], depts['REG'], date(2025, 4, 20), time(17,0), time(20,0), 3.0, 'สรุปผลการลงทะเบียน', 'head_rejected'),
        ]
        for staff, dept, wdate, st, et, hrs, detail, sts in sample_ots:
            is_hol = Holiday.objects.filter(date=wdate).exists() or wdate.weekday() >= 5
            day_type = 'holiday' if is_hol else 'weekday'
            rate = 3.0 if is_hol else 1.5
            amount = float(hrs) * rate * 100
            OTRequest.objects.get_or_create(
                staff=staff, work_date=wdate,
                defaults={
                    'department': dept, 'day_type': day_type,
                    'start_time': st, 'end_time': et,
                    'ot_hours': hrs, 'work_detail': detail,
                    'amount': amount, 'status': sts,
                }
            )
        self.stdout.write('  ✅ OT Requests ตัวอย่าง')

        self.stdout.write(self.style.SUCCESS('\n🎉 seed_data เสร็จสมบูรณ์!'))
        self.stdout.write('\n📋 บัญชีสำหรับทดสอบ:')
        self.stdout.write('  admin       / admin1234  → ผู้ดูแลระบบ')
        self.stdout.write('  somchai     / staff1234  → พนักงาน')
        self.stdout.write('  onanong     / head1234   → หัวหน้าแผนก')
        self.stdout.write('  panadda     / rep1234    → ตัวแทนแผนก')
        self.stdout.write('  checker     / chk1234    → ผู้ตรวจสอบ')
        self.stdout.write('  exec        / exec1234   → ผู้บริหาร')
        self.stdout.write('  s6512345678 / dome1234   → ทดสอบด้วย @dome.tu.ac.th')
