# -*- coding: utf-8 -*-
import sys, io, django, os, re, openpyxl
os.environ['DJANGO_SETTINGS_MODULE'] = 'smart_ot.settings'
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
django.setup()
from api.models import User, Department

HONORIFICS = [
    'รองศาสตราจารย์ ดร.','ผู้ช่วยศาสตราจารย์ ดร.','รองศาสตราจารย์',
    'ศาสตราจารย์ ดร.','ศาสตราจารย์','ว่าที่ ร.ต.','ว่าที่ร.ต.',
    'อาจารย์ ดร.','อาจารย์','นางสาว','นาง','นาย','ดร.',
]

def strip_h(name):
    name = name.strip()
    for h in sorted(HONORIFICS, key=len, reverse=True):
        if name.startswith(h):
            name = name[len(h):].strip()
            break
    parts = name.split()
    return (parts[0] if parts else name), (' '.join(parts[1:]) if len(parts) > 1 else '')

# Load email mapping from file 05
tu_map = {}
wb5 = openpyxl.load_workbook(r'C:\Users\ASUS\Downloads\05.รายชื่อ_อีเมล_tu.ac.th-reg.tu.ac.th.xlsx', data_only=True)
ws5 = wb5.active
for row in ws5.iter_rows(min_row=2, values_only=True):
    vals = list(row) + [None] * 5
    reg = str(vals[3] or '').strip().lower()
    tu = str(vals[4] or '').strip().lower()
    if reg and tu:
        tu_map[reg] = tu

# Parse file 04
wb = openpyxl.load_workbook(r'C:\Users\ASUS\Downloads\04. รายชื่อ + อีเมล.xlsx', data_only=True)
ws = wb.active
skip = {'ชื่อ-สกุล', 'รายชื่อบุคลากรสำนักงานทะเบียนนักศึกษา', ''}

current_dept = None
updated = 0
not_found = 0

for row in ws.iter_rows(min_row=1, values_only=True):
    vals = list(row) + [None] * 4
    seq_raw, name_raw, position_raw, email_raw = vals[:4]
    name_str = str(name_raw or '').strip()
    if not name_str or name_str in skip:
        continue

    # Section header = department
    if seq_raw is None:
        code = re.sub(r'[^a-zA-Z0-9]', '_', name_str)[:20].upper()
        dept, created = Department.objects.get_or_create(
            name=name_str,
            defaults={'code': code}
        )
        current_dept = dept
        if created:
            print(f'  [DEPT NEW] {name_str}')
        continue

    if not str(seq_raw).strip().isdigit():
        continue

    first, last = strip_h(name_str)
    position = str(position_raw or '').strip().replace('\n', ' ')
    reg_email = str(email_raw or '').strip().lower()
    tu_email = tu_map.get(reg_email, '')

    # Match user
    user = User.objects.filter(first_name=first, last_name=last).first()
    if not user and last:
        user = User.objects.filter(first_name=first, last_name__startswith=last[:3]).first()

    if not user:
        not_found += 1
        print(f'  [SKIP] {first} {last} - not found in DB')
        continue

    changed = False
    if current_dept:
        user.department = current_dept
        changed = True
    if tu_email and user.email != tu_email:
        user.email = tu_email
        changed = True
    if reg_email and user.notify_email != reg_email:
        user.notify_email = reg_email
        changed = True

    if changed:
        user.save()
        updated += 1
        dept_name = current_dept.name if current_dept else '-'
        print(f'  [OK] {user.username} ({first} {last}) -> {dept_name} | {tu_email}')

print(f'\nUpdated: {updated}, Not found: {not_found}')
print(f'Total users: {User.objects.filter(is_active=True).count()}')
