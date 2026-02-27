import pytesseract
from pdf2image import convert_from_path
import hashlib
import re
from datetime import datetime

# ✅ Correct model imports
from .models import LabMaster, Report


# ✅ Windows Tesseract Path
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"


# ===============================
# File Hash Generator
# ===============================
def generate_file_hash(file):
    hasher = hashlib.sha256()
    for chunk in file.chunks():
        hasher.update(chunk)
    return hasher.hexdigest()


# ===============================
# OCR: PDF → Text
# ===============================
def extract_text_from_pdf(pdf_path):
    images = convert_from_path(
        pdf_path,
        poppler_path=r"C:\poppler\poppler-25.12.0\Library\bin"
    )

    text = ""
    for image in images:
        text += pytesseract.image_to_string(image)

    return text


# ===============================
# Field Extraction Engine
# ===============================
import re
from datetime import datetime

def extract_fields(text):

    # -------------------------
    # Normalize text heavily
    # -------------------------
    clean_text = text.upper()

    # Replace all dash variations with normal dash
    clean_text = clean_text.replace("–", "-")
    clean_text = clean_text.replace("—", "-")

    # Remove extra spaces around dash
    clean_text = re.sub(r'\s*-\s*', '-', clean_text)

    # Collapse multiple spaces
    clean_text = re.sub(r'\s+', ' ', clean_text)
    # Extract Lab Name (match against database)

    lab_name = None

    # Normalize text for matching
    text_upper = text.upper()

    from .models import LabMaster

    for lab in LabMaster.objects.all().only("laboratory_name"):
     if lab.laboratory_name.upper() in text_upper:
        lab_name = lab.laboratory_name
        break
    # -------------------------
    # 1️⃣ Certificate Number
    # Handles:
    # TC-5589
    # TC 5589
    # TC5589
    # T C-5589
    # -------------------------
    cert_pattern = r'\bT\s*C[- ]?\s*(\d{3,6})\b'
    cert_match = re.search(cert_pattern, clean_text)

    certificate_no = None
    if cert_match:
        number = cert_match.group(1)
        certificate_no = f"TC-{number}"

    # If not TC, try generic 2-letter prefix
    if not certificate_no:
        generic_pattern = r'\b([A-Z]{2})[- ]?\s*(\d{3,6})\b'
        generic_match = re.search(generic_pattern, clean_text)
        if generic_match:
            prefix = generic_match.group(1)
            number = generic_match.group(2)
            certificate_no = f"{prefix}-{number}"

    # -------------------------
    # 2️⃣ ULR Extraction
    # -------------------------
    ulr = None
    if certificate_no:
        cert_clean = certificate_no.replace("-", "")
        ulr_pattern = rf'\b{cert_clean}[A-Z0-9]{{8,}}\b'
        ulr_match = re.search(ulr_pattern, clean_text)
        if ulr_match:
            ulr = ulr_match.group()

    # -------------------------
    # 3️⃣ Issue Date (Optional)
    # -------------------------
    date_patterns = [
        r'\b\d{2}/\d{2}/\d{4}\b',
        r'\b\d{2} [A-Z]{3} \d{4}\b',
    ]

    issue_date = None
    for pattern in date_patterns:
        match = re.search(pattern, clean_text)
        if match:
            issue_date = match.group()
            break

    return {
        "certificate_no": certificate_no,
        "ulr": ulr,
        "issue_date": issue_date
    }

# ===============================
# Date Parser
# ===============================
def parse_date(date_string):

    for fmt in ("%d/%m/%Y", "%d %b %Y"):
        try:
            return datetime.strptime(date_string, fmt).date()
        except:
            continue
    return None


# ===============================
# Core Validation Engine
# ===============================
from datetime import datetime
from .models import LabMaster, Report

def validate_report(data):

    ulr = data.get("ulr")
    cert_no = data.get("certificate_no")
    issue_date = parse_date(data.get("issue_date"))

    # 1️⃣ Get Lab FIRST
    lab = LabMaster.objects.filter(cert_no=cert_no).first()

    if not lab:
        return None, "INVALID_CERTIFICATE"

    # 2️⃣ Duplicate ULR Check (after lab fetch)
    if ulr and Report.objects.filter(ulr_number=ulr).exists():
        return lab, "DUPLICATE_ULR"

    # 3️⃣ Expiry Date
    expiry_date = lab.extend_date if lab.extend_date else lab.to_date

    if not expiry_date:
        return lab, "INVALID_CERTIFICATE"

    # 4️⃣ Issue Date Validation
    if issue_date:
        if lab.issue_date and issue_date < lab.issue_date:
            return lab, "INVALID_ISSUE_DATE"

        if issue_date > expiry_date:
            return lab, "CERTIFICATE_EXPIRED"

    return lab, "VALID"