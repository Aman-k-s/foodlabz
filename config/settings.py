"""
Django settings for config project.
"""

import os
from pathlib import Path

try:
    import dj_database_url
except ModuleNotFoundError:  # local env fallback when package is not installed yet
    dj_database_url = None

BASE_DIR = Path(__file__).resolve().parent.parent


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


SECRET_KEY = os.getenv(
    "DJANGO_SECRET_KEY",
    "django-insecure-uoy#h@snbrdou@ce(^fbk7xmw)ffoi25^8nr^^vn5x(vwp_$t3",
)
DEBUG = _env_bool("DJANGO_DEBUG", True)

default_hosts = ["127.0.0.1", "localhost", ".ngrok-free.dev", ".ngrok-free.app"]
allowed_hosts_env = os.getenv("DJANGO_ALLOWED_HOSTS")
if allowed_hosts_env:
    ALLOWED_HOSTS = [host.strip() for host in allowed_hosts_env.split(",") if host.strip()]
else:
    ALLOWED_HOSTS = default_hosts


INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "verification",
]

MIDDLEWARE = [
    "verification.middleware.ApiCorsFallbackMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

if dj_database_url:
    DATABASES = {
        "default": dj_database_url.config(
            default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
            conn_max_age=600,
            ssl_require=False,
        )
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

cors_origins_env = os.getenv("CORS_ALLOWED_ORIGINS", "")
CORS_ALLOWED_ORIGINS = [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]

cors_allow_all_env = os.getenv("CORS_ALLOW_ALL_ORIGINS")
if cors_allow_all_env is not None:
    CORS_ALLOW_ALL_ORIGINS = cors_allow_all_env.strip().lower() in {"1", "true", "yes", "on"}
else:
    CORS_ALLOW_ALL_ORIGINS = not CORS_ALLOWED_ORIGINS

# Supports Vercel preview/prod domains without reconfiguring every preview URL.
CORS_ALLOWED_ORIGIN_REGEXES = [r"^https://.*\.vercel\.app$"]

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
