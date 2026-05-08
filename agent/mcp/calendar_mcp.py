import os
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# IST timezone for sleep-hours detection
IST = ZoneInfo("Asia/Kolkata")

# Sleep hours in IST: 10 PM to 6 AM
SLEEP_START_HOUR = 22
SLEEP_END_HOUR   = 6

# Keywords that indicate travel or out-of-office
TRAVEL_KEYWORDS = [
    "travel", "flight", "hotel", "out of office", "ooo",
    "vacation", "holiday", "trip", "abroad", "conference",
    "offsite", "off site", "leave", "away",
]


def _build_calendar_service(tokens: dict):
    creds = Credentials(
        token=tokens["token"],
        refresh_token=tokens.get("refresh_token"),
        token_uri=tokens.get("token_uri", "https://oauth2.googleapis.com/token"),
        client_id=tokens.get("client_id", os.getenv("GOOGLE_CLIENT_ID")),
        client_secret=tokens.get("client_secret", os.getenv("GOOGLE_CLIENT_SECRET")),
        scopes=tokens.get("scopes", ["https://www.googleapis.com/auth/calendar.readonly"]),
    )
    return build("calendar", "v3", credentials=creds, cache_discovery=False)


def _is_sleep_hours(dt: datetime) -> bool:
    """Check if datetime falls in sleep hours (10 PM – 6 AM IST)."""
    local = dt.astimezone(IST)
    h = local.hour
    return h >= SLEEP_START_HOUR or h < SLEEP_END_HOUR


def _has_travel_keyword(text: str) -> bool:
    lower = text.lower()
    return any(kw in lower for kw in TRAVEL_KEYWORDS)


def get_signals(
    user_pseudonym: str,
    breach_timestamp: str,
    tokens: dict | None = None,
) -> list[str]:
    """
    Read Google Calendar for anomaly signals around the breach timestamp.
    Returns list of signal strings — event titles only, no attendees or locations.
    Returns [] on any failure — never crashes the reason node.

    Args:
        user_pseudonym:    SHA-256 pseudonym — logging only
        breach_timestamp:  ISO-8601 string of the breach date
        tokens:            OAuth token dict. If None, returns [].
    """
    if not tokens:
        return []

    signals = []

    try:
        # Parse breach timestamp
        try:
            breach_dt = datetime.fromisoformat(breach_timestamp.replace("Z", "+00:00"))
        except Exception:
            breach_dt = datetime.now(timezone.utc)

        # Search window: 24h before and after breach
        window_start = breach_dt - timedelta(hours=24)
        window_end   = breach_dt + timedelta(hours=24)

        service = _build_calendar_service(tokens)

        events_result = service.events().list(
            calendarId="primary",
            timeMin=window_start.isoformat(),
            timeMax=window_end.isoformat(),
            maxResults=20,
            singleEvents=True,
            orderBy="startTime",
            fields="items(summary,start,end,status)",  # no attendees, no location — privacy
        ).execute()

        events = events_result.get("items", [])

        for event in events:
            summary = event.get("summary", "")
            status  = event.get("status", "")
            start   = event.get("start", {})

            if status == "cancelled":
                continue

            # Parse event start time
            start_str = start.get("dateTime") or start.get("date", "")
            try:
                if "T" in start_str:
                    event_dt = datetime.fromisoformat(start_str.replace("Z", "+00:00"))
                else:
                    # All-day event
                    event_dt = datetime.fromisoformat(start_str).replace(tzinfo=timezone.utc)
            except Exception:
                continue

            # Check: travel or out-of-office event during breach window
            if _has_travel_keyword(summary):
                signals.append(
                    f"Calendar: travel/OOO event '{summary}' detected during breach window"
                )
                continue

            # Check: breach occurred during sleep hours
            if _is_sleep_hours(breach_dt):
                signals.append(
                    "Calendar: breach timestamp falls in user's sleep hours (10 PM – 6 AM IST)"
                )
                # Add once, not per-event
                break

            # Check: all-day event (could indicate user was away)
            if "date" in start and "dateTime" not in start:
                if _has_travel_keyword(summary) or "holiday" in summary.lower():
                    signals.append(
                        f"Calendar: all-day event '{summary}' overlaps with breach date"
                    )

    except HttpError as e:
        print(f"[calendar_mcp] HttpError for user {user_pseudonym[:8]}...: {e}")
        return []
    except Exception as e:
        print(f"[calendar_mcp] Unexpected error (non-fatal): {e}")
        return []

    # Deduplicate and cap
    seen = set()
    deduped = []
    for s in signals:
        if s not in seen:
            seen.add(s)
            deduped.append(s)

    return deduped[:5]
