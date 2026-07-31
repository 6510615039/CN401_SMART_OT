"""
python manage.py seed_initial

สร้างข้อมูลพื้นฐานสำหรับ production:
  - SystemSettings (เกณฑ์ OT)
  - วันหยุดประจำปี 2568–2569
ไม่สร้าง demo users หรือ demo departments
"""
from datetime import date
from django.core.management.base import BaseCommand
from api.models import Holiday, SystemSettings


HOLIDAYS = [
    # 2568
    (date(2025, 1, 1),   'วันขึ้นปีใหม่',                         2568, 'official'),
    (date(2025, 2, 12),  'วันมาฆบูชา',                            2568, 'official'),
    (date(2025, 4, 6),   'วันจักรี',                               2568, 'official'),
    (date(2025, 4, 13),  'วันสงกรานต์',                            2568, 'official'),
    (date(2025, 4, 14),  'วันสงกรานต์',                            2568, 'official'),
    (date(2025, 4, 15),  'วันสงกรานต์',                            2568, 'official'),
    (date(2025, 4, 18),  'ชดเชยวันสงกรานต์',                      2568, 'compensation'),
    (date(2025, 5, 1),   'วันแรงงานแห่งชาติ',                     2568, 'official'),
    (date(2025, 5, 5),   'วันฉัตรมงคล',                            2568, 'official'),
    (date(2025, 5, 12),  'วันวิสาขบูชา',                           2568, 'official'),
    (date(2025, 6, 3),   'วันเฉลิมพระชนมพรรษาสมเด็จพระราชินี',   2568, 'official'),
    (date(2025, 7, 28),  'วันเฉลิมพระชนมพรรษา ร.10',             2568, 'official'),
    (date(2025, 8, 12),  'วันแม่แห่งชาติ',                         2568, 'official'),
    (date(2025, 10, 13), 'วันนวมินทรมหาราช',                      2568, 'official'),
    (date(2025, 10, 23), 'วันปิยมหาราช',                           2568, 'official'),
    (date(2025, 12, 5),  'วันพ่อแห่งชาติ',                         2568, 'official'),
    (date(2025, 12, 10), 'วันรัฐธรรมนูญ',                          2568, 'official'),
    (date(2025, 12, 31), 'วันสิ้นปี',                              2568, 'official'),
    # 2569
    (date(2026, 1, 1),   'วันขึ้นปีใหม่',                         2569, 'official'),
    (date(2026, 3, 3),   'วันมาฆบูชา',                            2569, 'official'),
    (date(2026, 4, 6),   'วันจักรี',                               2569, 'official'),
    (date(2026, 4, 13),  'วันสงกรานต์',                            2569, 'official'),
    (date(2026, 4, 14),  'วันสงกรานต์',                            2569, 'official'),
    (date(2026, 4, 15),  'วันสงกรานต์',                            2569, 'official'),
    (date(2026, 5, 1),   'วันแรงงานแห่งชาติ',                     2569, 'official'),
    (date(2026, 5, 5),   'วันฉัตรมงคล',                            2569, 'official'),
    (date(2026, 5, 31),  'วันวิสาขบูชา',                           2569, 'official'),
    (date(2026, 6, 3),   'วันเฉลิมพระชนมพรรษาสมเด็จพระราชินี',   2569, 'official'),
    (date(2026, 7, 28),  'วันเฉลิมพระชนมพรรษา ร.10',             2569, 'official'),
    (date(2026, 8, 12),  'วันแม่แห่งชาติ',                         2569, 'official'),
    (date(2026, 10, 13), 'วันนวมินทรมหาราช',                      2569, 'official'),
    (date(2026, 10, 23), 'วันปิยมหาราช',                           2569, 'official'),
    (date(2026, 12, 5),  'วันพ่อแห่งชาติ',                         2569, 'official'),
    (date(2026, 12, 10), 'วันรัฐธรรมนูญ',                          2569, 'official'),
    (date(2026, 12, 31), 'วันสิ้นปี',                              2569, 'official'),
]


class Command(BaseCommand):
    help = 'สร้าง SystemSettings และวันหยุดสำหรับ production (ไม่มี demo users)'

    def handle(self, *args, **kwargs):
        self.stdout.write('🌱 seed_initial...')

        SystemSettings.objects.get_or_create(pk=1, defaults={
            'max_ot_hours_weekday':    4,
            'max_ot_hours_holiday':    7,
            'rate_multiplier_weekday': 1.5,
            'rate_multiplier_holiday': 3.0,
        })
        self.stdout.write('  ✅ SystemSettings')

        created = 0
        for d, name, year, htype in HOLIDAYS:
            _, made = Holiday.objects.get_or_create(
                date=d,
                defaults={'name': name, 'holiday_type': htype, 'year': year, 'is_system': True},
            )
            if made:
                created += 1
        self.stdout.write(f'  ✅ วันหยุด: เพิ่มใหม่ {created} วัน')

        self.stdout.write(self.style.SUCCESS('seed_initial เสร็จสมบูรณ์'))
