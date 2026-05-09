# Backend Fixes & Improvements — PhantomID

This document outlines the identified technical debt, critical bugs, and architectural improvements needed for the PhantomID backend.

## 1. CRITICAL: Async Safety in Blockchain Layer
- **Issue**: `blockchain/proof_service/proof_service.py` uses `asyncio.run()` inside `_record_on_chain`. Since the agent graph runs within the FastAPI event loop, this will trigger `RuntimeError: asyncio.run() cannot be called from a running event loop`.
- **Impact**: The "ACT" node will crash whenever it attempts to record a threat on Solana devnet.
- **Fix**: 
    - Convert `generate_proof` and all internal helpers (`_record_on_chain`, `_upload_to_pinata`, etc.) to `async def`.
    - Replace `asyncio.run(_send())` with `await _send()`.
    - In `agent/graph/nodes.py`, change `asyncio.to_thread(generate_proof, ...)` to `await generate_proof(...)`.

## 2. Architecture: Single Source of Truth for Data
- **Issue**: The system maintains two separate databases: Supabase (`agent/api/db.py`) for user/threat metadata and SQLite (`blockchain/credential_vault/vault.db`) for Verifiable Credentials. The main API (`/credentials` route) currently only reads from Supabase.
- **Impact**: If a VC is successfully issued but the Supabase update fails, the user will see an empty vault despite having on-chain proofs.
- **Fix**:
    - **Recommended**: Migrate the Credential Vault table to Supabase to unify the state.
    - **Interim**: Update `agent/api/routes.py` to query both Supabase and the local Vault API (via `blockchain.credential_vault.get_proof_results`) and merge the results.

## 3. Intelligence: Vector Search vs. Exact Match
- **Issue**: `intelligence/rag/query.py` performs vector similarity searches on SHA-256 hash strings (`query_text = f"Hash: {hashed_identifier}"`). 
- **Impact**: Inefficient. It loads a 384-dimensional embedding model to represent a non-semantic hex string, then retrieves 10 "similar" nodes only to filter for an exact match.
- **Fix**:
    - Use LlamaIndex/pgvector **metadata filtering**.
    - Change `query_breach_db` to use a filter: `where metadata->>'hashed_identifier' = :id`.
    - This eliminates the need for embedding the query hash and ensures 100% precision.

## 4. Agent: Persistence & Resumption
- **Issue**: `run_agent` is started as a fire-and-forget `asyncio.create_task`. 
- **Impact**: If the server restarts during the 20-30 second Solana/IPFS pipeline, the agent dies, the proof is lost, and the user receives no notification.
- **Fix**:
    - Add an `agent_status` column to the `users` table.
    - On server `startup`, query for users with pending statuses and re-trigger the `run_agent` loop.

## 5. Security: Environment Validation
- **Issue**: Broad `RuntimeError` exceptions when env vars like `PINATA_JWT` or `ANCHOR_PROGRAM_ID` are missing.
- **Impact**: Hard to debug in production environments like Render or Docker.
- **Fix**:
    - Add a `validate_env()` function in `agent/api/main.py`.
    - Check for: `SUPABASE_URL`, `SUPABASE_KEY`, `GROQ_API_KEY`, `PINATA_JWT`, `ANCHOR_PROGRAM_ID`, `SOLANA_WALLET_PATH`.
    - Print a clear "MISSING CONFIG" error and exit on startup if critical keys are absent.

## 6. Notifications: WhatsApp Rate Limiting
- **Issue**: `send_alert` is called directly in the `act` node.
- **Impact**: If multiple breaches are found for one user, they might be spammed, or Meta might rate-limit the API.
- **Fix**:
    - Implement a simple cooldown or "last_notified_at" check in the `users` table before calling `send_alert`.

## 7. Mock Logic Refactoring
- **Issue**: Mocking is handled via `try-except ImportError` in `nodes.py`.
- **Impact**: Brittle. If a developer has the package installed but no internet/keys, it fails instead of falling back to mocks.
- **Fix**: 
    - Use a central `USE_MOCKS=true` env var.
    - Abstract the `perceive` and `act` interfaces so mocks can be injected cleanly.
