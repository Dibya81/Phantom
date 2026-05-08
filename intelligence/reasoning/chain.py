"""
PhantomID — Intelligence Layer
reasoning/chain.py

LLM reasoning chain (Groq) that converts raw breach matches into a
plain-English threat_summary and risk_score.

OUTPUT CONTRACT (enforced by prompt):
    - 1–3 sentence plain-English summary
    - Final line: "Risk score: <integer 0–100>"
    - NO JSON, NO extra fields
"""

import os
import re
from groq import Groq

GROQ_API_KEY = os.environ["GROQ_API_KEY"]
GROQ_MODEL = "llama-3.1-8b-instant"   # fixed: was llama3-70b-8192

_client: Groq | None = None


def _get_client() -> Groq:
    global _client
    if _client is None:
        _client = Groq(api_key=GROQ_API_KEY)
    return _client


SYSTEM_PROMPT = """You are a cybersecurity threat analyst for PhantomID, an Indian digital identity protection service.

Your job is to analyse breach data and produce a SHORT, clear threat assessment.

STRICT OUTPUT FORMAT — follow exactly:
1. Write 1 to 3 sentences in plain English describing the threat. Be specific about breach names, dates, and exposed data types.
2. On the LAST line write exactly: "Risk score: <integer>"
   where <integer> is 0–100.

RULES:
- Do NOT output JSON.
- Do NOT add headings, bullet points, or extra fields.
- Do NOT mention the word "hashed" or reveal technical internals.
- DO name the breach source (e.g. "MobiKwik 2021").
- DO mention how long ago the breach occurred if the date is available.
- DO mention the most sensitive fields exposed (password, PAN, phone, etc.).
- The risk score must match the severity you describe.
"""


def _format_matches_for_prompt(matches: list[dict]) -> str:
    if not matches:
        return "No breach records found."
    lines = []
    for m in matches:
        days_ago = ""
        try:
            from datetime import datetime, timezone
            breach_date = datetime.fromisoformat(m["date"])
            delta = (datetime.now(timezone.utc) - breach_date.replace(tzinfo=timezone.utc)).days
            days_ago = f" ({delta} days ago)"
        except Exception:
            pass
        lines.append(
            f"- Source: {m['source']}{days_ago} | "
            f"Exposed: {', '.join(m['exposed_fields'])} | "
            f"Confidence: {m['confidence']:.2f} | "
            f"Preview: {m['raw_preview']}"
        )
    return "\n".join(lines)


def run_reasoning_chain(matches: list[dict], current_risk_score: int) -> dict:
    """
    Run the LLM reasoning chain over raw breach matches.

    Args:
        matches: list of BreachMatch.matches dicts
        current_risk_score: the integer risk_score from query_breach_db

    Returns:
        {
            "threat_summary": str,   # 1–3 plain-English sentences
            "risk_score": int        # 0–100 integer
        }
    """
    client = _get_client()

    breach_text = _format_matches_for_prompt(matches)
    user_message = (
        f"Breach records for this identifier:\n\n{breach_text}\n\n"
        f"Current computed risk score: {current_risk_score}/100.\n\n"
        "Produce your threat assessment now."
    )

    response = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        temperature=0.2,
        max_tokens=300,
    )

    raw_output = response.choices[0].message.content.strip()

    extracted_risk = _extract_risk_score(raw_output, fallback=current_risk_score)

    summary_lines = [
        line for line in raw_output.splitlines()
        if not re.match(r"^risk score\s*:\s*\d+", line.strip(), re.IGNORECASE)
    ]
    threat_summary = " ".join(summary_lines).strip()

    return {
        "threat_summary": threat_summary,
        "risk_score": extracted_risk,
    }


def _extract_risk_score(text: str, fallback: int) -> int:
    """Extract integer risk score from LLM output. Returns fallback if not found."""
    match = re.search(r"risk score\s*:\s*(\d+)", text, re.IGNORECASE)
    if match:
        score = int(match.group(1))
        return max(0, min(100, score))
    return max(0, min(100, fallback))
