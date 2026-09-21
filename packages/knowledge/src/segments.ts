// P2-EMBED-014 — segment index + tenant-filtered similarity search.
// tenantId is a REQUIRED parameter on every function: there is no unscoped
// search path by construction. Old/superseded versions are excluded by id
// list (the retrieval layer resolves which versions those are).
import type { MigrationConn, QueryFn, QueryRow } from '@yantra/db';
import { EMBEDDING_DIMENSIONS, toVectorLiteral } from './embeddings.js';

export interface IndexSegment {
  page: number;
  sectionPath: string[];
  kind: string;
  text: string;
  embedding: number[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertVersionIds(ids: string[]): void {
  for (const id of ids) {
    if (!UUID_RE.test(id)) {
      throw new Error(`invalid version id: ${id}`);
    }
  }
}

export interface SimilarSegment {
  id: string;
  documentId: string;
  versionId: string;
  page: number;
  sectionPath: string[];
  kind: string;
  text: string;
  distance: number;
}

function checkEmbedding(embedding: number[]): void {
  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `embedding has ${embedding.length} dimensions, expected ${EMBEDDING_DIMENSIONS}`,
    );
  }
}

// Replaces a version's index wholesale: re-embedding after a new version
// lands never leaves stale segments behind. Serialized per version with an
// advisory lock so concurrent re-indexes cannot interleave into a torn mix,
// and the document/version pairing is verified (composite FKs each pass for
// same-tenant mismatched pairs, so the check is explicit).
export async function indexVersionSegments(
  connect: () => Promise<MigrationConn>,
  args: {
    tenantId: string;
    documentId: string;
    versionId: string;
    segments: IndexSegment[];
  },
): Promise<string[]> {
  const conn = await connect();
  await conn.query('begin');
  try {
    await conn.query("select pg_advisory_xact_lock(hashtext('segments:' || $1))", [args.versionId]);
    const pairing = await conn.query(
      'select 1 from document_version where id = $1 and document_id = $2 and tenant_id = $3',
      [args.versionId, args.documentId, args.tenantId],
    );
    if (pairing.rows.length === 0) {
      throw new Error('version does not belong to the given document and tenant');
    }
    await conn.query(
      'delete from document_segment where tenant_id = $1 and document_version_id = $2',
      [args.tenantId, args.versionId],
    );
    const ids: string[] = [];
    for (const segment of args.segments) {
      checkEmbedding(segment.embedding);
      const rows = (
        await conn.query(
          `insert into document_segment
             (tenant_id, document_id, document_version_id, page, section_path, kind, text_content, embedding)
           values ($1, $2, $3, $4, $5, $6, $7, $8::vector)
           returning id`,
          [
            args.tenantId,
            args.documentId,
            args.versionId,
            segment.page,
            segment.sectionPath,
            segment.kind,
            segment.text,
            toVectorLiteral(segment.embedding),
          ],
        )
      ).rows;
      const id = rows[0]?.['id'];
      if (typeof id !== 'string' || !id) {
        throw new Error('segment insert did not return an id');
      }
      ids.push(id);
    }
    await conn.query('commit');
    return ids;
  } catch (error) {
    await conn.query('rollback');
    throw error;
  } finally {
    conn.release();
  }
}

function rowToSimilar(row: QueryRow): SimilarSegment {
  const sectionPath = row['section_path'];
  const distance = row['distance'];
  if (
    typeof row['id'] !== 'string' ||
    typeof row['document_id'] !== 'string' ||
    typeof row['document_version_id'] !== 'string' ||
    typeof row['page'] !== 'number' ||
    !Array.isArray(sectionPath) ||
    typeof row['kind'] !== 'string' ||
    typeof row['text_content'] !== 'string'
  ) {
    throw new Error('similarity search returned a malformed row');
  }
  return {
    id: row['id'],
    documentId: row['document_id'],
    versionId: row['document_version_id'],
    page: row['page'],
    sectionPath: sectionPath as string[],
    kind: row['kind'],
    text: row['text_content'],
    distance: typeof distance === 'number' ? distance : Number(distance),
  };
}

export async function searchSimilar(
  query: QueryFn,
  args: {
    tenantId: string;
    embedding: number[];
    topK: number;
    excludeVersionIds?: string[];
    versionIds?: string[];
    kinds?: string[];
  },
): Promise<SimilarSegment[]> {
  if (!Number.isInteger(args.topK) || args.topK <= 0 || args.topK > 100) {
    throw new Error('topK must be an integer between 1 and 100');
  }
  checkEmbedding(args.embedding);
  const excluded = args.excludeVersionIds ?? [];
  assertVersionIds(excluded);
  const scoped = args.versionIds ?? [];
  assertVersionIds(scoped);
  const literal = toVectorLiteral(args.embedding);
  const clauses = ['tenant_id = $1'];
  const params: unknown[] = [args.tenantId, literal, args.topK];
  if (excluded.length > 0) {
    params.push(excluded);
    clauses.push(`and not (document_version_id = any($${params.length}::uuid[]))`);
  }
  if (scoped.length > 0) {
    params.push(scoped);
    clauses.push(`and document_version_id = any($${params.length}::uuid[])`);
  }
  if (args.kinds && args.kinds.length > 0) {
    params.push(args.kinds);
    clauses.push(`and kind = any($${params.length})`);
  }
  const rows = (
    await query(
      // Tenant scoping is structural (no unscoped path exists). Recall note:
      // the bare HNSW index serves ORDER BY distance; pre-filter recall holds
      // at current scale — revisit ef_search/partitioning past ~100k segments
      // per tenant (see DECISIONS).
      `select id, document_id, document_version_id, page, section_path, kind, text_content,
              embedding <=> $2::vector as distance
       from document_segment
       where ${clauses.join(' ')}
       order by embedding <=> $2::vector
       limit $3`,
      params,
    )
  ).rows;
  return rows.map(rowToSimilar);
}
