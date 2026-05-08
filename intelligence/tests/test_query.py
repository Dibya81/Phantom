"""
PhantomID — Intelligence Layer
tests/test_query.py

Unit and integration tests for query_breach_db().
Uses contracts/mock/breach_match.mock.json as fixture (RULE 9).
"""

import hashlib
import json
import os
import sys
import unittest
from unittest.mock import MagicMock, patch

# Allow running from project root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from intelligence.rag.query import query_breach_db, _compute_risk_score


# ── Helpers ───────────────────────────────────────────────────────────────────

def sha256_hex(raw: str) -> str:
    return hashlib.sha256(raw.strip().lower().encode()).hexdigest()


# 5 pre-seeded test identifiers (use real ones for demo; these are placeholders)
TEST_IDENTIFIERS = [
    "test1@example.com",
    "test2@example.com",
    "9876543210",
    "ABCDE1234F",
    "test5@phantomid.in",
]

MOCK_BREACH_MATCH = {
    "matches": [
        {
            "source": "MobiKwik_2021",
            "date": "2021-03-01",
            "exposed_fields": ["email", "phone", "password_hash"],
            "confidence": 0.95,
            "raw_preview": "***@***.*** | ********** | [hash redacted]"
        }
    ],
    "risk_score": 82,
    "identifier_queried": sha256_hex("test1@example.com")
}


# ── Schema validation helper ──────────────────────────────────────────────────

def validate_breach_match_schema(result: dict) -> list[str]:
    """
    Returns a list of schema violation strings.
    Empty list = valid.
    Mirrors contracts/breach_match.schema.json (frozen).
    """
    errors = []

    if not isinstance(result, dict):
        return ["result is not a dict"]

    # Top-level fields
    if "matches" not in result:
        errors.append("missing field: matches")
    elif not isinstance(result["matches"], list):
        errors.append("matches must be a list")

    if "risk_score" not in result:
        errors.append("missing field: risk_score")
    elif not isinstance(result["risk_score"], int):
        errors.append(f"risk_score must be int, got {type(result['risk_score'])}")
    elif not (0 <= result["risk_score"] <= 100):
        errors.append(f"risk_score out of range: {result['risk_score']}")

    if "identifier_queried" not in result:
        errors.append("missing field: identifier_queried")
    elif not isinstance(result["identifier_queried"], str):
        errors.append("identifier_queried must be str")

    # Per-match validation
    import re
    PII_PATTERNS = [
        re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}"),
        re.compile(r"\b[6-9]\d{9}\b"),
        re.compile(r"\b[A-Z]{5}[0-9]{4}[A-Z]\b"),
    ]

    for i, m in enumerate(result.get("matches", [])):
        if not isinstance(m.get("source"), str):
            errors.append(f"matches[{i}].source must be str")
        if not isinstance(m.get("date"), str):
            errors.append(f"matches[{i}].date must be str")
        else:
            from datetime import datetime
            try:
                datetime.fromisoformat(m["date"])
            except ValueError:
                errors.append(f"matches[{i}].date not ISO-8601: {m['date']}")
        if not isinstance(m.get("exposed_fields"), list):
            errors.append(f"matches[{i}].exposed_fields must be list")
        if not isinstance(m.get("confidence"), float):
            errors.append(f"matches[{i}].confidence must be float")
        elif not (0.0 <= m["confidence"] <= 1.0):
            errors.append(f"matches[{i}].confidence out of range: {m['confidence']}")
        if not isinstance(m.get("raw_preview"), str):
            errors.append(f"matches[{i}].raw_preview must be str")
        else:
            if len(m["raw_preview"]) > 100:
                errors.append(f"matches[{i}].raw_preview exceeds 100 chars")
            for pat in PII_PATTERNS:
                if pat.search(m["raw_preview"]):
                    errors.append(f"matches[{i}].raw_preview contains raw PII")

    return errors


# ── Tests ─────────────────────────────────────────────────────────────────────

class TestSchemaValidation(unittest.TestCase):
    """Tests against the mock fixture — no live DB required."""

    def test_mock_fixture_is_valid(self):
        errors = validate_breach_match_schema(MOCK_BREACH_MATCH)
        self.assertEqual(errors, [], f"Mock fixture schema errors: {errors}")

    def test_risk_score_is_integer(self):
        self.assertIsInstance(MOCK_BREACH_MATCH["risk_score"], int)

    def test_confidence_is_float(self):
        for m in MOCK_BREACH_MATCH["matches"]:
            self.assertIsInstance(m["confidence"], float)

    def test_exposed_fields_is_list(self):
        for m in MOCK_BREACH_MATCH["matches"]:
            self.assertIsInstance(m["exposed_fields"], list)

    def test_raw_preview_no_pii(self):
        import re
        email_re = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
        for m in MOCK_BREACH_MATCH["matches"]:
            self.assertIsNone(email_re.search(m["raw_preview"]),
                              "raw_preview must not contain raw email")

    def test_risk_score_range(self):
        self.assertGreaterEqual(MOCK_BREACH_MATCH["risk_score"], 0)
        self.assertLessEqual(MOCK_BREACH_MATCH["risk_score"], 100)


