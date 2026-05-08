# README — PERSON 2 · Blockchain + Proof Layer
> **PhantomID · 48-Hour Hackathon · Solana + IPFS + Verifiable Credentials**

---

## ROLE

You are the **Proof Layer**. You own everything that happens after a threat is confirmed:
generating the immutable evidence record, anchoring it on-chain, issuing a W3C Verifiable
Credential, and exposing a vault API for the frontend to read.

You are the **last node** in the agent pipeline before the user is notified.
Your output is what makes PhantomID legally credible and demo-worthy.
A Solana transaction confirming on Explorer in real time is a physical wow moment.

---

## OWNERSHIP — FILES YOU MAY TOUCH

```
blockchain/
├── anchor_contract/    ← Rust + Anchor smart contract (devnet only)
├── proof_service/      ← Python service exposing generate_proof()
├── vc_issuer/          ← W3C Verifiable Credential generation (@digitalbazaar/vc)
├── credential_vault/   ← API endpoint returning VC list for a user
└── tests/              ← your unit and integration tests
```

**You may also read (but NOT modify):**
- `contracts/threat_assessment.schema.json` — your input schema (LAW)
- `contracts/proof_result.schema.json` — your output schema (LAW)
- `contracts/mock/threat_assessment.mock.json` — use this in all your tests
- `contracts/mock/proof_result.mock.json` — use this to verify your output format

---

## FORBIDDEN AREAS — DO NOT TOUCH THESE

```
intelligence/   ← Person 1 owns this entirely
agent/          ← Person 3 owns this entirely
contracts/      ← READ-ONLY for you. No modifications without team consensus.
```

If you find yourself editing anything outside `blockchain/`, **stop immediately**.

---

## YOUR ONE DELIVERABLE

You expose exactly **one function**. This is the integration contract between you
and Person 3. It must match this signature exactly — no exceptions.

```python
def generate_proof(threat_assessment: dict) -> dict:
    """
    Generate immutable proof for a confirmed threat.

    Args:
        threat_assessment: A dict matching contracts/threat_assessment.schema.json.
                           Validated by caller. You may trust its structure.

    Returns:
        A dict matching contracts/proof_result.schema.json exactly.

    Raises:
        Exception if any step fails (IPFS upload, Solana tx, VC issuance).
        NEVER return partial data. All-or-nothing.
    """
```

### Input Schema (READ-ONLY — consume but never modify)

```json
{
  "user_pseudonym": "string",     // SHA-256 of user_id — NEVER raw PII
  "threat_summary": "string",     // 1–3 sentence LLM summary
  "matches": [/* BreachMatch[] */],
  "risk_level": "LOW|MEDIUM|HIGH|CRITICAL",
  "context_signals": ["string"],
  "timestamp": "ISO-8601 string"
}
```

### Return Schema (FROZEN — DO NOT MODIFY)

```json
{
  "ipfs_cid": "string",           // CID returned by Pinata after upload
  "solana_tx_sig": "string",      // devnet transaction signature
  "vc_json": { },                 // full W3C VC object (see VC section below)
  "report_hash": "string",        // SHA-256 hex of the uploaded JSON report
  "generated_at": "ISO-8601 string"
}
```

**DO NOT ADD FIELDS. DO NOT RENAME FIELDS. DO NOT CHANGE TYPES.**

---

## ANCHOR SMART CONTRACT — SPECIFICATION

The contract has **exactly ONE instruction**. Do not add more.

```
Instruction: record_threat_event

Fields:
  user_pseudonym: [u8; 32]    // raw bytes of SHA-256 hash
  report_cid:     String      // IPFS CID string (max 64 chars)
  report_hash:    [u8; 32]    // raw bytes of SHA-256 hash of report JSON
  threat_level:   u8          // 0=LOW, 1=MEDIUM, 2=HIGH, 3=CRITICAL
  timestamp:      i64         // Unix timestamp (seconds)
```

**DO NOT add new instructions. DO NOT add new fields to this instruction.**
The contract is purposeful and minimal. Judges respect simplicity with clear intent.

Deploy to **Solana devnet only**. Never mainnet.

---

## W3C VERIFIABLE CREDENTIAL — SPECIFICATION

The VC must contain these fields. Use `@digitalbazaar/vc` for issuance.

```json
{
  "@context": ["https://www.w3.org/2018/credentials/v1"],
  "type": ["VerifiableCredential", "IdentityThreatCredential"],
  "issuer": "did:key:<your-agent-keypair-DID>",
  "issuanceDate": "ISO-8601",
  "credentialSubject": {
    "id": "did:phantom:<user_pseudonym>",
    "threatDetected": true,
    "evidenceCid": "<ipfs_cid>",
    "onChainTx": "<solana_tx_sig>",
    "riskLevel": "HIGH|CRITICAL|MEDIUM|LOW",
    "detectionTimestamp": "ISO-8601"
  },
  "proof": { /* cryptographic signature from @digitalbazaar/vc */ }
}
```

The `vc_json` field in ProofResult must be this full object — not a string, not a URL.

---

## TECH STACK — NO DEVIATIONS

