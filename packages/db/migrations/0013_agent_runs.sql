-- 0013 — agent run trace (P2-AGENT-017, master spec §9.6).
-- Every specialist run persists its structured state transitions: workflow,
-- input hash (never raw secrets), outcome, confidence, and per-node steps
-- with redacted I/O. The trace is what experts inspect and evals regress on.

create table agent_run (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant (id) on delete cascade,
  workflow text not null,
  workflow_version text not null default '1',
  input_hash text not null,
  status text not null default 'running'
    check (status in ('running', 'answered', 'abstained', 'escalated', 'failed')),
  confidence double precision,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create table agent_step (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references agent_run (id) on delete cascade,
  seq integer not null,
  node text not null,
  input_json jsonb not null default '{}',
  output_json jsonb not null default '{}',
  started_at timestamptz not null default now(),
  ended_at timestamptz not null default now(),
  unique (run_id, seq)
);

create index agent_run_tenant_started_idx on agent_run (tenant_id, started_at desc);
