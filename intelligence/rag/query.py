"""
PhantomID — Intelligence Layer
rag/query.py

The RAG query pipeline. Wraps LlamaIndex similarity search against pgvector
and normalises results into the BreachMatch schema.

PUBLIC CONTRACT:
    query_breach_db(hashed_identifier: str) -> dict
"""

import json
import os
from datetime import datetime
from typing import Any

import sqlalchemy
from llama_index.core import VectorStoreIndex, StorageContext
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
from llama_index.vector_stores.postgres import PGVectorStore

# ── Config ────────────────────────────────────────────────────────────────────
SUPABASE_DB_URL = os.environ["SUPABASE_DB_URL"]
EMBED_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
TABLE_NAME = "breach_vectors"
TOP_K = 10
SIMILARITY_THRESHOLD = 0.70


def _url_part(part: str) -> Any:
    """Extract a component from the DB URL using SQLAlchemy."""
    url = sqlalchemy.engine.make_url(SUPABASE_DB_URL)
    return getattr(url, part)


def _build_index() -> VectorStoreIndex:
    vector_store = PGVectorStore.from_params(
        database=_url_part("database"),
        host=_url_part("host"),
        password=_url_part("password"),
        port=int(_url_part("port") or 5432),
        user=_url_part("username"),   # SQLAlchemy URL uses .username not .user
        table_name=TABLE_NAME,
        embed_dim=384,
    )
    embed_model = HuggingFaceEmbedding(model_name=EMBED_MODEL_NAME)
    storage_context = StorageContext.from_defaults(vector_store=vector_store)
    return VectorStoreIndex([], storage_context=storage_context, embed_model=embed_model)


# Module-level singleton — built once on first import
_INDEX: VectorStoreIndex | None = None


def _get_index() -> VectorStoreIndex:
    global _INDEX
    if _INDEX is None:
        _INDEX = _build_index()
    return _INDEX


def _parse_node_metadata(node) -> dict:
    """Extract and validate metadata from a LlamaIndex scored node."""
    meta = node.metadata or {}
    try:
        exposed_fields = json.loads(meta.get("exposed_fields", "[]"))
    except (json.JSONDecodeError, TypeError):
        exposed_fields = []

    raw_date = meta.get("date", "")
    try:
        datetime.fromisoformat(raw_date)
        date_str = raw_date
    except ValueError:
        date_str = datetime.utcnow().date().isoformat()

    return {
        "source": str(meta.get("source", "unknown")),
        "date": date_str,
        "exposed_fields": exposed_fields if isinstance(exposed_fields, list) else [],
        "confidence": float(round(node.score, 4)) if node.score is not None else 0.0,
        "raw_preview": str(meta.get("raw_preview", ""))[:100],
    }


def _compute_risk_score(matches: list[dict]) -> int:
    """
    Compute risk_score (integer 0–100) from match list.
    Higher confidence + more sensitive exposed_fields = higher score.
    """
    if not matches:
        return 0

    SENSITIVE = {"password_hash", "password", "pan", "aadhaar_partial", "dob"}
    HIGH_SENSITIVITY = {"pan", "aadhaar_partial"}

    base = 0.0
    for m in matches:
        conf = m["confidence"]
        fields = set(m.get("exposed_fields", []))
        sensitivity = 1.0
        if fields & HIGH_SENSITIVITY:
            sensitivity = 1.5
        elif fields & SENSITIVE:
            sensitivity = 1.2
        base += conf * sensitivity

    normalised = min(100, int((base / max(len(matches), 1)) * 40 + (len(matches) - 1) * 5))
    return max(0, min(100, normalised))


def query_breach_db(hashed_identifier: str) -> dict:
    """
    Query the breach vector store for a given identifier.

    Args:
        hashed_identifier: SHA-256 hex digest of the raw identifier (email/phone/PAN prefix).
                           NEVER accept raw PII as input.

    Returns:
        A dict matching contracts/breach_match.schema.json exactly.
    """
    if not isinstance(hashed_identifier, str) or len(hashed_identifier) != 64:
        raise ValueError(
            "hashed_identifier must be a SHA-256 hex string (64 chars). "
            "Never pass raw PII."
        )

    index = _get_index()
    retriever = index.as_retriever(similarity_top_k=TOP_K)

    query_text = f"Hash: {hashed_identifier}"
    nodes = retriever.retrieve(query_text)

    matches = []
    for node in nodes:
        if node.score is not None and node.score < SIMILARITY_THRESHOLD:
            continue
        parsed = _parse_node_metadata(node)
        node_hash = node.metadata.get("hashed_identifier", "")
        if node_hash != hashed_identifier:
            continue
        matches.append(parsed)

    # Deduplicate by source — keep highest confidence per source
    seen: dict[str, dict] = {}
    for m in matches:
        src = m["source"]
        if src not in seen or m["confidence"] > seen[src]["confidence"]:
            seen[src] = m
    matches = list(seen.values())

    risk_score = _compute_risk_score(matches)

    return {
        "matches": matches,
        "risk_score": risk_score,
        "identifier_queried": hashed_identifier,
    }
