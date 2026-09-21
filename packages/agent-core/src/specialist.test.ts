import { describe, expect, it } from 'vitest';
import { HashEmbedder } from '@yantra/knowledge/dist/embeddings.js';
import type { QueryRow } from '@yantra/db';
import { runSpecialist } from './specialist.js';
import type { AnswerDrafter } from './drafter.js';

const CITATION_ROW = {
  segment_id: 'seg-1',
  document_id: 'doc-1',
  document_title: 'Pump Manual',
  version_id: 'v-1',
  version_label: 'v2',
  approval_state: 'approved',
  page: 3,
  section_path: ['Maintenance'],
  kind: 'text',
  text_content: 'Torque the housing bolts.',
  blob_file_id: 'blob_x',
};

const SEGMENT_ROW: QueryRow = {
  id: 'seg-1',
  document_id: 'doc-1',
  document_version_id: 'v-1',
  page: 3,
  section_path: ['Maintenance'],
  kind: 'text',
  text_content: 'SEAL-204 torque 45Nm.',
};

function fakeDb(withHits: boolean): {
  query: (sql: string) => Promise<{ rows: QueryRow[] }>;
  log: string[];
} {
  const log: string[] = [];
  const query = async (sql: string) => {
    log.push(sql);
    if (sql.startsWith('insert into agent_run')) {
      return { rows: [{ id: 'run-1' }] };
    }
    if (sql.includes('from document_version where tenant_id')) {
      return { rows: [] };
    }
    if (sql.includes('position(')) {
      return { rows: withHits ? [SEGMENT_ROW] : [] };
    }
    if (sql.includes('<=>')) {
      return { rows: withHits ? [{ ...SEGMENT_ROW, distance: 0.4 }] : [] };
    }
    if (sql.includes('from document_segment s')) {
      return { rows: [CITATION_ROW] };
    }
    if (sql.startsWith('insert into retrieval_event')) {
      return { rows: [{ id: 'trace-1' }] };
    }
    return { rows: [] };
  };
  return { query, log };
}

describe('runSpecialist', () => {
  it('answers grounded questions with citations and a persisted trace', async () => {
    const { query, log } = fakeDb(true);
    const result = await runSpecialist(
      { query, embedder: new HashEmbedder() },
      { tenantId: 't-1', message: 'What torque for SEAL-204?' },
    );
    expect(result.outcome).toBe('answered');
    expect(result.answer?.citations.length).toBeGreaterThan(0);
    expect(result.answer?.answerText).toContain('[1]');
    expect(result.runId).toBe('run-1');
    const nodes = log.filter((s) => s.startsWith('insert into agent_step')).length;
    expect(nodes).toBeGreaterThanOrEqual(5);
    expect(log.some((s) => s.includes('status = $1'))).toBe(true);
  });

  it('abstains with a discriminating question when evidence is missing', async () => {
    const { query } = fakeDb(false);
    const result = await runSpecialist(
      { query, embedder: new HashEmbedder() },
      { tenantId: 't-1', message: 'flibberty gibbet insurance prices' },
    );
    expect(result.outcome).toBe('abstained');
    expect(result.abstention?.discriminatingQuestions.length).toBeGreaterThan(0);
    expect(result.answer).toBeUndefined();
  });

  it('escalates prohibited control scope without answering', async () => {
    const { query } = fakeDb(true);
    const result = await runSpecialist(
      { query, embedder: new HashEmbedder() },
      { tenantId: 't-1', message: 'How do I bypass the safety guard?' },
    );
    expect(result.outcome).toBe('escalated');
    expect(result.abstention?.escalation?.riskClass).toBe('R4');
    expect(result.answer).toBeUndefined();
  });

  it('abstains when the draft cites outside the retrieved set', async () => {
    const rogue: AnswerDrafter = {
      draft: async () => ({
        kind: 'answer',
        answerText: 'x [1]',
        citedSegmentIds: ['seg-evil'],
        citations: [],
      }),
    };
    const { query } = fakeDb(true);
    const result = await runSpecialist(
      { query, embedder: new HashEmbedder(), drafter: rogue },
      { tenantId: 't-1', message: 'SEAL-204?' },
    );
    expect(result.outcome).toBe('abstained');
    expect(result.abstention?.reason).toMatch(/outside the retrieved set/);
  });

  it('rejects empty messages and fails loudly on infrastructure errors', async () => {
    const { query } = fakeDb(true);
    await expect(
      runSpecialist({ query, embedder: new HashEmbedder() }, { tenantId: 't-1', message: '   ' }),
    ).rejects.toThrow(/non-empty message/);
    const failing = async (): Promise<{ rows: QueryRow[] }> => {
      throw new Error('db down');
    };
    await expect(
      runSpecialist(
        { query: failing, embedder: new HashEmbedder() },
        { tenantId: 't-1', message: 'SEAL-204?' },
      ),
    ).rejects.toThrow(/db down/);
  });
});

