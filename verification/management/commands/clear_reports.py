from django.core.management.base import BaseCommand

from verification.models import Report


class Command(BaseCommand):
    help = "Delete all uploaded reports and their stored files."

    def handle(self, *args, **options):
        reports = list(Report.objects.all())
        report_count = len(reports)
        deleted_files = 0

        for report in reports:
            if report.file:
                report.file.delete(save=False)
                deleted_files += 1

        Report.objects.all().delete()

        self.stdout.write(
            self.style.SUCCESS(
                f"Cleared reports successfully. Deleted rows: {report_count}, files: {deleted_files}"
            )
        )
