import hashlib
import re
from datetime import datetime

import pytesseract
from pdf2image import convert_from_path

from .models import LabMaster, Report

pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

CERT_PATTERN = re.compile(r"\b([A-Z]{2})[- ]?(\d{3,6})\b")
ULR_LABEL_PATTERN = re.compile(r"\bULR(?:\s*NO\.?)?[:\s-]*([A-Z0-9-]{8,})\b")
DATE_PATTERNS = [
    re.compile(r"\b\d{2}/\d{2}/\d{4}\b"),
    re.compile(r"\b\d{2}\s+[A-Z]{3}\s+\d{4}\b"),
]


def generate_file_hash(file):
    hasher = hashlib.sha256()
    for chunk in file.chunks():
        hasher.update(chunk)
    return hasher.hexdigest()


def extract_text_from_pdf(pdf_path):
    images = convert_from_path(
        pdf_path,
        poppler_path=r"C:\poppler\poppler-25.12.0\Library\bin",
    )
    text = ""
    for image in images:
        text += pytesseract.image_to_string(image)
    return text


def parse_date(date_string):
    if not date_string:
        return None
    value = str(date_string).strip().upper()
    for fmt in ("%d/%m/%Y", "%d %b %Y"):
        try:
            return datetime.strptime(value, fmt).date()
        except (TypeError, ValueError):
            continue
    return None


def extract_fields(text):
    clean_text = text.upper()
    clean_text = clean_text.replace("–", "-").replace("—", "-")
    clean_text = re.sub(r"\s*-\s*", "-", clean_text)
    clean_text = re.sub(r"\s+", " ", clean_text)

    certificate_no = None
    cert_match = CERT_PATTERN.search(clean_text)
    if cert_match:
        certificate_no = f"{cert_match.group(1)}-{cert_match.group(2)}"

    ulr = None
    label_match = ULR_LABEL_PATTERN.search(clean_text)
    if label_match:
        ulr = label_match.group(1).replace(" ", "")
    elif certificate_no:
        cert_clean = certificate_no.replace("-", "")
        ulr_match = re.search(rf"\b{cert_clean}[A-Z0-9]{{8,}}\b", clean_text)
        if ulr_match:
            ulr = ulr_match.group(0)

    issue_date = None
    for pattern in DATE_PATTERNS:
        date_match = pattern.search(clean_text)
        if date_match:
            issue_date = date_match.group(0)
            break

    labtype = None
    if "TESTING" in clean_text:
        labtype = "Testing"
    elif "CALIBRATION" in clean_text:
        labtype = "Calibration"
    elif "MEDICAL" in clean_text:
        labtype = "Medical"
    elif "CHEMICAL" in clean_text:
        labtype = "Chemical"
    elif "BIOLOGICAL" in clean_text:
        labtype = "Biological"
    elif "MICROBIOLOGICAL" in clean_text or "MICROBIOLOGY" in clean_text:
        labtype = "Microbiological"

    return {
        "certificate_no": certificate_no,
        "ulr": ulr,
        "issue_date": issue_date,
        "labtype": labtype,
    }


def validate_report(data, report_id=None):
    ulr = data.get("ulr")
    cert_no = data.get("certificate_no")
    labtype = data.get("labtype")
    issue_date = parse_date(data.get("issue_date"))

    if not cert_no:
        return None, "INVALID_CERTIFICATE"

    cert_qs = LabMaster.objects.filter(cert_no=cert_no)
    lab = None
    if labtype:
        lab = cert_qs.filter(labtype__iexact=labtype).first()
    if not lab:
        lab = cert_qs.first()

    if not lab:
        return None, "INVALID_CERTIFICATE"

    if ulr:
        duplicate_qs = Report.objects.filter(ulr_number=ulr)
        if report_id:
            duplicate_qs = duplicate_qs.exclude(id=report_id)
        if duplicate_qs.exists():
            return lab, "DUPLICATE_ULR"

    expiry_date = lab.extend_date or lab.to_date
    if not expiry_date:
        return lab, "INVALID_CERTIFICATE"

    today = datetime.today().date()
    if today > expiry_date:
        return lab, "CERTIFICATE_EXPIRED"

    if issue_date and lab.issue_date and issue_date < lab.issue_date:
        return lab, "INVALID_ISSUE_DATE"

    return lab, "VALID"
