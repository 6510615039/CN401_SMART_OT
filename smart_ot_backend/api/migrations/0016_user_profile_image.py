from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0015_no_ot_declaration'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='profile_image',
            field=models.TextField(blank=True, default=''),
        ),
    ]
