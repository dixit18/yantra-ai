-- 0011 — retrieval trace for hybrid search (P2-HYBRID-015).
-- Every search records its query, normalized tokens, scope filters, and the
-- returned segment ids: experts can later inspect WHY an answer cited what it
-- cited (master spec §20, Agent Run Inspector data source).

create table retrieval_event (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant (id) on delete cascade,
  query_text text not null,
  normalized_tokens text[] not null default '{}',
  version_ids uuid[] not null default '{}',
  include_superseded boolean not null default false,
  top_k integer not null,
  candidates_exact integer not null default 0,
  candidates_vector integer not null default 0,
  returned_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create index retrieval_event_tenant_created_idx on retrieval_event (tenant_id, created_at desc);