class TestComputeRiskScore(unittest.TestCase):

    def test_empty_matches_returns_zero(self):
        self.assertEqual(_compute_risk_score([]), 0)

    def test_high_confidence_password_hash_raises_score(self):
        matches = [{
            "source": "Test",
            "date": "2021-01-01",
            "exposed_fields": ["email", "password_hash"],
            "confidence": 0.99,
            "raw_preview": "preview",
        }]
        score = _compute_risk_score(matches)
        self.assertGreater(score, 20)
        self.assertLessEqual(score, 100)

    def test_pan_exposure_raises_score_higher(self):
        matches_pan = [{
            "source": "Test",
            "date": "2021-01-01",
            "exposed_fields": ["email", "pan"],
            "confidence": 0.90,
            "raw_preview": "preview",
        }]
        matches_email = [{
            "source": "Test",
            "date": "2021-01-01",
            "exposed_fields": ["email"],
            "confidence": 0.90,
            "raw_preview": "preview",
        }]
        self.assertGreater(_compute_risk_score(matches_pan), _compute_risk_score(matches_email))

    def test_risk_score_never_exceeds_100(self):
        matches = [
            {
                "source": f"Breach_{i}",
                "date": "2021-01-01",
                "exposed_fields": ["email", "password_hash", "pan"],
                "confidence": 1.0,
                "raw_preview": "preview",
            }
            for i in range(50)
        ]
        self.assertLessEqual(_compute_risk_score(matches), 100)


class TestQueryBreachDbInputValidation(unittest.TestCase):

    def test_rejects_raw_email(self):
        with self.assertRaises(ValueError):
            query_breach_db("user@example.com")

    def test_rejects_short_string(self):
        with self.assertRaises(ValueError):
            query_breach_db("abc123")

    def test_rejects_empty_string(self):
        with self.assertRaises(ValueError):
            query_breach_db("")

    def test_accepts_valid_sha256(self):
        """Should NOT raise on a valid 64-char hex string (may fail DB conn in CI)."""
        valid_hash = sha256_hex("test@example.com")
        # We only test input validation here — DB calls are mocked in integration tests.
        try:
            with patch("intelligence.rag.query._get_index") as mock_index:
                mock_retriever = MagicMock()
                mock_retriever.retrieve.return_value = []
                mock_index.return_value.as_retriever.return_value = mock_retriever
                result = query_breach_db(valid_hash)
                self.assertIn("matches", result)
                self.assertIn("risk_score", result)
                self.assertIn("identifier_queried", result)
                self.assertEqual(result["identifier_queried"], valid_hash)
        except Exception as e:
            self.fail(f"query_breach_db raised unexpectedly: {e}")


class TestQueryBreachDbWithMock(unittest.TestCase):
    """Integration-style tests using mocked vector store."""

    def _make_mock_node(self, hashed_id: str, source: str, confidence: float):
        node = MagicMock()
        node.score = confidence
        node.metadata = {
            "source": source,
            "date": "2021-03-01",
            "exposed_fields": '["email", "phone", "password_hash"]',
            "hashed_identifier": hashed_id,
            "raw_preview": "***@***.*** | ********** | [hash]",
        }
        return node

    def test_returns_valid_schema_for_seeded_identifiers(self):
        for raw in TEST_IDENTIFIERS:
            h = sha256_hex(raw)
            with patch("intelligence.rag.query._get_index") as mock_index:
                mock_retriever = MagicMock()
                mock_retriever.retrieve.return_value = [
                    self._make_mock_node(h, "MobiKwik_2021", 0.92)
                ]
                mock_index.return_value.as_retriever.return_value = mock_retriever

                result = query_breach_db(h)
                errors = validate_breach_match_schema(result)
                self.assertEqual(errors, [], f"Schema errors for {raw}: {errors}")

    def test_identifier_queried_echoed_back(self):
        h = sha256_hex("test1@example.com")
        with patch("intelligence.rag.query._get_index") as mock_index:
            mock_retriever = MagicMock()
            mock_retriever.retrieve.return_value = []
            mock_index.return_value.as_retriever.return_value = mock_retriever
            result = query_breach_db(h)
            self.assertEqual(result["identifier_queried"], h)

    def test_no_matches_returns_zero_risk(self):
        h = sha256_hex("nobody@nowhere.com")
        with patch("intelligence.rag.query._get_index") as mock_index:
            mock_retriever = MagicMock()
            mock_retriever.retrieve.return_value = []
            mock_index.return_value.as_retriever.return_value = mock_retriever
            result = query_breach_db(h)
            self.assertEqual(result["risk_score"], 0)
            self.assertEqual(result["matches"], [])


class TestReasoningChain(unittest.TestCase):

    def test_produces_threat_summary_string(self):
        from intelligence.reasoning.chain import run_reasoning_chain
        matches = MOCK_BREACH_MATCH["matches"]
        with patch("intelligence.reasoning.chain._get_client") as mock_client:
            mock_response = MagicMock()
            mock_response.choices[0].message.content = (
                "User's email appeared in the MobiKwik 2021 breach alongside phone and password hash. "
                "Likely active exploitation window.\nRisk score: 82"
            )
            mock_client.return_value.chat.completions.create.return_value = mock_response
            result = run_reasoning_chain(matches, current_risk_score=82)

        self.assertIn("threat_summary", result)
        self.assertIn("risk_score", result)
        self.assertIsInstance(result["threat_summary"], str)
        self.assertIsInstance(result["risk_score"], int)
        self.assertNotIn("{", result["threat_summary"])  # no JSON in summary
        self.assertGreater(len(result["threat_summary"]), 10)

    def test_risk_score_clamped_to_100(self):
        from intelligence.reasoning.chain import _extract_risk_score
        self.assertEqual(_extract_risk_score("Risk score: 150", 50), 100)

    def test_risk_score_clamped_to_zero(self):
        from intelligence.reasoning.chain import _extract_risk_score
        self.assertEqual(_extract_risk_score("Risk score: -10", 20), 0)

    def test_fallback_used_when_no_score_in_text(self):
        from intelligence.reasoning.chain import _extract_risk_score
        self.assertEqual(_extract_risk_score("No score here.", 42), 42)


if __name__ == "__main__":
    unittest.main()