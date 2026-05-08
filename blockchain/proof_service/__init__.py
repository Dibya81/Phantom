"""
proof_service package init — re-export the public contract function.
"""
from .proof_service import generate_proof

__all__ = ["generate_proof"]
