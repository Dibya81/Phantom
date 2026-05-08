# 🛡️ PhantomID — Autonomous Identity Defense Platform

## Overview

PhantomID is an autonomous AI-powered cyber defense platform designed to detect, analyze, and respond to identity-related data breaches in real time.

Unlike traditional breach checkers that only search static databases, PhantomID combines:

* historical breach intelligence
* live advisory signals
* contextual behavioral analysis
* AI-driven threat reasoning
* blockchain-backed evidence anchoring

to deliver high-fidelity identity threat intelligence.

The platform transforms passive monitoring into an active autonomous security system capable of reasoning about:

* whether a breach is historical or actively dangerous
* whether suspicious activity aligns with real-world user behavior
* whether identity compromise indicators should escalate into actionable security alerts

---

# 🚀 Core Capabilities

## 🔍 Autonomous Threat Intelligence

PhantomID continuously analyzes identity exposure risks using:

* historical breach repositories
* vulnerability intelligence feeds
* contextual user activity signals
* real-time advisory streams

Powered by:

* LangGraph orchestration
* LLM-based reasoning
* vector intelligence retrieval
* event-driven pipelines

---

## 📧 Gmail Security Signal Intelligence

The Gmail integration is NOT used for generic inbox reading.

Instead, the agent extracts high-value security indicators such as:

* password reset emails
* suspicious sign-in alerts
* MFA change notifications
* unusual login warnings
* recovery attempts

### Example

If a user appears in a known breach AND Gmail detects:

> “New login from unknown device”

the system escalates the threat from:

```text id="vn8mq4"
Historical Breach
```

to:

```text id="2bw7yl"
Active Identity Attack
```

This enables contextual, real-world threat validation.

---

## 📅 Calendar Context Intelligence

Calendar integration provides behavioral and temporal reasoning.

The AI agent evaluates:

* travel schedules
* out-of-office events
* sleep windows
* activity timing anomalies

### Example

If suspicious access occurs at:

```text id="4vm2z7"
03:12 AM IST
```

while the user is likely asleep OR marked as traveling, the system increases confidence and flags the event as anomalous.

This transforms PhantomID from:

```text id="vw2hfa"
simple breach lookup
```

into:

```text id="gcnv4r"
context-aware autonomous cyber analyst
```

---

# 🧠 Intelligence Layer

PhantomID maintains a normalized intelligence repository built from real-world breach and vulnerability sources.

## Integrated Intelligence Sources

| Source                 | Category               | Intelligence Type                |
| ---------------------- | ---------------------- | -------------------------------- |
| HIBP Breach Repository | Global Breaches        | Historical exposure metadata     |
| NVD CVE 2.0            | Vulnerabilities        | Technical exploit intelligence   |
| CERT-In Advisories     | Government Signals     | Live cyber threat advisories     |
| MobiKwik (2021)        | Financial              | Consumer identity exposure       |
| Domino’s India         | Consumer               | Customer exposure intelligence   |
| CoWIN (2023)           | Government/Health      | Sensitive citizen exposure       |
| BigBasket              | E-Commerce             | Credential & contact exposure    |
| Air India              | Travel                 | Passenger & identity records     |
| COMB Dataset Metadata  | Credential Aggregation | Cross-platform exposure patterns |

---

# 🧩 System Architecture

## High-Level Pipeline

```text id="uivk7v"
USER INPUT
    ↓
IDENTITY HASHING
    ↓
BREACH INTELLIGENCE RETRIEVAL
    ↓
CONTEXTUAL SIGNAL ANALYSIS
    ↓
AI THREAT REASONING
    ↓
RISK SCORING
    ↓
BLOCKCHAIN EVIDENCE ANCHORING
    ↓
LIVE COMMAND CENTER
```

---

## 🧠 Neural-Blockchain Architecture

PhantomID implements a **Double-Loop Validation** system:

1.  **The Neural Loop (LLM + MCP)**: Synthesizes disparate data points (breach records + Gmail alerts + Calendar OOO) to determine if a threat is a "Logical Match."
2.  **The Blockchain Loop (Solana + IPFS)**: Once a threat is validated, the agent generates a **Cryptographic Proof**. This proof is hashed, uploaded to IPFS, and anchored to the Solana Devnet.

This architecture ensures that every alert on the dashboard is not just "AI-predicted" but **immutably anchored** and verifiable by third parties.

---

## 🧠 Neural-Blockchain Architecture

PhantomID implements a **Double-Loop Validation** system:

1.  **The Neural Loop (LLM + MCP)**: Synthesizes disparate data points (breach records + Gmail alerts + Calendar OOO) to determine if a threat is a "Logical Match."
2.  **The Blockchain Loop (Solana + IPFS)**: Once a threat is validated, the agent generates a **Cryptographic Proof**. This proof is hashed, uploaded to IPFS, and anchored to the Solana Devnet.

This architecture ensures that every alert on the dashboard is not just "AI-predicted" but **immutably anchored** and verifiable by third parties.

---

# ⚡ AI Reasoning Engine

The autonomous reasoning layer uses:

* LangGraph
* LLM-based orchestration
* multi-signal threat synthesis
* contextual intelligence fusion

The agent evaluates:

* breach recency
* exposed data sensitivity
* corroborating signals
* temporal anomalies
* advisory correlations
* behavioral inconsistencies

