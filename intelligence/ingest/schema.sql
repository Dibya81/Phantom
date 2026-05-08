-- PhantomID — Supabase Schema
-- Run this once in the Supabase SQL editor before starting.

-- Enable pgvector extension
create extension if not exists vector;

-- Breach vectors table (LlamaIndex writes here via pgvector)
create table if not exists breach_vectors (
  id bigserial primary key,
  text text not null,
  embedding vector(384),
  metadata jsonb,
  created_at timestamptz default now()
);

-- Index for fast cosine similarity search
create index if not exists breach_vectors_embedding_idx
on breach_vectors
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

-- Registered users table
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  user_pseudonym text unique,
  hashed_email text unique,
  hashed_phone text unique,
  hashed_pan text,
  raw_phone text,                   -- stored un-hashed for WhatsApp delivery only
  gmail_connected boolean default false,
  gmail_tokens jsonb,
  created_at timestamptz default now()
);

-- Detection events table
-- Person 1 (Telegram monitor) writes here.
-- Person 3 (perceive node) reads here and marks consumed=true.
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

-- Threat events table
-- Person 3 (act node) writes here after full pipeline completes.
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
