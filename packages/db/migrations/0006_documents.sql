-- 0006 — document/version lifecycle (P2-DOC-011).
-- Versions are content-immutable: the blob pointer, label, and identity never
-- change after insert. Only approval_state / effective_to / supersession move,
-- and only through the validated machine in @yantra/knowledge (the CHECK below
-- bounds the vocabulary; the graph of legal jumps lives in code + tests).
-- tenant_id is denormalized onto versions with a composite FK so no query can
-- detach a version from its document's tenant.

create table document (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant (id) on delete cascade,
  source_type text not null,
  title text not null,
  confidentiality text not null default 'internal',
  owner text not null default '',
  created_at timestamptz not null default now()
);

create index document_tenant_created_idx on document (tenant_id, created_at desc);

alter table document add constraint document_id_tenant_key unique (id, tenant_id);

create table document_version (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null,
  tenant_id uuid not null,
  version_label text not null,
  blob_file_id text not null references blob_file (id) on delete restrict,
  approval_state text not null default 'draft'
    check (approval_state in ('draft', 'in_review', 'approved', 'rejected', 'superseded', 'archived')),
  supersedes_version_id uuid references document_version (id) on delete set null,
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  created_by uuid references app_user (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (document_id, version_label),
  foreign key (document_id, tenant_id) references document (id, tenant_id) on delete cascade
);

create index document_version_tenant_state_idx on document_version (tenant_id, approval_state);
