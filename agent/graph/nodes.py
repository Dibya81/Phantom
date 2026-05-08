import os
import sys
import json
import hashlib
import asyncio
from datetime import datetime, timezone

try:
    from langchain_groq import ChatGroq
except ImportError:
    # Fallback dummy LLM for environments without langchain_groq
    class _DummyLLM:
        def __init__(self, *args, **kwargs):
            pass
        def invoke(self, prompt: str):
            class _Resp:
                def __init__(self):
                    self.content = "SUMMARY: Mock summary.\nRISK_LEVEL: LOW"
            return _Resp()
    ChatGroq = _DummyLLM
from dotenv import load_dotenv

load_dotenv()

# ── Path configuration ──────────────────────────────────────────────────────
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../"))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

# ── WebSocket broadcaster (set at runtime by the API layer) ──────────────────
_ws_broadcast = None

def set_ws_broadcaster(fn):
    global _ws_broadcast
    _ws_broadcast = fn

async def _emit(event: str, node: str, payload: dict, state: dict):
    ev = {
        "event": event,
        "node": node,
        "payload": payload,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    broadcaster = state.get("broadcaster")
    if (broadcaster):
        print(f"[debug] Emitting {event} from {node} to broadcaster")
        await broadcaster(ev)
    else:
        print(f"[debug] WARNING: No broadcaster found in state for event {event}")

# ── Intelligence Layer ────────────────────────────────────────────────────────
from intelligence.rag.query import query_breach_db
print("[perceive] Using REAL query_breach_db from intelligence layer")

# ── Blockchain Layer ─────────────────────────────────────────────────────────
try:
    from blockchain.proof_service import generate_proof as _real_proof
    generate_proof = _real_proof
    print("[act] Using REAL generate_proof from blockchain layer")
except (ImportError, Exception):
    print("[act] Blockchain service not configured — using stub")
    from blockchain.proof_service.proof_service_stub import generate_proof_stub as generate_proof

# ── MCP imports ───────────────────────────────────────────────────────────────
try:
    from agent.mcp.gmail_mcp import get_signals as _gmail_signals
    from agent.mcp.calendar_mcp import get_signals as _calendar_signals

    def gmail_signals(user_pseudonym: str, tokens: dict | None = None) -> list[str]:
        return _gmail_signals(user_pseudonym, tokens)

    def calendar_signals(user_pseudonym: str, breach_ts: str, tokens: dict | None = None) -> list[str]:
        return _calendar_signals(user_pseudonym, breach_ts, tokens)

except ImportError:
    def gmail_signals(user_pseudonym, tokens=None): return []
    def calendar_signals(user_pseudonym, breach_ts="", tokens=None): return []

# ── LLM ──────────────────────────────────────────────────────────────────────
def _get_llm():
    return ChatGroq(
        model="llama-3.1-8b-instant",
        temperature=0.2,
        api_key=os.getenv("GROQ_API_KEY"),
    )

# ── REQUIRED field validator ──────────────────────────────────────────────────
_BREACH_MATCH_FIELDS = {"matches", "risk_score", "identifier_queried"}
_MATCH_ITEM_FIELDS = {"source", "date", "exposed_fields", "confidence", "raw_preview"}
_THREAT_ASSESSMENT_FIELDS = {"user_pseudonym", "threat_summary", "matches", "risk_level", "context_signals", "timestamp"}

def _validate_breach_match(data: dict) -> bool:
    return _BREACH_MATCH_FIELDS.issubset(data.keys())

def _validate_threat_assessment(data: dict) -> bool:
    return _THREAT_ASSESSMENT_FIELDS == set(data.keys())


# ═══════════════════════════════════════════════════════════════════════════════
# NODE 1 — PERCEIVE
# ═══════════════════════════════════════════════════════════════════════════════
async def perceive(state: dict) -> dict:
    loop_count = state.get("loop_count", 0)
    hashed_id = state["hashed_identifier"]

    await _emit("PERCEIVE", "SurveillanceAgent", {"status": "scanning", "loop": loop_count}, state)

    # Hard cap — after 3 empty loops force downstream with risk_score=0 exit
    if loop_count >= 3:
        await _emit("PERCEIVE", "SurveillanceAgent", {
            "status": "max_loops_reached",
            "message": "No breach detected after 3 attempts. Stopping."
        }, state)
        # Return a zero-risk result that will short-circuit at the graph edge
        return {
            "breach_match": {
                "matches": [],
                "risk_score": 0,
                "identifier_queried": hashed_id,
            },
            "loop_count": loop_count + 1,
        }

    errors = list(state.get("errors", []))
    try:
        raw_id = state.get("raw_identifier")
        result = await asyncio.to_thread(query_breach_db, hashed_id, raw_id)
    except Exception as e:
        err_msg = f"[perceive] SurveillanceAgent error: {e}"
        errors.append(err_msg)
        await _emit("ERROR", "SurveillanceAgent", {"error": err_msg}, state)
        return {
            "breach_match": {
                "matches": [],
                "risk_score": 0,
                "identifier_queried": hashed_id,
            },
            "loop_count": loop_count + 1,
            "errors": errors,
        }

    # Defensive: log and strip extra fields, don't crash on unexpected data
    if not _validate_breach_match(result):
        err_msg = "[perceive] BreachMatch schema mismatch"
        errors.append(err_msg)
        await _emit("ERROR", "SurveillanceAgent", {
            "error": err_msg,
            "received_keys": list(result.keys()),
        }, state)
        return {
            "breach_match": {"matches": [], "risk_score": 0, "identifier_queried": hashed_id},
            "loop_count": loop_count + 1,
            "errors": errors,
        }

    # Strip any extra fields and sanitize individual matches
    safe_result = {k: result[k] for k in _BREACH_MATCH_FIELDS}
    
    sanitized_matches = []
    for m in result.get("matches", []):
        # Extract only allowed fields
        sm = {k: m[k] for k in _MATCH_ITEM_FIELDS if k in m}
        
        # Ensure date is ISO-8601 date-time (e.g., 2018-12-01 -> 2018-12-01T00:00:00Z)
        if "date" in sm and len(sm["date"]) == 10:
            sm["date"] = f"{sm['date']}T00:00:00Z"
            
        sanitized_matches.append(sm)
    
    safe_result["matches"] = sanitized_matches

    await _emit("PERCEIVE", "SurveillanceAgent", {
        "status": "complete",
        "risk_score": safe_result["risk_score"],
        "match_count": len(safe_result["matches"]),
        "mode": "REAL",
    }, state)

    return {
        "breach_match": safe_result,
        "loop_count": loop_count + 1,
        "errors": errors,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# NODE 2 — REASON
# ═══════════════════════════════════════════════════════════════════════════════
async def reason(state: dict) -> dict:
    breach_match = state.get("breach_match") or {}
    user_pseudonym = state.get("user_pseudonym", "Unknown")
    matches = breach_match.get("matches", [])  # assign once, use everywhere

    await _emit("REASON", "ContextAgent", {"status": "gathering_context"}, state)

    # Gather MCP context signals
    gmail_sigs    = []
    calendar_sigs = []

    try:
        from agent.api.db import get_gmail_tokens
        tokens = await get_gmail_tokens(user_pseudonym)
        if tokens:
            gmail_sigs    = gmail_signals(user_pseudonym, tokens)
            breach_ts     = matches[0].get("date", datetime.now(timezone.utc).isoformat()) if matches else datetime.now(timezone.utc).isoformat()
            calendar_sigs = calendar_signals(user_pseudonym, breach_ts, tokens)
    except Exception as e:
        err_msg = f"[reason] MCP fetch error: {e}"
        errors = list(state.get("errors", []))
        errors.append(err_msg)
        state["errors"] = errors  # Update local state for subsequent steps
        await _emit("ERROR", "ContextAgent", {"error": err_msg}, state)
        print(f"{err_msg} (non-fatal)")

    context_signals = gmail_sigs + calendar_sigs

    await _emit("REASON", "ContextAgent", {
        "status": "reasoning",
        "context_signal_count": len(context_signals),
    }, state)

    # Build LLM prompt
    matches_summary = "\n".join([
        f"- Source: {m.get('source', 'Unknown')}, Date: {m.get('date', 'Unknown')}, "
        f"Exposed: {', '.join(m.get('exposed_fields', []))}, Confidence: {m.get('confidence', 0)}"
        for m in matches
    ])

    context_block = "\n".join(f"- {s}" for s in context_signals) if context_signals else "- No additional context signals."

    prompt = f"""You are a cybersecurity threat analyst for PhantomID.
A user's identity was analyzed for exposure. Produce a concise, expert threat assessment.

BREACH MATCHES:
{matches_summary}

CONTEXT SIGNALS (from Gmail and Calendar):
{context_block}

OVERALL RISK SCORE: {breach_match['risk_score']}/100
RISK CLASSIFICATION: {breach_match.get('risk_level', 'UNKNOWN')}

Your Task:
1. Identify the specific breach sources and the types of data exposed.
2. Evaluate the severity based on the risk score and context signals.
3. Provide a clear, jargon-free summary for the user.
4. State the risk level (LOW, MEDIUM, HIGH, CRITICAL).

Format your response as exactly two lines:
SUMMARY: <your 1-3 sentence specific explanation and actionable insight>
RISK_LEVEL: <LOW|MEDIUM|HIGH|CRITICAL>

No JSON. No extra text. No bullet points. Two lines only."""

    errors = list(state.get("errors", []))
    try:
        llm = _get_llm()
        response = await asyncio.to_thread(llm.invoke, prompt)
        raw = response.content.strip()
    except Exception as e:
        err_msg = f"[reason] ContextAgent LLM failure: {e}"
        errors.append(err_msg)
        await _emit("ERROR", "ContextAgent", {"error": err_msg}, state)
        raw = f"SUMMARY: Breach detected in {matches[0].get('source', 'unknown source') if matches else 'unknown source'}. Manual review required.\nRISK_LEVEL: HIGH"

    # Parse LLM output
    threat_summary = "Breach detected. Manual review required."
    risk_level = "HIGH"

    for line in raw.splitlines():
        if line.startswith("SUMMARY:"):
            threat_summary = line.replace("SUMMARY:", "").strip()
        elif line.startswith("RISK_LEVEL:"):
            candidate = line.replace("RISK_LEVEL:", "").strip().upper()
            if candidate in ("LOW", "MEDIUM", "HIGH", "CRITICAL"):
                risk_level = candidate

    # Build ThreatAssessment — EXACTLY 6 fields, no more
    threat_assessment = {
        "user_pseudonym": user_pseudonym,
        "threat_summary": threat_summary,
        "matches": matches,
        "risk_level": risk_level,
        "context_signals": context_signals,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    assert _validate_threat_assessment(threat_assessment), (
        f"ThreatAssessment field mismatch: {set(threat_assessment.keys())}"
    )

    await _emit("REASON", "ContextAgent", {
        "status": "complete",
        "risk_level": risk_level,
        "threat_summary": threat_summary,
        "context_signals": context_signals,
    }, state)

    await _emit("REASON", "ReasoningAgent", {"threat_assessment": threat_assessment}, state)
    return {
        "threat_assessment": threat_assessment,
        "loop_count": state.get("loop_count", 0) + 1,
        "errors": errors,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# NODE 3 — ACT
# ═══════════════════════════════════════════════════════════════════════════════
async def act(state: dict) -> dict:
    threat_assessment = state["threat_assessment"]
    phone_number = state.get("phone_number", "")

    await _emit("ACT", "ResponseAgent", {"status": "generating_proof"}, state)

    # Call Person 2
    print(f"[act] Anchoring threat event for pseudonym: {threat_assessment['user_pseudonym']}")
    await _emit("ACT", "EvidenceAgent", {"status": "anchoring", "pseudonym": threat_assessment["user_pseudonym"]}, state)
    
    proof_result = None
    errors = list(state.get("errors", []))
    try:
        proof_result = await asyncio.to_thread(generate_proof, threat_assessment)
        if proof_result:
            print(f"[act] Blockchain anchoring SUCCESS. Hash: {proof_result.get('report_hash')} | Sig: {proof_result.get('solana_tx_sig')[:16]}...")
            await _emit("ACT", "EvidenceAgent", {
                "status": "anchored", 
                "report_hash": proof_result.get("report_hash"),
                "solana_tx_sig": proof_result.get("solana_tx_sig")
            }, state)
    except Exception as e:
        err_msg = f"[act] EvidenceAgent blockchain error: {e}"
        errors.append(err_msg)
        print(f"CRITICAL: {err_msg}")
        import traceback
        traceback.print_exc()
        await _emit("ERROR", "EvidenceAgent", {"error": err_msg}, state)
        # Don't crash — continue to notify user, store None
        proof_result = None

    # Store in Supabase
    try:
        from agent.api.db import store_proof_result
        await store_proof_result(
            user_pseudonym=threat_assessment["user_pseudonym"],
            threat_assessment=threat_assessment,
            proof_result=proof_result,
        )
    except Exception as e:
        err_msg = f"[act] Supabase store error: {e}"
        errors.append(err_msg)
        await _emit("ERROR", "SurveillanceAgent", {"error": err_msg}, state)
        print(f"{err_msg} (non-fatal)")

    # Store in Blockchain Vault SQLite
    try:
        from blockchain.credential_vault.credential_vault import store_proof_result as vault_store
        if proof_result:
            vault_store(threat_assessment["user_pseudonym"], proof_result)
    except Exception as e:
        err_msg = f"[act] Vault store error: {e}"
        errors.append(err_msg)
        await _emit("ERROR", "SurveillanceAgent", {"error": err_msg}, state)
        print(f"{err_msg} (non-fatal)")

    # Send WhatsApp notification (phone is forced to sandbox in whatsapp.py)
    if threat_assessment["matches"]:
        print(f"[act] Found {len(threat_assessment['matches'])} matches. Triggering WhatsApp alert...")
        try:
            from agent.notifications.whatsapp import send_alert
            res = await send_alert(
                phone=phone_number,
                match=threat_assessment["matches"][0],
                risk_level=threat_assessment["risk_level"],
                user_pseudonym=threat_assessment["user_pseudonym"]
            )
            if not res:
                err_msg = "[act] WhatsApp alert failed (check Twilio logs)"
                errors.append(err_msg)
                await _emit("ERROR", "SurveillanceAgent", {"error": err_msg}, state)
            print(f"[act] send_alert returned: {res}")
        except Exception as e:
            err_msg = f"[act] WhatsApp notification error: {e}"
            errors.append(err_msg)
            await _emit("ERROR", "SurveillanceAgent", {"error": err_msg}, state)
            print(f"CRITICAL: {err_msg}")
            import traceback
            traceback.print_exc()

    await _emit("COMPLETE", "EvidenceAgent", {
        "status": "complete",
        "proof_result": proof_result,
        "user_pseudonym": threat_assessment["user_pseudonym"],
        "mode": "MOCK" if globals().get("_ACT_MOCK") else "REAL",
    }, state)

    return {"proof_result": proof_result, "errors": errors}
