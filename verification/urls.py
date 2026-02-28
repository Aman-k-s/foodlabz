from django.urls import path
from .views import ReportByUlrView, UploadReportView

urlpatterns = [
    path("upload/", UploadReportView.as_view()),
    path("report/<str:ulr>/", ReportByUlrView.as_view()),
]
