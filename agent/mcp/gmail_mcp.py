import os
from datetime import datetime, timezone, timedelta
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# Keywords that indicate a security-relevant email
SECURITY_KEYWORDS = [
    "sign-in", "signin", "new sign in",
    "suspicious", "suspicious activity",
    "password changed", "password reset",
    "new device", "unrecognized device",
    "security alert", "security notice",
    "unauthorized", "unusual activity",
    "account access", "verify your identity",
]

def _build_gmail_service(tokens: dict):
    creds = Credentials(
        token=tokens["token"],
        refresh_token=tokens.get("refresh_token"),
        token_uri=tokens.get("token_uri", "https://oauth2.googleapis.com/token"),
        client_id=tokens.get("client_id", os.getenv("GOOGLE_CLIENT_ID")),
        client_secret=tokens.get("client_secret", os.getenv("GOOGLE_CLIENT_SECRET")),
        scopes=tokens.get("scopes", ["https://www.googleapis.com/auth/gmail.readonly"]),
    )
    return build("gmail", "v1", credentials=creds, cache_discovery=False)


def _days_ago_label(date_str: str) -> str:
    """Convert ISO date string to human-readable 'X days ago'."""
    try:
        dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        delta = datetime.now(timezone.utc) - dt
        days = delta.days
        if days == 0:
            return "today"
        elif days == 1:
            return "1 day ago"
        else:
            return f"{days} days ago"
    except Exception:
        return "recently"


def get_signals(user_pseudonym: str, tokens: dict | None = None) -> list[str]:
    """
    Read Gmail for security-relevant emails.
    Returns a list of signal strings — subjects and senders only, no body content.
    Returns [] on any failure — never crashes the reason node.

    Args:
        user_pseudonym: SHA-256 pseudonym — used only for logging, never stored
        tokens: OAuth token dict from Supabase. If None, returns [].
    """
    if not tokens:
        return []

    signals = []

    try:
        service = _build_gmail_service(tokens)

        # Build Gmail search query from keywords
        keyword_query = " OR ".join(f'subject:"{kw}"' for kw in SECURITY_KEYWORDS)
        # Only look at last 30 days
        after_date = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y/%m/%d")
        query = f"({keyword_query}) after:{after_date}"

        results = service.users().messages().list(
            userId="me",
            q=query,
            maxResults=10,       # cap — we don't need more
        ).execute()

        messages = results.get("messages", [])

        for msg in messages:
            try:
                full = service.users().messages().get(
                    userId="me",
                    id=msg["id"],
                    format="metadata",
                    metadataHeaders=["Subject", "From", "Date"],
                ).execute()

                headers = {
                    h["name"]: h["value"]
                    for h in full.get("payload", {}).get("headers", [])
                }

                subject = headers.get("Subject", "")
                sender  = headers.get("From", "")
                date    = headers.get("Date", "")

                # Strip email address to domain only — no raw PII
                sender_domain = ""
                if "<" in sender:
                    addr = sender.split("<")[-1].replace(">", "").strip()
                    sender_domain = addr.split("@")[-1] if "@" in addr else addr
                elif "@" in sender:
                    sender_domain = sender.split("@")[-1].strip()

                # Parse date to days-ago label
                try:
                    from email.utils import parsedate_to_datetime
                    parsed_dt = parsedate_to_datetime(date)
                    age_label = _days_ago_label(parsed_dt.isoformat())
                except Exception:
                    age_label = "recently"

                # Build signal string — subject + domain + age, no PII
                if subject:
                    signal = f"Gmail security email: '{subject}' from {sender_domain} {age_label}"
                    signals.append(signal)

            except HttpError:
                continue  # skip individual message errors, keep processing

    except HttpError as e:
        print(f"[gmail_mcp] HttpError for user {user_pseudonym[:8]}...: {e}")
        return []
    except Exception as e:
        print(f"[gmail_mcp] Unexpected error (non-fatal): {e}")
        return []

    return signals[:5]  # max 5 signals to keep ThreatAssessment clean
