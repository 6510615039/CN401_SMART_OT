"""
สร้างบัญชีนักศึกษาสำหรับทดสอบการเข้าสู่ระบบ

วิธีใช้:
    python manage.py create_test_students

รูปแบบการ login:
    - อีเมล:    s6512345678@dome.tu.ac.th  (password: test1234)
    - username: s6512345678               (password: test1234)
"""

from django.core.management.base import BaseCommand
from api.models import User, Department


# ---- แก้ไขรายชื่อสมาชิกทีมได้ตรงนี้ ----
STUDENTS = [
    # (student_id,   first_name,  last_name,      role,        dept_name)
    ('s6512345671', 'นักศึกษา',   'คนที่หนึ่ง',   'staff',     'สำนักทะเบียน'),
    ('s6512345672', 'นักศึกษา',   'คนที่สอง',    'staff',     'สำนักทะเบียน'),
    ('s6512345673', 'นักศึกษา',   'คนที่สาม',    'depthead',  'สำนักทะเบียน'),
    ('s6512345674', 'นักศึกษา',   'คนที่สี่',    'rep',       'สำนักทะเบียน'),
    ('s6512345675', 'นักศึกษา',   'คนที่ห้า',    'checker',   'สำนักทะเบียน'),
]

DEFAULT_PASSWORD = 'test1234'
EMAIL_DOMAIN    = 'dome.tu.ac.th'
# -----------------------------------------


class Command(BaseCommand):
    help = 'สร้างบัญชีนักศึกษาทดสอบ'

    def add_arguments(self, parser):
        parser.add_argument(
            '--password', default=DEFAULT_PASSWORD,
            help=f'รหัสผ่านสำหรับบัญชีทดสอบ (default: {DEFAULT_PASSWORD})'
        )
        parser.add_argument(
            '--domain', default=EMAIL_DOMAIN,
            help=f'email domain (default: {EMAIL_DOMAIN})'
        )

    def handle(self, *args, **options):
        password = options['password']
        domain   = options['domain']

        for sid, fname, lname, role, dept_name in STUDENTS:
            dept, _ = Department.objects.get_or_create(
                name=dept_name,
                defaults={'code': dept_name[:10]}
            )
            email = f'{sid}@{domain}'
            user, created = User.objects.get_or_create(
                username=sid,
                defaults={
                    'first_name':  fname,
                    'last_name':   lname,
                    'email':       email,
                    'employee_id': sid,
                    'role':        role,
                    'department':  dept,
                    'is_active':   True,
                }
            )
            if created:
                user.set_password(password)
                user.save()
                self.stdout.write(self.style.SUCCESS(
                    f'  ✓ สร้าง {email}  role={role}'
                ))
            else:
                # อัปเดต email/password ถ้ามีอยู่แล้ว
                user.email = email
                user.set_password(password)
                user.save()
                self.stdout.write(
                    f'  ~ อัปเดต {email}  (มีอยู่แล้ว)'
                )

        self.stdout.write(self.style.SUCCESS(
            f'\nเสร็จสิ้น — password ทุกบัญชี: {password}'
        ))
        self.stdout.write(
            f'login ด้วย: <student_id>@{domain}  หรือ  <student_id>'
        )
