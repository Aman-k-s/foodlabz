"""
URL configuration for config project.
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import HttpResponse
from django.urls import include, path


def home(request):
    return HttpResponse(
        "Foodlabz API is running.",
        content_type="text/plain; charset=utf-8",
    )


def favicon(request):
    return HttpResponse(status=204)


urlpatterns = [
    path("", home),
    path("favicon.ico", favicon),
    path("admin/", admin.site.urls),
    path("api/", include("verification.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
