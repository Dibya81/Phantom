# README — PERSON 1 · Intelligence Layer
> **PhantomID · 48-Hour Hackathon · RAG + SurveillanceAgent**

---

## ROLE

You are the **Intelligence Layer**. You own everything related to detecting threats:
breach data ingestion, the RAG query pipeline, the live Telegram monitor, and the
LLM reasoning chain that converts raw breach signals into a structured risk assessment.

You are the **first node** in the entire system. Nothing downstream works until your
function returns valid data. Your job is to make detections feel real and trustworthy.

---

## OWNERSHIP — FILES YOU MAY TOUCH

```
intelligence/
├── ingest/        ← all data ingestion scripts (breach datasets, CERT-In scraper)
├── rag/           ← LlamaIndex pipeline, pgvector config, embedding logic
├── monitor/       ← Telethon Telegram channel monitor
├── reasoning/     ← LLM prompts and reasoning chain
└── tests/         ← your unit and integration tests
```

**You may also read (but NOT modify):**
- `contracts/breach_match.schema.json` — your output schema (LAW)
- `contracts/mock/breach_match.mock.json` — use this in all your tests

---

## FORBIDDEN AREAS — DO NOT TOUCH THESE

```
agent/          ← Person 3 owns this entirely
blockchain/     ← Person 2 owns this entirely
contracts/      ← READ-ONLY for you. No modifications without team consensus.
```

If you find yourself editing anything outside `intelligence/`, **stop immediately**.

---

## YOUR ONE DELIVERABLE

You expose exactly **one function**. This is the integration contract between you
and Person 3. It must match this signature exactly — no exceptions.

```python
def query_breach_db(hashed_identifier: str) -> dict:
    """
    Query the breach vector store for a given identifier.

    Args:
        hashed_identifier: SHA-256 hex digest of the raw identifier (email/phone/PAN prefix).
                           NEVER accept raw PII as input.

    Returns:
        A dict matching contracts/breach_match.schema.json exactly.
    """
```

### Return Schema (FROZEN — DO NOT MODIFY)

```json
{
  "matches": [
    {
      "source": "string",          // e.g. "MobiKwik_2021"
      "date": "ISO-8601 string",   // e.g. "2021-03-01"
      "exposed_fields": ["string"],// e.g. ["email", "phone", "password_hash"]
      "confidence": 0.95,          // float 0.0–1.0
      "raw_preview": "string"      // max 100 chars, no raw PII, truncated/masked
    }
  ],
  "risk_score": 82,                // integer 0–100
  "identifier_queried": "string"   // echo back the hashed_identifier input
}
```

**DO NOT ADD FIELDS. DO NOT RENAME FIELDS. DO NOT CHANGE TYPES.**

---

## TECH STACK — NO DEVIATIONS

| Component | Library/Tool |
|---|---|
| RAG orchestration | LlamaIndex |
| Vector store | pgvector on Supabase |
| Embeddings | sentence-transformers |
| Telegram monitor | Telethon |
| LLM inference | Groq API |
| Language | Python 3.11+ |

Do **not** introduce new dependencies without team approval.
Do **not** switch to a different vector DB.
Do **not** swap sentence-transformers for a different embedding model mid-hackathon.

---

## CONTRACT RULES

- `DO NOT MODIFY CONTRACTS WITHOUT TEAM CONSENSUS.`
- Field names are **snake_case** — never camelCase, never PascalCase.
- `date` is always an **ISO-8601 string** — never a Unix timestamp.
- `risk_score` is an **integer** — never a float.
- `confidence` is a **float** — never a string like "high".
- `exposed_fields` is always a **list of strings** — never a comma-separated string.
- `raw_preview` must **never contain raw PII** — mask or truncate before storing.

---

## DATA INGESTION RESPONSIBILITIES (Pre-Hackathon)

You must have the following datasets ingested and queryable **before Hour 0**:

1. HaveIBeenPwned downloadable password corpus
2. COMB (Collection of Many Breaches) — partial sample minimum
3. CoWIN leak dataset (publicly documented)
4. MobiKwik 2021 (21M records, documented)
5. Domino's India 2021 (180M orders, documented)
6. CERT-In public breach advisories
7. 10–15 Telegram channel archives (pulled via Telethon pre-hackathon)

**A judge who types their own email and sees a real breach hit is a judge who believes in the product.**

