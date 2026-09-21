-- 0010 — retrievable segments for hybrid search (P2-EMBED-014).
-- Embeddings are fixed at 1536 dimensions (OpenAI text-embedding-3-small
-- compatible, so the production provider drops in with no schema change; a
-- different-dim model means a new migration, documented in DECISIONS).
-- The HNSW index accelerates ORDER BY distance; tenant scoping is enforced
-- by the always-present WHERE clause, never by the index.

create table document_segment (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant (id) on delete cascade,
  document_id uuid not null,
  document_version_id uuid not null,
  page integer not null,
  section_path text[] not null default '{}',
  kind text not null,
  text_content text not null,
  embedding vector(1536) not null,
  created_at timestamptz not null default now(),
  foreign key (document_id, tenant_id) references document (id, tenant_id) on delete cascade
);

-- Composite bases so segments cannot detach versions from their tenant.
alter table document_version add constraint document_version_id_tenant_key unique (id, tenant_id);
alter table document_segment
  add constraint document_segment_version_fk
    foreign key (document_version_id, tenant_id)
    references document_version (id, tenant_id) on delete cascade;

create index document_segment_embedding_idx on document_segment using hnsw (embedding vector_cosine_ops);
create index document_segment_tenant_version_idx on document_segment (tenant_id, document_version_id);
