import pandas as pd
from datetime import datetime
from verification.models import LabMaster


def get_first_present(row, keys):
    for key in keys:
        if key in row and pd.notna(row.get(key)):
            return row.get(key)
    return None


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
                ulr_number=(
                    str(get_first_present(row, ["ULR", "ULR_Number", "ULRNo", "ULR NO", "Ulr"])).strip().upper()
                    if get_first_present(row, ["ULR", "ULR_Number", "ULRNo", "ULR NO", "Ulr"]) is not None
                    else None
                ),
                labtype=labtype,
                issue_date=safe_parse_date(row.get("Issue_Date")),
                to_date=safe_parse_date(row.get("ToDate")),
                extend_date=safe_parse_date(row.get("ExtendDate")),
                city=(str(row.get("City")).strip() if pd.notna(row.get("City")) else None),
                state=(str(row.get("State")).strip() if pd.notna(row.get("State")) else None),
                prime_address=(
                    str(row.get("PrimeAddress")).strip()
                    if pd.notna(row.get("PrimeAddress"))
                    else None
                ),
            )
        )

    LabMaster.objects.bulk_create(lab_objects, batch_size=5000)

    print(f"Import completed. Inserted: {len(lab_objects)}")
