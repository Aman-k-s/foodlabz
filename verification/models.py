from django.db import models
from django.utils import timezone
class Report(models.Model):
    file = models.FileField(upload_to="reports/")
    file_hash = models.CharField(max_length=64, unique=True)
    vendor = models.CharField(max_length=255, null=True, blank=True)
    vendor_id = models.CharField(max_length=100, null=True, blank=True)
    vendor_name = models.CharField(max_length=255, null=True, blank=True)
    consignment_id = models.CharField(max_length=100, null=True, blank=True)
    commodity = models.CharField(max_length=255, null=True, blank=True)

    lab_name = models.CharField(max_length=255, null=True, blank=True)
    accreditation_no = models.CharField(max_length=100, null=True, blank=True)
    ulr_number = models.CharField(max_length=50, null=True, blank=True)

    validation_score = models.IntegerField(default=0)
    status = models.CharField(max_length=30, default="PENDING")
    rejection_reason = models.CharField(max_length=255, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.accreditation_no} - {self.status}"


class LabMaster(models.Model):
    lab_id = models.CharField(max_length=50, unique=True)
    laboratory_name = models.CharField(max_length=255)
    cert_no = models.CharField(max_length=100)
    ulr_number = models.CharField(max_length=50, null=True, blank=True)
    labtype = models.CharField(max_length=100)

    issue_date = models.DateField(null=True, blank=True)
    to_date = models.DateField(null=True, blank=True)
    extend_date = models.DateField(null=True, blank=True)

    city = models.CharField(max_length=100, null=True, blank=True)
    state = models.CharField(max_length=100, null=True, blank=True)
    prime_address = models.TextField(null=True, blank=True)

    class Meta:
        unique_together = ("cert_no", "labtype")

    def __str__(self):
        return f"{self.laboratory_name} - {self.cert_no} ({self.labtype})"


class GeocodeCache(models.Model):
    place_key = models.CharField(max_length=200, unique=True)
    place_label = models.CharField(max_length=200)
    lat = models.FloatField()
    lng = models.FloatField()
    updated_at = models.DateTimeField(default=timezone.now)

    def touch(self):
        self.updated_at = timezone.now()

    def __str__(self):
        return f"{self.place_label} ({self.lat},{self.lng})"
