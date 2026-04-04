FROM node:20-slim AS frontend-build

WORKDIR /frontend

COPY Prompt-Engineering-Blueprint/package*.json ./
RUN npm ci

COPY Prompt-Engineering-Blueprint/ ./
RUN npm run build


FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
COPY --from=frontend-build /frontend/dist/public ./frontend_dist

CMD sh -c "python manage.py migrate && \
python manage.py collectstatic --noinput && \
echo \"CLEAR_REPORTS=${CLEAR_REPORTS}\" && \
case \"${CLEAR_REPORTS}\" in \
  true|TRUE|True|1) \
    echo 'Starting one-time report cleanup' && \
    python manage.py clear_reports ;; \
  *) \
    echo 'Skipping report cleanup' ;; \
esac && \
echo \"RUN_LAB_IMPORT=${RUN_LAB_IMPORT}\" && \
case \"${RUN_LAB_IMPORT}\" in \
  true|TRUE|True|1) \
    echo 'Starting one-time lab import from file1.xlsx' && \
    python manage.py shell -c \"from verification.import_labs import import_labs_from_excel; import_labs_from_excel('file1.xlsx')\" ;; \
  *) \
    echo 'Skipping lab import' ;; \
esac && \
gunicorn config.wsgi:application \
  --bind 0.0.0.0:${PORT:-10000} \
  --timeout ${GUNICORN_TIMEOUT:-120} \
  --graceful-timeout ${GUNICORN_GRACEFUL_TIMEOUT:-30}"
