from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("verification", "0004_labmaster_labtype_and_constraints"),
    ]

    operations = [
        migrations.AddField(
            model_name="labmaster",
            name="prime_address",
            field=models.TextField(blank=True, null=True),
        ),
    ]
