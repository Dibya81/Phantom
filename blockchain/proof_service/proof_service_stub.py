"""
PhantomID — Proof Service: Stub / Mock mode
============================================
Used at Hour-8 checkpoint before real integrations are ready.
Returns a valid ProofResult dict populated from the mock file.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path

log = logging.getLogger("proof_service.stub")

_MOCK_PATH = (
    Path(__file__).resolve().parents[2]
    / "contracts" / "mock" / "proof_result.mock.json"
)


def generate_proof_stub(threat_assessment: dict) -> dict:
    """
    Stub implementation — returns mock ProofResult.
    Switch to proof_service.generate_proof() for real runs.
    """
    log.warning(
        "STUB MODE — generate_proof_stub() called. "
        "NOT calling Pinata or Solana. For integration testing only."
    )
    with _MOCK_PATH.open() as f:
        mock = json.load(f)

    # Override generated_at with current time for realism
    mock["generated_at"] = datetime.now(timezone.utc).isoformat()
    return mock