and generates:

* risk level
* confidence score
* threat explanation
* actionable remediation guidance

---

# 🔐 Privacy & Security Model

## Local Hashing

Sensitive identifiers are hashed before entering the intelligence pipeline:

* Email
* Phone
* PAN

Raw identity values are never persisted in intelligence storage.

---

## Zero-Knowledge Design

PhantomID stores:

* cryptographic fingerprints
* metadata
* contextual signals

instead of raw personally identifiable information.

---

## Deterministic Pseudonyms

Users are represented internally using privacy-safe pseudonymous identifiers derived from hashed identity vectors.

---

# ⛓️ Blockchain Evidence Anchoring

Confirmed threat assessments are anchored onto:

* Solana Devnet
* Anchor Framework

This creates:

* immutable evidence
* timestamped verification
* tamper-resistant auditability

---

## W3C Verifiable Credentials

PhantomID can generate standardized digital threat certificates allowing users to:

* prove compromise events
* provide evidence to institutions
* validate incident authenticity

---

# 🖥️ Frontend Experience

The frontend is designed as a:

```text id="e0vmdt"
real-time autonomous cyber command center
```

Design principles:

* Apple-grade minimalism
* Linear-inspired UX
* cinematic motion systems
* immersive scrollytelling
* real-time intelligence visualization

Built using:

* React
* Vite
* Tailwind CSS
* Framer Motion
* GPU-optimized animations

---

# 🛠️ Technical Stack

## Backend & AI

| Technology            | Purpose              |
| --------------------- | -------------------- |
| FastAPI               | Async API Gateway    |
| LangGraph             | Agent Orchestration  |
| Groq (LLaMA 3.1 70B)  | Real-time reasoning  |
| Supabase + pgvector   | Intelligence storage |
| Google Workspace APIs | Contextual signals   |
| WebSockets            | Real-time updates    |

---

## Blockchain & Storage

| Technology       | Purpose                |
| ---------------- | ---------------------- |
| Solana           | Threat anchoring       |
| Anchor Framework | Smart contracts        |
| IPFS / Pinata    | Evidence storage       |
| W3C VC           | Verifiable credentials |

---

## Frontend

| Technology    | Purpose            |
| ------------- | ------------------ |
| React + Vite  | Frontend framework |
| Tailwind CSS  | Styling system     |
| Framer Motion | Motion engine      |

---

# 🗂️ Project Structure

```text id="1o6sdu"
phantomid/
├── agent/
│   ├── api/             # FastAPI routes, DB adapters, auth logic
│   ├── frontend/        # Vite + React (Live Command Center)
│   ├── graph/           # LangGraph (Perceive-Reason-Act nodes)
│   ├── mcp/             # Google Workspace signal providers
│   └── notifications/    # WhatsApp, Telegram, Twilio integrations
├── blockchain/
│   ├── anchor_contract/ # Solana smart contract (Rust)
│   ├── proof_service/   # IPFS + Solana + VC orchestration
│   └── vc_issuer/        # W3C Verifiable Credential generation
├── intelligence/
│   ├── rag/             # Vector retrieval & Supabase query logic
│   └── processors/      # Raw data normalization & ingestion
├── contracts/           # JSON Schemas for threats & proofs
├── breach_data/         # Raw intelligence repositories
└── README.md            # You are here
```

---

# ⚙️ Environment Configuration

## Required Environment Variables

```env id="zc5d6e"
# AI & Core
GROQ_API_KEY=
SUPABASE_URL=
SUPABASE_KEY=
SUPABASE_DB_URL=

# Blockchain
SOLANA_PRIVATE_KEY=
SOLANA_RPC_URL=
ANCHOR_PROGRAM_ID=

# Google Workspace
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

# Storage
PINATA_JWT=
```

---

# 📊 Threat Scoring Model

The platform generates:

* confidence scores
* risk classifications
* contextual severity levels

## Risk Levels

| Level    | Meaning                       |
| -------- | ----------------------------- |
| LOW      | Weak or indirect signals      |
| MEDIUM   | Confirmed exposure            |
| HIGH     | Multiple corroborated signals |
| CRITICAL | Active compromise indicators  |

---

# 🔄 Real-Time Event Flow

```text id="h9v4p4"
Detection Signal
    ↓
Threat Correlation
    ↓
AI Reasoning
    ↓
Blockchain Proof
    ↓
Frontend Streaming
    ↓
User Alerting
```

---

# 🧪 Development Setup

The system includes a consolidated startup script for full-stack operation.

```bash id="c40s4s"
# 1. Initialize environment
# Ensure .env is populated with all required keys

# 2. Start the entire system (Frontend + Backend)
./start.sh

# 3. Manual Startup (Optional)
# Backend:
cd agent && uvicorn api.main:app --port 8000
# Frontend:
cd agent/frontend && npm run dev
```

---

# 🎯 Mission

PhantomID is designed to evolve beyond passive breach monitoring into a fully autonomous identity defense ecosystem capable of:

* contextual reasoning
* real-time intelligence synthesis
* behavioral anomaly detection
* verifiable digital evidence generation

---

# 📄 License

MIT License

---

# © PhantomID

Autonomous Identity Protection for the AI-Native Era.
