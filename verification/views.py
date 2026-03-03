import os
import tempfile

from rest_framework.response import Response
from rest_framework.views import APIView

from .models import LabMaster, Report
from .utils import (
    extract_fields,
    extract_text_from_pdf,
    generate_file_hash,
    normalize_ulr,
    validate_report,
)


def _trim_reason(message):
    text = (message or "Failed to process document.").strip()
    return text[:250]


def _reject_report(report, reason):
    report.status = "REJECTED"
    report.validation_score = 0
    report.rejection_reason = _trim_reason(reason)
    try:
        report.save(update_fields=["status", "validation_score", "rejection_reason"])
    except Exception:
        # Never re-raise from rejection path; we still want API response.
        pass


def _lab_address(lab):
    if not lab:
        return None
    if lab.prime_address:
        return lab.prime_address
    parts = [part for part in [lab.city, lab.state] if part]
    return ", ".join(parts) if parts else None


def _report_file_url(request, report):
    if not report or not report.file:
        return None
    try:
        return request.build_absolute_uri(report.file.url)
    except Exception:
        return report.file.url


def _serialize_report(request, report, lab, extracted_issue_date=None, extracted_to_date=None):
    valid_till = (lab.extend_date or lab.to_date) if lab else None
    issue_date = str(lab.issue_date) if lab and lab.issue_date else None
    to_date = str(lab.to_date) if lab and lab.to_date else None
    return {
        "lab_name": report.lab_name,
        "labtype": lab.labtype if lab else None,
        "certificate_no": report.accreditation_no,
        "ulr_number": report.ulr_number,
        "status": report.status,
        "rejection_reason": report.rejection_reason,
        "issue_date": issue_date,
        "to_date": to_date,
        "valid_till": valid_till,
        "address": _lab_address(lab),
        "file_url": _report_file_url(request, report),
        "created_at": report.created_at,
    }


def _extract_text_from_uploaded_pdf(file_obj):
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            temp_path = tmp.name
            for chunk in file_obj.chunks():
                tmp.write(chunk)
        return extract_text_from_pdf(temp_path)
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


class UploadReportView(APIView):
    def post(self, request):
        report = None
        try:
            file = request.FILES.get("file")
            if not file:
                return Response({"error": "No file uploaded"}, status=400)
            if not str(file.name).lower().endswith(".pdf"):
                return Response({"error": "Only PDF reports are supported for upload."}, status=400)

            file_hash = generate_file_hash(file)
            report = Report.objects.filter(file_hash=file_hash).first()
            if not report:
                report = Report(file_hash=file_hash)

            # Always refresh stored file and re-run extraction on the current upload.
            report.file = file
            report.status = "PENDING"
            report.rejection_reason = None
            report.save()

            text = _extract_text_from_uploaded_pdf(file)
            extracted = extract_fields(text)

            report.accreditation_no = extracted.get("certificate_no")
            report.ulr_number = normalize_ulr(extracted.get("ulr"))

            lab, status, rejection_reason = validate_report(extracted, report_id=report.id)
            report.status = status
            report.validation_score = 100 if status == "VALID" else 0
            report.rejection_reason = rejection_reason

            if lab:
                report.lab_name = lab.laboratory_name
            report.save()

            return Response(
                {
                    "success": True,
                    "data": _serialize_report(
                        request=request,
                        report=report,
                        lab=lab,
                        extracted_issue_date=extracted.get("issue_date"),
                        extracted_to_date=extracted.get("to_date"),
                    ),
                }
            )
        except Exception as e:
            if not report:
                return Response({"error": _trim_reason(str(e))}, status=500)

            _reject_report(report, str(e))
            return Response(
                {
                    "success": True,
                    "data": _serialize_report(request=request, report=report, lab=None),
                }
            )


class ReportByUlrView(APIView):
    def get(self, request, ulr):
        normalized_ulr = normalize_ulr(ulr)
        if not normalized_ulr:
            return Response({"message": "ULR number does not exist in lab database."}, status=404)

        report = Report.objects.filter(ulr_number__iexact=normalized_ulr).order_by("-created_at").first()
        if not report:
            return Response({"message": "ULR number does not exist in lab database."}, status=404)

        lab = None
        if report.accreditation_no:
            lab = LabMaster.objects.filter(cert_no=report.accreditation_no).first()

        return Response(
            {
                "success": True,
                "data": _serialize_report(request=request, report=report, lab=lab),
            }
        )


class UploadedReportsView(APIView):
    def get(self, request):
        reports = Report.objects.order_by("-created_at")[:100]
        data = []
        for report in reports:
            lab = None
            if report.accreditation_no:
                lab = LabMaster.objects.filter(cert_no=report.accreditation_no).first()
            data.append(_serialize_report(request=request, report=report, lab=lab))
        return Response({"success": True, "data": data})
