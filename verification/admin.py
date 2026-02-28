from django.contrib import admin

from .models import LabMaster, Report

@admin.register(LabMaster)
class LabMasterAdmin(admin.ModelAdmin):
    list_display = ("cert_no", "labtype", "laboratory_name", "city", "state", "to_date")
    search_fields = ("cert_no", "labtype", "laboratory_name")
    list_filter = ("labtype", "state", "city")


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ("id", "accreditation_no", "ulr_number", "status")
    search_fields = ("accreditation_no", "ulr_number")
    list_filter = ("status",)