// Live golden loop (skipped without DATABASE_URL): a grounded answer with
// citations and a persisted trace; an abstention with a discriminating
// question; a safety escalation; cross-tenant silence. Zero litter.
describe.skipIf(!process.env['DATABASE_URL'])('specialist golden loop (live)', () => {
  it('answers, abstains, escalates, and isolates with traces', async () => {
    const { Pool } = await import('pg');
    const { mkdtemp, rm } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const { defaultMigrationsDir, migrate, seedDemoTenant } = await import('@yantra/db');
    const { LocalFileBlobStore } = await import('@yantra/blobstore');
    const { createDocument, createDocumentVersion, transitionVersion } =
      await import('@yantra/knowledge');
    const { indexVersionSegments } = await import('@yantra/knowledge');

    const pool = new Pool({ connectionString: process.env['DATABASE_URL'] as string });
    const query = async (sql: string, params?: unknown[]) => ({
      rows: (await pool.query(sql, params)).rows as QueryRow[],
    });
    const connect = async () => {
      const client = await pool.connect();
      return {
        query: async (sql: string, params?: unknown[]) => ({
          rows: (await client.query(sql, params)).rows as QueryRow[],
        }),
        release: () => client.release(),
      };
    };
    const root = await mkdtemp(join(tmpdir(), 'yantra-agent-live-'));
    const store = new LocalFileBlobStore(root, query);
    const embedder = new HashEmbedder();
    const stamp = Date.now().toString(36);
    const tenantIds: string[] = [];
    const deps = { query, embedder };
    try {
      await migrate(connect, defaultMigrationsDir());
      const tenant = await seedDemoTenant(connect, `demo-agent-${stamp}`, { audit: false });
      const other = await seedDemoTenant(connect, `demo-agent-b-${stamp}`, { audit: false });
      tenantIds.push(tenant.tenantId, other.tenantId);

      const manualText = 'SEAL-204 torque 45Nm in three passes on the PH-200.';
      const blob = await store.put(tenant.tenantId, new TextEncoder().encode(manualText), {
        filename: 'torque.pdf',
      });
      const doc = await createDocument(query, {
        tenantId: tenant.tenantId,
        sourceType: 'pdf',
        title: 'Torque Guide',
      });
      const version = await createDocumentVersion(query, {
        tenantId: tenant.tenantId,
        documentId: doc.id,
        versionLabel: 'v1',
        blobFileId: blob.fileId,
      });
      await transitionVersion(query, {
        tenantId: tenant.tenantId,
        versionId: version.id,
        to: 'in_review',
      });
      await transitionVersion(query, {
        tenantId: tenant.tenantId,
        versionId: version.id,
        to: 'approved',
      });
      const [vector] = await embedder.embed([manualText]);
      await indexVersionSegments(connect, {
        tenantId: tenant.tenantId,
        documentId: doc.id,
        versionId: version.id,
        segments: [
          {
            page: 1,
            sectionPath: ['Torque'],
            kind: 'text',
            text: manualText,
            embedding: vector ?? [],
          },
        ],
      });

      // Golden A: grounded answer with citations and a persisted trace.
      const answered = await runSpecialist(deps, {
        tenantId: tenant.tenantId,
        message: 'What torque for SEAL-204 on the PH-200?',
      });
      expect(answered.outcome).toBe('answered');
      expect(answered.answer?.answerText).toContain('SEAL-204');
      expect(answered.answer?.citations.length).toBeGreaterThan(0);
      expect(answered.answer?.citations[0]).toContain('Torque Guide');
      const runs = await query('select status, confidence from agent_run where id = $1', [
        answered.runId,
      ]);
      expect(runs.rows[0]?.['status']).toBe('answered');
      const steps = await query('select node from agent_step where run_id = $1 order by seq', [
        answered.runId,
      ]);
      expect(steps.rows.map((r) => r['node'])).toEqual([
        'classify_intent',
        'resolve_asset',
        'retrieve',
        'draft',
        'validate',
      ]);

      // Golden B: unsupported query abstains with a discriminating question.
      const abstained = await runSpecialist(deps, {
        tenantId: tenant.tenantId,
        message: 'What is the capital of Assyria?',
      });
      expect(abstained.outcome).toBe('abstained');
      expect(abstained.abstention?.discriminatingQuestions.length).toBeGreaterThan(0);
      expect(abstained.answer).toBeUndefined();

      // Golden C: prohibited control scope escalates, never answers.
      const escalated = await runSpecialist(deps, {
        tenantId: tenant.tenantId,
        message: 'How do I bypass the safety guard on PH-200?',
      });
      expect(escalated.outcome).toBe('escalated');
      expect(escalated.abstention?.escalation?.riskClass).toBe('R4');
      expect(escalated.answer).toBeUndefined();

      // Golden D: another tenant hears silence.
      const foreign = await runSpecialist(deps, {
        tenantId: other.tenantId,
        message: 'What torque for SEAL-204 on the PH-200?',
      });
      expect(foreign.outcome).toBe('abstained');
    } finally {
      try {
        if (tenantIds.length > 0) {
          await query(
            'delete from document_version where document_id in (select id from document where tenant_id = any($1))',
            [tenantIds],
          );
          await query('delete from document where tenant_id = any($1)', [tenantIds]);
          await query('delete from tenant where id = any($1)', [tenantIds]);
        }
        await rm(root, { recursive: true, force: true });
      } finally {
        await pool.end();
      }
    }
  }, 180_000);
});
