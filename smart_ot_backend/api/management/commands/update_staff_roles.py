"""
กำหนด role ของ User จากไฟล์ Excel

วิธีใช้:
    python manage.py update_staff_roles "path/to/roles.xlsx" --dry-run
    python manage.py update_staff_roles "path/to/roles.xlsx"

Header ที่คาดหวัง (แถวแรก):
    ID | Name | สังกัด | <ไม่มีชื่อ — คือ role>

Role mapping:
    "หัวหน้างาน"           → role=depthead,  extra_roles=[staff]
    "ตัวแทน"/"ตัวแทนฝ่าย" → role=deptrep,   extra_roles=[staff]
    "ผู้ตรวจสอบ"           → role=checker,   extra_roles=[staff]
    "แอดมิน / ตัวแทนฝ่าย" → role=admin,     extra_roles=[staff, deptrep]
    "แอดมิน"               → role=admin,     extra_roles=[staff]
    ว่าง/None              → role=staff,     extra_roles=[]
"""

import openpyxl
from django.core.management.base import BaseCommand, CommandError

from api.models import User


ROLE_MAP = {
    'หัวหน้างาน':           ('depthead', ['staff']),
    'ตัวแทน':               ('deptrep',  ['staff']),
    'ตัวแทนฝ่าย':           ('deptrep',  ['staff']),
    'ผู้ตรวจสอบ':           ('checker',  ['staff']),
    'แอดมิน / ตัวแทนฝ่าย': ('admin',    ['staff', 'deptrep']),
    'แอดมิน':               ('admin',    ['staff']),
}


def parse_emp_id(cell_val):
    """แปลงค่าจาก Excel เป็น employee_id 4 หลัก เช่น 6 → '0006', '0006' → '0006'"""
    if cell_val is None:
        return ''
    if isinstance(cell_val, float) and cell_val.is_integer():
        cell_val = int(cell_val)
    return str(cell_val).strip().zfill(4)


class Command(BaseCommand):
    help = 'กำหนด role/extra_roles ของ User จากไฟล์ Excel'

    def add_arguments(self, parser):
        parser.add_argument('excel_path', type=str, help='Path ของไฟล์ Excel')
        parser.add_argument('--dry-run', action='store_true', help='แสดงผลโดยไม่บันทึกจริง')

    def handle(self, *args, **options):
        excel_path = options['excel_path']
        dry_run = options['dry_run']

        if dry_run:
            self.stdout.write(self.style.WARNING('*** DRY-RUN MODE (ไม่มีการบันทึกจริง) ***'))

        try:
            wb = openpyxl.load_workbook(excel_path, data_only=True)
        except FileNotFoundError:
            raise CommandError(f'ไม่พบไฟล์: {excel_path}')

        ws = wb.active
        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            raise CommandError('ไฟล์ Excel ไม่มีข้อมูล')

        data_rows = rows[1:]  # ข้าม header

        updated = not_found = skipped = 0

        for row in data_rows:
            if not any(row):
                continue

            emp_id = parse_emp_id(row[0] if len(row) > 0 else None)
            if not emp_id or emp_id == '0000':
                skipped += 1
                continue

            role_raw = str(row[3] if len(row) > 3 and row[3] is not None else '').strip()
            role, extra_roles = ROLE_MAP.get(role_raw, ('staff', []))

            user = User.objects.filter(employee_id=emp_id).first()
            if not user:
                self.stdout.write(self.style.WARNING(f'  ✗ ไม่พบ employee_id={emp_id}'))
                not_found += 1
                continue

            if dry_run:
                self.stdout.write(
                    f'[DRY-RUN] {emp_id} {user.get_full_name()}: '
                    f'role={role}, extra_roles={extra_roles}'
                )
            else:
                user.role        = role
                user.extra_roles = extra_roles
                user.save(update_fields=['role', 'extra_roles'])
                self.stdout.write(
                    f'  ✓ {emp_id} {user.get_full_name()}: role={role}, extra_roles={extra_roles}'
                )
            updated += 1

        self.stdout.write('\n' + '=' * 60)
        self.stdout.write(self.style.SUCCESS(
            f'สรุป: อัปเดต {updated} คน, ไม่พบ {not_found} คน, ข้าม {skipped} แถว'
        ))
