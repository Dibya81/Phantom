"""
conftest.py — root pytest configuration for blockchain tests.
"""
import pytest


def pytest_configure(config):
    config.addinivalue_line(
        "markers",
        "integration: marks tests that require real network access (Pinata + Solana devnet).",
    )
