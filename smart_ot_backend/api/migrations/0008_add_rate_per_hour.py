from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0007_add_notification'),
    ]

    operations = [
        migrations.AddField(
            model_name='otrequest',
            name='rate_per_hour',
            field=models.DecimalField(
                decimal_places=2,
                default=0,
                max_digits=6,
                verbose_name='อัตราค่าตอบแทน (บาท/ชม.)',
            ),
        ),
    ]
