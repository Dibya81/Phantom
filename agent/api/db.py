import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

_client: Client = None

def get_db() -> Client:
    global _client
    if _client is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_KEY")
        if not url or not key:
            raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be set in .env")
        _client = create_client(url, key)
    return _client


async def store_user(
    user_pseudonym: str,
    hashed_email: str,
    hashed_phone: str,
    hashed_pan: str,
    raw_phone: str,
) -> dict:
    db = get_db()
    row = {
        "user_pseudonym": user_pseudonym,
        "hashed_email": hashed_email,
        "hashed_phone": hashed_phone,
        "hashed_pan": hashed_pan,
        "raw_phone": raw_phone,           # only field stored un-hashed — needed for WhatsApp
        "gmail_connected": False,
    }
    result = db.table("users").upsert(row, on_conflict="user_pseudonym").execute()
    return result.data[0] if result.data else row


async def get_user_by_pseudonym(user_pseudonym: str) -> dict | None:
    db = get_db()
    result = db.table("users").select("*").eq("user_pseudonym", user_pseudonym).execute()
    return result.data[0] if result.data else None


async def store_gmail_tokens(user_pseudonym: str, tokens: dict) -> None:
    db = get_db()
    db.table("users").update({
        "gmail_tokens": tokens,
        "gmail_connected": True,
    }).eq("user_pseudonym", user_pseudonym).execute()


async def get_gmail_tokens(user_pseudonym: str) -> dict | None:
    db = get_db()
    result = db.table("users").select("gmail_tokens").eq("user_pseudonym", user_pseudonym).execute()
    if result.data and result.data[0].get("gmail_tokens"):
        return result.data[0]["gmail_tokens"]
    return None


async def store_proof_result(
    user_pseudonym: str,
    threat_assessment: dict,
    proof_result: dict | None,
) -> None:
    db = get_db()
    row = {
        "user_pseudonym": user_pseudonym,
        "threat_assessment": threat_assessment,
        "proof_result": proof_result,
        "risk_level": threat_assessment.get("risk_level", "UNKNOWN"),
        "threat_summary": threat_assessment.get("threat_summary", ""),
        "detected_at": threat_assessment.get("timestamp"),
    }
    db.table("threat_events").insert(row).execute()


async def get_threat_history(user_pseudonym: str) -> list[dict]:
    db = get_db()
    result = (
        db.table("threat_events")
        .select("*")
        .eq("user_pseudonym", user_pseudonym)
        .order("detected_at", desc=True)
        .execute()
    )
    return result.data or []


async def get_credentials(user_pseudonym: str) -> list[dict]:
    db = get_db()
    result = (
        db.table("threat_events")
        .select("proof_result, threat_assessment, risk_level, detected_at")
        .eq("user_pseudonym", user_pseudonym)
        .not_.is_("proof_result", "null")
        .order("detected_at", desc=True)
        .execute()
    )
    return result.data or []
