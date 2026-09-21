-- 0004 — blob file registry for the tenant-scoped BlobStore (P2-OBJ-010).
-- Bytes live content-addressed on the local filesystem; PostgreSQL owns the
-- metadata and the tenant boundary. Same bytes under two tenants are two
-- rows: duplicate detection must never leak existence across tenants.
create table blob_file (
  id text primary key,
  tenant_id uuid not null references tenant (id) on delete cascade,
  sha256 text not null,
  size_bytes bigint not null,
  mime_type text not null,
  filename text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, sha256)
);

create index blob_file_tenant_created_idx on blob_file (tenant_id, created_at desc);
