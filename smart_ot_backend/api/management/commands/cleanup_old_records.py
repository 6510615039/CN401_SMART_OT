"""
python manage.py cleanup_old_records

ลบ records เก่าตาม retention policy:
  - Notification  > 90 วัน
  - AuditLog      > 365 วัน (1 ปี)

เรียกด้วย cron หรือ Task Scheduler ทุกคืนเที่ยงคืน เช่น:
  Windows Task Scheduler: python manage.py cleanup_old_records
  Linux cron: 0 0 * * * /path/to/venv/bin/python manage.py cleanup_old_records
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from api.models import Notification, AuditLog


class Command(BaseCommand):
    help = 'ลบ Notification เก่ากว่า 90 วัน และ AuditLog เก่ากว่า 1 ปี'

    def handle(self, *args, **options):
        now = timezone.now()

        notif_cutoff = now - timedelta(days=90)
        deleted_notif, _ = Notification.objects.filter(created_at__lt=notif_cutoff).delete()
        self.stdout.write(self.style.SUCCESS(f'ลบ Notification {deleted_notif} รายการ (เก่ากว่า 90 วัน)'))

        audit_cutoff = now - timedelta(days=365)
        deleted_audit, _ = AuditLog.objects.filter(created_at__lt=audit_cutoff).delete()
        self.stdout.write(self.style.SUCCESS(f'ลบ AuditLog {deleted_audit} รายการ (เก่ากว่า 1 ปี)'))
