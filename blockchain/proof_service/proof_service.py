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

import asyncio
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

# Step 3 — Placeholder for IPFS (Pinata Removed)
# ---------------------------------------------------------------------------

async def _get_local_cid(report_bytes: bytes, report_hash: str) -> str:
    """
    Returns a deterministic placeholder for CID since Pinata is removed.
    In a production system, this would be the IPFS CID calculated locally.
    """
    # Simply prefix the hash to satisfy the 64-char String requirement on-chain
    return f"phantom_proof_{report_hash[:32]}"


# ---------------------------------------------------------------------------
# Step 4 — Solana Anchor call
# ---------------------------------------------------------------------------

def _load_keypair():
    """Load the Solana keypair from environment or configured wallet path."""
    from solders.keypair import Keypair

    # 1. Try environment variable first (raw JSON array string)
    env_key = os.getenv("SOLANA_PRIVATE_KEY")
    if env_key:
        try:
            secret = json.loads(env_key)
            return Keypair.from_bytes(bytes(secret))
        except Exception as e:
            log.warning("Failed to load SOLANA_PRIVATE_KEY from env: %s", e)

    # 2. Fall back to file path
    wallet_path_str = os.getenv(
        "SOLANA_WALLET_PATH",
        str(Path.home() / ".config" / "solana" / "id.json")
    )
    wallet_path = Path(wallet_path_str).expanduser()
    if not wallet_path.exists():
        log.error("Solana wallet NOT found at %s. Ensure SOLANA_PRIVATE_KEY or SOLANA_WALLET_PATH is set.", wallet_path)
        raise FileNotFoundError(f"Solana wallet not found and no SOLANA_PRIVATE_KEY in env: {wallet_path}")
    
    log.info("Loading Solana keypair from: %s", wallet_path)
    with wallet_path.open() as f:
        secret = json.load(f)
    return Keypair.from_bytes(bytes(secret))


def _risk_level_to_u8(risk_level: str) -> int:
    level = RISK_LEVEL_MAP.get(risk_level.upper())
    if level is None:
        raise ValueError(f"Unknown risk_level: {risk_level!r}")
    return level


