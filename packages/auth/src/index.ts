// P1-REPO-001 seed for P1-AUTH-004 — tenant request context guard.
export interface TenantContext {
  tenantId: string;
}

/**
 * @deprecated Never trust caller-supplied scope in production. Authenticate
 * with `authenticateRequest` (verifies the HMAC token, loads the tenant from
 * the database) and scope resources with `requireSameTenant` instead. Kept
 * only for legacy callers; no production path may use it.
 */
export function requireTenant(ctx: Partial<TenantContext> | null | undefined): TenantContext {
  const tenantId = ctx?.tenantId?.trim();
  if (!tenantId) {
    throw new Error('tenant context is required');
  }
  return { tenantId };
}

export * from './token.js';
export * from './permissions.js';
