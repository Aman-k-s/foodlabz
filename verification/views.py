from functools import lru_cache
from pathlib import Path

import pandas as pd
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import LabMaster, Report
from .utils import (
    extract_fields,
    extract_text_from_pdf,
    generate_file_hash,
    validate_report,
)

LAB_DIRECTORY_XLSX = Path(__file__).resolve().parent.parent / "File.xlsx"


def _normalize_text(value):
    if pd.isna(value) or value is None:
        return None
    text = str(value).strip()
    return text or None


def _normalize_date(value):
    if pd.isna(value) or value is None:
        return None
    parsed = pd.to_datetime(value, dayfirst=True, errors="coerce")
    if pd.isna(parsed):
        return None
    return parsed.date().isoformat()


def _parse_positive_int(value, default):
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    return parsed if parsed > 0 else default


@lru_cache(maxsize=1)
def load_labs_directory():
    if not LAB_DIRECTORY_XLSX.exists():
        return []

    df = pd.read_excel(
        LAB_DIRECTORY_XLSX,
        usecols=[
            "LaboratoryName",
            "Cert_No",
            "Labtype",
            "ExtendDate",
            "ToDate",
            "disciplineName",
            "groupName",
            "subGrpName",
            "City",
            "State",
        ],
    )
    df.columns = df.columns.str.strip()

    labs = []
    for _, row in df.iterrows():
        validity_date = _normalize_date(row.get("ExtendDate")) or _normalize_date(row.get("ToDate"))
        segments = [
            _normalize_text(row.get("disciplineName")),
            _normalize_text(row.get("groupName")),
            _normalize_text(row.get("subGrpName")),
        ]
        name = _normalize_text(row.get("LaboratoryName")) or "Unknown Laboratory"
        certificate_no = _normalize_text(row.get("Cert_No")) or "N/A"
        lab_type = _normalize_text(row.get("Labtype")) or "N/A"
        district = _normalize_text(row.get("City"))
        state = _normalize_text(row.get("State"))
        commodity_or_segment = " | ".join(segment for segment in segments if segment) or "N/A"

        labs.append(
            {
                "name": name,
                "certificateNo": certificate_no,
                "labType": lab_type,
                "validityDate": validity_date,
                "commodityOrSegment": commodity_or_segment,
                "district": district,
                "state": state,
                "_search": " ".join(
                    filter(
                        None,
                        [name.lower(), certificate_no.lower(), lab_type.lower(), commodity_or_segment.lower(), (district or "").lower(), (state or "").lower()],
                    )
                ),
            }
        )

    labs.sort(key=lambda lab: (lab["name"], lab["certificateNo"]))
    return labs


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


class LabsDirectoryView(APIView):
    def get(self, request):
        labs = load_labs_directory()
        query = (request.query_params.get("q") or "").strip().lower()
        page = _parse_positive_int(request.query_params.get("page"), 1)
        page_size = min(_parse_positive_int(request.query_params.get("page_size"), 50), 100)

        if query:
            filtered_labs = [lab for lab in labs if query in lab["_search"]]
        else:
            filtered_labs = labs

        total = len(filtered_labs)
        start = (page - 1) * page_size
        end = start + page_size
        page_items = [
            {key: value for key, value in lab.items() if key != "_search"}
            for lab in filtered_labs[start:end]
        ]

        return Response(
            {
                "success": True,
                "total": total,
                "page": page,
                "pageSize": page_size,
                "data": page_items,
            }
        )
