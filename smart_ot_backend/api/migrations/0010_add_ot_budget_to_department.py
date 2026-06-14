from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0009_add_time_period_attendance_status_to_timelog'),
    ]

    operations = [
        migrations.AddField(
            model_name='department',
            name='ot_budget',
            field=models.DecimalField(
                decimal_places=2,
                default=0,
                max_digits=12,
                verbose_name='งบประมาณ OT (บาท)',
            ),
        ),
    ]
