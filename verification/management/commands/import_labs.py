from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from verification.import_labs import import_labs_from_excel
from verification.models import LabMaster


class Command(BaseCommand):
    help = "Import lab master data from an Excel file into LabMaster."

    def add_arguments(self, parser):
        parser.add_argument("excel_path", type=str, help="Path to the Excel file to import.")

    def handle(self, *args, **options):
        excel_path = Path(options["excel_path"]).expanduser()
        if not excel_path.is_absolute():
            excel_path = Path.cwd() / excel_path

        if not excel_path.exists():
            raise CommandError(f"Excel file not found: {excel_path}")

        self.stdout.write(f"Importing labs from {excel_path} ...")
        import_labs_from_excel(excel_path)
        self.stdout.write(
            self.style.SUCCESS(f"Lab import completed. Current LabMaster count: {LabMaster.objects.count()}")
        )
