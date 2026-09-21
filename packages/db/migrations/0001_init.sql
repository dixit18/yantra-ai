-- P1-DB-003 — initial tenant/auth/audit schema.
-- Conventions: uuid PKs (gen_random_uuid is core since PG13, no extension),
-- every tenant-owned row carries tenant_id NOT NULL + FK with cascade,
-- audit_event is append-only (no update/delete path exists in the app).

create table tenant (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  slug text not null unique,
  region text not null default 'in',
  default_locale text not null default 'en-IN',
  retention_policy jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table app_user (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant (id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique (tenant_id, email)
);

create table role (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create table permission (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text not null
);

create table role_permission (
  role_id uuid not null references role (id) on delete cascade,
  permission_id uuid not null references permission (id) on delete cascade,
  primary key (role_id, permission_id)
);

create table user_role (
  user_id uuid not null references app_user (id) on delete cascade,
  role_id uuid not null references role (id) on delete cascade,
  primary key (user_id, role_id)
);

create table audit_event (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenant (id) on delete set null,
  actor_user_id uuid references app_user (id) on delete set null,
  type text not null,
  entity text not null,
  entity_id text not null default '',
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index audit_event_tenant_created_idx on audit_event (tenant_id, created_at desc);
