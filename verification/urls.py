from django.urls import path
from .views import LabsDirectoryView, ReportByUlrView, UploadReportView

urlpatterns = [
    path("upload/", UploadReportView.as_view()),
    path("report/<str:ulr>/", ReportByUlrView.as_view()),
    path("labs/", LabsDirectoryView.as_view()),
]
