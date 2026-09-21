// P2-CITE-016 — citations: resolve, render, and deep-link to the exact
// source. Every resolver is tenant-scoped (missing and foreign rows share one
// error: no existence oracle). Source bytes travel behind expiring,
// tenant-bound HMAC URLs (the presigned-URL pattern) so even the browser's
// native PDF viewer — which sends no auth headers — stays tenant-safe.
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { QueryFn } from '@yantra/db';

const MIN_SOURCE_SECRET = 32;

export interface Citation {
  segmentId: string;
  documentId: string;
  documentTitle: string;
  versionId: string;
  versionLabel: string;
  approvalState: string;
  page: number;
  sectionPath: string[];
  kind: string;
  text: string;
  blobFileId: string;
}

export async function resolveCitation(
  query: QueryFn,
  args: { tenantId: string; segmentId: string },
): Promise<Citation> {
  const rows = (
    await query(
      `select s.id as segment_id, s.document_id, d.title as document_title,
              s.document_version_id as version_id, v.version_label, v.approval_state,
              s.page, s.section_path, s.kind, s.text_content, v.blob_file_id
       from document_segment s
       join document d on d.id = s.document_id and d.tenant_id = s.tenant_id
       join document_version v on v.id = s.document_version_id and v.tenant_id = s.tenant_id
       where s.tenant_id = $1 and s.id = $2`,
      [args.tenantId, args.segmentId],
    )
  ).rows;
  const row = rows[0];
  if (
    !row ||
    typeof row['segment_id'] !== 'string' ||
    typeof row['document_id'] !== 'string' ||
    typeof row['document_title'] !== 'string' ||
    typeof row['version_id'] !== 'string' ||
    typeof row['version_label'] !== 'string' ||
    typeof row['approval_state'] !== 'string' ||
    typeof row['page'] !== 'number' ||
    !Array.isArray(row['section_path']) ||
    typeof row['kind'] !== 'string' ||
    typeof row['text_content'] !== 'string' ||
    typeof row['blob_file_id'] !== 'string'
  ) {
    throw new Error('citation not found');
  }
  return {
    segmentId: row['segment_id'],
    documentId: row['document_id'],
    documentTitle: row['document_title'],
    versionId: row['version_id'],
    versionLabel: row['version_label'],
    approvalState: row['approval_state'],
    page: row['page'],
    sectionPath: row['section_path'] as string[],
    kind: row['kind'],
    text: row['text_content'],
    blobFileId: row['blob_file_id'],
  };
}

export function formatCitation(citation: Citation): string {
  const section = citation.sectionPath.length > 0 ? ` · ${citation.sectionPath.join(' › ')}` : '';
  return `${citation.documentTitle} ${citation.versionLabel} · p.${citation.page}${section}`;
}

export const SOURCE_URL_TTL_SECONDS = 15 * 60;

export interface SourceUrl {
  fileId: string;
  tenantId: string;
  expiresAt: number;
  signature: string;
}

export function createSourceUrl(
  args: { fileId: string; tenantId: string },
  secret: string,
  issuedAt: number = Math.floor(Date.now() / 1000),
  ttlSeconds: number = SOURCE_URL_TTL_SECONDS,
): string {
  if (!secret || secret.length < 32) {
    throw new Error('source URL secret must be at least 32 characters');
  }
  if (!args.fileId || !args.tenantId) {
    throw new Error('source URL requires a file and a tenant');
  }
  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0 || ttlSeconds > 24 * 60 * 60) {
    throw new Error('source URL ttl must be between 1 and 86400 seconds');
  }
  const expiresAt = issuedAt + ttlSeconds;
  const body = `${args.tenantId}.${args.fileId}.${expiresAt}`;
  const signature = createHmac('sha256', secret).update(body).digest('base64url');
  const params = new URLSearchParams({
    tenant: args.tenantId,
    exp: String(expiresAt),
    sig: signature,
  });
  return `/api/blobs/${args.fileId}?${params.toString()}`;
}

export function verifySourceUrl(
  fileId: string,
  params: { tenant?: string; exp?: string; sig?: string },
  secret: string,
  now: number = Math.floor(Date.now() / 1000),
): { tenantId: string } {
  if (!secret || secret.length < MIN_SOURCE_SECRET) {
    throw new Error('source URL secret must be at least 32 characters');
  }
  const tenantId = params.tenant ?? '';
  const expiresAt = Number(params.exp ?? '');
  const sig = params.sig ?? '';
  if (!tenantId || !Number.isInteger(expiresAt) || !sig) {
    throw new Error('forbidden: malformed source URL');
  }
  if (expiresAt <= now) {
    throw new Error('forbidden: source URL expired');
  }
  const expected = createHmac('sha256', secret)
    .update(`${tenantId}.${fileId}.${expiresAt}`)
    .digest();
  let actual: Buffer;
  try {
    actual = Buffer.from(sig, 'base64url');
  } catch {
    throw new Error('forbidden: malformed source URL');
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new Error('forbidden: bad source URL signature');
  }
  return { tenantId };
}