| Component | Library/Tool |
|---|---|
| Smart contract | Rust + Anchor |
| Deployment target | Solana **devnet** (NEVER mainnet) |
| IPFS upload | Pinata SDK |
| Verifiable Credentials | `@digitalbazaar/vc` |
| Solana client | `@solana/web3.js` |
| Proof service language | Python |
| VC issuance language | Node.js (called from Python via subprocess or kept separate) |

Do **not** switch to a different blockchain.
Do **not** use Arweave instead of IPFS.
Do **not** use a custom VC format — W3C spec only.

---

## CONTRACT RULES

- `DO NOT MODIFY CONTRACTS WITHOUT TEAM CONSENSUS.`
- `generate_proof()` is **all-or-nothing** — if any step fails, raise an exception. Never return a dict with missing fields.
- `report_hash` is the SHA-256 of the **uploaded JSON bytes**, not the ThreatAssessment.
- `solana_tx_sig` must be a confirmed transaction — poll for confirmation before returning.
- `user_pseudonym` is **always a hash** — never store or log raw user IDs.
- `threat_level` in the contract maps to: LOW=0, MEDIUM=1, HIGH=2, CRITICAL=3.

---

## AI AGENT RULES

> These rules apply to any AI coding agent (Claude, GPT, Cursor, etc.) you use.
> Paste this section into your agent's system prompt or context window.

```
HARD RULES — BLOCKCHAIN LAYER:

1. NEVER add fields to the ProofResult return schema beyond:
   ipfs_cid, solana_tx_sig, vc_json, report_hash, generated_at.

2. NEVER rename any field. "ipfs_cid" stays "ipfs_cid". No exceptions.

3. NEVER deploy to Solana mainnet. Devnet only.

4. NEVER add new instructions to the Anchor contract. One instruction only:
   record_threat_event.

5. NEVER import from agent/ or intelligence/ directories.

6. NEVER return a partial ProofResult. If IPFS upload fails, raise an exception.
   If Solana tx fails, raise an exception. Never return with empty fields.

7. NEVER store or log raw user PII. user_pseudonym is always a SHA-256 hash.

8. ALWAYS validate your return dict against contracts/proof_result.schema.json
   before considering a function complete.

9. ALWAYS use contracts/mock/threat_assessment.mock.json as your test input.

10. ALWAYS poll Solana for transaction confirmation before returning solana_tx_sig.

11. If you are uncertain about a schema field name or type, STOP.
    Do not guess. Check the contracts/ folder.
```

---

## GIT RULES

- Work exclusively in the `blockchain/` directory.
- Branch name: `feat/blockchain-layer`
- Commit frequently — at minimum after each milestone below.
- Do **not** commit to `main` — Person 3 owns the integration merge.
- Do **not** commit anything to `agent/`, `intelligence/`, or `contracts/`.
- Do **not** commit wallet private keys or Pinata API keys — use `.env` only.

---

## TESTING RESPONSIBILITIES

Before each team sync checkpoint, your tests must verify:

- [ ] `generate_proof()` accepts a valid ThreatAssessment and returns a valid ProofResult
- [ ] Return dict passes JSON schema validation against `contracts/proof_result.schema.json`
- [ ] Pinata upload succeeds and returned CID resolves to the correct JSON
- [ ] Solana tx appears on devnet Explorer within 30 seconds
- [ ] `report_hash` matches SHA-256 of the uploaded JSON bytes
- [ ] W3C VC passes `@digitalbazaar/vc` verification
- [ ] Credential vault endpoint returns correct VC list for a given `user_pseudonym`
- [ ] `generate_proof()` raises an exception (not returns partial data) on Pinata failure
- [ ] `generate_proof()` raises an exception on Solana tx failure

---

## INTEGRATION CHECKPOINTS

| Time | You must deliver |
|---|---|
| Hour 8 | Anchor contract deployed to devnet. `generate_proof()` stub returns mock ProofResult. |
| Hour 24 | **SYNC WITH TEAM** — Person 3 calls your function live with a real ThreatAssessment. Solana tx must appear on Explorer. |
| Hour 36 | **FULL END-TO-END** — VC card visible in frontend. IPFS link resolves. Solana link resolves. |
| Hour 44 | Freeze. Devnet funded. 5 test runs completed without failure. |

---

## DEFINITION OF DONE

You are done when **all of the following are true**:

- [ ] `generate_proof()` accepts valid ThreatAssessment and returns valid ProofResult
- [ ] Solana devnet transaction appears on Explorer within 30 seconds
- [ ] IPFS link (via Pinata) opens the correct full JSON report
- [ ] W3C VC passes cryptographic verification via `@digitalbazaar/vc`
- [ ] Credential vault endpoint returns correct VCs for a `user_pseudonym`
- [ ] All tests in `blockchain/tests/` pass
- [ ] Person 3 successfully called your function and displayed the VC in the frontend
  (confirmed at Hour 24 sync)
- [ ] End-to-end: `generate_proof()` → Pinata → Solana → VC → vault runs 5 times without error

---

*Contracts are LAW. Boundaries are enforced. If in doubt, sync with the team.*
