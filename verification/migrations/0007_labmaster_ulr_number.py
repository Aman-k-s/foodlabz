from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("verification", "0006_report_rejection_reason"),
    ]

    operations = [
        migrations.AddField(
            model_name="labmaster",
            name="ulr_number",
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
    ]
