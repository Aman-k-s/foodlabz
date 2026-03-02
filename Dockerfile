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

CMD sh -c "python manage.py migrate && \
if [ \"${RUN_LAB_IMPORT}\" = \"true\" ]; then \
  python manage.py shell -c \"from verification.import_labs import import_labs_from_excel; import_labs_from_excel('File.xlsx')\"; \
fi && \
gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-10000}"
