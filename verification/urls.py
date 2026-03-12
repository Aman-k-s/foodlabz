from django.urls import path
from .views import (
    LabsDirectoryView,
    ReportByUlrView,
    ReportMediaView,
    UploadReportView,
    UploadedReportsView,
)

urlpatterns = [
    path("upload/", UploadReportView.as_view()),
    path("report/<str:ulr>/", ReportByUlrView.as_view()),
    path("reports/", UploadedReportsView.as_view()),
    path("media/<path:file_path>/", ReportMediaView.as_view()),
    path("labs/", LabsDirectoryView.as_view()),
]
