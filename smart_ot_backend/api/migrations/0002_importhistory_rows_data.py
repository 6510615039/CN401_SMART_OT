from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='importhistory',
            name='rows_data',
            field=models.JSONField(blank=True, null=True),
        ),
    ]
