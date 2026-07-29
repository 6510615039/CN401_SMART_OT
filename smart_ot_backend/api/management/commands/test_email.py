from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'ทดสอบส่งอีเมลผ่าน Resend API'

    def add_arguments(self, parser):
        parser.add_argument('to_email', help='อีเมลที่จะรับ เช่น you@example.com')

    def handle(self, *args, **options):
        to = options['to_email']
        self.stdout.write(f'กำลังส่งไปที่ {to} ...')

        import urllib.request, json
        from django.conf import settings
        api_key = getattr(settings, 'RESEND_API_KEY', '')
        if not api_key:
            self.stderr.write('RESEND_API_KEY ไม่ได้ตั้งค่า')
            return

        payload = json.dumps({
            'from': settings.DEFAULT_FROM_EMAIL,
            'to': [to],
            'subject': '[SMART OT] ทดสอบระบบอีเมล',
            'text': 'อีเมลนี้เป็นการทดสอบระบบแจ้งเตือน SMART OT\n\nถ้าได้รับอีเมลนี้แสดงว่าระบบทำงานปกติ',
        }).encode()

        req = urllib.request.Request(
            'https://api.resend.com/emails',
            data=payload,
            headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
            method='POST',
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                result = json.loads(resp.read())
                self.stdout.write(self.style.SUCCESS(f'สำเร็จ! email id: {result.get("id")}'))
        except urllib.error.HTTPError as e:
            self.stderr.write(f'ส่งไม่ได้: {e.code} {e.read().decode()}')
