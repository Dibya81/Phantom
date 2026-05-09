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
import re
import httpx
import sqlalchemy
from datetime import datetime
from typing import Any, Optional, List, Dict
from dotenv import load_dotenv

 import sqlalchemy
from llama_index.core import VectorStoreIndex, StorageContext
from llama_index.core.vector_stores import MetadataFilters, MetadataFilter
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
from llama_index.vector_stores.postgres import PGVectorStore


# ── Config ────────────────────────────────────────────────────────────────────
SUPABASE_DB_URL = os.environ.get("SUPABASE_DB_URL")
if SUPABASE_DB_URL:
    # Aggressively force psycopg2
    if "postgresql+psycopg" in SUPABASE_DB_URL:
        SUPABASE_DB_URL = re.sub(r"postgresql\+psycopg\d?", "postgresql+psycopg2", SUPABASE_DB_URL)
    elif SUPABASE_DB_URL.startswith("postgresql://"):
        SUPABASE_DB_URL = SUPABASE_DB_URL.replace("postgresql://", "postgresql+psycopg2://", 1)

TABLE_NAME = "breach_vectors"
TOP_K = 10
SIMILARITY_THRESHOLD = 0.70

# ── Intelligence Functions ──────────────────────────────────────────────────


# ── Intelligence Functions ──────────────────────────────────────────────────


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




def _exact_db_lookup(hashed_identifier: str) -> list[dict]:
    """Perform exact match lookup in the pgvector metadata."""
    engine = sqlalchemy.create_engine(SUPABASE_DB_URL)
    query = sqlalchemy.text(
        "SELECT metadata FROM breach_vectors WHERE metadata->>'hashed_identifier' = :h"
    )
    matches = []
    try:
        with engine.connect() as conn:
            results = conn.execute(query, {"h": hashed_identifier})
            for row in results:
                meta = row[0]
                fields = meta.get("exposed_fields", [])
                if isinstance(fields, str):
                    try:
                        fields = json.loads(fields)
                    except:
                        fields = []
                matches.append({
                    "source": meta.get("source") or meta.get("breach", "local_db"),
                    "breach": meta.get("breach") or meta.get("source", "Unknown Breach"),
                    "date": meta.get("date", datetime.utcnow().date().isoformat()),
                    "exposed_fields": fields,
                    "confidence": 0.6,
                    "how": meta.get("how", "Unknown vulnerability"),
                    "raw_preview": meta.get("raw_preview", "")
                })
    except Exception as e:
        print(f"[db_lookup] Exact match failed: {e}")
    return matches


def _domain_vector_search(identifier: str) -> list[dict]:
    """Perform keyword-based search for contextual advisories and breaches."""
    domain = identifier.split("@")[-1].lower() if "@" in identifier else identifier.lower()
    
    engine = sqlalchemy.create_engine(SUPABASE_DB_URL)
    query = sqlalchemy.text(
        "SELECT text, metadata FROM breach_vectors WHERE text ILIKE :d OR metadata->>'source' ILIKE :d LIMIT 5"
    )
    
    matches = []
    try:
        with engine.connect() as conn:
            results = conn.execute(query, {"d": f"%{domain}%"})
            for row in results:
                text_content, meta = row
                try:
                    if isinstance(meta, str):
                        meta = json.loads(meta)
                    fields = meta.get("exposed_fields") or meta.get("fields") or []
                    if isinstance(fields, str):
                        fields = json.loads(fields)
                except:
                    fields = []
                    
                matches.append({
                    "source": meta.get("source") or meta.get("breach") or "External Context",
                    "breach": meta.get("breach") or meta.get("source") or "External Context",
                    "date": meta.get("year") or meta.get("date") or datetime.utcnow().date().isoformat(),
                    "exposed_fields": fields,
                    "confidence": 0.5,
                    "how": meta.get("how", "Contextual advisory"),
                    "raw_preview": text_content
                })
    except Exception as e:
        print(f"[keyword_search] Failed for {domain}: {e}")
    return matches


def _check_detection_events(hashed_identifier: str) -> list[dict]:
    """
    Check for incoming signals from detection_events (e.g. Telegram monitors).
    Marks consumed=true after detection.
    """
    engine = sqlalchemy.create_engine(SUPABASE_DB_URL)
    select_query = sqlalchemy.text(
        "SELECT id, source_channel, detected_at, event_type FROM detection_events "
        "WHERE hashed_identifier = :h AND consumed = false"
    )
    update_query = sqlalchemy.text(
        "UPDATE detection_events SET consumed = true WHERE id = :id"
    )
    matches = []
    try:
        with engine.connect() as conn:
            results = conn.execute(select_query, {"h": hashed_identifier})
            for row in results:
                id_, channel, dt, ev_type = row
                matches.append({
                    "source": f"Monitor: {channel or 'Unknown'}",
                    "date": dt.isoformat() if dt else datetime.utcnow().date().isoformat(),
                    "exposed_fields": ["potential_leak_signal", str(ev_type or "leak")],
                    "confidence": 0.9,
                    "raw_preview": f"Detected in real-time monitor: {channel}"
                })
                # Mark as consumed
                conn.execute(update_query, {"id": id_})
            conn.commit()
    except Exception as e:
        print(f"[detection_events] Lookup failed: {e}")
    return matches


def _classify_risk(matches: list[dict], risk_score: int) -> str:
    """Classify risk into HIGH, MEDIUM, LOW."""
    if risk_score >= 70:
        return "HIGH"
    
    all_fields = []
    for m in matches:
        all_fields.extend(m.get("exposed_fields", []))
    
    fields_set = set(all_fields)
    if "password" in fields_set or "password_hash" in fields_set or len(matches) > 1:
        return "HIGH"
    if "email" in fields_set and "phone" in fields_set:
        return "MEDIUM"
    return "LOW"


def query_breach_db(hashed_identifier: str, raw_identifier: str = None) -> dict:
    """
    Corrected pipeline: 
    1. Direct Signal (detection_events) -> 0.9
    2. Exact Hash (local DB) -> 0.6
    3. Contextual Search (Domain/Vector) -> 0.4
    """
    all_matches = []

    index = _get_index()
    
    # Use metadata filtering for exact hash match — HUGE performance & accuracy win
    filters = MetadataFilters(filters=[
        MetadataFilter(key="hashed_identifier", value=hashed_identifier)
    ])
    
    retriever = index.as_retriever(
        similarity_top_k=TOP_K,
        filters=filters
    )

    # We still pass query_text, but the search space is now limited to exact hash matches
    query_text = f"Hash: {hashed_identifier}"
    nodes = retriever.retrieve(query_text)

    matches = []
    for node in nodes:
        # No need to check similarity_threshold or node_hash here anymore 
        # as the vector store filter handled it.
        parsed = _parse_node_metadata(node)
        matches.append(parsed)

    # Deduplicate by source — keep highest confidence per source

    seen: dict[str, dict] = {}
    for m in all_matches:
        src = m["source"]
        if src not in seen or m["confidence"] > seen[src]["confidence"]:
            seen[src] = m
    matches = list(seen.values())

    # 4. Scoring
    risk_score = _compute_risk_score(matches)
    
    return {
        "matches": matches,
        "risk_score": risk_score,
        "identifier_queried": hashed_identifier,
        "risk_level": _classify_risk(matches, risk_score)
    }
