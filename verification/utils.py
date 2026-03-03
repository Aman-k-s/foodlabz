import hashlib
import os
import re
import subprocess
import time
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


def _env_int_clamped(name, default, minimum, maximum):
    value = _env_int(name, default)
    return max(minimum, min(value, maximum))


def _remaining_seconds(deadline):
    if deadline is None:
        return None
    return max(1, int(deadline - time.monotonic()))


def extract_text_from_pdf(pdf_path):
    total_timeout_seconds = _env_int_clamped("OCR_TOTAL_TIMEOUT_SECONDS", 55, 20, 90)
    deadline = time.monotonic() + total_timeout_seconds

    pdftotext_timeout = min(_env_int_clamped("PDFTOTEXT_TIMEOUT_SECONDS", 10, 4, 15), _remaining_seconds(deadline))
    text = _extract_text_with_pdftotext(pdf_path, timeout_seconds=pdftotext_timeout) or ""

    # Certificate number is often printed as an image label below the NABL logo.
    # Keep OCR on page 1 as a light supplement even when pdftotext succeeds.
    page1_ocr_text = ""
    if not _contains_certificate_number(text):
        remaining = _remaining_seconds(deadline)
        if remaining and remaining > 3:
            page1_ocr_text = _extract_page_ocr_text(
                pdf_path,
                first_page=1,
                last_page=1,
                max_timeout_seconds=remaining,
            )

    if text and page1_ocr_text:
        return f"{text}\n{page1_ocr_text}"
    if text:
        return text
    if page1_ocr_text:
        return page1_ocr_text
    return ""


def _extract_text_with_pdftotext(pdf_path, timeout_seconds=20):
    try:
        result = subprocess.run(
            ["pdftotext", "-layout", "-enc", "UTF-8", pdf_path, "-"],
            check=False,
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
        )
    except (FileNotFoundError, subprocess.SubprocessError):
        return None

    if result.returncode != 0:
        return None

    output = (result.stdout or "").strip()
    return output or None


def _extract_page_ocr_text(pdf_path, first_page, last_page, max_timeout_seconds=None):
    poppler_path = os.getenv("POPPLER_PATH")
    ocr_dpi = _env_int_clamped("OCR_CERT_DPI", 110, 80, 150)
    convert_timeout_seconds = _env_int_clamped("OCR_CONVERT_TIMEOUT_SECONDS", 10, 4, 15)
    if max_timeout_seconds is not None:
        if max_timeout_seconds <= 3:
            return ""
        convert_timeout_seconds = min(convert_timeout_seconds, max_timeout_seconds)
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
        full_text = _ocr_images(images, max_timeout_seconds=max_timeout_seconds)
        cert_hint = _extract_certificate_hint(images[0], max_timeout_seconds=max_timeout_seconds)
        if cert_hint and cert_hint not in full_text:
            if full_text:
                return f"{full_text}\n{cert_hint}"
            return cert_hint
        return full_text
    except Exception:
        return ""


def _ocr_images(images, max_timeout_seconds=None):
    ocr_timeout_seconds = _env_int_clamped("OCR_TIMEOUT_SECONDS", 8, 3, 12)
    deadline = None
    if max_timeout_seconds is not None:
        deadline = time.monotonic() + max_timeout_seconds
    text = ""
    for image in images:
        per_page_timeout = ocr_timeout_seconds
        if deadline is not None:
            remaining = int(deadline - time.monotonic())
            if remaining <= 1:
                break
            per_page_timeout = min(per_page_timeout, remaining)
        try:
            text += pytesseract.image_to_string(
                image,
                config="--oem 1 --psm 6",
                timeout=per_page_timeout,
            )
        except RuntimeError as exc:
            # Keep processing remaining pages if one page exceeds OCR timeout.
            if "timeout" in str(exc).lower():
                continue
            raise
    return text


