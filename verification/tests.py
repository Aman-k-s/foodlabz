from datetime import date

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase

from .models import LabMaster, Report
from .utils import extract_fields, parse_date, validate_report


class ExtractionTests(TestCase):
    def test_extracts_ulr_even_when_ocr_reads_url_label(self):
        text = """
        NABL CERTIFICATE
        URL NO: TC12342500000001F
        DATE OF ISSUE: 24/02/2026
        """
        fields = extract_fields(text)
        self.assertEqual(fields["ulr"], "TC12342500000001F")

    def test_prefers_issue_date_label_over_unrelated_first_date(self):
        text = """
        VALID UP TO 31/12/2027
        LAB VISIT DATE 03/01/2026
        ISSUE DATE 24/02/2026
        """
        fields = extract_fields(text)
        self.assertEqual(fields["issue_date"], "24/02/2026")

    def test_parse_date_supports_common_formats(self):
        self.assertEqual(parse_date("24/02/2026"), date(2026, 2, 24))
        self.assertEqual(parse_date("24-02-2026"), date(2026, 2, 24))
        self.assertEqual(parse_date("24 FEB 2026"), date(2026, 2, 24))
        self.assertEqual(parse_date("24 February 2026"), date(2026, 2, 24))

    def test_certificate_extraction_ignores_unrelated_numbers(self):
        text = """
        REPORT NO: 998877
        REF CODE: 123456
        CERTIFICATE: TC-6467
        """
        fields = extract_fields(text)
        self.assertEqual(fields["certificate_no"], "TC-6467")

    def test_certificate_extraction_from_logo_line_with_five_digits(self):
        text = """
        NATIONAL ACCREDITATION BOARD FOR TESTING
        TC-11554
        """
        fields = extract_fields(text)
        self.assertEqual(fields["certificate_no"], "TC-11554")

    def test_certificate_extraction_tolerates_ocr_spaced_characters(self):
        text = """
        T C - 1 1 5 5 4
        """
        fields = extract_fields(text)
        self.assertEqual(fields["certificate_no"], "TC-11554")


class ReportFetchTests(TestCase):
    def test_report_lookup_is_case_and_format_insensitive(self):
        LabMaster.objects.create(
            lab_id="LAB-1",
            laboratory_name="Test Lab",
            cert_no="TC-1234",
            labtype="Testing",
            issue_date=date(2025, 1, 1),
            to_date=date(2027, 1, 1),
            prime_address="Prime Business Park, Mumbai",
        )
        Report.objects.create(
            file=SimpleUploadedFile("dummy.pdf", b"dummy", content_type="application/pdf"),
            file_hash="a" * 64,
            accreditation_no="TC-1234",
            ulr_number="TC12342500000001F",
            lab_name="Test Lab",
            status="VALID",
            validation_score=100,
        )

        response = self.client.get("/api/report/tc-1234-2500000001f/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"]["ulr_number"], "TC12342500000001F")
        self.assertEqual(response.json()["data"]["address"], "Prime Business Park, Mumbai")
        self.assertIn("/media/reports/", response.json()["data"]["file_url"])

    def test_reports_list_returns_uploaded_files(self):
        Report.objects.create(
            file=SimpleUploadedFile("dummy2.pdf", b"dummy", content_type="application/pdf"),
            file_hash="b" * 64,
            accreditation_no="TC-2222",
            ulr_number="TC22222500000001F",
            lab_name="List Lab",
            status="VALID",
            validation_score=100,
        )
        response = self.client.get("/api/reports/")
        self.assertEqual(response.status_code, 200)
        payload = response.json()["data"]
        self.assertGreaterEqual(len(payload), 1)
        self.assertIn("file_url", payload[0])

    def test_report_lookup_returns_ulr_not_in_lab_database_message(self):
        response = self.client.get("/api/report/TC00002500000001F/")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["message"], "ULR number does not exist in lab database.")


class ValidationTests(TestCase):
    def setUp(self):
        self.lab = LabMaster.objects.create(
            lab_id="LAB-2",
            laboratory_name="Acme Testing Laboratory",
            cert_no="TC-6467",
            ulr_number="TC64672600000001F",
            labtype="Testing",
            issue_date=date(2026, 2, 24),
            to_date=date(2027, 2, 23),
            prime_address="Prime Address",
        )

    def test_does_not_reject_when_issue_date_mismatch(self):
        lab, status, reason = validate_report(
            {
                "certificate_no": "TC-6467",
                "ulr": "TC64672600000001F",
                "issue_date": "23/02/2026",
                "to_date": "23/02/2027",
                "lab_name": "Acme Testing Laboratory",
            }
        )
        self.assertEqual(lab, self.lab)
        self.assertEqual(status, "VALID")
        self.assertIsNone(reason)

    def test_does_not_reject_when_to_date_mismatch(self):
        lab, status, reason = validate_report(
            {
                "certificate_no": "TC-6467",
                "ulr": "TC64672600000001F",
                "issue_date": "24/02/2026",
                "to_date": "22/02/2027",
                "lab_name": "Acme Testing Laboratory",
            }
        )
        self.assertEqual(lab, self.lab)
        self.assertEqual(status, "VALID")
        self.assertIsNone(reason)

    def test_rejects_when_ulr_mismatch(self):
        lab, status, reason = validate_report(
            {
                "certificate_no": "TC-6467",
                "ulr": "TC00002600000001F",
                "issue_date": "24/02/2026",
                "to_date": "23/02/2027",
                "lab_name": "Acme Testing Laboratory",
            }
        )
        self.assertEqual(lab, self.lab)
        self.assertEqual(status, "REJECTED")
        self.assertIn("different", reason.lower())
