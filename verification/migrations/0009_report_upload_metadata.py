from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("verification", "0008_report_vendor"),
    ]

    operations = [
        migrations.AddField(
            model_name="report",
            name="commodity",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name="report",
            name="consignment_id",
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AddField(
            model_name="report",
            name="vendor_id",
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AddField(
            model_name="report",
            name="vendor_name",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.RunSQL(
            sql="""
                UPDATE verification_report
                SET vendor_name = vendor
                WHERE vendor_name IS NULL AND vendor IS NOT NULL;
            """,
            reverse_sql="""
                UPDATE verification_report
                SET vendor = vendor_name
                WHERE vendor IS NULL AND vendor_name IS NOT NULL;
            """,
        ),
    ]