def _extract_certificate_hint(image, max_timeout_seconds=None):
    width, height = image.size
    crop = image.crop((int(width * 0.2), int(height * 0.2), int(width * 0.8), int(height * 0.75)))
    cert_timeout = _env_int_clamped("OCR_CERT_TIMEOUT_SECONDS", 5, 2, 8)
    if max_timeout_seconds is not None:
        cert_timeout = min(cert_timeout, max_timeout_seconds)
    if cert_timeout <= 1:
        return ""

    configs = [
        "--oem 1 --psm 6 -c tessedit_char_whitelist=TCRC-0123456789",
        "--oem 1 --psm 11 -c tessedit_char_whitelist=TCRC-0123456789",
    ]
    for config in configs:
        try:
            text = pytesseract.image_to_string(crop, config=config, timeout=cert_timeout).upper()
        except RuntimeError:
            continue
        normalized = re.sub(r"\s+", "", text)
        match = re.search(r"\b(TC|CC|RC)[- ]?\d{4,6}\b", text)
        if match:
            prefix = match.group(1).replace(" ", "")
            digits = re.sub(r"\D", "", match.group(0))
            if len(digits) >= 4:
                return f"{prefix}-{digits[-6:] if len(digits) > 6 else digits}"
        alt = re.search(r"(TC|CC|RC)-?\d{4,6}", normalized)
        if alt:
            token = alt.group(0).replace(" ", "")
            token = token.replace("--", "-")
            if "-" not in token:
                token = f"{token[:2]}-{token[2:]}"
            return token
    return ""


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


def normalize_cert_no(cert_no):
    if not cert_no:
        return None
    normalized = re.sub(r"[^A-Z0-9]", "", str(cert_no).upper())
    if not normalized:
        return None
    return normalized


def _lab_matches_cert(lab, cert_no):
    return normalize_cert_no(lab.cert_no) == normalize_cert_no(cert_no)


def _find_lab_by_ulr(ulr, labtype=None):
    normalized_ulr = normalize_ulr(ulr)
    if not normalized_ulr:
        return None
    qs = LabMaster.objects.filter(ulr_number__iexact=normalized_ulr)
    if labtype:
        lab = qs.filter(labtype__iexact=labtype).first()
        if lab:
            return lab
    return qs.first()


def _possible_certs_from_ulr(ulr):
    normalized_ulr = normalize_ulr(ulr)
    if not normalized_ulr or len(normalized_ulr) < 8:
        return []
    prefix = normalized_ulr[:2]
    if prefix not in {"TC", "CC", "RC"}:
        return []
    tail = normalized_ulr[2:]
    candidates = []
    for cert_len in (6, 5, 4):
        if len(tail) >= cert_len + 2:
            candidates.append(f"{prefix}-{tail[:cert_len]}")
    return candidates


def _find_lab_by_cert(cert_no, labtype=None):
    normalized_cert = normalize_cert_no(cert_no)
    if not normalized_cert:
        return None

    prefix_match = re.match(r"^(TC|CC|RC)", normalized_cert)
    qs = LabMaster.objects.all()
    if prefix_match:
        qs = qs.filter(cert_no__istartswith=prefix_match.group(1))

    if labtype:
        preferred = [lab for lab in qs.filter(labtype__iexact=labtype) if _lab_matches_cert(lab, normalized_cert)]
        if preferred:
            return preferred[0]

    matched = [lab for lab in qs if _lab_matches_cert(lab, normalized_cert)]
    if matched:
        return matched[0]
    return None


def find_lab_match(cert_no=None, ulr=None, labtype=None):
    lab_by_cert = _find_lab_by_cert(cert_no, labtype=labtype) if cert_no else None
    if lab_by_cert:
        return lab_by_cert, "cert"

    lab_by_ulr = _find_lab_by_ulr(ulr, labtype=labtype) if ulr else None
    if lab_by_ulr:
        return lab_by_ulr, "ulr"

    for candidate_cert in _possible_certs_from_ulr(ulr):
        lab = _find_lab_by_cert(candidate_cert, labtype=labtype)
        if lab:
            return lab, "ulr-cert-candidate"

    return None, None


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

    if not certificate_no and ulr:
        cert_from_ulr = re.match(r"^(TC|7C|CC|RC)(\d{4,6})", ulr)
        if cert_from_ulr:
            prefix = cert_from_ulr.group(1)
            if prefix == "7C":
                prefix = "TC"
            certificate_no = f"{prefix}-{cert_from_ulr.group(2)}"

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
    lab, match_source = find_lab_match(cert_no=cert_no, ulr=ulr, labtype=labtype)

    if not cert_no and not lab:
        return None, "REJECTED", "Certificate number not found in report."

    if not lab:
        return None, "REJECTED", "Incorrect certificate number."

    if not cert_no:
        return lab, "REJECTED", "Certificate number not found in report."

    if match_source in {"ulr", "ulr-cert-candidate"} and not _lab_matches_cert(lab, cert_no):
        return lab, "REJECTED", "Extracted certificate number does not match this ULR in lab database."

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

