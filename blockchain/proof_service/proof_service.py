"""
PhantomID — Blockchain / Proof Service
=======================================
Exposes: generate_proof(threat_assessment: dict) -> dict

Pipeline per call
-----------------
1. Validate input against ThreatAssessment schema
2. Build a deterministic JSON report from the assessment
3. SHA-256 hash the report bytes
4. Upload the report JSON to IPFS via Pinata
5. Call the Solana Anchor contract (record_threat_event)
6. Poll Solana devnet for transaction confirmation (≤ 30 s)
7. Generate a W3C Verifiable Credential via the Node.js vc_issuer subprocess
8. Validate the return dict against ProofResult schema
9. Return the complete ProofResult — or raise on any failure

CONTRACT RULES (enforced here):
- NEVER return partial data — all-or-nothing
- NEVER store or log raw PII
- ALWAYS use devnet, NEVER mainnet
- report_hash = SHA-256 of uploaded JSON bytes (not ThreatAssessment)
- solana_tx_sig confirmed before returning
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

import jsonschema
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("proof_service")

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
REPO_ROOT = Path(__file__).resolve().parents[2]
CONTRACTS_DIR = REPO_ROOT / "contracts"
VC_ISSUER_DIR = REPO_ROOT / "blockchain" / "vc_issuer"
IDL_PATH = REPO_ROOT / "blockchain" / "anchor_contract" / "target" / "idl" / "phantom_anchor.json"

THREAT_SCHEMA_PATH = CONTRACTS_DIR / "threat_assessment.schema.json"
PROOF_SCHEMA_PATH = CONTRACTS_DIR / "proof_result.schema.json"

# ---------------------------------------------------------------------------
# Threat-level mapping
# ---------------------------------------------------------------------------
RISK_LEVEL_MAP: dict[str, int] = {
    "LOW": 0,
    "MEDIUM": 1,
    "HIGH": 2,
    "CRITICAL": 3,
}

# ---------------------------------------------------------------------------
# Lazy-loaded schemas (no env vars required for schema loading)
# ---------------------------------------------------------------------------
_THREAT_SCHEMA: dict | None = None
_PROOF_SCHEMA: dict | None = None


def _load_schema(path: Path) -> dict:
    with path.open() as f:
        return json.load(f)


def _get_threat_schema() -> dict:
    global _THREAT_SCHEMA
    if _THREAT_SCHEMA is None:
        _THREAT_SCHEMA = _load_schema(THREAT_SCHEMA_PATH)
    return _THREAT_SCHEMA


def _get_proof_schema() -> dict:
    global _PROOF_SCHEMA
    if _PROOF_SCHEMA is None:
        _PROOF_SCHEMA = _load_schema(PROOF_SCHEMA_PATH)
    return _PROOF_SCHEMA


# ---------------------------------------------------------------------------
# Schema validation helpers
# ---------------------------------------------------------------------------

def _validate_threat_assessment(ta: dict) -> None:
    """Raise jsonschema.ValidationError if ta does not conform to the schema."""
    jsonschema.validate(instance=ta, schema=_get_threat_schema())


def _validate_proof_result(pr: dict) -> None:
    """Raise jsonschema.ValidationError if pr does not conform to the schema."""
    jsonschema.validate(instance=pr, schema=_get_proof_schema())


# ---------------------------------------------------------------------------
# Step 1 — Build report JSON
# ---------------------------------------------------------------------------

def _build_report(threat_assessment: dict) -> bytes:
    """
    Construct the canonical JSON report from the ThreatAssessment.
    sort_keys=True ensures deterministic structure (generated_at will vary).
    """
    report = {
        "phantomid_report": True,
        "schema_version": "1.0.0",
        "threat_assessment": threat_assessment,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    return json.dumps(report, sort_keys=True, separators=(",", ":")).encode("utf-8")


# ---------------------------------------------------------------------------
# Step 2 — Hash report
# ---------------------------------------------------------------------------

def _sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _sha256_bytes(data: bytes) -> bytes:
    return hashlib.sha256(data).digest()


# ---------------------------------------------------------------------------
# Step 3 — Upload to IPFS via Pinata
# ---------------------------------------------------------------------------

def _upload_to_pinata(report_bytes: bytes, report_hash: str) -> str:
    """
    Upload report_bytes to Pinata and return the IPFS CID.
    Raises RuntimeError on failure — never returns partial data.
    """
    import httpx

    pinata_jwt = os.environ["PINATA_JWT"]
    url = "https://api.pinata.cloud/pinning/pinJSONToIPFS"
    headers = {
        "Authorization": f"Bearer {pinata_jwt}",
        "Content-Type": "application/json",
    }
    body = {
        "pinataContent": json.loads(report_bytes.decode("utf-8")),
        "pinataMetadata": {
            "name": f"phantomid_report_{report_hash[:16]}",
            "keyvalues": {
                "report_hash": report_hash,
                "system": "phantomid",
            },
        },
        "pinataOptions": {"cidVersion": 1},
    }
    log.info("Uploading report to Pinata (hash prefix: %s)…", report_hash[:16])
    response = httpx.post(url, headers=headers, json=body, timeout=30)
    if response.status_code != 200:
        raise RuntimeError(
            f"Pinata upload failed: HTTP {response.status_code} — {response.text}"
        )
    cid = response.json().get("IpfsHash")
    if not cid:
        raise RuntimeError("Pinata returned success but IpfsHash is missing")
    log.info("Pinata upload successful — CID: %s", cid)
    return cid


# ---------------------------------------------------------------------------
# Step 4 — Solana Anchor call
# ---------------------------------------------------------------------------

def _load_keypair():
    """Load the Solana keypair from the configured wallet path."""
    from solders.keypair import Keypair

    wallet_path_str = os.getenv(
        "SOLANA_WALLET_PATH",
        str(Path.home() / ".config" / "solana" / "id.json")
    )
    wallet_path = Path(wallet_path_str).expanduser()
    if not wallet_path.exists():
        raise FileNotFoundError(f"Solana wallet not found: {wallet_path}")
    with wallet_path.open() as f:
        secret = json.load(f)
    return Keypair.from_bytes(bytes(secret))


def _risk_level_to_u8(risk_level: str) -> int:
    level = RISK_LEVEL_MAP.get(risk_level.upper())
    if level is None:
        raise ValueError(f"Unknown risk_level: {risk_level!r}")
    return level


def _record_on_chain(
    user_pseudonym_hex: str,
    report_cid: str,
    report_hash_hex: str,
    threat_level: int,
    timestamp_iso: str,
) -> str:
    """
    Call record_threat_event on the Anchor contract and wait for confirmation.
    Returns the confirmed transaction signature string.
    """
    from solana.rpc.api import Client as SolanaClient
    from solders.pubkey import Pubkey
    from solders.system_program import ID as SYS_PROGRAM_ID
    from anchorpy import Program, Provider, Wallet
    from anchorpy.idl import _Idl  # type: ignore
    import asyncio

    if len(report_cid) > 64:
        raise ValueError(f"report_cid too long ({len(report_cid)} chars, max 64)")

    rpc_url = os.getenv("SOLANA_RPC_URL", "https://api.devnet.solana.com")
    program_id_str = os.environ["ANCHOR_PROGRAM_ID"]

    keypair = _load_keypair()
    client = SolanaClient(rpc_url)
    wallet = Wallet(keypair)
    provider = Provider(client, wallet)

    # Load IDL
    if not IDL_PATH.exists():
        raise FileNotFoundError(
            f"Anchor IDL not found at {IDL_PATH}. Run 'anchor build' first."
        )
    with IDL_PATH.open() as f:
        idl_raw = json.load(f)
    idl = _Idl.from_json(idl_raw)
    program_id = Pubkey.from_string(program_id_str)
    program = Program(idl, program_id, provider)

    # Convert hex strings to raw bytes (as lists for anchorpy)
    user_pseudonym_bytes = list(bytes.fromhex(user_pseudonym_hex))
    report_hash_bytes = list(bytes.fromhex(report_hash_hex))

    # Derive PDA — seeds must match the Rust contract
    pda, _bump = Pubkey.find_program_address(
        [
            b"threat_event",
            bytes.fromhex(user_pseudonym_hex),
            bytes.fromhex(report_hash_hex),
        ],
        program_id,
    )

    # Parse ISO-8601 timestamp → Unix epoch (seconds)
    dt = datetime.fromisoformat(timestamp_iso.replace("Z", "+00:00"))
    unix_ts = int(dt.timestamp())

    log.info(
        "Sending Solana tx — program=%s pda=%s threat_level=%d",
        program_id_str, pda, threat_level
    )

    async def _send() -> str:
        tx = await program.rpc["record_threat_event"](
            user_pseudonym_bytes,
            report_cid,
            report_hash_bytes,
            threat_level,
            unix_ts,
            ctx=program.provider.send(
                accounts={
                    "threat_event": pda,
                    "authority": keypair.pubkey(),
                    "system_program": SYS_PROGRAM_ID,
                }
            ),
        )
        return str(tx)

    sig = asyncio.run(_send())
    log.info("Solana tx submitted: %s", sig)

    # Poll for confirmation (≤ 30 s)
    _await_confirmation(client, sig)
    return sig


def _await_confirmation(client, sig: str, timeout: int = 30) -> None:
    """Poll devnet until the transaction reaches Confirmed status."""
    deadline = time.time() + timeout
    log.info("Polling Solana for confirmation (timeout=%ds)…", timeout)
    while time.time() < deadline:
        resp = client.get_signature_statuses([sig])
        statuses = resp.value
        if statuses and statuses[0] is not None:
            status = statuses[0]
            if status.err:
                raise RuntimeError(f"Solana transaction failed on-chain: {status.err}")
            if status.confirmation_status in ("confirmed", "finalized"):
                log.info("Solana tx confirmed: %s", sig)
                return
        time.sleep(1.5)
    raise TimeoutError(
        f"Solana transaction {sig} did not confirm within {timeout} seconds"
    )


# ---------------------------------------------------------------------------
# Step 5 — W3C Verifiable Credential via Node.js subprocess
# ---------------------------------------------------------------------------

def _issue_vc(
    user_pseudonym: str,
    ipfs_cid: str,
    solana_tx_sig: str,
    risk_level: str,
    detection_timestamp: str,
) -> dict:
    """
    Invoke the Node.js vc_issuer script and return the parsed VC JSON.
    Raises RuntimeError on failure.
    """
    issuer_script = VC_ISSUER_DIR / "issue_vc.js"
    if not issuer_script.exists():
        raise FileNotFoundError(f"VC issuer script not found: {issuer_script}")

    payload = {
        "user_pseudonym": user_pseudonym,
        "ipfs_cid": ipfs_cid,
        "solana_tx_sig": solana_tx_sig,
        "risk_level": risk_level,
        "detection_timestamp": detection_timestamp,
    }
    payload_json = json.dumps(payload)

    node_bin = os.getenv("NODE_BIN", "node")
    log.info("Invoking vc_issuer subprocess…")
    result = subprocess.run(
        [node_bin, str(issuer_script)],
        input=payload_json.encode(),
        capture_output=True,
        timeout=30,
    )
    if result.returncode != 0:
        stderr = result.stderr.decode(errors="replace")
        raise RuntimeError(f"VC issuer subprocess failed:\n{stderr}")

    vc_raw = result.stdout.decode(errors="replace").strip()
    try:
        vc_json = json.loads(vc_raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"VC issuer returned invalid JSON: {exc}\n{vc_raw}") from exc

    log.info("W3C VC issued successfully")
    return vc_json


# ---------------------------------------------------------------------------
# Public contract function
# ---------------------------------------------------------------------------

def generate_proof(threat_assessment: dict) -> dict:
    """
    Generate immutable proof for a confirmed identity threat.

    Args:
        threat_assessment: A dict matching contracts/threat_assessment.schema.json.
                           Caller is responsible for passing a valid structure,
                           but this function performs its own validation.

    Returns:
        A dict matching contracts/proof_result.schema.json exactly.
        Fields: ipfs_cid, solana_tx_sig, vc_json, report_hash, generated_at

    Raises:
        jsonschema.ValidationError  — if input schema is violated
        RuntimeError / TimeoutError — if any pipeline step fails
        Exception is always raised on failure — never partial data returned.
    """
    pseudonym_preview = str(threat_assessment.get("user_pseudonym", "?"))[:16] + "…"
    log.info(
        "generate_proof() called for user_pseudonym=%s risk_level=%s",
        pseudonym_preview,
        threat_assessment.get("risk_level", "?"),
    )

    # 1. Validate input
    _validate_threat_assessment(threat_assessment)

    user_pseudonym: str = threat_assessment["user_pseudonym"]
    risk_level: str = threat_assessment["risk_level"]
    detection_timestamp: str = threat_assessment["timestamp"]
    threat_level_u8: int = _risk_level_to_u8(risk_level)

    # 2. Build report + hash
    report_bytes = _build_report(threat_assessment)
    report_hash_hex = _sha256_hex(report_bytes)
    log.info("Report built — hash: %s", report_hash_hex)

    # 3. Upload to IPFS
    ipfs_cid = _upload_to_pinata(report_bytes, report_hash_hex)

    # 4. Anchor to Solana devnet
    solana_tx_sig = _record_on_chain(
        user_pseudonym_hex=user_pseudonym,
        report_cid=ipfs_cid,
        report_hash_hex=report_hash_hex,
        threat_level=threat_level_u8,
        timestamp_iso=detection_timestamp,
    )

    # 5. Issue W3C VC
    vc_json = _issue_vc(
        user_pseudonym=user_pseudonym,
        ipfs_cid=ipfs_cid,
        solana_tx_sig=solana_tx_sig,
        risk_level=risk_level,
        detection_timestamp=detection_timestamp,
    )

    # 6. Build ProofResult
    generated_at = datetime.now(timezone.utc).isoformat()
    proof_result = {
        "ipfs_cid": ipfs_cid,
        "solana_tx_sig": solana_tx_sig,
        "vc_json": vc_json,
        "report_hash": report_hash_hex,
        "generated_at": generated_at,
    }

    # 7. Validate output (final guard before returning)
    _validate_proof_result(proof_result)

    log.info(
        "generate_proof() complete — cid=%s tx=%s",
        ipfs_cid,
        solana_tx_sig[:20] + "…",
    )
    return proof_result
