import os
import httpx
from dotenv import load_dotenv

load_dotenv()

WHATSAPP_API_URL = "https://graph.facebook.com/v19.0/{phone_number_id}/messages"

def _format_phone(phone: str) -> str:
    """
    Normalize phone to E.164 format without the '+'.
    WhatsApp Cloud API expects: 919876543210 (no +, no spaces, no dashes).
    Handles inputs like: +91-98765-43210, 09876543210, 9876543210
    """
    digits = "".join(filter(str.isdigit, phone))

    # If 10 digits and starts with non-91 prefix — assume Indian number, prepend 91
    if len(digits) == 10:
        digits = "91" + digits

    # If starts with 0 (local format) — strip leading 0, prepend 91
    if digits.startswith("0") and len(digits) == 11:
        digits = "91" + digits[1:]

    return digits


def _build_message(
    match: dict,
    risk_level: str,
    user_pseudonym: str,
) -> str:
    source        = match.get("source", "Unknown source")
    exposed       = ", ".join(match.get("exposed_fields", ["unknown data"]))
    frontend_url  = os.getenv("FRONTEND_URL", "https://phantomid.app")

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


async def send_alert(
    phone: str,
    match: dict,
    risk_level: str,
    user_pseudonym: str,
) -> bool:
    """
    Send WhatsApp notification via Meta Cloud API.

    Returns True on success, False on failure.
    Never raises — caller must not crash if this fails.

    Args:
        phone:           Raw phone number (any common format)
        match:           First BreachMatch entry — source + exposed_fields
        risk_level:      HIGH / CRITICAL / MEDIUM / LOW
        user_pseudonym:  SHA-256 hex — used in the credential URL
    """
    token           = os.getenv("WHATSAPP_TOKEN")
    phone_number_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID")

    if not token or not phone_number_id:
        print("[whatsapp] WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID not set — skipping")
        return False

    to      = _format_phone(phone)
    message = _build_message(match, risk_level, user_pseudonym)
    url     = WHATSAPP_API_URL.format(phone_number_id=phone_number_id)

    payload = {
        "messaging_product": "whatsapp",
        "recipient_type":    "individual",
        "to":                to,
        "type":              "text",
        "text": {
            "preview_url": False,
            "body":        message,
        },
    }

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type":  "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, json=payload, headers=headers)

        if response.status_code == 200:
            data = response.json()
            msg_id = data.get("messages", [{}])[0].get("id", "unknown")
            print(f"[whatsapp] Message sent. ID: {msg_id} → {to[:6]}***")
            return True
        else:
            print(f"[whatsapp] API error {response.status_code}: {response.text}")
            return False

    except httpx.TimeoutException:
        print(f"[whatsapp] Timeout sending to {to[:6]}***")
        return False
    except Exception as e:
        print(f"[whatsapp] Unexpected error (non-fatal): {e}")
        return False