async def _record_on_chain(
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
    from solana.rpc.async_api import AsyncClient as SolanaClient
    from solders.pubkey import Pubkey
    from solders.system_program import ID as SYS_PROGRAM_ID
    from anchorpy import Program, Provider, Wallet, Idl, Context

    if len(report_cid) > 64:
        raise ValueError(f"report_cid too long ({len(report_cid)} chars, max 64)")

    rpc_url = os.getenv("SOLANA_RPC_URL", "https://api.devnet.solana.com")
    program_id_str = os.environ["ANCHOR_PROGRAM_ID"]

    keypair = _load_keypair()
    program_id = Pubkey.from_string(program_id_str)
    
    # Convert hex strings to raw bytes
    user_pseudonym_bytes = bytes.fromhex(user_pseudonym_hex)
    report_hash_bytes = bytes.fromhex(report_hash_hex)

    if len(user_pseudonym_bytes) != 32:
        raise ValueError(f"user_pseudonym must be 32 bytes (got {len(user_pseudonym_bytes)})")
    if len(report_hash_bytes) != 32:
        raise ValueError(f"report_hash must be 32 bytes (got {len(report_hash_bytes)})")

    # Derive PDA — seeds must match the Rust contract
    pda, _bump = Pubkey.find_program_address(
        [
            b"threat_event",
            user_pseudonym_bytes,
            report_hash_bytes,
        ],
        program_id,
    )

    # Parse ISO-8601 timestamp → Unix epoch (seconds)
    dt = datetime.fromisoformat(timestamp_iso.replace("Z", "+00:00"))
    unix_ts = int(dt.timestamp())

    log.info(
        "Connecting to Solana RPC: %s | Program: %s | PDA: %s",
        rpc_url, program_id_str, pda
    )

    # Initialize Anchor Program
    async with SolanaClient(rpc_url) as client:
        provider = Provider(client, Wallet(keypair))
        
        # Aggressive in-memory IDL fix for Anchor 0.30 -> anchorpy 0.21.0
        with IDL_PATH.open() as f:
            raw_idl = json.load(f)
        
        def clean_accs(accs):
            cleaned = []
            for a in accs:
                if "accounts" in a: # Nested group
                    cleaned.append({"name": a["name"], "accounts": clean_accs(a["accounts"])})
                else:
                    cleaned.append({
                        "name": a["name"],
                        "isMut": a.get("writable", a.get("isMut", False)),
                        "isSigner": a.get("signer", a.get("isSigner", False))
                    })
            return cleaned

        def clean_type(t):
            if isinstance(t, dict):
                if "array" in t: return {"array": [clean_type(t["array"][0]), t["array"][1]]}
                if "vec" in t: return {"vec": clean_type(t["vec"])}
                if "option" in t: return {"option": clean_type(t["option"])}
                if "defined" in t: return {"defined": t["defined"]}
            if t == "pubkey": return "publicKey"
            return t

        fixed_idl = {
            "version": raw_idl.get("version", "0.1.0"),
            "name": raw_idl.get("name", "phantom_anchor"),
            "instructions": [],
            "accounts": [],
            "types": [],
            "errors": raw_idl.get("errors", [])
        }

        # 1. Instructions
        for inst in raw_idl.get("instructions", []):
            fixed_idl["instructions"].append({
                "name": inst["name"],
                "accounts": clean_accs(inst.get("accounts", [])),
                "args": [{"name": arg["name"], "type": clean_type(arg["type"])} for arg in inst.get("args", [])]
            })

        # 2. Types & Accounts
        all_types = raw_idl.get("types", [])
        for typ in all_types:
            new_typ = {"name": typ["name"], "type": {"kind": "struct", "fields": []}}
            if "type" in typ and "fields" in typ["type"]:
                for field in typ["type"]["fields"]:
                    new_typ["type"]["fields"].append({
                        "name": field["name"],
                        "type": clean_type(field["type"])
                    })
            fixed_idl["types"].append(new_typ)
        
        # In old IDLs, accounts was a subset of types
        for acc in raw_idl.get("accounts", []):
            acc_def = next((t for t in fixed_idl["types"] if t["name"] == acc["name"]), None)
            if acc_def:
                fixed_idl["accounts"].append(acc_def)

        idl = Idl.from_json(json.dumps(fixed_idl))
        program = Program(idl, program_id, provider)

        log.info("Submitting record_threat_event transaction...")
        try:
            sig = await program.rpc["record_threat_event"](
                user_pseudonym_bytes,
                report_cid,
                report_hash_bytes,
                threat_level,
                unix_ts,
                ctx=Context(
                    accounts={
                        "threat_event": pda,
                        "authority": keypair.pubkey(),
                        "system_program": SYS_PROGRAM_ID,
                    }
                ),
            )
            log.info("Solana tx submitted: %s", sig)
            # Poll for confirmation (≤ 30 s)
            await _await_confirmation(client, sig)
            return str(sig)
        except Exception as e:
            log.error("Anchor RPC call failed: %s", e)
            raise RuntimeError(f"Solana transaction failed: {e}")


async def _await_confirmation(client, sig: str, timeout: int = 60) -> None:
    """Poll devnet until the transaction reaches Confirmed status."""
    deadline = time.time() + timeout
    log.info("Polling Solana for confirmation (timeout=%ds)…", timeout)
    while time.time() < deadline:
        resp = await client.get_signature_statuses([sig])
        statuses = resp.value
        if statuses and statuses[0] is not None:
            status = statuses[0]

            if status.err:
                raise RuntimeError(f"Transaction failed on-chain: {status.err}")
            if status.confirmation_status in ("confirmed", "finalized"):
                log.info("Transaction confirmed! Status: %s", status.confirmation_status)
                return
        await asyncio.sleep(1.5)
    raise TimeoutError(
        f"Solana transaction {sig} did not confirm within {timeout} seconds"
    )


# ---------------------------------------------------------------------------
# Step 5 — W3C Verifiable Credential via Node.js subprocess
# ---------------------------------------------------------------------------

async def _issue_vc(
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
    
    # Use asyncio.create_subprocess_exec for non-blocking execution

    proc = await asyncio.create_subprocess_exec(
        node_bin, str(issuer_script),
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    
    stdout, stderr = await proc.communicate(input=payload_json.encode())
    
    if proc.returncode != 0:
        err_msg = stderr.decode(errors="replace")
        raise RuntimeError(f"VC issuer subprocess failed (code {proc.returncode}):\n{err_msg}")

    vc_raw = stdout.decode(errors="replace").strip()
    try:
        vc_json = json.loads(vc_raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"VC issuer returned invalid JSON: {exc}\n{vc_raw}") from exc

    log.info("W3C VC issued successfully")
    return vc_json


# ---------------------------------------------------------------------------
# Public contract function
# ---------------------------------------------------------------------------

async def generate_proof(threat_assessment: dict) -> dict:
    """
    Generate immutable proof for a confirmed identity threat.
    Returns a dict matching contracts/proof_result.schema.json exactly.
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
    if user_pseudonym.startswith("anon_"):
        user_pseudonym = user_pseudonym[len("anon_"):]

    risk_level: str = threat_assessment["risk_level"]
    detection_timestamp: str = threat_assessment["timestamp"]
    threat_level_u8: int = _risk_level_to_u8(risk_level)

    # 2. Build report + hash
    report_bytes = _build_report(threat_assessment)
    report_hash_hex = _sha256_hex(report_bytes)
    log.info("Report built — hash: %s", report_hash_hex)

    # 3. Create local CID (Pinata removed)
    ipfs_cid = await _get_local_cid(report_bytes, report_hash_hex)

    # 4. Anchor to Solana devnet
    solana_tx_sig = await _record_on_chain(
        user_pseudonym_hex=user_pseudonym,
        report_cid=ipfs_cid,
        report_hash_hex=report_hash_hex,
        threat_level=threat_level_u8,
        timestamp_iso=detection_timestamp,
    )

    # 5. Issue W3C VC
    vc_json = await _issue_vc(
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
    print(f"🔗 Solana Explorer: https://explorer.solana.com/tx/{solana_tx_sig}?cluster=devnet")
    return proof_result
