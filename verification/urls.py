from django.urls import path
from .views import (
    ClearUploadedReportsView,
    LabsDirectoryView,
    ReportByIdView,
    ReportByUlrView,
    ReportMediaView,
    UploadReportView,
    UploadedReportsView,
)

urlpatterns = [
    path("upload/", UploadReportView.as_view()),
    path("report/<str:ulr>/", ReportByUlrView.as_view()),
    path("reports/<int:report_id>/", ReportByIdView.as_view()),
    path("reports/", UploadedReportsView.as_view()),
    path("reports/clear/", ClearUploadedReportsView.as_view()),
    path("labs/", LabsDirectoryView.as_view()),
    path("media/<path:file_path>/", ReportMediaView.as_view()),
]
