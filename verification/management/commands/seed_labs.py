from pathlib import Path

from django.core.management.base import BaseCommand

from verification.import_labs import import_labs_from_excel
from verification.models import LabMaster


class Command(BaseCommand):
    help = "Import lab master data only when the LabMaster table is empty."

    def add_arguments(self, parser):
        parser.add_argument(
            "excel_path",
            nargs="?",
            default="file1.xlsx",
            help="Path to the Excel file used to seed lab data. Defaults to file1.xlsx.",
        )

    def handle(self, *args, **options):
        current_count = LabMaster.objects.count()
        if current_count > 0:
            self.stdout.write(f"Lab data already present. Current LabMaster count: {current_count}")
            return

        excel_path = Path(options["excel_path"]).expanduser()
        if not excel_path.is_absolute():
            excel_path = Path.cwd() / excel_path

        if not excel_path.exists():
            self.stdout.write(self.style.WARNING(f"Seed file not found, skipping lab import: {excel_path}"))
            return

        self.stdout.write(f"Lab table empty. Importing labs from {excel_path} ...")
        import_labs_from_excel(excel_path)
        self.stdout.write(
            self.style.SUCCESS(f"Lab seed completed. Current LabMaster count: {LabMaster.objects.count()}")
        )
