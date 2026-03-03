import hashlib
import os
import re
import subprocess
from datetime import datetime

import pytesseract
from pdf2image import convert_from_path

from .models import LabMaster, Report

_tesseract_cmd = os.getenv("TESSERACT_CMD")
if _tesseract_cmd:
    pytesseract.pytesseract.tesseract_cmd = _tesseract_cmd

CERT_PATTERN = re.compile(r"\b(TC|CC|RC)\s*[- ]?\s*(\d{4,6})\b")
CERT_LINE_PATTERN = re.compile(
    r"^\s*(T\s*C|C\s*C|R\s*C)\s*[-\u2010\u2011\u2012\u2013\u2014]?\s*((?:\d\s*){4,6})\s*$"
)
ULR_LABEL_PATTERN = re.compile(
    r"\bU\s*L\s*R(?:\s*(?:NO|NO\.|NUMBER))?[:\s\-]*([A-Z0-9\s\-/]{10,32})\b"
)
ULR_SEQUENCE_PATTERN = re.compile(
    r"\b(?:TC|CC|RC)[\s\-]?\d{3,6}[\s\-]?\d{2}[0-9A-F][0-9A-F]{8}[FP]\b"
)
DATE_PATTERNS = [
    re.compile(r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b"),
    re.compile(r"\b\d{1,2}\s+[A-Z]{3,9}\s+\d{2,4}\b"),
]
ISSUE_DATE_LABEL_PATTERNS = [
    re.compile(r"\bDATE\s+OF\s+ISSUE\b"),
    re.compile(r"\bISSUE\s+DATE\b"),
    re.compile(r"\bDATE\s+ISSUED\b"),
]
TO_DATE_LABEL_PATTERNS = [
    re.compile(r"\bVALID\s+TILL\b"),
    re.compile(r"\bVALID\s+UPTO\b"),
    re.compile(r"\bVALID\s+UP\s+TO\b"),
    re.compile(r"\bTO\s+DATE\b"),
    re.compile(r"\bEXPIRY\s+DATE\b"),
]
LAB_NAME_LABEL_PATTERNS = [
    re.compile(r"\bLABORATORY\s+NAME\b"),
    re.compile(r"\bNAME\s+OF\s+LABORATORY\b"),
]


def generate_file_hash(file):
    hasher = hashlib.sha256()
    for chunk in file.chunks():
        hasher.update(chunk)
    return hasher.hexdigest()


def _env_int(name, default):
    try:
        return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


def extract_text_from_pdf(pdf_path):
    text = _extract_text_with_pdftotext(pdf_path) or ""

    # Certificate number is often printed as an image label below the NABL logo.
    # Keep OCR on page 1 as a light supplement even when pdftotext succeeds.
    page1_ocr_text = ""
    if not _contains_certificate_number(text):
        page1_ocr_text = _extract_page_ocr_text(pdf_path, first_page=1, last_page=1)

    if text and page1_ocr_text:
        return f"{text}\n{page1_ocr_text}"
    if text:
        return text
    if page1_ocr_text:
        return page1_ocr_text

    poppler_path = os.getenv("POPPLER_PATH")
    max_pages = _env_int("OCR_MAX_PAGES", 2)
    dpi = _env_int("OCR_DPI", 120)
    convert_timeout_seconds = _env_int("OCR_CONVERT_TIMEOUT_SECONDS", 20)
    if max_pages <= 1:
        raise RuntimeError(
            "Unable to extract readable text from first page within OCR limits. "
            "Try a clearer PDF or increase OCR_MAX_PAGES."
        )

    convert_kwargs = {}
    if poppler_path:
        convert_kwargs["poppler_path"] = poppler_path

    images = convert_from_path(
        pdf_path,
        dpi=dpi,
        first_page=1,
        last_page=max_pages,
        grayscale=True,
        thread_count=1,
        fmt="jpeg",
        timeout=convert_timeout_seconds,
        **convert_kwargs,
    )
    text = _ocr_images(images)
    if not text.strip():
        raise RuntimeError(
            "OCR could not extract readable text within timeout. "
            "Try a clearer/smaller PDF or increase OCR_TIMEOUT_SECONDS."
        )
    return text


def _extract_text_with_pdftotext(pdf_path):
    try:
        result = subprocess.run(
            ["pdftotext", "-layout", "-enc", "UTF-8", pdf_path, "-"],
            check=False,
            capture_output=True,
            text=True,
            timeout=20,
        )
    except (FileNotFoundError, subprocess.SubprocessError):
        return None

    if result.returncode != 0:
        return None

    output = (result.stdout or "").strip()
    return output or None


def _extract_page_ocr_text(pdf_path, first_page, last_page):
    poppler_path = os.getenv("POPPLER_PATH")
    ocr_dpi = _env_int("OCR_CERT_DPI", 110)
    convert_timeout_seconds = _env_int("OCR_CONVERT_TIMEOUT_SECONDS", 20)
    convert_kwargs = {}
    if poppler_path:
        convert_kwargs["poppler_path"] = poppler_path

    try:
        images = convert_from_path(
            pdf_path,
            dpi=ocr_dpi,
            first_page=first_page,
            last_page=last_page,
            grayscale=True,
            thread_count=1,
            fmt="jpeg",
            timeout=convert_timeout_seconds,
            **convert_kwargs,
        )
        return _ocr_images(images)
    except Exception:
        return ""


def _ocr_images(images):
    ocr_timeout_seconds = _env_int("OCR_TIMEOUT_SECONDS", 20)
    text = ""
    for image in images:
        try:
            text += pytesseract.image_to_string(
                image,
                config="--oem 1 --psm 6",
                timeout=ocr_timeout_seconds,
            )
        except RuntimeError as exc:
            # Keep processing remaining pages if one page exceeds OCR timeout.
            if "timeout" in str(exc).lower():
                continue
            raise
    return text


def _contains_certificate_number(text):
    if not text:
        return False
    raw_text = text.upper()
    for line in raw_text.splitlines():
        if CERT_LINE_PATTERN.match(line.strip()):
            return True
    normalized = re.sub(r"\s+", " ", raw_text)
    return bool(CERT_PATTERN.search(normalized))


def parse_date(date_string):
    if not date_string:
        return None
    value = str(date_string).strip().upper()
    value = value.replace(".", "/")
    value = re.sub(r"\s+", " ", value)
    for fmt in (
        "%d/%m/%Y",
        "%d/%m/%y",
        "%d-%m-%Y",
        "%d-%m-%y",
        "%d %b %Y",
        "%d %b %y",
        "%d %B %Y",
        "%d %B %y",
    ):
        try:
            return datetime.strptime(value, fmt).date()
        except (TypeError, ValueError):
            continue
    return None


def normalize_ulr(ulr):
    if not ulr:
        return None
    normalized = re.sub(r"[^A-Z0-9]", "", str(ulr).upper())
    if not normalized:
        return None
    return normalized


def _extract_issue_date(clean_text):
    for label_pattern in ISSUE_DATE_LABEL_PATTERNS:
        label_match = label_pattern.search(clean_text)
        if not label_match:
            continue
        start = label_match.end()
        end = min(len(clean_text), label_match.end() + 60)
        window = clean_text[start:end]
        for date_pattern in DATE_PATTERNS:
            date_match = date_pattern.search(window)
            if date_match:
                return date_match.group(0)

    for date_pattern in DATE_PATTERNS:
        date_match = date_pattern.search(clean_text)
        if date_match:
            return date_match.group(0)
    return None


def _extract_date_by_labels(clean_text, label_patterns):
    for label_pattern in label_patterns:
        label_match = label_pattern.search(clean_text)
        if not label_match:
            continue
        start = label_match.end()
        end = min(len(clean_text), label_match.end() + 60)
        window = clean_text[start:end]
        for date_pattern in DATE_PATTERNS:
            date_match = date_pattern.search(window)
            if date_match:
                return date_match.group(0)
    return None


def _extract_lab_name(clean_text):
    for label_pattern in LAB_NAME_LABEL_PATTERNS:
        label_match = label_pattern.search(clean_text)
        if not label_match:
            continue
        start = label_match.end()
        end = min(len(clean_text), label_match.end() + 120)
        window = clean_text[start:end]
        window = window.lstrip(":- ").strip()
        candidate = re.split(r"\b(?:ULR|CERTIFICATE|DATE|VALID)\b", window)[0].strip(" :,-")
        if len(candidate) >= 5:
            return candidate
    return None


def extract_fields(text):
    raw_text = text.upper()
    raw_text = raw_text.replace("URL", "ULR")
    raw_text = raw_text.replace("\u2010", "-").replace("\u2011", "-")
    raw_text = raw_text.replace("\u2012", "-").replace("\u2013", "-").replace("\u2014", "-")
    raw_text = raw_text.replace("â€“", "-").replace("â€”", "-")
    raw_text = raw_text.replace("Ã¢â‚¬â€œ", "-").replace("Ã¢â‚¬â€", "-")

    certificate_no = None
    # Certificate appears as a distinct label below the logo in most reports.
    for line in raw_text.splitlines():
        line_match = CERT_LINE_PATTERN.match(line.strip())
        if not line_match:
            continue
        prefix = line_match.group(1).replace(" ", "")
        digits = re.sub(r"\s+", "", line_match.group(2))
        certificate_no = f"{prefix}-{digits}"
        break

    clean_text = re.sub(r"\s*-\s*", "-", raw_text)
    clean_text = re.sub(r"\s+", " ", clean_text)
    if not certificate_no:
        cert_match = CERT_PATTERN.search(clean_text)
        if cert_match:
            certificate_no = f"{cert_match.group(1)}-{cert_match.group(2)}"

    ulr = None
    label_match = ULR_LABEL_PATTERN.search(clean_text)
    if label_match:
        candidate = label_match.group(1)
        sequence_match = ULR_SEQUENCE_PATTERN.search(candidate)
        if sequence_match:
            ulr = normalize_ulr(sequence_match.group(0))
        else:
            ulr = normalize_ulr(candidate)
            if ulr and len(ulr) > 18:
                ulr = ulr[:18]
            if ulr and len(ulr) < 12:
                ulr = None

    if not ulr:
        sequence_match = ULR_SEQUENCE_PATTERN.search(clean_text)
        if sequence_match:
            ulr = normalize_ulr(sequence_match.group(0))

    if not ulr and certificate_no:
        cert_clean = certificate_no.replace("-", "")
        ulr_match = re.search(rf"\b{cert_clean}[A-Z0-9]{{8,}}\b", clean_text)
        if ulr_match:
            ulr = normalize_ulr(ulr_match.group(0))

    issue_date = _extract_issue_date(clean_text)
    to_date = _extract_date_by_labels(clean_text, TO_DATE_LABEL_PATTERNS)
    lab_name = _extract_lab_name(clean_text)

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
        "to_date": to_date,
        "lab_name": lab_name,
        "labtype": labtype,
    }


