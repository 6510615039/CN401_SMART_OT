from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0006_add_ot_deadline_and_rep_note'),
    ]

    operations = [
        migrations.CreateModel(
            name='Notification',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('message', models.TextField(verbose_name='ข้อความ')),
                ('notif_type', models.CharField(
                    choices=[
                        ('ot_submitted',        'ยื่นคำร้อง OT ใหม่'),
                        ('ot_head_approved',    'หัวหน้าอนุมัติ'),
                        ('ot_head_rejected',    'หัวหน้าตีกลับ'),
                        ('ot_rep_forwarded',    'ตัวแทนส่งต่อแล้ว'),
                        ('ot_checker_approved', 'ผู้ตรวจสอบอนุมัติ'),
                        ('ot_checker_rejected', 'ผู้ตรวจสอบตีกลับ'),
                    ],
                    max_length=30,
                )),
                ('is_read', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('recipient', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='notifications',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('ot_request', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='notifications',
                    to='api.otrequest',
                )),
            ],
            options={
                'verbose_name': 'การแจ้งเตือน',
                'ordering': ['-created_at'],
            },
        ),
    ]
