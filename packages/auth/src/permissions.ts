// P1-AUTH-004 — server-side authorization. Permissions are loaded from the
// database on every authentication (no permission ever rides inside the
// token), the token's tenant claim is re-checked against the user's row, and
// every guard throws instead of returning false — callers cannot forget the
// check, and UI scope is never trusted.
import type { QueryFn } from '@yantra/db';
import { verifyToken } from './token.js';

export interface RequestContext {
  tenantId: string;
  userId: string;
  permissions: string[];
}

export async function loadRequestIdentity(
  query: QueryFn,
  userId: string,
): Promise<{ tenantId: string; permissions: string[] }> {
  const rows = (
    await query(
      `select u.tenant_id as tenant_id, p.code as code
       from app_user u
       left join user_role ur on ur.user_id = u.id
       left join role r on r.id = ur.role_id
       left join role_permission rp on rp.role_id = r.id
       left join permission p on p.id = rp.permission_id
       where u.id = $1`,
      [userId],
    )
  ).rows;
  const tenantId = rows[0]?.['tenant_id'];
  if (typeof tenantId !== 'string' || !tenantId) {
    throw new Error('unauthenticated: unknown user');
  }
  const permissions = [
    ...new Set(rows.map((r) => r['code']).filter((c): c is string => typeof c === 'string')),
  ];
  return { tenantId, permissions };
}

export function requirePermission(ctx: RequestContext, code: string): void {
  // Generic message on purpose: echoing the missing code would let clients
  // enumerate valid permission names. Log server-side if you need the detail.
  if (!ctx.permissions.includes(code)) {
    throw new Error('forbidden: missing permission');
  }
}

export function requireSameTenant(ctx: RequestContext, resourceTenantId: string): void {
  if (!resourceTenantId || ctx.tenantId !== resourceTenantId) {
    throw new Error('forbidden: cross-tenant access denied');
  }
}

export async function authenticateRequest(
  headers: { authorization?: string | null },
  deps: { secret: string; query: QueryFn },
): Promise<RequestContext> {
  const header = headers.authorization?.trim() ?? '';
  const match = /^Bearer (.+)$/.exec(header);
  if (!match?.[1]) {
    throw new Error('unauthenticated: missing bearer token');
  }
  const payload = verifyToken(match[1], deps.secret);
  const identity = await loadRequestIdentity(deps.query, payload.userId);
  if (identity.tenantId !== payload.tenantId) {
    throw new Error('forbidden: token tenant does not match user tenant');
  }
  return { tenantId: identity.tenantId, userId: payload.userId, permissions: identity.permissions };
}