def validate_report(data, report_id=None):
    ulr = normalize_ulr(data.get("ulr"))
    cert_no = data.get("certificate_no")
    labtype = data.get("labtype")

    if not cert_no:
        return None, "REJECTED", "Certificate number not found in report."

    cert_qs = LabMaster.objects.filter(cert_no=cert_no)
    lab = None
    if labtype:
        lab = cert_qs.filter(labtype__iexact=labtype).first()
    if not lab:
        lab = cert_qs.first()

    if not lab:
        return None, "REJECTED", "Incorrect certificate number."

    if not ulr:
        return lab, "REJECTED", "ULR number not found in report."

    cert_clean = cert_no.replace("-", "")
    lab_ulr = normalize_ulr(lab.ulr_number) if getattr(lab, "ulr_number", None) else None
    if lab_ulr:
        if ulr != lab_ulr:
            return lab, "REJECTED", "Extracted ULR is different from the ULR mapped to this certificate in lab database."
    elif not ulr.startswith(cert_clean):
        return lab, "REJECTED", "Extracted ULR does not match this certificate number."

    duplicate_qs = Report.objects.filter(ulr_number__iexact=ulr)
    if report_id:
        duplicate_qs = duplicate_qs.exclude(id=report_id)
    if duplicate_qs.exists():
        return lab, "DUPLICATE_ULR", "ULR already exists in uploaded reports."

    return lab, "VALID", None
