"""
PhantomID — Intelligence Layer
tests/test_monitor.py

Tests for the Telegram monitor — candidate extraction and hash comparison.
No live Telegram connection required.
"""

import hashlib
import unittest

from intelligence.monitor.telegram_monitor import extract_candidates, sha256_hex


class TestCandidateExtraction(unittest.TestCase):

    def test_extracts_email(self):
        text = "leaked: user@gmail.com found in dump"
        candidates = extract_candidates(text)
        self.assertIn("user@gmail.com", candidates)

    def test_extracts_indian_phone(self):
        text = "phone: 9876543210 exposed"
        candidates = extract_candidates(text)
        self.assertIn("9876543210", candidates)

    def test_extracts_pan(self):
        text = "PAN: ABCDE1234F found"
        candidates = extract_candidates(text)
        self.assertIn("ABCDE1234F", candidates)

    def test_no_false_positives_on_clean_text(self):
        text = "nothing sensitive here just normal text"
        candidates = extract_candidates(text)
        self.assertEqual(candidates, [])

    def test_multiple_candidates(self):
        text = "email: a@b.com phone: 9123456789"
        candidates = extract_candidates(text)
        self.assertIn("a@b.com", candidates)
        self.assertIn("9123456789", candidates)


class TestHashComparison(unittest.TestCase):

    def test_hash_matches_registered_user(self):
        raw_email = "user@example.com"
        registered_hash = sha256_hex(raw_email)
        user_hashes = {registered_hash}

        candidates = [raw_email]
        hits = [sha256_hex(c) for c in candidates if sha256_hex(c) in user_hashes]
        self.assertEqual(len(hits), 1)

    def test_hash_does_not_match_unknown(self):
        user_hashes = {sha256_hex("registered@example.com")}
        candidates = ["unknown@example.com"]
        hits = [sha256_hex(c) for c in candidates if sha256_hex(c) in user_hashes]
        self.assertEqual(len(hits), 0)

    def test_hash_is_case_insensitive(self):
        h1 = sha256_hex("User@Example.COM")
        h2 = sha256_hex("user@example.com")
        self.assertEqual(h1, h2)


if __name__ == "__main__":
    unittest.main()