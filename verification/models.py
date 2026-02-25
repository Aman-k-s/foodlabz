from django.db import models

class Lab(models.Model):
    name = models.CharField(max_length=255)
    accreditation_no = models.CharField(max_length=100)
    ulr_prefix = models.CharField(max_length=10)
    accreditation_valid_till = models.DateField()

    def __str__(self):
        return self.name


class Report(models.Model):
    file = models.FileField(upload_to='reports/')
    file_hash = models.CharField(max_length=64, unique=True)

    lab_name = models.CharField(max_length=255, null=True, blank=True)
    accreditation_no = models.CharField(max_length=100, null=True, blank=True)
    ulr_number = models.CharField(max_length=50, null=True, blank=True)

    validation_score = models.IntegerField(default=0)
    status = models.CharField(max_length=20, default="PENDING")

    created_at = models.DateTimeField(auto_now_add=True)