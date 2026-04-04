import os
import tempfile
import threading
from pathlib import Path

from django.conf import settings
from django.core.paginator import Paginator
from django.db.models import Q
from django.http import FileResponse, Http404
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import LabMaster, Report
from .utils import (
    extract_fields,
    extract_text_from_pdf,
    find_lab_match,
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
        return request.build_absolute_uri(f"/api/media/{report.file.name}")
    except Exception:
        return f"/api/media/{report.file.name}"


def _serialize_report(request, report, lab, extracted_issue_date=None, extracted_to_date=None):
    valid_till = (lab.extend_date or lab.to_date) if lab else None
    issue_date = str(lab.issue_date) if lab and lab.issue_date else None
    to_date = str(lab.to_date) if lab and lab.to_date else None
    ulr_number = report.ulr_number or (lab.ulr_number if lab else None)
    return {
        "id": report.id,
        "vendor": report.vendor,
        "vendor_id": report.vendor_id,
        "vendor_name": report.vendor_name,
        "consignment_id": report.consignment_id,
        "commodity": report.commodity,
        "lab_name": lab.laboratory_name if lab else report.lab_name,
        "labtype": lab.labtype if lab else None,
        "certificate_no": lab.cert_no if lab else report.accreditation_no,
        "ulr_number": ulr_number,
        "status": report.status,
        "rejection_reason": report.rejection_reason,
        "issue_date": issue_date,
        "to_date": to_date,
        "valid_till": valid_till,
        "address": _lab_address(lab),
        "file_url": _report_file_url(request, report),
        "created_at": report.created_at,
    }


def _serialize_lab(lab):
    valid_till = lab.extend_date or lab.to_date
    return {
        "lab_id": lab.lab_id,
        "laboratory_name": lab.laboratory_name,
        "cert_no": lab.cert_no,
        "labtype": lab.labtype,
        "issue_date": str(lab.issue_date) if lab.issue_date else None,
        "to_date": str(lab.to_date) if lab.to_date else None,
        "valid_till": str(valid_till) if valid_till else None,
        "city": lab.city,
        "state": lab.state,
        "address": lab.prime_address,
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


def _process_uploaded_report(report_id):
    try:
        report = Report.objects.get(id=report_id)
    except Report.DoesNotExist:
        return

    try:
        file_path = report.file.path
        text = extract_text_from_pdf(file_path)
        extracted = extract_fields(text)

        report.accreditation_no = extracted.get("certificate_no")
        report.ulr_number = normalize_ulr(extracted.get("ulr"))

        if report.ulr_number:
            duplicate_report = (
                Report.objects.filter(ulr_number__iexact=report.ulr_number)
                .exclude(id=report.id)
                .order_by("-created_at")
                .first()
            )
            if duplicate_report:
                _reject_report(
                    report,
                    "This ULR number has already been uploaded in the demo database. Clear demo reports to upload it again.",
                )
                return

        upload_date = timezone.localdate()
        lab, status, rejection_reason = validate_report(
            extracted,
            report_id=report.id,
            upload_date=upload_date,
        )
        report.status = status
        report.validation_score = 100 if status == "VALID" else 0
        report.rejection_reason = rejection_reason

        if lab:
            report.lab_name = lab.laboratory_name
            report.accreditation_no = lab.cert_no
            if not report.ulr_number and lab.ulr_number:
                report.ulr_number = normalize_ulr(lab.ulr_number)

        report.save()
    except Exception as exc:
        _reject_report(report, str(exc))


def _start_report_processing(report_id):
    worker = threading.Thread(
        target=_process_uploaded_report,
        args=(report_id,),
        daemon=True,
        name=f"report-processor-{report_id}",
    )
    worker.start()


class UploadReportView(APIView):
    def post(self, request):
        try:
            file = request.FILES.get("file")
            vendor_id = (request.data.get("vendor_id") or "").strip()
            vendor_name = (request.data.get("vendor_name") or "").strip()
            consignment_id = (request.data.get("consignment_id") or "").strip()
            commodity = (request.data.get("commodity") or "").strip()
            if not file:
                return Response({"error": "No file uploaded"}, status=400)
            if not vendor_id:
                return Response({"error": "Vendor ID is required for demo uploads."}, status=400)
            if not vendor_name:
                return Response({"error": "Vendor Name is required for demo uploads."}, status=400)
            if not consignment_id:
                return Response({"error": "Consignment ID is required for demo uploads."}, status=400)
            if not commodity:
                return Response({"error": "Commodity is required for demo uploads."}, status=400)
            if not str(file.name).lower().endswith(".pdf"):
                return Response({"error": "Only PDF reports are supported for upload."}, status=400)

            file_hash = generate_file_hash(file)
            existing_file_report = Report.objects.filter(file_hash=file_hash).order_by("-created_at").first()
            if existing_file_report:
                return Response(
                    {
                        "error": "This exact report has already been uploaded in the demo database. Clear demo reports to upload it again."
                    },
                    status=400,
                )

            report = Report(file_hash=file_hash)
            report.vendor = vendor_name
            report.vendor_id = vendor_id
            report.vendor_name = vendor_name
            report.consignment_id = consignment_id
            report.commodity = commodity
            report.file = file
            report.status = "PROCESSING"
            report.rejection_reason = None
            report.save()
            _start_report_processing(report.id)

            return Response(
                {
                    "success": True,
                    "data": _serialize_report(request=request, report=report, lab=None),
                }
            )
        except Exception as e:
            return Response({"error": _trim_reason(str(e))}, status=500)


class ReportByUlrView(APIView):
    def get(self, request, ulr):
        normalized_ulr = normalize_ulr(ulr)
        if not normalized_ulr:
            return Response({"message": "ULR number does not exist in lab database."}, status=404)

        report = Report.objects.filter(ulr_number__iexact=normalized_ulr).order_by("-created_at").first()
        if not report:
            return Response({"message": "ULR number does not exist in lab database."}, status=404)

        lab = None
        lab, _ = find_lab_match(cert_no=report.accreditation_no, ulr=report.ulr_number)

        return Response(
            {
                "success": True,
                "data": _serialize_report(request=request, report=report, lab=lab),
            }
        )


class ReportByIdView(APIView):
    def get(self, request, report_id):
        report = Report.objects.filter(id=report_id).first()
        if not report:
            return Response({"message": "Report does not exist."}, status=404)

        lab = None
        if report.accreditation_no or report.ulr_number:
            lab, _ = find_lab_match(cert_no=report.accreditation_no, ulr=report.ulr_number)

        return Response(
            {
                "success": True,
                "data": _serialize_report(request=request, report=report, lab=lab),
            }
        )


class UploadedReportsView(APIView):
    def get(self, request):
        query = (request.GET.get("q") or "").strip()
        status_filter = (request.GET.get("status") or "").strip()
        try:
            page = int(request.GET.get("page", 1))
        except ValueError:
            page = 1
        try:
            page_size = int(request.GET.get("page_size", 25))
        except ValueError:
            page_size = 25

        page = max(page, 1)
        page_size = max(1, min(page_size, 100))

        reports = Report.objects.order_by("-created_at")
        if query:
            reports = reports.filter(
                Q(vendor_id__icontains=query)
                | Q(vendor_name__icontains=query)
                | Q(consignment_id__icontains=query)
                | Q(commodity__icontains=query)
                | Q(lab_name__icontains=query)
                | Q(accreditation_no__icontains=query)
                | Q(ulr_number__icontains=query)
                | Q(status__icontains=query)
            )
        if status_filter:
            reports = reports.filter(status__iexact=status_filter)

        paginator = Paginator(reports, page_size)
        page_obj = paginator.get_page(page)
        data = []
        for report in page_obj.object_list:
            lab, _ = find_lab_match(cert_no=report.accreditation_no, ulr=report.ulr_number)
            data.append(_serialize_report(request=request, report=report, lab=lab))
        return Response(
            {
                "success": True,
                "data": data,
                "count": paginator.count,
                "page": page_obj.number,
                "page_size": page_size,
            }
        )


class ClearUploadedReportsView(APIView):
    def post(self, request):
        reports = list(Report.objects.all())
        cleared = len(reports)
        for report in reports:
            try:
                if report.file:
                    report.file.delete(save=False)
            except Exception:
                pass
        Report.objects.all().delete()
        return Response({"success": True, "cleared": cleared})


class LabsDirectoryView(APIView):
    def get(self, request):
        query = (request.GET.get("q") or "").strip()
        labtype_filter = (request.GET.get("labtype") or "").strip()
        state_filter = (request.GET.get("state") or "").strip()
        city_filter = (request.GET.get("city") or "").strip()
        try:
            page = int(request.GET.get("page", 1))
        except ValueError:
            page = 1
        try:
            page_size = int(request.GET.get("page_size", 50))
        except ValueError:
            page_size = 50

        page = max(page, 1)
        page_size = max(1, min(page_size, 200))

        labs = LabMaster.objects.all().order_by("laboratory_name")
        if query:
            labs = labs.filter(
                Q(laboratory_name__icontains=query)
                | Q(cert_no__icontains=query)
                | Q(labtype__icontains=query)
                | Q(city__icontains=query)
                | Q(state__icontains=query)
                | Q(prime_address__icontains=query)
            )
        if labtype_filter:
            labs = labs.filter(labtype__icontains=labtype_filter)
        if state_filter:
            labs = labs.filter(state__icontains=state_filter)
        if city_filter:
            labs = labs.filter(city__icontains=city_filter)

        paginator = Paginator(labs, page_size)
        page_obj = paginator.get_page(page)
        data = [_serialize_lab(lab) for lab in page_obj.object_list]
        return Response(
            {
                "success": True,
                "data": data,
                "count": paginator.count,
                "page": page_obj.number,
                "page_size": page_size,
            }
        )


class ReportMediaView(APIView):
    def get(self, request, file_path):
        media_root = Path(settings.MEDIA_ROOT).resolve()
        requested = (media_root / file_path).resolve()
        if media_root not in requested.parents and requested != media_root:
            raise Http404("File not found")
        if not requested.exists() or not requested.is_file():
            raise Http404("File not found")
        return FileResponse(requested.open("rb"), as_attachment=False, filename=requested.name)
