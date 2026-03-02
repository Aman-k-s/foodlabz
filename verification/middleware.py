from django.http import HttpResponse


class ApiCorsFallbackMiddleware:
    """
    Hard fallback for CORS on API routes.
    This is intentionally permissive to unblock deployment-time CORS issues.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path.startswith("/api/") and request.method == "OPTIONS":
            response = HttpResponse(status=200)
        else:
            response = self.get_response(request)

        if request.path.startswith("/api/"):
            origin = request.headers.get("Origin", "*")
            response["Access-Control-Allow-Origin"] = origin
            response["Vary"] = "Origin"
            response["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
            response["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
            response["Access-Control-Max-Age"] = "86400"

        return response
