// P1-DB-003 — idempotent demo seed. No secrets anywhere: the demo admin is a
// plain identity row (auth credentials arrive with P1-AUTH-004, never here).
// The whole graph builds inside one transaction off a single connection, so a
// crash never leaves a half-tenant. Reruns reuse the graph (created=false);
// each run appends one audit_event, which is correct — audit is append-only.
import type { QueryFn, QueryRow } from './check.js';
import type { MigrationConn } from './migrate.js';
import { buildAuditInsert } from '@yantra/contracts';

export const DEMO_PERMISSIONS: readonly { code: string; description: string }[] = [
  { code: 'knowledge:approve', description: 'Approve knowledge assertions' },
  { code: 'service:escalate', description: 'Escalate service cases with context' },
  { code: 'parts:request', description: 'Create parts requests' },
  { code: 'admin:users', description: 'Manage users and roles' },
];

export interface SeedResult {
  tenantId: string;
  adminUserId: string;
  adminRoleId: string;
  created: boolean;
}

function idOf(rows: QueryRow[]): string | null {
  const id = rows[0]?.['id'];
  return typeof id === 'string' && id ? id : null;
}

async function findOrCreate(
  query: QueryFn,
  selectSql: string,
  selectParams: unknown[],
  insertSql: string,
  insertParams: unknown[],
): Promise<{ id: string; created: boolean }> {
  const hit = idOf((await query(selectSql, selectParams)).rows);
  if (hit) {
    return { id: hit, created: false };
  }
  const made = idOf((await query(insertSql, insertParams)).rows);
  if (made) {
    return { id: made, created: true };
  }
  const raced = idOf((await query(selectSql, selectParams)).rows);
  if (!raced) {
    throw new Error('seed could not create or find required row');
  }
  return { id: raced, created: false };
}

export async function seedDemoTenant(
  connect: () => Promise<MigrationConn>,
  slug = 'demo',
  options: { audit?: boolean } = {},
): Promise<SeedResult> {
  const conn = await connect();
  const query = conn.query;
  try {
    await query('begin');
    const tenant = await findOrCreate(
      query,
      'select id from tenant where slug = $1',
      [slug],
      `insert into tenant (legal_name, slug, region, default_locale)
     values ('Demo Manufacturer', $1, 'in', 'en-IN')
     on conflict (slug) do nothing
     returning id`,
      [slug],
    );

    for (const perm of DEMO_PERMISSIONS) {
      await query(
        'insert into permission (code, description) values ($1, $2) on conflict (code) do nothing',
        [perm.code, perm.description],
      );
    }

    const role = await findOrCreate(
      query,
      'select id from role where tenant_id = $1 and name = $2',
      [tenant.id, 'admin'],
      `insert into role (tenant_id, name) values ($1, 'admin')
     on conflict (tenant_id, name) do nothing
     returning id`,
      [tenant.id],
    );

    const admin = await findOrCreate(
      query,
      'select id from app_user where tenant_id = $1 and email = $2',
      [tenant.id, 'admin@demo.local'],
      `insert into app_user (tenant_id, name, email) values ($1, 'Demo Admin', 'admin@demo.local')
     on conflict (tenant_id, email) do nothing
     returning id`,
      [tenant.id],
    );

    const permRows = (
      await query('select id from permission where code = any($1)', [
        DEMO_PERMISSIONS.map((p) => p.code),
      ])
    ).rows;
    for (const row of permRows) {
      await query(
        'insert into role_permission (role_id, permission_id) values ($1, $2) on conflict do nothing',
        [role.id, row['id']],
      );
    }
    await query(
      'insert into user_role (user_id, role_id, tenant_id) values ($1, $2, $3) on conflict do nothing',
      [admin.id, role.id, tenant.id],
    );

    // Tests seed with audit:false to stay clean (the audit write itself is
    // covered by unit test + the permanent demo tenant's live row).
    if (options.audit ?? true) {
      const insert = buildAuditInsert({
        tenantId: tenant.id,
        actorUserId: admin.id,
        type: 'tenant.seeded',
        entity: 'tenant',
        entityId: tenant.id,
        data: { slug },
      });
      await query(insert.sql, insert.params);
    }
    await query('commit');

    return {
      tenantId: tenant.id,
      adminUserId: admin.id,
      adminRoleId: role.id,
      created: tenant.created,
    };
  } catch (error) {
    await query('rollback');
    throw error;
  } finally {
    conn.release();
  }
}
