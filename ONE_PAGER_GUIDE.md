# FoodLabz Report Verification - One Pager (User Guide + Testing Proof)

## 1) Purpose
Verify uploaded PDF lab reports and mark them as:
- `PASSED`
- `FAILED` (with reason)

Core checks:
- Certificate number must be extracted from report.
- Certificate number must exist in Excel database.
- If ULR is extracted, it must match the certificate (and DB ULR when available).

---

## 2) How To Use (End User)
1. Open the app home page.
2. Upload report by:
   - Clicking `Upload or Drag & Drop PDF`, or
   - Dragging a PDF into the upload box.
3. Wait for processing bar (`Processing report... xx%`).
4. Auto-redirect to dashboard result.
5. Read result:
   - `PASSED`, or
   - `FAILED: <reason>`
6. Click `Open Uploaded Report` to review the exact uploaded file.

---

## 3) Result Rules (Current Logic)
- `PASSED` when:
  - Certificate is found in PDF, and
  - Certificate exists in DB, and
  - ULR (if present) is consistent with certificate/DB mapping.

- `FAILED` when:
  - `Certificate number not found in report.`
  - `Certificate number does not exist in lab database.`
  - `Certificate number does not match ULR.`

---

## 4) Use Cases + Testing Proof

| Test ID | Scenario | Input Type | Expected Result | Actual Result | Proof Screenshot |
|---|---|---|---|---|---|
| TC-01 | Valid report | Real PDF (correct cert + ULR) | PASSED | PASSED | `docs/screenshots/tc01_passed.png` |
| TC-02 | Certificate missing in PDF | Edited/low-quality PDF | FAILED: Certificate number not found in report. |  | `docs/screenshots/tc02_cert_missing.png` |
| TC-03 | Wrong certificate | Edited PDF with fake cert | FAILED: Certificate number does not exist in lab database. |  | `docs/screenshots/tc03_wrong_cert.png` |
| TC-04 | Cert/ULR mismatch | Edited PDF (cert + wrong ULR) | FAILED: Certificate number does not match ULR. |  | `docs/screenshots/tc04_cert_ulr_mismatch.png` |
| TC-05 | Drag-and-drop upload | PDF dropped into upload area | Upload starts and processes |  | `docs/screenshots/tc05_drag_drop.png` |
| TC-06 | Progress feedback | Any upload | Progress bar visible until completion |  | `docs/screenshots/tc06_progress_bar.png` |
| TC-07 | Open uploaded file | Any completed upload | File opens from dashboard link |  | `docs/screenshots/tc07_open_uploaded_file.png` |
| TC-08 | Non-PDF upload | `.jpg/.png/.docx` | Upload blocked with error |  | `docs/screenshots/tc08_non_pdf.png` |

Note:
- Fill `Actual Result` after each run.
- Keep screenshots as test evidence for audit/demo.

---

## 5) Screenshot Checklist (for Final Submission)
- Home page with logo + title `FoodLabz Report Verification`
- Drag-and-drop area highlighted
- Upload progress bar in action
- PASSED dashboard sample
- FAILED dashboard sample (with reason)
- Open Uploaded Report working

---

## 6) Build/Release Stamp
- Frontend build status: `PASS`
- Backend validation status: `PASS`
- Rule set active: strict certificate + ULR mismatch rejection

