"""
agent/notifications/whatsapp.py

Sends WhatsApp alerts via Twilio WhatsApp API.
Twilio sandbox is free — no Meta Business account needed.

Required .env vars:
    TWILIO_ACCOUNT_SID       — ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    TWILIO_AUTH_TOKEN        — your auth token
    TWILIO_WHATSAPP_FROM     — whatsapp:+14155238886  (sandbox number)

Recipient must join sandbox first:
    WhatsApp → send "join <your-code>" → +14155238886
"""

import os
from twilio.rest import Client
from dotenv import load_dotenv

load_dotenv()


# ─── Phone normalizer ─────────────────────────────────────────────────────────

def _format_phone(phone: str) -> str:
    """
    Convert any Indian phone format to E.164 with leading +
    Twilio WhatsApp requires: whatsapp:+919876543210

    Handles:
        9876543210        → +919876543210
        09876543210       → +919876543210
        +91-98765-43210   → +919876543210
        919876543210      → +919876543210
    """
    digits = "".join(filter(str.isdigit, phone))

    if len(digits) == 10:
        digits = "91" + digits
    elif digits.startswith("0") and len(digits) == 11:
        digits = "91" + digits[1:]

    # Already has country code
    if not digits.startswith("+"):
        digits = "+" + digits

    return digits


# ─── Message builder (unchanged from before) ─────────────────────────────────

def _build_message(match: dict, risk_level: str, user_pseudonym: str) -> str:
    source       = match.get("source", "Unknown source")
    exposed      = ", ".join(match.get("exposed_fields", ["unknown data"]))
    frontend_url = os.getenv("FRONTEND_URL", "https://phantomid.app")

    return (
        f"⚠️ PhantomID Alert\n\n"
        f"Your data was found in a breach.\n\n"
        f"Source: {source}\n"
        f"Exposed: {exposed}\n"
        f"Risk Level: {risk_level}\n\n"
        f"I've generated your proof certificate.\n"
        f"View it here: {frontend_url}/credentials/{user_pseudonym}\n\n"
        f"You did nothing. I handled it."
    )


# ─── Twilio WhatsApp sender ───────────────────────────────────────────────────

async def send_alert(
    phone: str,
    match: dict,
    risk_level: str,
    user_pseudonym: str,
) -> bool:
    """
    Send WhatsApp message via Twilio.

    Signature is 100% identical to old send_alert() —
    act node in nodes.py needs zero changes.

    Returns True on success, False on failure. Never raises.
    """
    account_sid = os.getenv("TWILIO_ACCOUNT_SID")
    auth_token  = os.getenv("TWILIO_AUTH_TOKEN")
    from_number = os.getenv("TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886")

    if not account_sid or not auth_token:
        print("[twilio-whatsapp] TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN not set — skipping")
        return False

    to      = f"whatsapp:{_format_phone(phone)}"
    message = _build_message(match, risk_level, user_pseudonym)

    try:
        client = Client(account_sid, auth_token)

        msg = client.messages.create(
            from_=from_number,
            to=to,
            body=message,
        )

        print(f"[twilio-whatsapp] Message sent. SID: {msg.sid} → {to[:20]}***")
        return True

    except Exception as e:
        print(f"[twilio-whatsapp] Failed (non-fatal): {e}")
        return False
