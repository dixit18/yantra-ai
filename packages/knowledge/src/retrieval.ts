// P2-HYBRID-015 — hybrid lexical/vector retrieval (master spec §10.4).
// Pipeline order, enforced in code, not documentation:
//   1. tenant scope (mandatory — no unscoped path exists anywhere below),
//   2. version scope (allowlist verified against the tenant; superseded
//      versions excluded unless explicitly included),
//   3. exact technical tokens first (part/model codes survive verbatim),
//   4. vector similarity for the rest,
//   5. deterministic merge: exact beats vector, ties break by distance,
//   6. every search persisted as a retrieval_event for inspection.
// Product-model scoping arrives with the catalog (P3-CAT-020); until then the
// version/document allowlists are the machine-context filters.
import type { QueryFn, QueryRow } from '@yantra/db';
import { normalizeToken } from './spreadsheet.js';
import { searchSimilar, type SimilarSegment } from './segments.js';
import type { Embedder } from './embeddings.js';

const TOKEN_RE = /\b[A-Za-z0-9]{2,}(?:[-_/.][A-Za-z0-9]+)+\b/g;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function extractTokens(queryText: string): string[] {
  const found = queryText.match(TOKEN_RE) ?? [];
  const normalized = found.map((token) => normalizeToken(token));
  return [...new Set(normalized)];
}

function assertUuids(ids: string[], what: string): void {
  for (const id of ids) {
    if (!UUID_RE.test(id)) {
      throw new Error(`invalid ${what} id: ${id}`);
    }
  }
}

export type HitOrigin = 'exact' | 'vector' | 'both';

export interface HybridHit extends SimilarSegment {
  origin: HitOrigin;
}

export interface HybridOptions {
  tenantId: string;
  queryText: string;
  embedder: Embedder;
  topK?: number;
  versionIds?: string[];
  includeSuperseded?: boolean;
  kinds?: string[];
}

export interface HybridResult {
  hits: HybridHit[];
  traceId: string;
  tokens: string[];
}

interface ScopedVersions {
  allowed: string[] | null;
  excluded: string[];
}

async function resolveVersionScope(
  query: QueryFn,
  tenantId: string,
  versionIds: string[] | undefined,
  includeSuperseded: boolean,
): Promise<ScopedVersions> {
  let allowed: string[] | null = null;
  if (versionIds && versionIds.length > 0) {
    assertUuids(versionIds, 'version');
    // The allowlist itself is tenant-checked: scoping to another tenant's
    // versions is rejected, not silently emptied.
    const owned = await query(
      'select id from document_version where tenant_id = $1 and id = any($2::uuid[])',
      [tenantId, versionIds],
    );
    const ownedIds = new Set(owned.rows.map((r) => String(r['id'])));
    const foreign = versionIds.filter((id) => !ownedIds.has(id));
    if (foreign.length > 0) {
      throw new Error('version scope includes versions outside the tenant');
    }
    allowed = versionIds;
  }
  let excluded: string[] = [];
  if (!includeSuperseded) {
    const stale = await query(
      `select id from document_version where tenant_id = $1 and approval_state = 'superseded'${
        allowed ? ' and id = any($2::uuid[])' : ''
      }`,
      allowed ? [tenantId, allowed] : [tenantId],
    );
    excluded = stale.rows.map((r) => String(r['id']));
  }
  return { allowed, excluded };
}

async function lexicalSearch(
  query: QueryFn,
  tenantId: string,
  tokens: string[],
  allowed: string[] | null,
  kinds: string[] | undefined,
  limit: number,
): Promise<SimilarSegment[]> {
  if (tokens.length === 0) {
    return [];
  }
  // Plain substring matching (position), not LIKE: technical tokens contain
  // LIKE wildcards (_ in SEAL_204, % anywhere) that must match literally, and
  // LIKE..ANY accepts no ESCAPE clause. Tokens are pre-uppercased, so match
  // against upper(text_content) for case-insensitivity.
  const params: unknown[] = [tenantId, ...tokens];
  let where = `tenant_id = $1 and (${tokens
    .map((_, i) => `position($${i + 2} in upper(text_content)) > 0`)
    .join(' or ')})`;
  if (allowed) {
    params.push(allowed);
    where += ` and document_version_id = any($${params.length}::uuid[])`;
  }
  if (kinds && kinds.length > 0) {
    params.push(kinds);
    where += ` and kind = any($${params.length})`;
  }
  params.push(limit);
  const rows = (
    await query(
      `select id, document_id, document_version_id, page, section_path, kind, text_content,
              0 as distance
       from document_segment
       where ${where}
       order by page, created_at
       limit $${params.length}`,
      params,
    )
  ).rows;
  return rows.map((row: QueryRow) => ({
    id: String(row['id']),
    documentId: String(row['document_id']),
    versionId: String(row['document_version_id']),
    page: Number(row['page']),
    sectionPath: (row['section_path'] ?? []) as string[],
    kind: String(row['kind']),
    text: String(row['text_content']),
    distance: 0,
  }));
}

