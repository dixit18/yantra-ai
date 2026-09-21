// Audit event construction — the single site that builds the INSERT.
// Both the runtime writer (@yantra/telemetry) and the seed (@yantra/db) go
// through here, so allowlist, caps, and secret-scrubbing cannot diverge.
// (Kept in contracts, the dependency leaf, to avoid a db↔telemetry cycle.)
import { z } from 'zod';
import { scrubSecrets } from './scrub.js';

export const AUDIT_EVENT_TYPES = ['tenant.seeded', 'case.opened', 'probe.write'] as const;
export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];

const MAX_DATA_BYTES = 64 * 1024;

export interface AuditEventInput {
  tenantId?: string | null;
  actorUserId?: string | null;
  type: AuditEventType;
  entity: string;
  entityId?: string;
  data?: Record<string, unknown>;
}

export interface AuditInsert {
  sql: string;
  params: [string | null, string | null, string, string, string, string];
}

const AuditInputSchema = z.object({
  tenantId: z.string().nullable().optional(),
  actorUserId: z.string().nullable().optional(),
  type: z.enum(AUDIT_EVENT_TYPES, { error: 'audit event type is not allowlisted' }),
  entity: z
    .string()
    .trim()
    .min(1, 'audit event requires a type and an entity')
    .max(128, 'audit event entity too long'),
  entityId: z.string().max(256).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

export function buildAuditInsert(event: AuditEventInput): AuditInsert {
  const parsed = AuditInputSchema.parse({
    ...event,
    entityId: event.entityId ?? '',
    data: event.data ?? {},
  });
  const dataJson = JSON.stringify(scrubSecrets(parsed.data));
  if (dataJson.length > MAX_DATA_BYTES) {
    throw new Error('audit event data too large');
  }
  return {
    sql: `insert into audit_event (tenant_id, actor_user_id, type, entity, entity_id, data)
       values ($1, $2, $3, $4, $5, $6)
       returning id`,
    params: [
      parsed.tenantId ?? null,
      parsed.actorUserId ?? null,
      parsed.type,
      parsed.entity,
      parsed.entityId ?? '',
      dataJson,
    ],
  };
}
