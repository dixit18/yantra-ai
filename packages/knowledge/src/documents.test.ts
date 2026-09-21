import { describe, expect, it } from 'vitest';
import type { QueryRow } from '@yantra/db';
import {
  APPROVAL_STATES,
  canTransition,
  createDocument,
  createDocumentVersion,
  replaceVersion,
  TRANSITIONS,
  transitionVersion,
  type ApprovalState,
} from './documents.js';

function head(id: string, state: ApprovalState, documentId = 'doc-1'): QueryRow {
  return { id, document_id: documentId, approval_state: state };
}

describe('canTransition', () => {
  it('allows the documented graph and nothing else', () => {
    expect(canTransition('draft', 'in_review')).toBe(true);
    expect(canTransition('in_review', 'approved')).toBe(true);
    expect(canTransition('rejected', 'draft')).toBe(true);
    expect(canTransition('superseded', 'archived')).toBe(true);
    // Succession runs only through replaceVersion (records the link).
    expect(canTransition('approved', 'superseded')).toBe(false);
    expect(canTransition('draft', 'approved')).toBe(false);
    expect(canTransition('approved', 'draft')).toBe(false);
    expect(canTransition('archived', 'draft')).toBe(false);
    expect(canTransition('superseded', 'approved')).toBe(false);
    const states = new Set<ApprovalState>();
    for (const from of APPROVAL_STATES) {
      states.add(from);
    }
    expect(states.size).toBe(6);
  });
});

describe('createDocument/createDocumentVersion', () => {
  it('writes tenant-scoped rows and rejects blank input', async () => {
    const seen: unknown[][] = [];
    const query = async (sql: string, params?: unknown[]) => {
      seen.push(params ?? []);
      expect(sql).toContain('tenant_id');
      return { rows: [{ id: 'x-1' }] };
    };
    await expect(
      createDocument(query, { tenantId: 't', sourceType: 'pdf', title: 'Manual' }),
    ).resolves.toEqual({
      id: 'x-1',
    });
    await expect(
      createDocument(query, { tenantId: 't', sourceType: 'pdf', title: '  ' }),
    ).rejects.toThrow(/source type and a title/);
    await expect(
      createDocumentVersion(query, {
        tenantId: 't',
        documentId: 'd',
        versionLabel: 'v1',
        blobFileId: '',
      }),
    ).rejects.toThrow(/label and a blob file/);
    expect(seen[0]).toContain('t');
  });
});

describe('transitionVersion', () => {
  it('moves along legal edges with tenant scope', async () => {
    const seen: string[] = [];
    const query = async (sql: string) => {
      seen.push(sql);
      if (sql.startsWith('select id, document_id')) {
        return { rows: [head('v-1', 'in_review')] };
      }
      return { rows: [] };
    };
    await expect(
      transitionVersion(query, { tenantId: 't-1', versionId: 'v-1', to: 'approved' }),
    ).resolves.toEqual({ id: 'v-1', from: 'in_review', to: 'approved' });
    expect(seen.join('\n')).toContain('tenant_id');
  });

  it('refuses illegal jumps and foreign rows', async () => {
    const query = async () => ({ rows: [head('v-1', 'draft')] });
    await expect(
      transitionVersion(query, { tenantId: 't-1', versionId: 'v-1', to: 'approved' }),
    ).rejects.toThrow(/illegal version transition/);
    const missing = async () => ({ rows: [] });
    await expect(
      transitionVersion(missing, { tenantId: 't-1', versionId: 'v-9', to: 'archived' }),
    ).rejects.toThrow(/not found/);
  });
});

describe('replaceVersion', () => {
  it('retires the old row and links the new one atomically', async () => {
    const calls: string[] = [];
    const smart = {
      query: async (sql: string, params?: unknown[]) => {
        calls.push(sql);
        if (sql.startsWith('select id, document_id')) {
          const id = params?.[1];
          if (id === 'old') {
            return { rows: [head('old', 'approved')] };
          }
          return { rows: [head('new', 'approved')] };
        }
        return { rows: [] };
      },
      release: () => {},
    };
    await expect(
      replaceVersion(async () => smart, {
        tenantId: 't-1',
        oldVersionId: 'old',
        newVersionId: 'new',
      }),
    ).resolves.toEqual({ oldVersionId: 'old', newVersionId: 'new' });
    expect(calls[0]).toBe('begin');
    expect(calls).toContain(
      "update document_version set approval_state = 'superseded', effective_to = now() where tenant_id = $1 and id = $2",
    );
    expect(calls[calls.length - 1]).toBe('commit');
  });

  it('refuses to supersede a version with itself', async () => {
    let connected = false;
    await expect(
      replaceVersion(
        async () => {
          connected = true;
          return { query: async () => ({ rows: [] }), release: () => {} };
        },
        { tenantId: 't-1', oldVersionId: 'same', newVersionId: 'same' },
      ),
    ).rejects.toThrow(/with itself/);
    expect(connected).toBe(false);
  });

  it('refuses unapproved rows, foreign documents, and rolls back', async () => {
    const calls: string[] = [];
    const smart = {
      query: async (sql: string, params?: unknown[]) => {
        calls.push(sql);
        if (sql.startsWith('select id, document_id')) {
          const id = params?.[1];
          if (id === 'old') {
            return { rows: [head('old', 'approved')] };
          }
          return { rows: [head('new', 'in_review')] };
        }
        return { rows: [] };
      },
      release: () => {},
    };
    await expect(
      replaceVersion(async () => smart, {
        tenantId: 't-1',
        oldVersionId: 'old',
        newVersionId: 'new',
      }),
    ).rejects.toThrow(/both versions must be approved/);
    expect(calls).toContain('rollback');
    expect(calls.some((s) => s.includes('superseded'))).toBe(false);
  });
});

describe('transition graph anti-drift', () => {
  it('matches every database graph definition (all must agree)', async () => {
    const { readdir, readFile } = await import('node:fs/promises');
    const { dirname, join } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const here = dirname(fileURLToPath(import.meta.url));
    const dir = join(here, '..', '..', 'db', 'migrations');
    const names = (await readdir(dir)).filter((n) => n.endsWith('.sql')).sort();
    const graphs: string[] = [];
    for (const name of names) {
      const sql = await readFile(join(dir, name), 'utf8');
      for (const line of sql.split('\n')) {
        if (line.startsWith('-- LEGAL-TRANSITIONS:')) {
          graphs.push(line.replace('-- LEGAL-TRANSITIONS:', '').trim());
        }
      }
    }
    expect(graphs.length).toBeGreaterThan(0);
    for (const graph of graphs) {
      expect(graph, 'all LEGAL-TRANSITIONS definitions must agree').toBe(graphs[0]);
    }
    const triggerGraph = new Map<string, string[]>();
    for (const edge of (graphs[0] as string).split(';')) {
      const trimmed = edge.trim();
      if (!trimmed) {
        continue;
      }
      const [from, tos] = trimmed.split('>');
      triggerGraph.set(
        (from as string).trim(),
        (tos as string)
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      );
    }
    for (const from of APPROVAL_STATES) {
      const expected = [...(TRANSITIONS[from] as readonly string[])];
      if (from === 'approved') {
        expected.push('superseded');
      }
      expect(triggerGraph.get(from)?.sort(), from).toEqual(expected.sort());
    }
  });
});
