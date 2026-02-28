## Backend (Python)

Install:

```bash
pip install -r requirements.txt
```

Pinned packages are in [requirements.txt](./requirements.txt):

- Django==6.0.2
- djangorestframework==3.16.1
- django-cors-headers==4.9.0
- pandas==3.0.1
- openpyxl==3.1.5
- pdf2image==1.17.0
- pytesseract==0.3.13
- Pillow==12.1.1

System tools required for OCR:

- Tesseract OCR (Windows path used in code: `C:\Program Files\Tesseract-OCR\tesseract.exe`)
- Poppler (Windows path used in code: `C:\poppler\poppler-25.12.0\Library\bin`)

## Frontend (Node)

Install:

```bash
cd Prompt-Engineering-Blueprint
npm install
```

All frontend dependencies are managed in:

- [Prompt-Engineering-Blueprint/package.json](./Prompt-Engineering-Blueprint/package.json)
- [Prompt-Engineering-Blueprint/package-lock.json](./Prompt-Engineering-Blueprint/package-lock.json)

Run locally:

```bash
cd Prompt-Engineering-Blueprint
npm run dev
```
