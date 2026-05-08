# README — PERSON 3 · Agent + Frontend Layer
> **PhantomID · 48-Hour Hackathon · LangGraph + FastAPI + React**

---

## ROLE

You are the **Agent Layer**. You own the LangGraph orchestration, the FastAPI backend,
the MCP integrations (Gmail, Calendar), the React frontend, and WhatsApp notifications.

You are the **integration hub** of the entire system. You consume Person 1's
`query_breach_db()` and Person 2's `generate_proof()`. You are responsible for
the experience the user and the judges actually see. A real-time agent trace
streaming on screen while a WhatsApp message arrives on a live phone is the demo.

You own everything the user touches. Make it feel like magic.

---

## OWNERSHIP — FILES YOU MAY TOUCH

```
agent/
├── graph/           ← LangGraph node definitions and conditional edges
├── api/             ← FastAPI endpoints, WebSocket, Celery tasks
├── mcp/             ← Gmail MCP and Calendar MCP wiring
├── frontend/        ← React + Vite + Tailwind (3 screens — no more)
├── notifications/   ← WhatsApp Cloud API sender
└── tests/           ← your integration and end-to-end tests
```

**You may also read (but NOT modify):**
- `contracts/breach_match.schema.json` — Person 1's output (your perceive node input)
- `contracts/threat_assessment.schema.json` — your reason node output (Person 2's input)
- `contracts/proof_result.schema.json` — Person 2's output (your act node input)
- `contracts/websocket_event.schema.json` — what you emit to the frontend
- `contracts/mock/` — all mock files for testing before real integrations are ready

---

## FORBIDDEN AREAS — DO NOT TOUCH THESE

```
intelligence/   ← Person 1 owns this entirely
blockchain/     ← Person 2 owns this entirely
contracts/      ← READ-ONLY for you. No modifications without team consensus.
```

You **call** Person 1 and Person 2's functions. You do **not** modify their code.
If their function returns unexpected data, you handle it defensively — you do not
go into their directory and "fix" it yourself.

---

## THE LANGGRAPH AGENT — FIXED STRUCTURE

The agent graph has **exactly 3 nodes**. Do not add nodes. Do not rename nodes.

```
perceive  →  reason  →  act
```

### Node Definitions

**perceive**
- Calls `query_breach_db(hashed_identifier)` from Person 1
- Input: registered user identifiers (from Supabase)
- Output: `BreachMatch` dict (contracts/breach_match.schema.json)
- If `risk_score == 0` or `matches` is empty: loop back (sleep, then perceive again)
- If `risk_score > 0`: proceed to `reason`

**reason**
- LLM call with raw breach matches + MCP context signals
- Reads Gmail MCP for security alert emails ("new sign-in", "suspicious activity")
- Reads Calendar MCP to flag anomalies (e.g. login while user was in meetings abroad)
- Produces a `ThreatAssessment` dict (contracts/threat_assessment.schema.json)
- If `risk_level` is `LOW` or `MEDIUM`: loop back (log and sleep)
- If `risk_level` is `HIGH` or `CRITICAL`: proceed to `act`

**act**
- Calls `generate_proof(threat_assessment)` from Person 2
- Receives `ProofResult` dict (contracts/proof_result.schema.json)
- Stores ProofResult in Supabase against the user record
- Sends WhatsApp notification
- Emits `COMPLETE` WebSocketEvent to frontend
- Ends current cycle

### Conditional Edges (FIXED)

```python
perceive → reason     : if risk_score > 0
perceive → perceive   : if risk_score == 0  (loop/sleep)
reason   → act        : if risk_level in ["HIGH", "CRITICAL"]
reason   → perceive   : if risk_level in ["LOW", "MEDIUM"]  (log and loop)
act      → END        : always
```

**Do not add new edges. Do not add new conditions.**

---

## API ENDPOINTS — FIXED SURFACE

These are the only 5 endpoints. Do not invent new ones.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/register` | User onboarding — hash PII, store in Supabase, return user token |
| `POST` | `/connect-gmail` | Gmail MCP OAuth flow — store credentials for MCP context reads |
| `GET` | `/threats` | Return full threat history for authenticated user |
| `GET` | `/credentials` | Proxy to blockchain/ credential vault — return VC list |
| `WS` | `/ws/agent` | Stream `WebSocketEvent` objects to frontend during agent execution |

**DO NOT add endpoints.** Not for settings. Not for analytics. Not for health checks.
Not for anything not on this list.

### WebSocket Event Schema (FROZEN)

```json
{
  "event": "PERCEIVE|REASON|ACT|COMPLETE|ERROR",
  "node": "SurveillanceAgent|ContextAgent|ResponseAgent|EvidenceAgent",
  "payload": { },
  "timestamp": "ISO-8601 string"
}
```

Emit one event per node transition. Emit `COMPLETE` when `act` finishes.
Emit `ERROR` with the error message in `payload` if any node fails.

---

## THE THREAT ASSESSMENT — YOUR OUTPUT TO PERSON 2

This is what your `reason` node must produce. Pass it directly to `generate_proof()`.

```json
{
  "user_pseudonym": "string",     // SHA-256 of internal user_id — NEVER raw PII
  "threat_summary": "string",     // 1–3 sentence LLM-generated summary
  "matches": [ ],                 // pass through from BreachMatch.matches[]
  "risk_level": "HIGH",           // one of: LOW, MEDIUM, HIGH, CRITICAL
  "context_signals": ["string"],  // e.g. ["Gmail security alert 3 days ago"]
  "timestamp": "ISO-8601 string"  // current UTC time
}
```

**DO NOT add fields. DO NOT rename fields.**

---

## FRONTEND — 3 SCREENS, NO MORE

### Screen 1 — Onboard
- Three input fields: email, phone number, PAN prefix
- "Connect Gmail" button (triggers `/connect-gmail` OAuth)
- "Activate Agent" button (triggers `/register` then starts agent loop)
- Clean, minimal. Should take 30 seconds to complete.
- No login wall. No password. No account creation flow.

### Screen 2 — Live Agent View (HERO SCREEN)
- Real-time LangGraph trace via WebSocket
- Each node (perceive → reason → act) lights up as it executes
- Reasoning text streams in as the LLM generates it
- Threat level indicator updates in real time
- Timeline of past threat events below the live trace
- **This is what the judges stare at. Make it feel like a security operations centre.**

### Screen 3 — Credential Vault
- One card per issued Verifiable Credential
- Each card: threat type, date detected, risk level, IPFS link, Solana Explorer link,
  "Download PDF" button
- Clean and credible. Should look like something you'd send to a bank or lawyer.

**Do not build a fourth screen.** No settings. No profile. No admin panel.

---

## WHATSAPP NOTIFICATION — EXACT FORMAT

When the `act` node completes, send this message to the registered phone number:

```
⚠️ PhantomID Alert

Your data was found in a breach.

Source: {source from matches[0]}
Exposed: {exposed_fields joined with ", "}
Risk Level: {risk_level}

I've generated your proof certificate.
View it here: https://phantomid.app/credentials/{user_pseudonym}

You did nothing. I handled it.
```

Test this with a real phone during development. Hearing a WhatsApp notification
arrive during the demo is a physical wow moment. Do not cut this feature.

---

## MCP INTEGRATION RULES

Gmail MCP reads:
- Email subjects/senders matching: "sign-in", "suspicious", "password changed",
  "new device", "security alert", "unauthorized"
- Pass these as `context_signals[]` to the `reason` node
- Do **not** read email body content beyond subject and sender

Calendar MCP reads:
- User's location/status during detected breach window
- Flag if breach timestamp aligns with "out of office", travel, or sleeping hours
- Pass flagged anomalies as additional `context_signals[]`

**Never store raw Gmail or Calendar content.** Extract signal strings only.

---

## AI AGENT RULES

> These rules apply to any AI coding agent (Claude, GPT, Cursor, etc.) you use.
> Paste this section into your agent's system prompt or context window.

```
HARD RULES — AGENT LAYER:

1. NEVER invent new API endpoints beyond the 5 listed in this README.

2. NEVER modify the LangGraph graph structure. 3 nodes only: perceive, reason, act.
   No new nodes. No renamed nodes. No new edges beyond those specified.

3. NEVER import from intelligence/ or blockchain/ directories directly.
   Call their Python functions via import — do not copy their code.

4. NEVER store raw PII. Hash user identifiers before writing to Supabase.

5. NEVER push updates to the frontend through any mechanism other than
   the /ws/agent WebSocket endpoint.

6. ALWAYS emit WebSocketEvent objects that exactly match
   contracts/websocket_event.schema.json.

7. ALWAYS produce ThreatAssessment objects that match
   contracts/threat_assessment.schema.json before calling generate_proof().

8. ALWAYS use contracts/mock/ files for unit tests before real integrations
   are available (before Hour 12 and Hour 24 syncs).

9. If Person 1's function returns extra fields not in the contract, LOG
   and ignore them — do not break, do not pass them downstream.

10. If Person 2's generate_proof() raises an exception, emit a WebSocketEvent
    with event=ERROR. Do not crash the agent loop.

11. NEVER build a 4th frontend screen.

12. NEVER add fields to ThreatAssessment beyond the 6 specified.
    "user_pseudonym", "threat_summary", "matches", "risk_level",
    "context_signals", "timestamp" — these six and no others.

13. If you are uncertain about a schema field name or type, STOP.
    Do not guess. Check the contracts/ folder.
```

---

## GIT RULES

- Work exclusively in the `agent/` directory.
- Branch name: `feat/agent-layer`
- You own the integration merge — you pull from Person 1 and Person 2's branches
  at the Hour 12 and Hour 24 sync checkpoints respectively.
- Do **not** commit to `intelligence/` or `blockchain/`.
- Do **not** commit API keys, OAuth secrets, or WhatsApp tokens — use `.env` only.

---

## TESTING RESPONSIBILITIES

Before each team sync checkpoint, your tests must verify:

- [ ] `perceive` node calls `query_breach_db()` with a hashed identifier (not raw PII)
- [ ] `perceive` node returns correctly on empty matches (no crash, loops back)
- [ ] `reason` node produces a valid ThreatAssessment matching contracts schema
- [ ] `act` node calls `generate_proof()` with the correct ThreatAssessment
- [ ] WebSocket emits correctly structured events for each node transition
- [ ] All 5 API endpoints return correct HTTP status codes and response shapes
- [ ] WhatsApp notification is sent when `act` completes
- [ ] Frontend Screen 2 receives and renders WebSocket events in real time
- [ ] Frontend Screen 3 displays VC cards with working IPFS and Solana links
- [ ] Full pipeline runs end-to-end without crash for 3 consecutive test accounts

---

## INTEGRATION CHECKPOINTS

| Time | You must deliver |
|---|---|
| Hour 8 | LangGraph 3-node graph scaffolded. `/register` endpoint working. React shell with 3 screen routes. Mock WebSocket emitting events. |
| Hour 12 | **SYNC WITH TEAM** — wire Person 1's `query_breach_db()` into perceive node. Run live call. Verify BreachMatch schema. |
| Hour 24 | **SYNC WITH TEAM** — wire Person 2's `generate_proof()` into act node. Run live call. Verify ProofResult. Solana tx on Explorer. |
| Hour 36 | **FULL END-TO-END** — onboard test account → activate → full pipeline → WhatsApp arrives → VC in vault. |
| Hour 44 | Freeze. 3 consecutive clean demo runs. Backup video recorded. |

---

## DEFINITION OF DONE

You are done when **all of the following are true**:

- [ ] Full agent loop (perceive → reason → act) runs without crash for 3 test accounts
- [ ] WebSocket streams live node events — frontend lights up correctly on Screen 2
- [ ] WhatsApp notification arrives on a real phone within 60 seconds of threat detection
- [ ] Screen 3 shows VC cards with working IPFS and Solana Explorer links
- [ ] All 5 API endpoints respond with correct schemas
- [ ] MCP context signals from Gmail appear in the ThreatAssessment `context_signals[]`
- [ ] All tests in `agent/tests/` pass
- [ ] Demo flow runs end-to-end: onboard → activate → perceive → reason → act → notify → VC visible
  in under 90 seconds, without manual intervention after "Activate Agent" is clicked

---

*Contracts are LAW. Boundaries are enforced. If in doubt, sync with the team.*
