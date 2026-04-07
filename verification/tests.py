from datetime import date

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase

from .models import LabMaster, Report
from .utils import (
    _direct_text_has_valid_identifiers,
    extract_fields,
    normalize_ulr,
    parse_date,
    validate_report,
)


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

    def test_certificate_falls_back_to_ulr_prefix_when_logo_cert_missing(self):
        text = """
        ULR No: TC861725000000126F
        """
        fields = extract_fields(text)
        self.assertEqual(fields["certificate_no"], "TC-861725")

    def test_certificate_prefers_ulr_when_visible_cert_is_wrong(self):
        text = """
        TC-11000
        ULR No: TC584325000010153F
        """
        fields = extract_fields(text)
        self.assertEqual(fields["certificate_no"], "TC-584325")
        self.assertEqual(fields["ulr"], "TC584325000010153F")

    def test_ulr_normalization_fixes_common_ocr_7c_prefix(self):
        self.assertEqual(normalize_ulr("7C504024000036001F"), "TC504024000036001F")

    def test_direct_text_validation_rejects_bad_extractions(self):
        self.assertFalse(_direct_text_has_valid_identifiers("URL NO: TC1234BADULR"))
        self.assertFalse(_direct_text_has_valid_identifiers("CERTIFICATE: 12-345"))
        self.assertTrue(_direct_text_has_valid_identifiers("TC-12345 ULR NO: TC1234512345678901F"))


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

    def test_ulr_mismatch_rejects(self):
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
        self.assertEqual(reason, "Certificate number does not match ULR.")

    def test_unknown_certificate_rejects_even_if_ulr_present(self):
        lab, status, reason = validate_report(
            {
                "certificate_no": "TC-9999",
                "ulr": "TC64672600000001F",
            }
        )
        self.assertIsNone(lab)
        self.assertEqual(status, "REJECTED")
        self.assertEqual(reason, "Certificate number does not exist in lab database.")

    def test_ulr_prefix_mismatch_rejects_even_when_lab_ulr_missing_in_db(self):
        LabMaster.objects.create(
            lab_id="LAB-3",
            laboratory_name="No ULR Lab",
            cert_no="TC-8777",
            ulr_number=None,
            labtype="Testing",
            issue_date=date(2024, 12, 26),
            to_date=date(2028, 12, 25),
            prime_address="Prime Address",
        )
        lab, status, reason = validate_report(
            {
                "certificate_no": "TC-8777",
                "ulr": "TC25000000126FLABR",
            }
        )
        self.assertIsNotNone(lab)
        self.assertEqual(status, "REJECTED")
        self.assertEqual(reason, "Certificate number does not match ULR.")

    def test_report_expired_when_upload_date_after_valid_till(self):
        lab = LabMaster.objects.create(
            lab_id="LAB-4",
            laboratory_name="Expired Lab",
            cert_no="TC-9000",
            ulr_number="TC90002600000001F",
            labtype="Testing",
            issue_date=date(2024, 6, 10),
            to_date=date(2025, 6, 10),
            prime_address="Prime Address",
        )
        lab, status, reason = validate_report(
            {
                "certificate_no": "TC-9000",
                "ulr": "TC90002600000001F",
                "lab_name": "Expired Lab",
            },
            upload_date=date(2026, 3, 11),
        )
        self.assertEqual(lab.cert_no, "TC-9000")
        self.assertEqual(status, "REJECTED")
        self.assertEqual(
            reason,
            "The test report is invalid because the laboratory's certificate expired before the test was conducted.",
        )
