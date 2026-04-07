import hashlib
import os
import re
import subprocess
import time
from datetime import datetime

import pytesseract
from pdf2image import convert_from_path
from django.utils import timezone

try:
    from pypdf import PdfReader
except ImportError:
    PdfReader = None

from .models import LabMaster, Report

_tesseract_cmd = os.getenv("TESSERACT_CMD")
if _tesseract_cmd:
    pytesseract.pytesseract.tesseract_cmd = _tesseract_cmd

CERT_PATTERN = re.compile(r"\b(TC|CC|RC)\s*[- ]?\s*(\d{4,6})\b")
CERT_LINE_PATTERN = re.compile(
    r"^\s*(T\s*C|C\s*C|R\s*C)\s*[-\u2010\u2011\u2012\u2013\u2014]?\s*((?:\d\s*){4,6})\s*$"
)
ULR_LABEL_PATTERN = re.compile(
    r"\bU\s*L\s*R(?:\s*(?:NO|NO\.|NUMBER))?[:\s\-]*([A-Z0-9\s\-/:.]{10,48})\b"
)
ULR_SEQUENCE_PATTERN = re.compile(
    # ULRs are overwhelmingly digit/hex sequences and typically end with F/P.
    # Keeping this constrained prevents OCR-joined English words from being treated as ULRs.
    r"\b(?:TC|CC|RC)[\s\-]?\d{4,6}(?:[\s\-]?[0-9A-F]){7,23}[\s\-]?[FP]\b"
)
# Strict normalized ULR format:
# - starts with TC/CC/RC + 4-6 digits (certificate id)
# - followed by 8-24 characters that are hex digits, ending in F or P
#
# This rejects common OCR noise like "TC6308BLACKPEPPER" or "...FDIKECHESIOAL".
ULR_STRICT_NORMALIZED_PATTERN = re.compile(r"^(TC|CC|RC)\d{4,6}[0-9A-F]{7,23}[FP]$")
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
    # Some PDFs require OCR to capture the ULR even when Poppler/pypdf find other text.
    # Give a bit more default budget in production; still clamped via env override.
    total_timeout_seconds = _env_int_clamped("OCR_TOTAL_TIMEOUT_SECONDS", 60, 12, 120)
    deadline = time.monotonic() + total_timeout_seconds

    text = _extract_text_with_pypdf(pdf_path) or ""
    if not text:
        pdftotext_timeout = min(_env_int_clamped("PDFTOTEXT_TIMEOUT_SECONDS", 8, 3, 15), _remaining_seconds(deadline))
        text = _extract_text_with_pdftotext(pdf_path, timeout_seconds=pdftotext_timeout) or ""

    # Certificate number and ULR are often printed as image labels in many PDFs.
    # Keep OCR on page 1 as a light supplement when either is missing from extracted text.
    page1_ocr_text = ""
    if not _contains_certificate_number(text) or not _contains_ulr_number(text):
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


def _extract_text_with_pypdf(pdf_path):
    if PdfReader is None:
        return None
    try:
        reader = PdfReader(pdf_path)
    except Exception:
        return None

    parts = []
    for page in reader.pages[:3]:
        try:
            page_text = page.extract_text() or ""
        except Exception:
            page_text = ""
        if page_text.strip():
            parts.append(page_text)

    combined = "\n".join(parts).strip()
    return combined or None


