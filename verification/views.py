from rest_framework.response import Response
from rest_framework.views import APIView

from .models import LabMaster, Report
from .utils import (
    extract_fields,
    extract_text_from_pdf,
    generate_file_hash,
    validate_report,
)


class UploadReportView(APIView):
    def post(self, request):
        file = request.FILES.get("file")
        if not file:
            return Response({"error": "No file uploaded"}, status=400)

        file_hash = generate_file_hash(file)
        existing_report = Report.objects.filter(file_hash=file_hash).first()

        if existing_report:
            try:
                text = extract_text_from_pdf(existing_report.file.path)
                extracted = extract_fields(text)
                lab, status = validate_report(extracted, report_id=existing_report.id)

                existing_report.accreditation_no = extracted.get("certificate_no")
                existing_report.ulr_number = extracted.get("ulr")
                existing_report.status = status
                existing_report.validation_score = 100 if status == "VALID" else 0
                if lab:
                    existing_report.lab_name = lab.laboratory_name
                existing_report.save()

                valid_till = (lab.extend_date or lab.to_date) if lab else None
                return Response(
                    {
                        "success": True,
                        "data": {
                            "lab_name": existing_report.lab_name,
                            "labtype": lab.labtype if lab else extracted.get("labtype"),
                            "certificate_no": existing_report.accreditation_no,
                            "ulr_number": existing_report.ulr_number,
                            "status": existing_report.status,
                            "issue_date": extracted.get("issue_date"),
                            "valid_till": valid_till,
                        },
                    }
                )
            except Exception as e:
                return Response({"error": str(e)}, status=500)

        report = Report.objects.create(file=file, file_hash=file_hash)
        try:
            text = extract_text_from_pdf(report.file.path)
            extracted = extract_fields(text)

            report.accreditation_no = extracted.get("certificate_no")
            report.ulr_number = extracted.get("ulr")

            lab, status = validate_report(extracted, report_id=report.id)
            report.status = status
            report.validation_score = 100 if status == "VALID" else 0

            if lab:
                report.lab_name = lab.laboratory_name
            report.save()

            valid_till = (lab.extend_date or lab.to_date) if lab else None
            return Response(
                {
                    "success": True,
                    "data": {
                        "lab_name": report.lab_name,
                        "labtype": lab.labtype if lab else extracted.get("labtype"),
                        "certificate_no": report.accreditation_no,
                        "ulr_number": report.ulr_number,
                        "status": report.status,
                        "issue_date": extracted.get("issue_date"),
                        "valid_till": valid_till,
                    },
                }
            )
        except Exception as e:
            return Response({"error": str(e)}, status=500)


class ReportByUlrView(APIView):
    def get(self, request, ulr):
        report = Report.objects.filter(ulr_number=ulr).order_by("-created_at").first()
        if not report:
            return Response({"message": "Certificate not found for the provided ULR"}, status=404)

        lab = None
        if report.accreditation_no:
            lab = LabMaster.objects.filter(cert_no=report.accreditation_no).first()

        valid_till = (lab.extend_date or lab.to_date) if lab else None
        issue_date = str(lab.issue_date) if lab and lab.issue_date else None

        return Response(
            {
                "success": True,
                "data": {
                    "lab_name": report.lab_name,
                    "labtype": lab.labtype if lab else None,
                    "certificate_no": report.accreditation_no,
                    "ulr_number": report.ulr_number,
                    "status": report.status,
                    "issue_date": issue_date,
                    "valid_till": valid_till,
                },
            }
        )
