import pandas as pd
from datetime import datetime
from verification.models import LabMaster


def safe_parse_date(value):
    if pd.isna(value):
        return None
    if isinstance(value, datetime):
        return value.date()
    parsed = pd.to_datetime(str(value).strip(), dayfirst=True, errors="coerce")
    if pd.isna(parsed):
        return None
    return parsed.date()


def import_labs_from_excel(path):
    df = pd.read_excel(path)
    df.columns = df.columns.str.strip()

    print("Total rows in Excel:", len(df))

    LabMaster.objects.all().delete()

    lab_objects = []
    seen_keys = set()

    for _, row in df.iterrows():
        cert_no = str(row["Cert_No"]).strip().upper()
        labtype = str(row["Labtype"]).strip()
        key = (cert_no, labtype)
        if key in seen_keys:
            continue
        seen_keys.add(key)

        lab_objects.append(
            LabMaster(
                lab_id=str(row["LabId"]).strip(),
                laboratory_name=str(row["LaboratoryName"]).strip(),
                cert_no=cert_no,
                labtype=labtype,
                issue_date=safe_parse_date(row.get("Issue_Date")),
                to_date=safe_parse_date(row.get("ToDate")),
                extend_date=safe_parse_date(row.get("ExtendDate")),
                city=(str(row.get("City")).strip() if pd.notna(row.get("City")) else None),
                state=(str(row.get("State")).strip() if pd.notna(row.get("State")) else None),
            )
        )

    LabMaster.objects.bulk_create(lab_objects, batch_size=5000)

    print(f"Import completed. Inserted: {len(lab_objects)}")