def _extract_text_with_pdftotext(pdf_path, timeout_seconds=20):
    try:
        result = subprocess.run(
            ["pdftotext", "-layout", "-enc", "UTF-8", pdf_path, "-"],
            check=False,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="ignore",
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


def _contains_ulr_number(text):
    if not text:
        return False
    raw_text = text.upper().replace("URL", "ULR")
    if ULR_SEQUENCE_PATTERN.search(raw_text):
        return True
    normalized = re.sub(r"\s+", " ", raw_text)
    label_match = ULR_LABEL_PATTERN.search(normalized)
    if not label_match:
        return False
    candidate = normalize_ulr(label_match.group(1))
    return bool(candidate and ULR_STRICT_NORMALIZED_PATTERN.match(candidate))


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
    if normalized.startswith("7C"):
        normalized = f"TC{normalized[2:]}"
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


def _candidate_certs_from_extracted(cert_no):
    normalized = normalize_cert_no(cert_no)
    if not normalized:
        return []

    match = re.match(r"^(TC|CC|RC)(\d+)$", normalized)
    if not match:
        return [normalized]

    prefix, digits = match.groups()
    candidates = []

    # Try exact OCR first, then progressively trim trailing digits down to 4.
    for length in range(len(digits), 3, -1):
        candidate = f"{prefix}-{digits[:length]}"
        if candidate not in candidates:
            candidates.append(candidate)
    return candidates


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


def _cert_from_ulr_fallback(ulr):
    candidates = _possible_certs_from_ulr(ulr)
    if not candidates:
        return None
    return candidates[0]


def _find_lab_by_cert(cert_no, labtype=None):
    cert_candidates = _candidate_certs_from_extracted(cert_no)
    if not cert_candidates:
        return None

    first_candidate = cert_candidates[0]
    prefix_match = re.match(r"^(TC|CC|RC)", normalize_cert_no(first_candidate))
    base_qs = LabMaster.objects.all()
    if prefix_match:
        base_qs = base_qs.filter(cert_no__istartswith=prefix_match.group(1))

    if labtype:
        labs = list(base_qs.filter(labtype__iexact=labtype))
        for candidate in cert_candidates:
            preferred = [lab for lab in labs if _lab_matches_cert(lab, candidate)]
            if preferred:
                return preferred[0]

    all_labs = list(base_qs)
    for candidate in cert_candidates:
        matched = [lab for lab in all_labs if _lab_matches_cert(lab, candidate)]
        if matched:
            return matched[0]
    return None


def find_lab_match(cert_no=None, ulr=None, labtype=None):
    lab_by_cert = _find_lab_by_cert(cert_no, labtype=labtype) if cert_no else None
    if lab_by_cert:
        return lab_by_cert, "cert"

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

    def _finalize_ulr(value):
        if not value:
            return None
        normalized = normalize_ulr(value)
        if not normalized:
            return None
        if not ULR_STRICT_NORMALIZED_PATTERN.match(normalized):
            # Best-effort fix for common OCR confusions in digit/hex runs.
            fixed = (
                normalized.replace("O", "0")
                .replace("Q", "0")
                .replace("I", "1")
                .replace("L", "1")
                .replace("S", "5")
                .replace("B", "8")
                .replace("Z", "2")
                .replace("G", "6")
            )
            if not ULR_STRICT_NORMALIZED_PATTERN.match(fixed):
                return None
            normalized = fixed
        return normalized

    ulr = None
    candidates: list[str] = []

    label_match = ULR_LABEL_PATTERN.search(clean_text)
    if label_match:
        candidate_window = label_match.group(1)
        candidates.extend([m.group(0) for m in ULR_SEQUENCE_PATTERN.finditer(candidate_window)])

    candidates.extend([m.group(0) for m in ULR_SEQUENCE_PATTERN.finditer(clean_text)])

    if certificate_no:
        cert_clean = certificate_no.replace("-", "")
        # Some PDFs print the ULR without the "ULR" label. Use this as a fallback,
        # but filter aggressively to avoid matching commodity text.
        candidates.extend([m.group(0) for m in re.finditer(rf"\b{cert_clean}[A-Z0-9]{{8,}}\b", clean_text)])

    scored: list[tuple[int, str]] = []
    for raw_candidate in candidates:
        normalized = _finalize_ulr(raw_candidate)
        if not normalized:
            continue
        digit_count = sum(1 for ch in normalized if ch.isdigit())
        score = digit_count * 10 + len(normalized)
        if certificate_no:
            cert_clean = certificate_no.replace("-", "")
            if normalized.startswith(cert_clean):
                score += 100
        scored.append((score, normalized))

    if scored:
        scored.sort(key=lambda x: x[0], reverse=True)
        ulr = scored[0][1]

    if not certificate_no and ulr:
        certificate_no = _cert_from_ulr_fallback(ulr)

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


def validate_report(data, report_id=None, upload_date=None):
    if upload_date is None:
        upload_date = timezone.localdate()
    ulr = normalize_ulr(data.get("ulr"))
    cert_no = data.get("certificate_no")
    labtype = data.get("labtype")
    if not cert_no:
        return None, "REJECTED", "Certificate number not found in report."

    lab = _find_lab_by_cert(cert_no, labtype=labtype)
    if not lab:
        return None, "REJECTED", "Certificate number does not exist in lab database."

    cert_token = normalize_cert_no(cert_no)
    if ulr and cert_token and not ulr.startswith(cert_token):
        return lab, "REJECTED", "Certificate number does not match ULR."

    expected_ulr = normalize_ulr(lab.ulr_number)
    if ulr and expected_ulr and ulr != expected_ulr:
        return lab, "REJECTED", "Certificate number does not match ULR."

    valid_till = lab.extend_date or lab.to_date
    if valid_till and upload_date > valid_till:
        return lab, "REJECTED", "The test report is invalid because the laboratory's certificate expired before the test was conducted."

    return lab, "VALID", None