---

## TELEGRAM MONITOR RULES

- Poll pre-joined channels every **5 minutes** — not faster, not slower.
- Extract candidate strings (emails, phone patterns, PAN patterns).
- Hash candidates and compare against user registry in Supabase.
- On match: fire an event that the LangGraph `perceive` node can consume.
- Do **not** store raw channel content — store only hashes and metadata.

---

## REASONING LAYER

The LLM reasoning chain converts raw breach `matches[]` into a human-readable
`threat_summary`. This summary is included in the `ThreatAssessment` that Person 3
builds. Your reasoning prompt must produce:

- A 1–3 sentence plain-English summary of the threat
- A `risk_score` integer (0–100)
- Nothing else — no JSON wrapping, no extra fields

Example output your reasoning chain should produce:
> "User's email appeared in the MobiKwik 2021 breach 14 days ago alongside
> phone number and password hash. A matching phone number also surfaced in a
> Telegram dump 3 days ago. Likely active exploitation window. Risk: Critical."

---

## AI AGENT RULES

> These rules apply to any AI coding agent (Claude, GPT, Cursor, etc.) you use.
> Paste this section into your agent's system prompt or context window.

```
HARD RULES — INTELLIGENCE LAYER:

1. NEVER add fields to the BreachMatch return schema that are not in
   contracts/breach_match.schema.json.

2. NEVER rename any field. "exposed_fields" stays "exposed_fields".
   "risk_score" stays "risk_score". No exceptions.

3. NEVER create a REST API or HTTP server. Your deliverable is a
   Python function, not an endpoint.

4. NEVER import from agent/ or blockchain/ directories.

5. NEVER accept raw PII as function input. Always hash first.

6. NEVER store raw PII in pgvector or Supabase. Hash or truncate everything.

7. NEVER return a risk_score as a float. It must be an integer.

8. ALWAYS validate your return dict against contracts/breach_match.schema.json
   before considering a function complete.

9. ALWAYS use contracts/mock/breach_match.mock.json as your test fixture.

10. If you are uncertain about a schema field name or type, STOP.
    Do not guess. Check the contracts/ folder.
```

---

## GIT RULES

- Work exclusively in the `intelligence/` directory.
- Branch name: `feat/intelligence-layer`
- Commit frequently — at minimum after each milestone below.
- Do **not** commit to `main` — Person 3 owns the integration merge.
- Do **not** commit anything to `agent/`, `blockchain/`, or `contracts/`.

---

## TESTING RESPONSIBILITIES

Before each team sync checkpoint, your tests must verify:

- [ ] `query_breach_db()` returns a valid dict for 5 pre-seeded test identifiers
- [ ] Return dict passes JSON schema validation against `contracts/breach_match.schema.json`
- [ ] `risk_score` is an integer between 0 and 100
- [ ] `confidence` values are floats between 0.0 and 1.0
- [ ] `raw_preview` contains no raw email, phone, or PAN data
- [ ] Telegram monitor fires a detection event for a seeded channel message
- [ ] Reasoning chain produces a `threat_summary` string (no JSON, no extra fields)

---

## INTEGRATION CHECKPOINTS

| Time | You must deliver |
|---|---|
| Hour 8 | `query_breach_db()` stub that returns valid mock data from `contracts/mock/` |
| Hour 12 | **SYNC WITH TEAM** — Person 3 calls your function live. Schema must match. |
| Hour 36 | **FULL END-TO-END** — your detection triggers the full agent pipeline |
| Hour 44 | Freeze. Demo accounts seeded. 5 test identifiers confirmed working. |

---

## DEFINITION OF DONE

You are done when **all of the following are true**:

- [ ] `query_breach_db()` returns valid BreachMatch JSON for 5 seeded test identifiers
- [ ] Telegram monitor polls every 5 minutes and fires correctly on match
- [ ] LLM reasoning chain produces a `threat_summary` string and `risk_score`
- [ ] All tests in `intelligence/tests/` pass
- [ ] Return schema validated against `contracts/breach_match.schema.json`
- [ ] Person 3 successfully called your function from their LangGraph `perceive` node
  (confirmed at Hour 12 sync)
- [ ] At least one live demo account triggers a real detection from ingested data

---

*Contracts are LAW. Boundaries are enforced. If in doubt, sync with the team.*
