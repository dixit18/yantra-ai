// P1-REPO-001 seed for P1-AUTH-004 — tenant request context guard.
// Server-side checks must call requireTenant; never trust UI-supplied scope.
export interface TenantContext {
  tenantId: string;
}

export function requireTenant(ctx: Partial<TenantContext> | null | undefined): TenantContext {
  const tenantId = ctx?.tenantId?.trim();
  if (!tenantId) {
    throw new Error('tenant context is required');
  }
  return { tenantId };
}
