"""
ลบแผนกที่ไม่ตรงกับไฟล์ 08 ออก และโยก users ที่อยู่ในแผนกผิดให้ department = None
แผนกที่ถูกต้อง (6 แผนก):
  - ผู้บริหาร
  - งานทะเบียนนักศึกษา 1
  - งานทะเบียนนักศึกษา 2
  - งานทะเบียนนักศึกษา 3
  - งานยุทธศาสตร์และบริหารสำนักงานทะเบียน
  - งานเทคโนโลยีและสื่อสารดิจิทัล
"""
from django.core.management.base import BaseCommand
from api.models import Department, User


KEEP = {
    'ผู้บริหาร',
    'งานทะเบียนนักศึกษา 1',
    'งานทะเบียนนักศึกษา 2',
    'งานทะเบียนนักศึกษา 3',
    'งานยุทธศาสตร์และบริหารสำนักงานทะเบียน',
    'งานเทคโนโลยีและสื่อสารดิจิทัล',
}


class Command(BaseCommand):
    help = 'ลบแผนกที่ไม่ตรงกับไฟล์ 08 ออก'

    def handle(self, *args, **options):
        bad = Department.objects.exclude(name__in=KEEP)
        bad_ids = list(bad.values_list('id', flat=True))
        bad_names = list(bad.values_list('name', flat=True))

        if not bad_ids:
            self.stdout.write(self.style.SUCCESS('ไม่มีแผนกที่ต้องลบ'))
            return

        # โยก users ออกจากแผนกผิด
        affected = User.objects.filter(department_id__in=bad_ids)
        count = affected.count()
        affected.update(department=None)
        self.stdout.write(f'โยก {count} users ออกจากแผนกผิด → department = None')

        # ลบแผนกผิด
        bad.delete()
        self.stdout.write(self.style.SUCCESS(f'ลบแผนก: {bad_names}'))

        # แสดงแผนกที่เหลือ
        self.stdout.write('\nแผนกที่เหลือ:')
        for d in Department.objects.order_by('name'):
            self.stdout.write(f'  [{d.id}] {d.name}')
