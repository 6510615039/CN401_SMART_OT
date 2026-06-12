"""
Import รายชื่อบุคลากรจาก Excel เข้าระบบ

วิธีใช้:
    python manage.py import_staff_roster "path/to/รายชื่อบุคลากร.xlsx"

สิ่งที่ command ทำ:
  - สร้าง User ทุกคนด้วย role='staff' + department ที่ตรงกัน
  - Username = ชื่อไทย (ตัวแรก) + ลำดับ เช่น สาริยา_4
  - Password = tustaff2025 (ทุกคน)
  - Admin ไปเปลี่ยน TU username / role ได้ทีหลังใน Admin → Users
"""

import re
import sys
from django.core.management.base import BaseCommand, CommandError
import openpyxl
from api.models import User, Department

# คำนำหน้านามที่ต้องตัดออก
HONORIFICS = [
    'รองศาสตราจารย์ ดร.', 'ศาสตราจารย์ ดร.', 'ผู้ช่วยศาสตราจารย์ ดร.',
    'รองศาสตราจารย์', 'ศาสตราจารย์', 'ผู้ช่วยศาสตราจารย์',
    'ว่าที่ ร.ต.', 'ว่าที่ร.ต.', 'ว่าที่ร.อ.',
    'อาจารย์ ดร.', 'อาจารย์',
    'นางสาว', 'นาง', 'นาย', 'ดร.',
]

DEFAULT_PASSWORD = 'tustaff2025'
DEPT_NAME = 'สำนักงานทะเบียนนักศึกษา'


def strip_honorific(full_name: str) -> tuple[str, str]:
    """ตัดคำนำหน้า แล้วแยกชื่อ-นามสกุล"""
    name = full_name.strip()
    for h in sorted(HONORIFICS, key=len, reverse=True):
        if name.startswith(h):
            name = name[len(h):].strip()
            break
    parts = name.split()
    first = parts[0] if parts else name
    last = ' '.join(parts[1:]) if len(parts) > 1 else ''
    return first.strip(), last.strip()


def make_username(first_name: str, seq: int) -> str:
    """สร้าง username จากชื่อ + ลำดับ"""
    clean = re.sub(r'[^฀-๿a-zA-Z0-9]', '', first_name)
    return f'{clean}_{seq}'


class Command(BaseCommand):
    help = 'Import รายชื่อบุคลากรจากไฟล์ Excel'

    def add_arguments(self, parser):
        parser.add_argument('xlsx_path', type=str, help='Path ของไฟล์ Excel')
        parser.add_argument('--password', default=DEFAULT_PASSWORD,
                            help=f'รหัสผ่านเริ่มต้น (default: {DEFAULT_PASSWORD})')
        parser.add_argument('--dry-run', action='store_true',
                            help='แสดงผลโดยไม่บันทึกจริง')

    def handle(self, *args, **options):
        path = options['xlsx_path']
        password = options['password']
        dry_run = options['dry_run']

        try:
            wb = openpyxl.load_workbook(path)
        except FileNotFoundError:
            raise CommandError(f'ไม่พบไฟล์: {path}')

        ws = wb.active

        # สร้าง Department หลัก
        main_dept, _ = Department.objects.get_or_create(
            name=DEPT_NAME, defaults={'code': 'REG'}
        )

        current_sub_dept = None   # section header ปัจจุบัน
        created = []
        skipped = []

        for row in ws.iter_rows(values_only=True):
            seq, name_raw, position, _ = (row + (None, None, None, None))[:4]

            # ข้ามแถวหัวตาราง / แถวว่าง
            if not name_raw:
                continue
            name_raw = str(name_raw).strip()
            if name_raw in ('ชื่อ-สกุล', 'รายชื่อบุคลากรสำนักงานทะเบียน '):
                continue

            # แถว section header (seq = None แต่มีชื่อ)
            if seq is None:
                current_sub_dept_name = name_raw
                if not dry_run:
                    current_sub_dept, _ = Department.objects.get_or_create(
                        name=current_sub_dept_name,
                        defaults={'code': current_sub_dept_name[:15].upper().replace(' ', '_')},
                    )
                self.stdout.write(self.style.WARNING(f'\n── {name_raw} ──'))
                continue

            # แถวพนักงาน
            first, last = strip_honorific(name_raw)
            username = make_username(first, seq)
            pos = str(position).strip() if position else ''

            dept_to_use = current_sub_dept if current_sub_dept else main_dept

            if User.objects.filter(username=username).exists():
                skipped.append(username)
                self.stdout.write(f'  ~ ข้าม {username} (มีอยู่แล้ว)')
                continue

            if not dry_run:
                user = User(
                    username=username,
                    first_name=first,
                    last_name=last,
                    email='',
                    role='staff',
                    department=dept_to_use,
                    is_active=True,
                )
                user.set_password(password)
                user.save()

            created.append({'seq': seq, 'username': username, 'name': f'{first} {last}', 'dept': dept_to_use.name if dept_to_use and not dry_run else (current_sub_dept_name if current_sub_dept else DEPT_NAME), 'pos': pos})
            flag = '[DRY]' if dry_run else '✓'
            self.stdout.write(f'  {flag} {seq:>3}. {username:<20} {first} {last}')

        # สรุป
        self.stdout.write('\n' + '='*60)
        self.stdout.write(self.style.SUCCESS(
            f'\nสร้าง {len(created)} บัญชี | ข้าม {len(skipped)} บัญชี (มีอยู่แล้ว)'
        ))
        if not dry_run and created:
            self.stdout.write(f'Password เริ่มต้น: {password}')
            self.stdout.write('\nขั้นตอนต่อไป:')
            self.stdout.write('  1. Login ด้วย admin → ไปหน้า "จัดการผู้ใช้"')
            self.stdout.write('  2. แก้ username ให้ตรงกับ TU username จริงของแต่ละคน')
            self.stdout.write('  3. กำหนด role ที่เหมาะสม (depthead, deptrep, checker)')
            self.stdout.write('\nตาราง username ที่สร้าง:')
            self.stdout.write(f'  {"seq":<5} {"username":<25} {"ชื่อ":<25} {"งาน"}')
            self.stdout.write('  ' + '-'*80)
            for c in created:
                self.stdout.write(f'  {c["seq"]:<5} {c["username"]:<25} {c["name"]:<25} {c["dept"]}')
