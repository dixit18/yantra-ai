import { describe, expect, it } from 'vitest';
import {
  createSourceUrl,
  formatCitation,
  resolveCitation,
  verifySourceUrl,
  type Citation,
} from './citations.js';

const SECRET = 'citation-test-secret-min-32-chars-ok';
const CITATION: Citation = {
  segmentId: 'seg-1',
  documentId: 'doc-1',
  documentTitle: 'Pump Manual',
  versionId: 'v-1',
  versionLabel: 'v2',
  approvalState: 'approved',
  page: 3,
  sectionPath: ['Maintenance', 'Seals'],
  kind: 'text',
  text: 'Torque the housing bolts.',
  blobFileId: 'blob_abcdef0123456789abcdef0123456789',
};

describe('formatCitation', () => {
  it('renders the version, page, and section path', () => {
    expect(formatCitation(CITATION)).toBe('Pump Manual v2 · p.3 · Maintenance › Seals');
  });

  it('omits the section separator without a path', () => {
    expect(formatCitation({ ...CITATION, sectionPath: [] })).toBe('Pump Manual v2 · p.3');
  });
});

describe('resolveCitation', () => {
  const row = {
    segment_id: 'seg-1',
    document_id: 'doc-1',
    document_title: 'Pump Manual',
    version_id: 'v-1',
    version_label: 'v2',
    approval_state: 'approved',
    page: 3,
    section_path: ['Maintenance'],
    kind: 'text',
    text_content: 'Torque it.',
    blob_file_id: 'blob_x',
  };

  it('maps a tenant-scoped row and hides missing vs foreign alike', async () => {
    const query = async (sql: string, params?: unknown[]) => {
      expect(sql).toContain('s.tenant_id = $1 and s.id = $2');
      expect(params?.[0]).toBe('t-1');
      return { rows: [row] };
    };
    await expect(
      resolveCitation(query, { tenantId: 't-1', segmentId: 'seg-1' }),
    ).resolves.toMatchObject({
      documentTitle: 'Pump Manual',
      page: 3,
    });
    const empty = async () => ({ rows: [] });
    await expect(resolveCitation(empty, { tenantId: 't-1', segmentId: 'missing' })).rejects.toThrow(
      /^citation not found$/,
    );
    await expect(resolveCitation(empty, { tenantId: 'other', segmentId: 'seg-1' })).rejects.toThrow(
      /^citation not found$/,
    );
  });
});

describe('source URLs', () => {
  const args = { fileId: 'blob_abc', tenantId: 'tenant-1' };

  it('round-trips a signed URL', () => {
    const url = createSourceUrl(args, SECRET, 1_800_000_000);
    expect(url.startsWith('/api/blobs/blob_abc?')).toBe(true);
    const params = new URLSearchParams(url.split('?')[1] ?? '');
    expect(
      verifySourceUrl(
        'blob_abc',
        {
          tenant: params.get('tenant') ?? undefined,
          exp: params.get('exp') ?? undefined,
          sig: params.get('sig') ?? undefined,
        },
        SECRET,
        1_800_000_000,
      ),
    ).toEqual({ tenantId: 'tenant-1' });
  });

  it('rejects tampering, expiry, and weak secrets', () => {
    const url = createSourceUrl(args, SECRET, 1_800_000_000);
    const params = new URLSearchParams(url.split('?')[1] ?? '');
    const good = {
      tenant: params.get('tenant') ?? undefined,
      exp: params.get('exp') ?? undefined,
      sig: params.get('sig') ?? undefined,
    };
    expect(() => verifySourceUrl('blob_xyz', good, SECRET, 1_800_000_000)).toThrow(/signature/);
    expect(() =>
      verifySourceUrl('blob_abc', { ...good, tenant: 'tenant-2' }, SECRET, 1_800_000_000),
    ).toThrow(/signature/);
    expect(() => verifySourceUrl('blob_abc', good, SECRET, 1_800_090_001)).toThrow(/expired/);
    expect(() =>
      verifySourceUrl('blob_abc', { ...good, sig: undefined }, SECRET, 1_800_000_000),
    ).toThrow(/malformed/);
    expect(() => createSourceUrl(args, 'short', 1_800_000_000)).toThrow(/32 characters/);
    expect(() => createSourceUrl({ fileId: '', tenantId: 't' }, SECRET, 1_800_000_000)).toThrow(
      /file and a tenant/,
    );
  });
});
