"""
PhantomID — Intelligence Layer
monitor/telegram_monitor.py

Polls pre-joined Telegram breach channels every 5 minutes.
Extracts candidate PII patterns, hashes them, compares against
the Supabase user registry. On match, fires a detection event
for Person 3's LangGraph perceive node to consume.

RULES:
- Poll every 300 seconds (5 minutes) — not faster, not slower.
- NEVER store raw channel content.
- Store ONLY hashes and metadata.
- Raw PII is hashed and discarded immediately.
"""

import asyncio
import hashlib
import logging
import os
import re
from datetime import datetime, timezone

import httpx
from telethon import TelegramClient
from telethon.tl.types import Message

logger = logging.getLogger("phantomid.monitor")

# ── Config ────────────────────────────────────────────────────────────────────
TG_API_ID = int(os.environ["TELEGRAM_API_ID"])
TG_API_HASH = os.environ["TELEGRAM_API_HASH"]
TG_SESSION = os.environ.get("TELEGRAM_SESSION_NAME", "phantomid_monitor")
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]   # fixed: was SUPABASE_SERVICE_KEY
POLL_INTERVAL = 300  # seconds — DO NOT CHANGE

# Channels to monitor — must be pre-joined in the Telegram app.
CHANNELS_TO_MONITOR: list[str] = [
    "cloudandcybersecurity",
    "breachdetector",
    "cybersecuritynewschat",
]

# ── Regex patterns ────────────────────────────────────────────────────────────
_EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
_PHONE_RE = re.compile(r"\b[6-9]\d{9}\b")   # Indian mobile numbers
_PAN_RE   = re.compile(r"\b[A-Z]{5}[0-9]{4}[A-Z]\b")

# ── State ─────────────────────────────────────────────────────────────────────
_seen_message_ids: set[int] = set()


def sha256_hex(raw: str) -> str:
    return hashlib.sha256(raw.strip().lower().encode()).hexdigest()


def extract_candidates(text: str) -> list[str]:
    """
    Extract raw candidate strings from a message.
    Returns raw strings — caller MUST hash immediately.
    """
    candidates = []
    candidates.extend(_EMAIL_RE.findall(text))
    candidates.extend(_PHONE_RE.findall(text))
    candidates.extend(_PAN_RE.findall(text))
    return candidates


async def fetch_user_hashes() -> set[str]:
    """
    Fetch all registered user identifier hashes from Supabase.
    Returns a set of SHA-256 hex strings.
    """
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/users",
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
            },
            params={"select": "hashed_email,hashed_phone,hashed_pan"},
        )
        resp.raise_for_status()
        rows = resp.json()

    hashes: set[str] = set()
    for row in rows:
        for field in ("hashed_email", "hashed_phone", "hashed_pan"):
            val = row.get(field)
            if val:
                hashes.add(val)
    return hashes


async def fire_detection_event(
    hashed_identifier: str,
    channel: str,
    message_id: int,
    detected_at: str,
) -> None:
    """
    Write a detection event to Supabase for Person 3's perceive node to consume.
    Stores NO raw PII — only the hash and metadata.
    """
    payload = {
        "hashed_identifier": hashed_identifier,
        "source_channel": channel,
        "source_message_id": message_id,
        "detected_at": detected_at,
        "event_type": "TELEGRAM_BREACH_HIT",
        "consumed": False,
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{SUPABASE_URL}/rest/v1/detection_events",
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
            },
            json=payload,
        )
        resp.raise_for_status()
    logger.info(f"[monitor] Detection event fired: {hashed_identifier[:12]}… from {channel}")


async def process_message(msg: Message, channel: str, user_hashes: set[str]) -> None:
    """Process one Telegram message. Hash candidates; compare; fire on match."""
    if msg.id in _seen_message_ids:
        return
    _seen_message_ids.add(msg.id)

    text = msg.message or ""
    if not text:
        return

    candidates = extract_candidates(text)
    for raw in candidates:
        h = sha256_hex(raw)
        if h in user_hashes:
            detected_at = datetime.now(timezone.utc).isoformat()
            await fire_detection_event(
                hashed_identifier=h,
                channel=channel,
                message_id=msg.id,
                detected_at=detected_at,
            )


async def poll_once(client: TelegramClient) -> None:
    """One poll cycle across all monitored channels."""
    user_hashes = await fetch_user_hashes()
    logger.info(f"[monitor] Poll cycle — {len(user_hashes)} registered hashes.")

    for channel in CHANNELS_TO_MONITOR:
        try:
            async for msg in client.iter_messages(channel, limit=50):
                await process_message(msg, channel, user_hashes)
        except Exception as exc:
            logger.error(f"[monitor] Error reading {channel}: {exc}")


async def run_monitor() -> None:
    """Main loop. Polls every POLL_INTERVAL seconds."""
    async with TelegramClient(TG_SESSION, TG_API_ID, TG_API_HASH) as tg:
        logger.info("[monitor] Telegram client connected. Starting poll loop.")
        while True:
            try:
                await poll_once(tg)
            except Exception as exc:
                logger.error(f"[monitor] Poll error: {exc}")
            await asyncio.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_monitor())
