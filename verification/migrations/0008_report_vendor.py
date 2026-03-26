from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("verification", "0007_labmaster_ulr_number"),
    ]

    operations = [
        migrations.AddField(
            model_name="report",
            name="vendor",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
    ]
