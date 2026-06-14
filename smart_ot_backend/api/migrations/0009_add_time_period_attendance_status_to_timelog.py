from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0008_add_rate_per_hour'),
    ]

    operations = [
        migrations.AddField(
            model_name='timelog',
            name='time_period',
            field=models.CharField(
                choices=[('morning', 'กะเช้า (เริ่ม OT 16:00)'), ('normal', 'กะปกติ (เริ่ม OT 16:30)')],
                default='normal',
                max_length=10,
                verbose_name='กะ',
            ),
        ),
        migrations.AddField(
            model_name='timelog',
            name='attendance_status',
            field=models.CharField(
                choices=[
                    ('present', 'มาทำงาน'),
                    ('absent',  'ขาดงาน'),
                    ('leave',   'ลา'),
                    ('holiday', 'วันหยุด'),
                ],
                default='present',
                max_length=10,
                verbose_name='สถานะเข้างาน',
            ),
        ),
    ]
