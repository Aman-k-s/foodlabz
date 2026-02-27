from rest_framework.views import APIView
from rest_framework.response import Response
from .models import Report
from .utils import (
    generate_file_hash,
    extract_text_from_pdf,
    extract_fields,
    validate_report
)


class UploadReportView(APIView):

    def post(self, request):

        file = request.FILES.get('file')

        if not file:
            return Response({"error": "No file uploaded"}, status=400)

        file_hash = generate_file_hash(file)

        # 🔁 Check if file already exists
        existing_report = Report.objects.filter(file_hash=file_hash).first()

        if existing_report:
            try:
                # Re-run OCR and validation
                text = extract_text_from_pdf(existing_report.file.path)
                extracted = extract_fields(text)

                lab, status = validate_report(extracted)

                existing_report.accreditation_no = extracted.get("certificate_no")
                existing_report.ulr_number = extracted.get("ulr")
                existing_report.status = status

                if lab:
                    existing_report.lab_name = lab.laboratory_name

                existing_report.save()

                return Response({
                    "message": "File reprocessed",
                    "data": {
                        "lab_name": existing_report.lab_name,
                        "certificate_no": existing_report.accreditation_no,
                        "ulr_number": existing_report.ulr_number,
                        "status": existing_report.status
                    }
                })

            except Exception as e:
                print("ERROR:", str(e))
                return Response({"error": str(e)}, status=500)

        # 🆕 Create new report
        report = Report.objects.create(file=file, file_hash=file_hash)

        try:
            # OCR
            text = extract_text_from_pdf(report.file.path)

            # Extract fields
            extracted = extract_fields(text)

            report.accreditation_no = extracted.get("certificate_no")
            report.ulr_number = extracted.get("ulr")

            # Validate
            lab, status = validate_report(extracted)

            report.status = status

            if lab:
                report.lab_name = lab.laboratory_name

            report.save()

            return Response({
                "success": True,
                "data": {
                    "lab_name": report.lab_name,
                    "certificate_no": report.accreditation_no,
                    "ulr_number": report.ulr_number,
                    "status": report.status
                }
            })

        except Exception as e:
            print("ERROR:", str(e))
            return Response({"error": str(e)}, status=500)