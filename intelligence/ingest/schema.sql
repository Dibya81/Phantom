-- PhantomID — Production Supabase Schema
-- Run this in the Supabase SQL editor to initialize or update your environment.

-- 1. EXTENSIONS
create extension if not exists vector;

-- 2. BREACH INTELLIGENCE (LlamaIndex / pgvector)
create table if not exists breach_vectors (
  id bigserial primary key,
  text text not null,
  embedding vector(384),
  metadata jsonb,
  created_at timestamptz default now()
);

-- Index for fast similarity search
create index if not exists breach_vectors_embedding_idx
on breach_vectors
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

-- 3. IDENTITY VAULT (Users)
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  user_pseudonym text unique,
  hashed_email text unique,
  hashed_phone text unique,
  password_hash text,               -- Added for secure production auth
  raw_phone text,                   -- Stored for WhatsApp delivery
  gmail_connected boolean default false,
  gmail_tokens jsonb,
  created_at timestamptz default now()
);

-- Index for high-speed login/lookup
create index if not exists idx_users_hashed_email on users(hashed_email);

-- 4. REAL-TIME SIGNALS (Telegram/Web Monitors)
create table if not exists detection_events (
  id bigserial primary key,
  hashed_identifier text not null,
  source_channel text,
  source_message_id bigint,
  detected_at timestamptz,
  event_type text,
  consumed boolean default false,
  created_at timestamptz default now()
);

-- Index for the agent's perception loop
create index if not exists idx_detection_unconsumed on detection_events(hashed_identifier) where consumed = false;

-- 5. THREAT INTELLIGENCE (Agent Output & Blockchain Proofs)
create table if not exists threat_events (
  id bigserial primary key,
  user_pseudonym text not null,
  threat_assessment jsonb,
  proof_result jsonb,
  risk_level text,
  threat_summary text,
  detected_at timestamptz,
  created_at timestamptz default now()
);

-- Index for the Credential Vault dashboard
create index if not exists idx_threat_events_pseudonym on threat_events(user_pseudonym);
create index if not exists idx_threat_events_detected on threat_events(detected_at desc);
