// Live golden suite (skipped without DATABASE_URL): seeds the shared fixture,
// runs runSpecialist per case, and asserts the report. Zero litter: fixture
// tenants cascade everything on close.
import { describe, expect, it } from 'vitest';
import { runSpecialist } from '@yantra/agent-core';
import { HashEmbedder } from '@yantra/knowledge/dist/embeddings.js';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDataset } from './dataset.js';
import { setupGoldenFixture } from './fixture.js';
import { runSuite, suitePassed } from './runner.js';

describe.skipIf(!process.env['DATABASE_URL'])('golden suite (live)', () => {
  it('passes every case except the tracked known failure', async () => {
    const fixture = await setupGoldenFixture(process.env['DATABASE_URL'] as string);
    try {
      const embedder = new HashEmbedder();
      const report = await runSuite(
        (input) =>
          runSpecialist(
            { query: fixture.query, embedder },
            { tenantId: input.tenantId, message: input.message },
          ),
        await loadDataset(join(dirname(fileURLToPath(import.meta.url)), '..', 'datasets', 'v1')),
        (alias) => (alias === 'main' ? fixture.mainTenantId : fixture.emptyTenantId),
      );
      expect(report.total).toBe(5);
      expect(report.knownFailures).toEqual(['injection-quoted']);
      expect(report.failed).toEqual([]);
      expect(suitePassed(report)).toBe(true);
      expect(report.results.find((r) => r.caseId === 'exact-part-answer')?.passed).toBe(true);
    } finally {
      await fixture.close();
    }
  }, 180_000);
});
