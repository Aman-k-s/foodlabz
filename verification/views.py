from rest_framework.views import APIView
from rest_framework.response import Response
from .models import Report
from .utils import generate_file_hash, extract_text_from_pdf, extract_fields, validate_report


# class UploadReportView(APIView):

#     def post(self, request):
#         file = request.FILES['file']
#         file_hash = generate_file_hash(file)

#         if Report.objects.filter(file_hash=file_hash).exists():
#             return Response({"error": "Duplicate file"})

#         report = Report.objects.create(file=file, file_hash=file_hash)

#         text = extract_text_from_pdf(report.file.path)
#         extracted = extract_fields(text)

#         report.lab_name = extracted["lab_name"]
#         report.accreditation_no = extracted["accreditation_no"]
#         report.ulr_number = extracted["ulr"]
#         report.save()

#         score, status = validate_report(extracted)

#         report.validation_score = score
#         report.status = status
#         report.save()

#         return Response({
#             "success": True,
#             "data": {
#                 "lab_name": report.lab_name,
#                 "accreditation_no": report.accreditation_no,
#                 "ulr_number": report.ulr_number,
#                 "validation_score": score,
#                 "status": status
#             }
#         })
class UploadReportView(APIView):

    def post(self, request):
        file = request.FILES.get('file')

        if not file:
            return Response({"error": "No file uploaded"}, status=400)

        return Response({
            "message": "File received successfully",
            "filename": file.name,
            "size": file.size
        })
    