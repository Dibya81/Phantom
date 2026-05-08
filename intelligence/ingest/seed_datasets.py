"""
PhantomID — Intelligence Layer
ingest/seed_datasets.py

Run this script ONCE before Hour 0 to seed all breach datasets.
Usage: python -m intelligence.ingest.seed_datasets
"""

import os
import sys
from dotenv import load_dotenv
load_dotenv()
from intelligence.ingest.ingest import get_index, ingest_jsonl_file, ingest_csv_file

# Paths to raw breach files — adjust to wherever you've downloaded them locally.
# NEVER commit these files to git.
DATA_DIR = os.environ.get("BREACH_DATA_DIR", "./breach_data")

DATASETS = [
    # HaveIBeenPwned (HIBP) — pwned passwords hash list (hash:count TSV)
    # We ingest the email-domain breach list, not raw password hashes.
    {
        "type": "csv",
        "filepath": f"{DATA_DIR}/hibp_breach_list.csv",
        "source": "HIBP",
        "date": "2024-01-01",
        "id_col": "email",
        "exposed_cols": ["email", "password_hash"],
        "delimiter": ",",
    },
    # COMB — Collection of Many Breaches (partial sample)
    {
        "type": "csv",
        "filepath": f"{DATA_DIR}/comb_sample.txt",
        "source": "COMB_2021",
        "date": "2021-02-01",
        "id_col": "email",
        "exposed_cols": ["email", "password_hash"],
        "delimiter": ":",
    },
    # CoWIN leak
    {
        "type": "jsonl",
        "filepath": f"{DATA_DIR}/cowin_leak.jsonl",
        "source": "CoWIN_2023",
        "date": "2023-06-12",
        "id_field": "mobile",
        "field_map": {
            "mobile": "phone",
            "name": "name",
            "dob": "dob",
            "aadhaar_last4": "aadhaar_partial",
        },
    },
    # MobiKwik 2021
    {
        "type": "jsonl",
        "filepath": f"{DATA_DIR}/mobikwik_2021.jsonl",
        "source": "MobiKwik_2021",
        "date": "2021-03-01",
        "id_field": "email",
        "field_map": {
            "email": "email",
            "phone": "phone",
            "password_hash": "password_hash",
            "address": "address",
        },
    },
    # Domino's India 2021
    {
        "type": "jsonl",
        "filepath": f"{DATA_DIR}/dominos_india_2021.jsonl",
        "source": "Dominos_India_2021",
        "date": "2021-05-18",
        "id_field": "email",
        "field_map": {
            "email": "email",
            "phone": "phone",
            "address": "address",
        },
    },
]


def main():
    print("[seed] Building vector index …")
    index = get_index()

    for ds in DATASETS:
        fpath = ds["filepath"]
        if not os.path.exists(fpath):
            print(f"[seed] SKIP — file not found: {fpath}")
            continue

        print(f"[seed] Ingesting {ds['source']} from {fpath} …")
        if ds["type"] == "jsonl":
            n = ingest_jsonl_file(
                filepath=fpath,
                source=ds["source"],
                date=ds["date"],
                id_field=ds["id_field"],
                field_map=ds["field_map"],
                index=index,
            )
        else:
            n = ingest_csv_file(
                filepath=fpath,
                source=ds["source"],
                date=ds["date"],
                id_col=ds["id_col"],
                exposed_cols=ds["exposed_cols"],
                index=index,
                delimiter=ds.get("delimiter", ","),
            )
        print(f"[seed] {ds['source']}: {n} records ingested.")

    print("[seed] Done.")


if __name__ == "__main__":
    main()