"""
PhantomID — Intelligence Layer
ingest/ingest.py

Responsible for loading breach datasets into pgvector via LlamaIndex.
Hashes all PII before storage. Never stores raw PII.
"""

import hashlib
import os
import json
from datetime import datetime
from typing import Optional

import sqlalchemy
from llama_index.core import Document, VectorStoreIndex, StorageContext
from llama_index.vector_stores.postgres import PGVectorStore
from llama_index.embeddings.huggingface import HuggingFaceEmbedding

# ── Config ────────────────────────────────────────────────────────────────────
SUPABASE_DB_URL = os.environ["SUPABASE_DB_URL"]
EMBED_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
TABLE_NAME = "breach_vectors"


def _url_part(part: str):
    """Extract a component from the DB URL using SQLAlchemy."""
    url = sqlalchemy.engine.make_url(SUPABASE_DB_URL)
    return getattr(url, part)


def sha256_hex(raw: str) -> str:
    """Hash a raw identifier. NEVER store raw PII."""
    return hashlib.sha256(raw.strip().lower().encode()).hexdigest()


def mask_preview(raw_line: str, max_len: int = 100) -> str:
    """
    Produce a safe preview string — no raw email/phone/PAN.
    Replaces anything that looks like PII with asterisks.
    """
    import re
    masked = re.sub(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", "***@***.***", raw_line)
    masked = re.sub(r"\b\d{10}\b", "**********", masked)
    masked = re.sub(r"\b[A-Z]{5}[0-9]{4}[A-Z]\b", "**PAN**", masked)
    return masked[:max_len]


def build_vector_store() -> PGVectorStore:
    """Build PGVectorStore using the direct connection string."""
    return PGVectorStore.from_params(
        connection_string=SUPABASE_DB_URL,
        table_name=TABLE_NAME,
        embed_dim=384,
    )


def get_index(vector_store: Optional[PGVectorStore] = None) -> VectorStoreIndex:
    if vector_store is None:
        vector_store = build_vector_store()
    embed_model = HuggingFaceEmbedding(model_name=EMBED_MODEL_NAME)
    storage_context = StorageContext.from_defaults(vector_store=vector_store)
    return VectorStoreIndex([], storage_context=storage_context, embed_model=embed_model)


def ingest_breach_record(
    *,
    source: str,
    date: str,
    exposed_fields: list[str],
    raw_identifier: str,
    raw_line: str,
    index: VectorStoreIndex,
) -> None:
    """
    Ingest one breach record into the vector store.

    Args:
        source: Breach name, e.g. "MobiKwik_2021"
        date: ISO-8601 date string
        exposed_fields: list of field names exposed
        raw_identifier: the raw email/phone/PAN (will be hashed, NEVER stored)
        raw_line: the raw CSV/JSON line (will be masked before storage)
        index: LlamaIndex VectorStoreIndex to insert into
    """
    hashed = sha256_hex(raw_identifier)
    preview = mask_preview(raw_line)

    metadata = {
        "source": source,
        "date": date,
        "exposed_fields": json.dumps(exposed_fields),
        "hashed_identifier": hashed,
        "raw_preview": preview,
    }

    text = (
        f"Breach: {source} | Date: {date} | "
        f"Fields: {', '.join(exposed_fields)} | "
        f"Hash: {hashed} | Preview: {preview}"
    )

    doc = Document(text=text, metadata=metadata)
    index.insert(doc)


def ingest_jsonl_file(
    filepath: str,
    source: str,
    date: str,
    id_field: str,
    field_map: dict[str, str],
    index: VectorStoreIndex,
) -> int:
    """
    Ingest a JSONL breach file.

    Returns:
        Number of records ingested.
    """
    count = 0
    with open(filepath, "r", encoding="utf-8", errors="ignore") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                continue

            raw_id = record.get(id_field, "")
            if not raw_id:
                continue

            exposed = [v for k, v in field_map.items() if record.get(k)]
            ingest_breach_record(
                source=source,
                date=date,
                exposed_fields=exposed,
                raw_identifier=str(raw_id),
                raw_line=line,
                index=index,
            )
            count += 1
    return count


def ingest_csv_file(
    filepath: str,
    source: str,
    date: str,
    id_col: str,
    exposed_cols: list[str],
    index: VectorStoreIndex,
    delimiter: str = ",",
) -> int:
    """
    Ingest a CSV breach file.

    Returns:
        Number of records ingested.
    """
    import csv

    count = 0
    with open(filepath, "r", encoding="utf-8", errors="ignore") as fh:
        reader = csv.DictReader(fh, delimiter=delimiter)
        for row in reader:
            raw_id = row.get(id_col, "")
            if not raw_id:
                continue
            exposed = [col for col in exposed_cols if row.get(col)]
            ingest_breach_record(
                source=source,
                date=date,
                exposed_fields=exposed,
                raw_identifier=str(raw_id),
                raw_line=str(row),
                index=index,
            )
            count += 1
    return count
