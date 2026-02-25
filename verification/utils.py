import pytesseract
from pdf2image import convert_from_path
import hashlib
import re
from .models import Lab

# Windows Tesseract Path
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"


def generate_file_hash(file):
    hasher = hashlib.sha256()
    for chunk in file.chunks():
        hasher.update(chunk)
    return hasher.hexdigest()


def extract_text_from_pdf(pdf_path):
    images = convert_from_path(
        pdf_path,
        poppler_path=r"C:\poppler\poppler-25.12.0\Library\bin"
    )

    text = ""
    for image in images:
        text += pytesseract.image_to_string(image)

    return text


def extract_fields(text):
    ulr = re.search(r'\b\d{18}\b', text)

    acc = re.search(r'Report No\.?\s*(\S+)', text)

    lab_name = text.split('\n')[0]  # first line usually lab name

    return {
        "ulr": ulr.group() if ulr else None,
        "accreditation_no": acc.group(1) if acc else None,
        "lab_name": lab_name.strip() if lab_name else None
    }


def validate_report(data):
    score = 100
    status = "VALID"

    lab_name = data.get("lab_name")
    accreditation_no = data.get("accreditation_no")
    ulr = data.get("ulr")

    if not lab_name or not accreditation_no:
        return 50, "SUSPICIOUS"

    lab = Lab.objects.filter(
        name__icontains=lab_name,
        accreditation_no=accreditation_no
    ).first()

    if not lab:
        score -= 40

    if lab and ulr and not ulr.startswith(lab.ulr_prefix):
        score -= 20

    if score < 60:
        status = "INVALID"
    elif score < 85:
        status = "SUSPICIOUS"

    return score, status