export async function recordRetrieval(
  query: QueryFn,
  trace: {
    tenantId: string;
    queryText: string;
    tokens: string[];
    versionIds: string[];
    includeSuperseded: boolean;
    topK: number;
    candidatesExact: number;
    candidatesVector: number;
    returnedIds: string[];
  },
): Promise<string> {
  const rows = (
    await query(
      `insert into retrieval_event
         (tenant_id, query_text, normalized_tokens, version_ids, include_superseded,
          top_k, candidates_exact, candidates_vector, returned_ids)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       returning id`,
      [
        trace.tenantId,
        trace.queryText,
        trace.tokens,
        trace.versionIds,
        trace.includeSuperseded,
        trace.topK,
        trace.candidatesExact,
        trace.candidatesVector,
        trace.returnedIds,
      ],
    )
  ).rows;
  const id = rows[0]?.['id'];
  if (typeof id !== 'string' || !id) {
    throw new Error('retrieval trace insert did not return an id');
  }
  return id;
}

export async function hybridSearch(query: QueryFn, options: HybridOptions): Promise<HybridResult> {
  const topK = options.topK ?? 10;
  if (!Number.isInteger(topK) || topK <= 0 || topK > 50) {
    throw new Error('topK must be an integer between 1 and 50');
  }
  const includeSuperseded = options.includeSuperseded ?? false;
  const tokens = extractTokens(options.queryText);
  const { allowed, excluded } = await resolveVersionScope(
    query,
    options.tenantId,
    options.versionIds,
    includeSuperseded,
  );

  const exact = await lexicalSearch(
    query,
    options.tenantId,
    tokens,
    allowed,
    options.kinds,
    topK * 3,
  );
  const [queryVector] = await options.embedder.embed([options.queryText]);
  if (!queryVector) {
    throw new Error('embedder returned no vector');
  }
  const vector = await searchSimilar(query, {
    tenantId: options.tenantId,
    embedding: queryVector,
    topK: topK * 2,
    excludeVersionIds: excluded.length > 0 ? excluded : undefined,
    versionIds: allowed ?? undefined,
    kinds: options.kinds,
  });
  const inScope = (hit: SimilarSegment): boolean =>
    (!allowed || allowed.includes(hit.versionId)) &&
    (!options.kinds || options.kinds.includes(hit.kind));

  const merged = new Map<string, HybridHit>();
  for (const hit of exact.filter(inScope).slice(0, topK)) {
    merged.set(hit.id, { ...hit, origin: 'exact' });
  }
  for (const hit of vector.filter(inScope)) {
    const existing = merged.get(hit.id);
    if (existing) {
      // Two independent signals beat one: corroborated hits rank first and
      // carry the real vector distance instead of exact's placeholder zero.
      existing.origin = 'both';
      existing.distance = hit.distance;
    } else if (merged.size < topK) {
      merged.set(hit.id, { ...hit, origin: 'vector' });
    }
  }
  const hits = [...merged.values()].sort((a, b) => {
    const rank = (origin: HitOrigin): number =>
      origin === 'both' ? 0 : origin === 'exact' ? 1 : 2;
    return rank(a.origin) - rank(b.origin) || a.distance - b.distance;
  });

  const traceId = await recordRetrieval(query, {
    tenantId: options.tenantId,
    queryText: options.queryText,
    tokens,
    versionIds: allowed ?? [],
    includeSuperseded,
    topK,
    candidatesExact: exact.length,
    candidatesVector: vector.length,
    returnedIds: hits.map((h) => h.id),
  });
  return { hits, traceId, tokens };
}
