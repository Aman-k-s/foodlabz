import pandas as pd
from datetime import datetime
from verification.models import LabMaster


def safe_parse_date(value):
    if pd.isna(value):
        return None
    if isinstance(value, datetime):
        return value.date()
    try:
        return datetime.strptime(str(value).strip(), "%d/%m/%Y").date()
    except:
        return None


def import_labs_from_excel(path):

    df = pd.read_excel(path)

    print("Total rows in Excel:", len(df))

    lab_objects = []

    for _, row in df.iterrows():

        cert_no = str(row['Cert_No']).strip().upper()

        lab_objects.append(
            LabMaster(
                lab_id=str(row['LabId']).strip(),
                laboratory_name=str(row['LaboratoryName']).strip(),
                cert_no=cert_no,
                issue_date=safe_parse_date(row.get('Issue_Date')),
                to_date=safe_parse_date(row.get('ToDate')),
                extend_date=safe_parse_date(row.get('ExtendDate')),
                city=row.get('City'),
                state=row.get('State')
            )
        )

    LabMaster.objects.bulk_create(lab_objects)

    print("Import completed.")