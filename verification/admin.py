from django.contrib import admin

from .models import LabMaster, Report

@admin.register(LabMaster)
class LabMasterAdmin(admin.ModelAdmin):
    list_display = ("cert_no", "labtype", "laboratory_name", "city", "state", "to_date")
    search_fields = ("cert_no", "labtype", "laboratory_name")
    list_filter = ("labtype", "state", "city")


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "vendor_id",
        "vendor_name",
        "consignment_id",
        "commodity",
        "lab_name",
        "accreditation_no",
        "ulr_number",
        "status",
        "created_at",
    )
    search_fields = (
        "vendor",
        "vendor_id",
        "vendor_name",
        "consignment_id",
        "commodity",
        "lab_name",
        "accreditation_no",
        "ulr_number",
        "file_hash",
    )
    list_filter = ("status", "created_at")
    readonly_fields = ("file_hash", "created_at")
