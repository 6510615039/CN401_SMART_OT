"""
อัปเดต/สร้าง User และ Department จากไฟล์ Excel mapping

วิธีใช้:
    python manage.py update_staff_from_mapping "path/to/mapping.xlsx" --dry-run
    python manage.py update_staff_from_mapping "path/to/mapping.xlsx"

Header ที่ต้องมีในไฟล์ Excel (แถวแรก):
    employee_id, ชื่อ (ไฟล์รหัส), สังกัด, ชื่อ (ไฟล์อีเมล), email_reg, email_tu, หมายเหตุ

สิ่งที่ command ทำ:
  - สร้าง/หา Department จากคอลัมน์ "สังกัด" — code = 3 grapheme cluster แรกของชื่อแผนก + running number
    เช่น "ผู้บริหาร" → "ผู้บริ_1"
  - หา User ด้วย employee_id แล้วอัปเดต first_name/last_name/email/notify_email/department
  - ถ้าไม่พบ User → สร้างใหม่ด้วย username = ส่วนหน้า @ ของ email_tu, password = employee_id
"""

import unicodedata

import openpyxl
from django.core.management.base import BaseCommand, CommandError

from api.models import User, Department

REQUIRED_HEADERS = [
    'employee_id', 'ชื่อ (ไฟล์รหัส)', 'สังกัด',
    'ชื่อ (ไฟล์อีเมล)', 'email_reg', 'email_tu', 'หมายเหตุ',
]


def thai_first_clusters(name, n=3):
    """คืนค่า n grapheme cluster แรกของชื่อ (พยัญชนะไทย + วรรณยุกต์/สระบนล่างที่ติดกัน นับเป็น 1 ตัว)"""
    clusters = []
    for ch in name:
        if clusters and unicodedata.category(ch) in ('Mn', 'Mc'):
            clusters[-1] += ch
        else:
            clusters.append(ch)
    return ''.join(clusters[:n])


def cell_str(v):
    if v is None:
        return ''
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v).strip()


class Command(BaseCommand):
    help = 'อัปเดต/สร้าง User และ Department จากไฟล์ Excel mapping'

    def add_arguments(self, parser):
        parser.add_argument('excel_path', type=str, help='Path ของไฟล์ Excel mapping')
        parser.add_argument('--dry-run', action='store_true', help='แสดงผลโดยไม่บันทึกจริง')

    def handle(self, *args, **options):
        excel_path = options['excel_path']
        dry_run = options['dry_run']

        try:
            wb = openpyxl.load_workbook(excel_path, data_only=True)
        except FileNotFoundError:
            raise CommandError(f'ไม่พบไฟล์: {excel_path}')

        ws = wb.active
        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            raise CommandError('ไฟล์ Excel ไม่มีข้อมูล')

        header = [cell_str(c) for c in rows[0]]
        col = {}
        for name in REQUIRED_HEADERS:
            if name not in header:
                raise CommandError(f'ไม่พบคอลัมน์ "{name}" ใน header ของไฟล์')
            col[name] = header.index(name)

        data_rows = rows[1:]

        # ── สร้าง/หา Department จากคอลัมน์ "สังกัด" ─────────────────────
        dept_names = []
        for row in data_rows:
            dept_name = cell_str(row[col['สังกัด']]) if col['สังกัด'] < len(row) else ''
            if dept_name and dept_name not in dept_names:
                dept_names.append(dept_name)

        used_codes = set(Department.objects.values_list('code', flat=True))
        dept_map = {}
        depts_created = 0

        for dept_name in dept_names:
            dept = Department.objects.filter(name=dept_name).first()
            if dept:
                dept_map[dept_name] = dept
                continue

            prefix = thai_first_clusters(dept_name, 3)
            n = 1
            while f'{prefix}_{n}' in used_codes:
                n += 1
            code = f'{prefix}_{n}'
            used_codes.add(code)

            if dry_run:
                self.stdout.write(f'[DRY-RUN] จะสร้างแผนกใหม่: {dept_name} (code={code})')
                dept_map[dept_name] = Department(name=dept_name, code=code)
            else:
                dept_map[dept_name] = Department.objects.create(name=dept_name, code=code)
                self.stdout.write(f'  ✓ สร้างแผนก: {dept_name} (code={code})')
            depts_created += 1

        # ── ประมวลผลแต่ละแถว ────────────────────────────────────────
        updated = created = not_found = 0

        for row in data_rows:
            emp_id = cell_str(row[col['employee_id']]) if col['employee_id'] < len(row) else ''
            if not emp_id:
                not_found += 1
                continue

            full_name_id = cell_str(row[col['ชื่อ (ไฟล์รหัส)']]) if col['ชื่อ (ไฟล์รหัส)'] < len(row) else ''
            dept_name    = cell_str(row[col['สังกัด']])           if col['สังกัด']           < len(row) else ''
            email_reg    = cell_str(row[col['email_reg']])        if col['email_reg']        < len(row) else ''
            email_tu     = cell_str(row[col['email_tu']])         if col['email_tu']         < len(row) else ''

            parts = full_name_id.split(' ', 1)
            first_name = parts[0] if parts else ''
            last_name  = parts[1] if len(parts) > 1 else ''

            dept = dept_map.get(dept_name)
            user = User.objects.filter(employee_id=emp_id).first()

            if user:
                if dry_run:
                    self.stdout.write(
                        f'[DRY-RUN] จะอัปเดต {emp_id}: {first_name} {last_name}, '
                        f'email={email_tu}, notify_email={email_reg}, dept={dept_name}'
                    )
                else:
                    user.first_name   = first_name
                    user.last_name    = last_name
                    user.email        = email_tu
                    user.notify_email = email_reg
                    user.department   = dept
                    user.save()
                    self.stdout.write(f'  ✓ อัปเดต {emp_id}: {first_name} {last_name}')
                updated += 1
            else:
                username = email_tu.split('@')[0] if '@' in email_tu else emp_id
                if dry_run:
                    self.stdout.write(
                        f'[DRY-RUN] จะสร้างใหม่ {emp_id}: username={username}, '
                        f'{first_name} {last_name}, email={email_tu}, dept={dept_name}'
                    )
                else:
                    new_user = User(
                        username=username,
                        first_name=first_name,
                        last_name=last_name,
                        email=email_tu,
                        notify_email=email_reg,
                        employee_id=emp_id,
                        department=dept,
                        role='staff',
                    )
                    new_user.set_password(emp_id)
                    new_user.save()
                    self.stdout.write(f'  ✓ สร้างใหม่ {emp_id}: username={username} ({first_name} {last_name})')
                created += 1

        self.stdout.write('\n' + '=' * 60)
        self.stdout.write(self.style.SUCCESS(
            f'สรุป: สร้างแผนก {depts_created} อัน, อัปเดต {updated} คน, '
            f'สร้างใหม่ {created} คน, ไม่พบ {not_found} คน'
        ))
