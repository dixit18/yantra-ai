// P2-DOC-011 — document/version lifecycle. Versions are content-immutable:
// the blob pointer, label, and identity never change after insert. Only the
// approval state machine below moves a version, and supersession retires the
// old row explicitly instead of deleting history.
import type { MigrationConn, QueryFn } from '@yantra/db';

export const APPROVAL_STATES = [
  'draft',
  'in_review',
  'approved',
  'rejected',
  'superseded',
  'archived',
] as const;
export type ApprovalState = (typeof APPROVAL_STATES)[number];

export const TRANSITIONS: Record<ApprovalState, readonly ApprovalState[]> = {
  draft: ['in_review', 'archived'],
  in_review: ['approved', 'rejected', 'draft'],
  // No approved>superseded edge here on purpose: code may only supersede via
  // replaceVersion, which records the successor link the trigger requires.
  approved: ['archived'],
  rejected: ['draft', 'archived'],
  superseded: ['archived'],
  archived: [],
};

export function canTransition(from: ApprovalState, to: ApprovalState): boolean {
  return TRANSITIONS[from].includes(to);
}

export interface DocumentInput {
  tenantId: string;
  sourceType: string;
  title: string;
  confidentiality?: string;
  owner?: string;
}

export async function createDocument(
  query: QueryFn,
  input: DocumentInput,
): Promise<{ id: string }> {
  if (!input.title.trim() || !input.sourceType.trim()) {
    throw new Error('document requires a source type and a title');
  }
  const rows = (
    await query(
      `insert into document (tenant_id, source_type, title, confidentiality, owner)
       values ($1, $2, $3, $4, $5)
       returning id`,
      [
        input.tenantId,
        input.sourceType.trim(),
        input.title.trim(),
        input.confidentiality?.trim() || 'internal',
        input.owner?.trim() || '',
      ],
    )
  ).rows;
  return { id: stringId(rows[0]?.['id'], 'document') };
}

export interface VersionInput {
  tenantId: string;
  documentId: string;
  versionLabel: string;
  blobFileId: string;
  createdBy?: string | null;
}

export async function createDocumentVersion(
  query: QueryFn,
  input: VersionInput,
): Promise<{ id: string }> {
  if (!input.versionLabel.trim() || !input.blobFileId.trim()) {
    throw new Error('document version requires a label and a blob file');
  }
  const rows = (
    await query(
      `insert into document_version (document_id, tenant_id, version_label, blob_file_id, created_by)
       values ($1, $2, $3, $4, $5)
       returning id`,
      [
        input.documentId,
        input.tenantId,
        input.versionLabel.trim(),
        input.blobFileId.trim(),
        input.createdBy ?? null,
      ],
    )
  ).rows;
  return { id: stringId(rows[0]?.['id'], 'document version') };
}

function stringId(value: unknown, what: string): string {
  if (typeof value !== 'string' || !value) {
    throw new Error(`${what} insert did not return an id`);
  }
  return value;
}

export interface VersionHead {
  id: string;
  documentId: string;
  approvalState: ApprovalState;
}

async function loadVersionHead(
  query: QueryFn,
  tenantId: string,
  versionId: string,
): Promise<VersionHead> {
  const rows = (
    await query(
      'select id, document_id, approval_state from document_version where tenant_id = $1 and id = $2',
      [tenantId, versionId],
    )
  ).rows;
  const row = rows[0];
  const state = row?.['approval_state'];
  if (!row || typeof row['id'] !== 'string' || typeof state !== 'string') {
    throw new Error('document version not found');
  }
  if (!(APPROVAL_STATES as readonly string[]).includes(state)) {
    throw new Error('document version carries an unknown state');
  }
  return {
    id: row['id'] as string,
    documentId: String(row['document_id']),
    approvalState: state as ApprovalState,
  };
}

export async function transitionVersion(
  query: QueryFn,
  args: { tenantId: string; versionId: string; to: ApprovalState },
): Promise<{ id: string; from: ApprovalState; to: ApprovalState }> {
  const head = await loadVersionHead(query, args.tenantId, args.versionId);
  if (!canTransition(head.approvalState, args.to)) {
    throw new Error(`illegal version transition: ${head.approvalState} -> ${args.to}`);
  }
  await query('update document_version set approval_state = $1 where tenant_id = $2 and id = $3', [
    args.to,
    args.tenantId,
    args.versionId,
  ]);
  return { id: head.id, from: head.approvalState, to: args.to };
}

export interface ReplaceInput {
  tenantId: string;
  oldVersionId: string;
  newVersionId: string;
}

// Retires an approved version in favor of another approved version of the
// same document. The successor link lands FIRST so the row guard can see a
// live successor when the old row retires; all or nothing.
export async function replaceVersion(
  connect: () => Promise<MigrationConn>,
  args: ReplaceInput,
): Promise<{ oldVersionId: string; newVersionId: string }> {
  if (args.oldVersionId === args.newVersionId) {
    throw new Error('cannot supersede a version with itself');
  }
  const conn = await connect();
  const query = conn.query;
  try {
    await query('begin');
    const oldHead = await loadVersionHead(query, args.tenantId, args.oldVersionId);
    const newHead = await loadVersionHead(query, args.tenantId, args.newVersionId);
    if (oldHead.documentId !== newHead.documentId) {
      throw new Error('versions belong to different documents');
    }
    if (oldHead.approvalState !== 'approved' || newHead.approvalState !== 'approved') {
      throw new Error('both versions must be approved before replacement');
    }
    await query(
      'update document_version set effective_from = now(), supersedes_version_id = $1 where tenant_id = $2 and id = $3',
      [args.oldVersionId, args.tenantId, args.newVersionId],
    );
    await query(
      "update document_version set approval_state = 'superseded', effective_to = now() where tenant_id = $1 and id = $2",
      [args.tenantId, args.oldVersionId],
    );
    await query('commit');
    return { oldVersionId: args.oldVersionId, newVersionId: args.newVersionId };
  } catch (error) {
    await query('rollback');
    throw error;
  } finally {
    conn.release();
  }
}
