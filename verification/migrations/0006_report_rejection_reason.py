from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("verification", "0005_labmaster_prime_address"),
    ]

    operations = [
        migrations.AddField(
            model_name="report",
            name="rejection_reason",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
    ]
