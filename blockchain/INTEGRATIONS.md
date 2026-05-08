# Person 2 — Blockchain & Proof Layer Integrations

This document serves as the **Integration Guide** for Person 3 (Agent / Frontend Layer) to consume the Blockchain components.

Person 2 does **not** directly integrate with Person 1. The data flow is strictly:
`Person 1 (Intelligence)  ➔  Person 3 (Agent)  ➔  Person 2 (Blockchain/Proof)  ➔  Person 3 (Vault/Frontend)`

---

## 1. The `act` Node Integration (Python)

When the LangGraph `reason` node produces a `ThreatAssessment` with a risk level of `HIGH` or `CRITICAL`, the `act` node must invoke the proof generation pipeline.

### Import
Person 3 must import the entry point from the `blockchain` package:
```python
# In agent/graph/act_node.py (or similar)
from blockchain.proof_service import generate_proof
# Or if you need the mock for Hour 8 checkpoint:
from blockchain.proof_service.proof_service_stub import generate_proof_stub
```

### Execution & Storage
The `generate_proof` function expects a Python dictionary that strictly matches `contracts/threat_assessment.schema.json`.

```python
from blockchain.credential_vault import store_proof_result

def act_node(state):
    threat_assessment = state["threat_assessment"]
    
    # 1. Generate the immutable proof (Pinata IPFS -> Solana -> W3C VC)
    # WARNING: This makes real network calls and takes ~5-20 seconds.
    proof_result = generate_proof(threat_assessment)
    
    # 2. Store the resulting credential in the Vault Database
    user_pseudonym = threat_assessment["user_pseudonym"]
    store_proof_result(user_pseudonym, proof_result)
    
    # 3. Proceed to WhatsApp notification
    # ...
```
*Note: `generate_proof()` is an all-or-nothing synchronous function. If Pinata or Solana fails, it will raise an exception. Person 3 must catch errors and emit an `ERROR` WebSocketEvent to the frontend.*

---

## 2. Credential Vault API (Frontend Integration)

Person 3's FastAPI backend needs to serve the Verifiable Credentials to the React frontend. Person 2 provides a pre-built FastAPI application in `blockchain/credential_vault/credential_vault.py`.

### Option A: Mount as Sub-application
Person 3 can mount the Person 2 Vault FastAPI app directly into the main Agent FastAPI app:

```python
# In agent/api/main.py
from fastapi import FastAPI
from blockchain.credential_vault import app as vault_app

app = FastAPI(title="PhantomID Main API")

# Mount Person 2's endpoints under /vault
app.mount("/vault", vault_app)

# The frontend can now call: GET /vault/credentials?user_pseudonym=<hash>
```

### Option B: Call Programmatically
If Person 3 prefers to expose their own exactly specified `/credentials` route, they can query the Vault database directly using the provided helper:

```python
# In agent/api/main.py
from fastapi import FastAPI, HTTPException
from blockchain.credential_vault import get_proof_results

app = FastAPI()

@app.get("/credentials")
async def get_credentials_route(user_pseudonym: str):
    if len(user_pseudonym) != 64:
        raise HTTPException(status_code=400, detail="Invalid pseudonym")
    
    # Returns a list of ProofResult dicts
    return get_proof_results(user_pseudonym)
```

---

## 3. Mock Data / Pre-Integration Usage

For the **Hour 8 Sync** and early frontend development, Person 3 should use the mock payloads to avoid hitting rate limits or waiting for real Solana Devnet block confirmations.

1. **For the Agent Graph**: Use `generate_proof_stub(threat_assessment)` which instantaneously returns the mock dictionary from `contracts/mock/proof_result.mock.json`.
2. **For the Frontend**: Manually seed the SQLite vault database using the programatic helper:
   ```python
   import json
   from blockchain.credential_vault import store_proof_result
   
   with open("contracts/mock/proof_result.mock.json") as f:
       mock_pr = json.load(f)
       
   store_proof_result("a3f5c2d1e4b6789012345678abcdef0123456789abcdef0123456789abcdef01", mock_pr)
   ```

---

## 4. Required Environment Variables

When running the full stack, Person 3's environment (or `.env` file) MUST contain Person 2's keys. See `.env.example` in the root.

```ini
# Required for generate_proof()
PINATA_JWT=your_pinata_jwt_here
ANCHOR_PROGRAM_ID=your_deployed_solana_program_id

# Optional configurations
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_WALLET_PATH=~/.config/solana/id.json
CREDENTIAL_VAULT_DB=blockchain/credential_vault/vault.db
PHANTOMID_ISSUER_KEY_PATH=blockchain/vc_issuer/issuer_key.json
```
