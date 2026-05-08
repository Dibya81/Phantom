"""
PhantomID — Credential Vault API
=================================
Exposes: GET /credentials?user_pseudonym=<sha256_hex>

Persists ProofResult objects in a local SQLite database (dev) or Supabase (prod).
Person 3 calls this endpoint from their GET /credentials FastAPI route.

Contract:
  Input  : user_pseudonym (SHA-256 hex, 64 chars)
  Output : list of ProofResult objects (contracts/proof_result.schema.json)
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import sqlite3
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import jsonschema
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

load_dotenv()
log = logging.getLogger("credential_vault")
logging.basicConfig(level=logging.INFO)

# ---------------------------------------------------------------------------
# Paths & Schema
# ---------------------------------------------------------------------------
REPO_ROOT = Path(__file__).resolve().parents[2]
PROOF_SCHEMA_PATH = REPO_ROOT / "contracts" / "proof_result.schema.json"
DB_PATH = Path(os.getenv("CREDENTIAL_VAULT_DB", str(Path(__file__).parent / "vault.db")))

with PROOF_SCHEMA_PATH.open() as f:
    PROOF_SCHEMA = json.load(f)


# ---------------------------------------------------------------------------
# SQLite helpers (dev/hackathon storage)
# ---------------------------------------------------------------------------

def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def _init_db() -> None:
    """Create the vault table if it doesn't exist."""
    with _get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS credential_vault (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                user_pseudonym  TEXT    NOT NULL,
                ipfs_cid        TEXT    NOT NULL UNIQUE,
                solana_tx_sig   TEXT    NOT NULL,
                vc_json         TEXT    NOT NULL,
                report_hash     TEXT    NOT NULL,
                generated_at    TEXT    NOT NULL,
                inserted_at     TEXT    NOT NULL DEFAULT (datetime('now'))
            )
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_user_pseudonym ON credential_vault(user_pseudonym)"
        )
        conn.commit()
    log.info("Credential vault DB initialised at %s", DB_PATH)


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

@asynccontextmanager
async def _lifespan(app: FastAPI):
    _init_db()
    yield


app = FastAPI(
    title="PhantomID Credential Vault",
    description="Stores and retrieves W3C Verifiable Credentials for PhantomID.",
    version="1.0.0",
    lifespan=_lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class StoreCredentialRequest(BaseModel):
    """Internal: called by proof_service after generate_proof() succeeds."""
    user_pseudonym: str = Field(..., min_length=64, max_length=64, pattern="^[a-f0-9]{64}$")
    ipfs_cid: str
    solana_tx_sig: str
    vc_json: dict[str, Any]
    report_hash: str = Field(..., min_length=64, max_length=64, pattern="^[a-f0-9]{64}$")
    generated_at: str


class ProofResultResponse(BaseModel):
    ipfs_cid: str
    solana_tx_sig: str
    vc_json: dict[str, Any]
    report_hash: str
    generated_at: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/credentials", response_model=list[ProofResultResponse])
async def get_credentials(
    user_pseudonym: str = Query(
        ...,
        min_length=64,
        max_length=64,
        description="SHA-256 hex of the user identifier (64 chars).",
    )
) -> list[ProofResultResponse]:
    """
    Return all stored ProofResult objects for the given user_pseudonym.
    This is consumed by Person 3's frontend to render the VC vault.

    The user_pseudonym must be a 64-char lowercase hex SHA-256 hash.
    Raw user IDs are NEVER accepted.
    """
    if len(user_pseudonym) != 64 or not all(c in "0123456789abcdef" for c in user_pseudonym):
        raise HTTPException(status_code=400, detail="user_pseudonym must be a 64-char lowercase hex SHA-256")

    rows = _fetch_credentials(user_pseudonym)
    return [
        ProofResultResponse(
            ipfs_cid=r["ipfs_cid"],
            solana_tx_sig=r["solana_tx_sig"],
            vc_json=json.loads(r["vc_json"]),
            report_hash=r["report_hash"],
            generated_at=r["generated_at"],
        )
        for r in rows
    ]


@app.post("/credentials/store", status_code=201)
async def store_credential(req: StoreCredentialRequest) -> dict:
    """
    Store a ProofResult in the vault.
    Called internally by proof_service after generate_proof() completes.
    Not exposed to the public frontend.
    """
    # Validate against the frozen schema before persisting
    proof_result = {
        "ipfs_cid": req.ipfs_cid,
        "solana_tx_sig": req.solana_tx_sig,
        "vc_json": req.vc_json,
        "report_hash": req.report_hash,
        "generated_at": req.generated_at,
    }
    try:
        jsonschema.validate(instance=proof_result, schema=PROOF_SCHEMA)
    except jsonschema.ValidationError as exc:
        raise HTTPException(status_code=422, detail=f"Schema validation failed: {exc.message}")

    _insert_credential(req.user_pseudonym, proof_result)
    log.info(
        "Credential stored for user_pseudonym=%s… cid=%s",
        req.user_pseudonym[:16], req.ipfs_cid
    )
    return {"status": "stored", "ipfs_cid": req.ipfs_cid}


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "credential_vault", "timestamp": datetime.now(timezone.utc).isoformat()}


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

def _fetch_credentials(user_pseudonym: str) -> list[sqlite3.Row]:
    with _get_conn() as conn:
        cursor = conn.execute(
            """
            SELECT ipfs_cid, solana_tx_sig, vc_json, report_hash, generated_at
            FROM credential_vault
            WHERE user_pseudonym = ?
            ORDER BY inserted_at DESC
            """,
            (user_pseudonym,),
        )
        return cursor.fetchall()


def _insert_credential(user_pseudonym: str, proof_result: dict) -> None:
    with _get_conn() as conn:
        try:
            conn.execute(
                """
                INSERT INTO credential_vault
                    (user_pseudonym, ipfs_cid, solana_tx_sig, vc_json, report_hash, generated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    user_pseudonym,
                    proof_result["ipfs_cid"],
                    proof_result["solana_tx_sig"],
                    json.dumps(proof_result["vc_json"]),
                    proof_result["report_hash"],
                    proof_result["generated_at"],
                ),
            )
            conn.commit()
        except sqlite3.IntegrityError:
            log.warning(
                "Credential with ipfs_cid=%s already exists — skipping duplicate insert",
                proof_result["ipfs_cid"],
            )


# ---------------------------------------------------------------------------
# Programmatic helper (called from proof_service directly in process)
# ---------------------------------------------------------------------------

def store_proof_result(user_pseudonym: str, proof_result: dict) -> None:
    """
    Persist a ProofResult without going through HTTP.
    Call this from proof_service.py after generate_proof() succeeds.
    Auto-initialises DB if called outside of FastAPI lifespan.
    """
    _init_db()
    _insert_credential(user_pseudonym, proof_result)


def get_proof_results(user_pseudonym: str) -> list[dict]:
    """Return all ProofResults for a user_pseudonym as plain dicts."""
    rows = _fetch_credentials(user_pseudonym)
    return [
        {
            "ipfs_cid": r["ipfs_cid"],
            "solana_tx_sig": r["solana_tx_sig"],
            "vc_json": json.loads(r["vc_json"]),
            "report_hash": r["report_hash"],
            "generated_at": r["generated_at"],
        }
        for r in rows
    ]


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "credential_vault:app",
        host="0.0.0.0",
        port=int(os.getenv("VAULT_PORT", "8001")),
        reload=False,
    )
