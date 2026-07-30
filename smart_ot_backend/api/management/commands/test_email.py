from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'ทดสอบส่งอีเมลผ่าน Resend API'

    def add_arguments(self, parser):
        parser.add_argument('to_email', help='อีเมลที่จะรับ เช่น you@example.com')

    def handle(self, *args, **options):
        to = options['to_email']
        self.stdout.write(f'กำลังส่งไปที่ {to} ...')

        from django.core.mail import send_mail
        from django.conf import settings
        if not getattr(settings, 'EMAIL_HOST_USER', ''):
            self.stderr.write('EMAIL_HOST_USER ไม่ได้ตั้งค่า — เพิ่ม EMAIL_HOST_USER และ EMAIL_HOST_PASSWORD ในไฟล์ .env')
            return

        try:
            send_mail(
                '[SMART OT] ทดสอบระบบอีเมล',
                'อีเมลนี้เป็นการทดสอบระบบแจ้งเตือน SMART OT\n\nถ้าได้รับอีเมลนี้แสดงว่าระบบทำงานปกติ',
                settings.DEFAULT_FROM_EMAIL,
                [to],
                fail_silently=False,
            )
            self.stdout.write(self.style.SUCCESS('สำเร็จ! เช็ค inbox ได้เลย'))
        except Exception as e:
            self.stderr.write(f'ส่งไม่ได้: {e}')
