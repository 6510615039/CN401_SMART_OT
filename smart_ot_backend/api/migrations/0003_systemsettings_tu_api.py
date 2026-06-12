from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0002_importhistory_rows_data'),
    ]

    operations = [
        migrations.AddField(
            model_name='systemsettings',
            name='tu_api_url',
            field=models.CharField(blank=True, default='', max_length=500, verbose_name='TU API Base URL'),
        ),
        migrations.AddField(
            model_name='systemsettings',
            name='tu_api_key',
            field=models.CharField(blank=True, default='', max_length=200, verbose_name='TU API Key'),
        ),
        migrations.AddField(
            model_name='systemsettings',
            name='tu_api_enabled',
            field=models.BooleanField(default=False, verbose_name='เปิดใช้ TU API'),
        ),
    ]
