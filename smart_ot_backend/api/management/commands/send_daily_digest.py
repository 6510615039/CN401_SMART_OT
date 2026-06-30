"""
python manage.py send_daily_digest

ส่ง email digest รายวัน สรุปกิจกรรม OT ของวันที่ผ่านมา แยกตาม role
ตั้งรันทุกวันเวลา 18:00 ด้วย Windows Task Scheduler หรือ cron:
  Windows: schtasks /create /tn "SmartOT_Digest" /tr "python manage.py send_daily_digest" /sc DAILY /st 18:00
  Linux cron: 0 18 * * * /path/to/venv/bin/python manage.py send_daily_digest

Scope ตาม role:
  staff     — คำร้องของตัวเองที่มีสถานะเปลี่ยนในวันนี้
  depthead  — คำร้องใหม่ที่รอการพิจารณาในแผนก
  deptrep   — คำร้องที่ head_approved และรอส่งต่อในแผนก
  checker   — คำร้องที่ rep_forwarded และรอตรวจสอบทั้งระบบ
"""
from django.core.management.base import BaseCommand
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
from api.models import User, OTRequest, Notification


ROLE_DISPLAY = {
    'staff': 'พนักงาน',
    'depthead': 'หัวหน้างาน',
    'deptrep': 'ตัวแทนฝ่าย',
    'checker': 'ผู้ตรวจสอบ',
}


def _send(to_email: str, subject: str, body: str):
    try:
        send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, [to_email], fail_silently=True)
    except Exception:
        pass


class Command(BaseCommand):
    help = 'ส่ง email digest รายวันให้แต่ละ role'

    def handle(self, *args, **options):
        today = timezone.localdate()
        yesterday = today - timedelta(days=1)

        sent = 0

        # ─── staff: สรุปสถานะคำร้องของตัวเองที่เปลี่ยนเมื่อวาน ───
        staff_users = User.objects.filter(role='staff', is_active=True).exclude(notify_email='')
        for user in staff_users:
            email = user.notify_email or user.email
            if not email:
                continue
            changed = OTRequest.objects.filter(
                staff=user,
                updated_at__date=yesterday,
            ).exclude(status='submitted')
            if not changed.exists():
                continue
            lines = [f'สรุปสถานะคำร้อง OT ของคุณ {user.get_full_name()} ประจำวันที่ {yesterday.strftime("%d/%m/%Y")}\n']
            for r in changed:
                lines.append(f'  • วันที่ทำ OT: {r.work_date}  สถานะ: {r.get_status_display()}')
            lines.append('\nกรุณาเข้าสู่ระบบเพื่อตรวจสอบรายละเอียด')
            _send(email, f'[Smart OT] สรุปสถานะคำร้อง OT วันที่ {yesterday}', '\n'.join(lines))
            sent += 1

        # ─── depthead: คำร้องใหม่รออนุมัติในแผนก ───
        head_users = User.objects.filter(role='depthead', is_active=True).exclude(notify_email='')
        for user in head_users:
            email = user.email
            if not email or not user.department:
                continue
            pending = OTRequest.objects.filter(
                staff__department=user.department,
                status='submitted',
            )
            if not pending.exists():
                continue
            lines = [
                f'สรุปคำร้อง OT รออนุมัติ — แผนก {user.department.name}',
                f'ณ วันที่ {today.strftime("%d/%m/%Y")} มีคำร้องรออนุมัติ {pending.count()} รายการ',
                '',
                'กรุณาเข้าสู่ระบบเพื่อดำเนินการอนุมัติ',
            ]
            _send(email, f'[Smart OT] คำร้อง OT รออนุมัติ {pending.count()} รายการ', '\n'.join(lines))
            sent += 1

        # ─── deptrep: คำร้องที่ head_approved รอส่งต่อในแผนก ───
        rep_users = User.objects.filter(role='deptrep', is_active=True).exclude(notify_email='')
        for user in rep_users:
            email = user.email
            if not email or not user.department:
                continue
            waiting = OTRequest.objects.filter(
                department=user.department,
                status='head_approved',
            )
            if not waiting.exists():
                continue
            lines = [
                f'สรุปคำร้อง OT รอส่งต่อ — แผนก {user.department.name}',
                f'ณ วันที่ {today.strftime("%d/%m/%Y")} มีคำร้องที่หัวหน้าอนุมัติแล้ว {waiting.count()} รายการ รอการส่งต่อ',
                '',
                'กรุณาเข้าสู่ระบบเพื่อดำเนินการส่งออก',
            ]
            _send(email, f'[Smart OT] คำร้อง OT รอส่งต่อ {waiting.count()} รายการ', '\n'.join(lines))
            sent += 1

        # ─── checker: คำร้องทั้งหมดที่ rep_forwarded รอตรวจสอบ ───
        checker_users = User.objects.filter(role='checker', is_active=True).exclude(notify_email='')
        for user in checker_users:
            email = user.notify_email or user.email
            if not email:
                continue
            waiting = OTRequest.objects.filter(status='rep_forwarded')
            if not waiting.exists():
                continue
            lines = [
                f'สรุปคำร้อง OT รอตรวจสอบ',
                f'ณ วันที่ {today.strftime("%d/%m/%Y")} มีคำร้องที่รอการตรวจสอบ {waiting.count()} รายการ',
                '',
                'กรุณาเข้าสู่ระบบเพื่อดำเนินการ',
            ]
            _send(email, f'[Smart OT] คำร้อง OT รอตรวจสอบ {waiting.count()} รายการ', '\n'.join(lines))
            sent += 1

        self.stdout.write(self.style.SUCCESS(f'ส่ง digest email {sent} ฉบับ'))
