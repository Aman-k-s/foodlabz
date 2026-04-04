from django.http import JsonResponse
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


def api_root(request):
    return JsonResponse(
        {
            "status": "ok",
            "service": "foodlabz-api",
            "endpoints": {
                "upload": "/api/upload/",
                "report_by_ulr": "/api/report/<ulr>/",
                "report_by_id": "/api/reports/<report_id>/",
                "reports": "/api/reports/",
                "reports_clear": "/api/reports/clear/",
                "labs": "/api/labs/",
                "media": "/api/media/<file_path>/",
                "health": "/api/health/",
            },
        }
    )


def healthcheck(request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("", api_root),
    path("health/", healthcheck),
    path("upload/", UploadReportView.as_view()),
    path("report/<str:ulr>/", ReportByUlrView.as_view()),
    path("reports/<int:report_id>/", ReportByIdView.as_view()),
    path("reports/", UploadedReportsView.as_view()),
    path("reports/clear/", ClearUploadedReportsView.as_view()),
    path("labs/", LabsDirectoryView.as_view()),
    path("media/<path:file_path>/", ReportMediaView.as_view()),
]
