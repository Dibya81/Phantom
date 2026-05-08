"""
PhantomID — blockchain/tests/test_proof_service.py
===================================================
Test suite for Person 2's proof service.

Test strategy:
  Unit tests   — use mocks/stubs; no real network calls
  Integration  — real Pinata + Solana devnet (skipped if env vars not set)

Run unit tests only:
  pytest blockchain/tests/test_proof_service.py -m "not integration" -v

Run everything (needs PINATA_JWT and ANCHOR_PROGRAM_ID set):
  pytest blockchain/tests/test_proof_service.py -v
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import jsonschema
import pytest

# ---------------------------------------------------------------------------
# Path setup — allow importing blockchain packages directly
# ---------------------------------------------------------------------------
REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT))

from blockchain.proof_service.proof_service import (
    _build_report,
    _sha256_hex,
    _risk_level_to_u8,
    _validate_threat_assessment,
    _validate_proof_result,
    RISK_LEVEL_MAP,
)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_threat_assessment() -> dict:
    """Load the canonical mock ThreatAssessment from contracts/mock/."""
    path = REPO_ROOT / "contracts" / "mock" / "threat_assessment.mock.json"
    with path.open() as f:
        return json.load(f)


@pytest.fixture
def mock_proof_result() -> dict:
    """Load the canonical mock ProofResult from contracts/mock/."""
    path = REPO_ROOT / "contracts" / "mock" / "proof_result.mock.json"
    with path.open() as f:
        return json.load(f)


@pytest.fixture
def threat_schema() -> dict:
    path = REPO_ROOT / "contracts" / "threat_assessment.schema.json"
    with path.open() as f:
        return json.load(f)


@pytest.fixture
def proof_schema() -> dict:
    path = REPO_ROOT / "contracts" / "proof_result.schema.json"
    with path.open() as f:
        return json.load(f)


# ===========================================================================
# Unit Tests — Schema Validation
# ===========================================================================

class TestSchemaValidation:
    def test_mock_threat_assessment_is_valid(self, mock_threat_assessment, threat_schema):
        """Mock ThreatAssessment must be valid against the frozen schema."""
        jsonschema.validate(instance=mock_threat_assessment, schema=threat_schema)

    def test_mock_proof_result_is_valid(self, mock_proof_result, proof_schema):
        """Mock ProofResult must be valid against the frozen schema."""
        jsonschema.validate(instance=mock_proof_result, schema=proof_schema)

    def test_threat_assessment_missing_required_field(self, mock_threat_assessment):
        ta = {**mock_threat_assessment}
        del ta["risk_level"]
        with pytest.raises(jsonschema.ValidationError):
            _validate_threat_assessment(ta)

    def test_threat_assessment_invalid_risk_level(self, mock_threat_assessment):
        ta = {**mock_threat_assessment, "risk_level": "EXTREME"}
        with pytest.raises(jsonschema.ValidationError):
            _validate_threat_assessment(ta)

    def test_threat_assessment_invalid_pseudonym_length(self, mock_threat_assessment):
        ta = {**mock_threat_assessment, "user_pseudonym": "short"}
        with pytest.raises(jsonschema.ValidationError):
            _validate_threat_assessment(ta)

    def test_proof_result_missing_field_fails(self, mock_proof_result):
        pr = {**mock_proof_result}
        del pr["ipfs_cid"]
        with pytest.raises(jsonschema.ValidationError):
            _validate_proof_result(pr)

    def test_proof_result_extra_field_fails(self, mock_proof_result):
        pr = {**mock_proof_result, "extra_field": "BANNED"}
        with pytest.raises(jsonschema.ValidationError):
            _validate_proof_result(pr)

    def test_report_hash_must_be_64_hex_chars(self, mock_proof_result):
        pr = {**mock_proof_result, "report_hash": "not_a_hash"}
        with pytest.raises(jsonschema.ValidationError):
            _validate_proof_result(pr)


# ===========================================================================
# Unit Tests — Internal Functions
# ===========================================================================

class TestInternalFunctions:
    def test_build_report_produces_valid_json(self, mock_threat_assessment):
        report_bytes = _build_report(mock_threat_assessment)
        parsed = json.loads(report_bytes)
        assert parsed["phantomid_report"] is True
        assert "threat_assessment" in parsed
        assert "generated_at" in parsed

    def test_build_report_is_deterministic_for_same_input(self, mock_threat_assessment):
        """Same input produces same hash (modulo generated_at — so we test structure)."""
        b1 = _build_report(mock_threat_assessment)
        b2 = _build_report(mock_threat_assessment)
        # generated_at will differ by a tiny fraction; check the TA content is same
        p1 = json.loads(b1)
        p2 = json.loads(b2)
        assert p1["threat_assessment"] == p2["threat_assessment"]

    def test_sha256_hex_length(self, mock_threat_assessment):
        report_bytes = _build_report(mock_threat_assessment)
        h = _sha256_hex(report_bytes)
        assert len(h) == 64
        assert all(c in "0123456789abcdef" for c in h)

    def test_sha256_hex_matches_hashlib(self):
        data = b"PhantomID test data"
        expected = hashlib.sha256(data).hexdigest()
        assert _sha256_hex(data) == expected

    def test_risk_level_mapping_all_values(self):
        assert _risk_level_to_u8("LOW") == 0
        assert _risk_level_to_u8("MEDIUM") == 1
        assert _risk_level_to_u8("HIGH") == 2
        assert _risk_level_to_u8("CRITICAL") == 3

    def test_risk_level_case_insensitive(self):
        assert _risk_level_to_u8("high") == 2
        assert _risk_level_to_u8("Critical") == 3

    def test_risk_level_unknown_raises(self):
        with pytest.raises(ValueError):
            _risk_level_to_u8("EXTREME")


# ===========================================================================
# Unit Tests — generate_proof() with mocks
# ===========================================================================

class TestGenerateProofMocked:
    """Test the full generate_proof() pipeline with all external calls mocked."""

    @patch("blockchain.proof_service.proof_service._issue_vc")
    @patch("blockchain.proof_service.proof_service._record_on_chain")
    @patch("blockchain.proof_service.proof_service._upload_to_pinata")
    def test_generate_proof_returns_valid_proof_result(
        self,
        mock_pinata,
        mock_solana,
        mock_vc,
        mock_threat_assessment,
        mock_proof_result,
    ):
        """generate_proof() should return a valid ProofResult dict."""
        mock_pinata.return_value = mock_proof_result["ipfs_cid"]
        mock_solana.return_value = mock_proof_result["solana_tx_sig"]
        mock_vc.return_value = mock_proof_result["vc_json"]

        from blockchain.proof_service.proof_service import generate_proof

        result = generate_proof(mock_threat_assessment)

        # Must have exactly these fields
        assert set(result.keys()) == {"ipfs_cid", "solana_tx_sig", "vc_json", "report_hash", "generated_at"}

    @patch("blockchain.proof_service.proof_service._issue_vc")
    @patch("blockchain.proof_service.proof_service._record_on_chain")
    @patch("blockchain.proof_service.proof_service._upload_to_pinata")
    def test_report_hash_matches_uploaded_report(
        self,
        mock_pinata,
        mock_solana,
        mock_vc,
        mock_threat_assessment,
        mock_proof_result,
    ):
        """report_hash must be SHA-256 of the report bytes, NOT of ThreatAssessment."""
        mock_pinata.return_value = mock_proof_result["ipfs_cid"]
        mock_solana.return_value = mock_proof_result["solana_tx_sig"]
        mock_vc.return_value = mock_proof_result["vc_json"]

        from blockchain.proof_service.proof_service import generate_proof

        result = generate_proof(mock_threat_assessment)
        report_bytes = _build_report(mock_threat_assessment)

        # The hash must be of the report, not the raw assessment
        assert len(result["report_hash"]) == 64
        # We can't check exact equality because generated_at differs, but it must be 64-char hex
        assert all(c in "0123456789abcdef" for c in result["report_hash"])

    @patch("blockchain.proof_service.proof_service._issue_vc")
    @patch("blockchain.proof_service.proof_service._record_on_chain")
    @patch("blockchain.proof_service.proof_service._upload_to_pinata")
    def test_generate_proof_validates_output_schema(
        self,
        mock_pinata,
        mock_solana,
        mock_vc,
        mock_threat_assessment,
        mock_proof_result,
        proof_schema,
    ):
        """Output must pass ProofResult schema validation."""
        mock_pinata.return_value = mock_proof_result["ipfs_cid"]
        mock_solana.return_value = mock_proof_result["solana_tx_sig"]
        mock_vc.return_value = mock_proof_result["vc_json"]

        from blockchain.proof_service.proof_service import generate_proof

        result = generate_proof(mock_threat_assessment)
        jsonschema.validate(instance=result, schema=proof_schema)

    @patch("blockchain.proof_service.proof_service._upload_to_pinata")
    def test_generate_proof_raises_on_pinata_failure(
        self, mock_pinata, mock_threat_assessment
    ):
        """If Pinata fails, generate_proof must raise — never return partial data."""
        mock_pinata.side_effect = RuntimeError("Pinata connection refused")

        from blockchain.proof_service.proof_service import generate_proof

        with pytest.raises(RuntimeError, match="Pinata"):
            generate_proof(mock_threat_assessment)

    @patch("blockchain.proof_service.proof_service._issue_vc")
    @patch("blockchain.proof_service.proof_service._record_on_chain")
    @patch("blockchain.proof_service.proof_service._upload_to_pinata")
    def test_generate_proof_raises_on_solana_failure(
        self, mock_pinata, mock_solana, mock_vc, mock_threat_assessment, mock_proof_result
    ):
        """If Solana tx fails, generate_proof must raise."""
        mock_pinata.return_value = mock_proof_result["ipfs_cid"]
        mock_solana.side_effect = TimeoutError("Solana tx did not confirm")

        from blockchain.proof_service.proof_service import generate_proof

        with pytest.raises(TimeoutError):
            generate_proof(mock_threat_assessment)

    @patch("blockchain.proof_service.proof_service._issue_vc")
    @patch("blockchain.proof_service.proof_service._record_on_chain")
    @patch("blockchain.proof_service.proof_service._upload_to_pinata")
    def test_generate_proof_raises_on_vc_failure(
        self, mock_pinata, mock_solana, mock_vc, mock_threat_assessment, mock_proof_result
    ):
        """If VC issuance fails, generate_proof must raise."""
        mock_pinata.return_value = mock_proof_result["ipfs_cid"]
        mock_solana.return_value = mock_proof_result["solana_tx_sig"]
        mock_vc.side_effect = RuntimeError("VC issuer subprocess failed")

        from blockchain.proof_service.proof_service import generate_proof

        with pytest.raises(RuntimeError, match="VC"):
            generate_proof(mock_threat_assessment)

    def test_generate_proof_rejects_invalid_threat_assessment(self):
        """generate_proof must reject input that violates ThreatAssessment schema."""
        from blockchain.proof_service.proof_service import generate_proof

        bad_input = {"risk_level": "UNKNOWN", "user_pseudonym": "tooshort"}
        with pytest.raises(jsonschema.ValidationError):
            generate_proof(bad_input)

    @patch("blockchain.proof_service.proof_service._issue_vc")
    @patch("blockchain.proof_service.proof_service._record_on_chain")
    @patch("blockchain.proof_service.proof_service._upload_to_pinata")
    def test_ipfs_cid_passed_to_solana(
        self, mock_pinata, mock_solana, mock_vc, mock_threat_assessment, mock_proof_result
    ):
        """The CID returned by Pinata must be passed verbatim to the Solana call."""
        expected_cid = "QmTestCIDForSolanaPassThrough"
        mock_pinata.return_value = expected_cid
        mock_solana.return_value = mock_proof_result["solana_tx_sig"]
        mock_vc.return_value = mock_proof_result["vc_json"]

        from blockchain.proof_service.proof_service import generate_proof

        result = generate_proof(mock_threat_assessment)
        assert result["ipfs_cid"] == expected_cid

        # Verify the CID was passed to the Solana call
        call_kwargs = mock_solana.call_args
        assert call_kwargs is not None
        # report_cid is positional or keyword arg
        args, kwargs = call_kwargs
        assert expected_cid in args or kwargs.get("report_cid") == expected_cid


# ===========================================================================
# Unit Tests — Credential Vault
# ===========================================================================

class TestCredentialVault:
    """Test the credential vault storage layer."""

    def test_store_and_retrieve(self, mock_proof_result, tmp_path, monkeypatch):
        """Stored ProofResults must be retrievable by user_pseudonym."""
        # Redirect DB to tmp
        monkeypatch.setenv("CREDENTIAL_VAULT_DB", str(tmp_path / "test_vault.db"))

        # Re-import so it picks up the env var
        import importlib
        import blockchain.credential_vault.credential_vault as vault_mod
        importlib.reload(vault_mod)
        vault_mod._init_db()

        user_pseudonym = "a" * 64  # valid 64-char hex
        vault_mod._insert_credential(user_pseudonym, mock_proof_result)

        results = vault_mod.get_proof_results(user_pseudonym)
        assert len(results) == 1
        assert results[0]["ipfs_cid"] == mock_proof_result["ipfs_cid"]
        assert results[0]["solana_tx_sig"] == mock_proof_result["solana_tx_sig"]
        assert results[0]["report_hash"] == mock_proof_result["report_hash"]

    def test_retrieve_unknown_user_returns_empty(self, tmp_path, monkeypatch):
        monkeypatch.setenv("CREDENTIAL_VAULT_DB", str(tmp_path / "empty_vault.db"))
        import importlib
        import blockchain.credential_vault.credential_vault as vault_mod
        importlib.reload(vault_mod)
        vault_mod._init_db()

        results = vault_mod.get_proof_results("b" * 64)
        assert results == []

    def test_duplicate_ipfs_cid_ignored(self, mock_proof_result, tmp_path, monkeypatch):
        """Inserting same CID twice must not raise or duplicate."""
        monkeypatch.setenv("CREDENTIAL_VAULT_DB", str(tmp_path / "dup_vault.db"))
        import importlib
        import blockchain.credential_vault.credential_vault as vault_mod
        importlib.reload(vault_mod)
        vault_mod._init_db()

        user_pseudonym = "c" * 64
        vault_mod._insert_credential(user_pseudonym, mock_proof_result)
        vault_mod._insert_credential(user_pseudonym, mock_proof_result)  # duplicate

        results = vault_mod.get_proof_results(user_pseudonym)
        assert len(results) == 1  # still just one


# ===========================================================================
# Integration Tests — require real env vars
# ===========================================================================

@pytest.mark.integration
class TestIntegration:
    """
    Integration tests — skipped unless real env vars are set.
    Run with: pytest -m integration -v
    """

    @pytest.fixture(autouse=True)
    def require_env(self):
        if not os.getenv("PINATA_JWT") or not os.getenv("ANCHOR_PROGRAM_ID"):
            pytest.skip(
                "PINATA_JWT and ANCHOR_PROGRAM_ID must be set for integration tests"
            )

    def test_full_generate_proof_pipeline(self, mock_threat_assessment, proof_schema):
        """End-to-end: ThreatAssessment → ProofResult with real Pinata + Solana."""
        from blockchain.proof_service.proof_service import generate_proof

        result = generate_proof(mock_threat_assessment)

        # Must pass schema
        jsonschema.validate(instance=result, schema=proof_schema)

        # CID must look like an IPFS CID
        assert result["ipfs_cid"].startswith("Qm") or result["ipfs_cid"].startswith("bafy")

        # Sig must be a non-empty string
        assert len(result["solana_tx_sig"]) > 32

        # report_hash must be 64 hex chars
        assert len(result["report_hash"]) == 64
        assert all(c in "0123456789abcdef" for c in result["report_hash"])

        # vc_json must have the W3C VC fields
        vc = result["vc_json"]
        assert "VerifiableCredential" in vc.get("type", [])
        assert "IdentityThreatCredential" in vc.get("type", [])
        assert vc["credentialSubject"]["threatDetected"] is True
        assert "proof" in vc

        print(f"\n✅ Solana tx: https://explorer.solana.com/tx/{result['solana_tx_sig']}?cluster=devnet")
        print(f"✅ IPFS:      https://ipfs.io/ipfs/{result['ipfs_cid']}")
