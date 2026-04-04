"""
URL configuration for config project.
"""

import mimetypes

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import FileResponse, Http404, HttpResponse
from django.urls import include, path, re_path


def _frontend_path(*parts):
    return (settings.FRONTEND_DIST_DIR.joinpath(*parts)).resolve()


def _serve_frontend_file(file_path):
    dist_root = settings.FRONTEND_DIST_DIR.resolve()
    requested = _frontend_path(file_path)
    if dist_root not in requested.parents and requested != dist_root:
        raise Http404("File not found")
    if not requested.exists() or not requested.is_file():
        raise Http404("File not found")

    content_type, _ = mimetypes.guess_type(str(requested))
    return FileResponse(
        requested.open("rb"),
        as_attachment=False,
        filename=requested.name,
        content_type=content_type or "application/octet-stream",
    )


def home(request):
    index_path = _frontend_path("index.html")
    if index_path.exists():
        return FileResponse(index_path.open("rb"), content_type="text/html; charset=utf-8")
    return HttpResponse("Foodlabz API is running.", content_type="text/plain; charset=utf-8")


def frontend_asset(request, file_path):
    return _serve_frontend_file(file_path)


def favicon(request):
    try:
        return _serve_frontend_file("favicon.png")
    except Http404:
        try:
            return _serve_frontend_file("foodlabz-logo.png")
        except Http404:
            return HttpResponse(status=204)


urlpatterns = [
    path("", home),
    path("favicon.ico", favicon),
    path("assets/<path:file_path>", frontend_asset),
    path("foodlabz-logo.png", frontend_asset, {"file_path": "foodlabz-logo.png"}),
    path("favicon.png", frontend_asset, {"file_path": "favicon.png"}),
    path("admin/", admin.site.urls),
    path("api/", include("verification.urls")),
    re_path(r"^(?!api/|admin/|assets/|favicon\.ico$|favicon\.png$|foodlabz-logo\.png$).*$", home),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
