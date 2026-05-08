"""
PhantomID — Intelligence Layer
ingest/cert_in_scraper.py

Scraper for CERT-In public advisories.
Ingests breach-related notifications into pgvector for RAG context.
"""

import asyncio
import hashlib
import logging
import re
from datetime import datetime

import httpx
from bs4 import BeautifulSoup

from intelligence.ingest.ingest import get_index, ingest_breach_record

logger = logging.getLogger("phantomid.cert_in")

BASE_URL = "https://www.cert-in.org.in"
LIST_URL = "https://www.cert-in.org.in/s2c_full_list.jsp?p1={page}"
TOTAL_PAGES = 5          # scrape 5 pages — enough for a hackathon
BREACH_KEYWORDS = [
    "breach", "leak", "compromise", "unauthorised access",
    "data exposure", "credential", "personal data", "pii",
    "ransomware", "phishing", "identity"
]

# CERT-In date formats they actually use
_DATE_FORMATS = [
    "%B %d, %Y",   # January 01, 2024
    "%b %d, %Y",   # Jan 01, 2024
    "%d-%m-%Y",    # 01-01-2024
    "%Y-%m-%d",    # 2024-01-01
]


def _parse_date(raw: str) -> str:
    """Parse a date string into ISO-8601. Returns today if unparseable."""
    raw = raw.strip()
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(raw, fmt).date().isoformat()
        except ValueError:
            continue
    return datetime.utcnow().date().isoformat()


def _advisory_hash(advisory_id: str, title: str) -> str:
    """
    Unique hash per advisory — NOT a user identifier.
    Lets pgvector distinguish between different advisories.
    """
    unique = f"CERT-IN::{advisory_id}::{title}".lower()
    return hashlib.sha256(unique.encode()).hexdigest()


def _extract_exposed_fields(text: str) -> list[str]:
    """Infer what data types were mentioned in the advisory."""
    text_lower = text.lower()
    fields = []
    checks = {
        "email":           ["email"],
        "phone":           ["phone", "mobile", "contact number"],
        "password":        ["password", "credential"],
        "aadhaar":         ["aadhaar", "uid"],
        "pan":             ["pan number", "pan card"],
        "financial_data":  ["bank", "financial", "payment", "credit card", "debit card", "upi"],
        "personal_data":   ["personal data", "pii", "personally identifiable"],
        "health_data":     ["health", "medical", "covid", "vaccination"],
        "address":         ["address", "location"],
        "identity_docs":   ["passport", "driving licence", "voter"],
    }
    for field, keywords in checks.items():
        if any(kw in text_lower for kw in keywords):
            fields.append(field)
    return fields if fields else ["advisory_notice"]


def _is_breach_related(text: str) -> bool:
    text_lower = text.lower()
    return any(kw in text_lower for kw in BREACH_KEYWORDS)


async def _fetch_page(client: httpx.AsyncClient, page: int) -> BeautifulSoup:
    url = LIST_URL.format(page=page)
    logger.info(f"[cert-in] Fetching page {page}: {url}")
    resp = await client.get(url, timeout=20)
    resp.raise_for_status()
    return BeautifulSoup(resp.text, "html.parser")


def _parse_advisories(soup: BeautifulSoup) -> list[dict]:
    """
    Parse advisories from a CERT-In list page.
    CERT-In renders advisories in <table> rows — we try multiple selectors
    since their HTML structure has changed over the years.
    """
    advisories = []

    # Strategy 1: table rows (most common on CERT-In)
    rows = soup.select("table tr")
    for row in rows:
        cols = row.find_all("td")
        if len(cols) < 2:
            continue

        # Typical columns: [Advisory ID] [Title] [Date] or [Date] [Title] [Link]
        text_parts = [c.get_text(separator=" ").strip() for c in cols]
        full_text = " | ".join(text_parts)

        if not _is_breach_related(full_text):
            continue

        # Try to find advisory ID (pattern: CIAD-YYYY-NNNN or CIVN-YYYY-NNNN)
        adv_id_match = re.search(r"CI[A-Z]+-\d{4}-\d+", full_text)
        advisory_id = adv_id_match.group(0) if adv_id_match else f"CERT-IN-{len(advisories)}"

        # Try to find a date in any column
        date_str = datetime.utcnow().date().isoformat()
        for part in text_parts:
            date_match = re.search(
                r"\b(\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\w+ \d{1,2},? \d{4})\b", part
            )
            if date_match:
                date_str = _parse_date(date_match.group(0))
                break

        # Title is usually the longest column text
        title = max(text_parts, key=len)

        advisories.append({
            "advisory_id": advisory_id,
            "title": title,
            "date": date_str,
            "full_text": full_text,
        })

    # Strategy 2: list items (fallback)
    if not advisories:
        for item in soup.select("li, .list_item, .advisory-item"):
            text = item.get_text(separator=" ").strip()
            if not _is_breach_related(text):
                continue
            adv_id_match = re.search(r"CI[A-Z]+-\d{4}-\d+", text)
            advisory_id = adv_id_match.group(0) if adv_id_match else f"CERT-IN-LI-{len(advisories)}"
            advisories.append({
                "advisory_id": advisory_id,
                "title": text[:120],
                "date": datetime.utcnow().date().isoformat(),
                "full_text": text,
            })

    return advisories


async def scrape_cert_in(pages: int = TOTAL_PAGES) -> int:
    """
    Scrape CERT-In advisory list pages and ingest breach-related entries
    into pgvector.

    Args:
        pages: number of list pages to scrape (default 5)

    Returns:
        Total number of advisories ingested.
    """
    index = get_index()
    total = 0

    async with httpx.AsyncClient(verify=False) as client:
        for page in range(1, pages + 1):
            try:
                soup = await _fetch_page(client, page)
            except Exception as exc:
                logger.error(f"[cert-in] Failed to fetch page {page}: {exc}")
                continue

            advisories = _parse_advisories(soup)
            logger.info(f"[cert-in] Page {page}: {len(advisories)} breach-related advisories found.")

            for adv in advisories:
                try:
                    unique_hash = _advisory_hash(adv["advisory_id"], adv["title"])
                    exposed = _extract_exposed_fields(adv["full_text"])

                    # Run sync ingest in thread pool so we don't block the event loop
                    await asyncio.get_event_loop().run_in_executor(
                        None,
                        lambda a=adv, h=unique_hash, e=exposed: ingest_breach_record(
                            source=f"CERT-In_{a['advisory_id']}",
                            date=a["date"],
                            exposed_fields=e,
                            raw_identifier=h,      # unique per advisory, not a user identifier
                            raw_line=a["full_text"],
                            index=index,
                        )
                    )
                    total += 1
                except Exception as exc:
                    logger.error(f"[cert-in] Ingest error for {adv['advisory_id']}: {exc}")

            # Be polite to CERT-In's server
            await asyncio.sleep(1)

    logger.info(f"[cert-in] Done. Total ingested: {total}")
    return total


if __name__ == "__main__":
    import asyncio
    logging.basicConfig(level=logging.INFO)
    asyncio.run(scrape_cert_in())