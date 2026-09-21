import { expect, test } from '@playwright/test';

// P2-CITE-016: citations resolve to the exact version/page; foreign sources
// stay unreachable. Negative paths run everywhere (no secrets needed); the
// positive path runs only with DATABASE_URL + APP_SECRET and skips in CI.

test('viewer without a token stays locked with no source leak', async ({ page }) => {
  await page.goto('/citations/seg-unknown');
  await expect(page.getByTestId('citation-locked')).toBeVisible();
  await expect(page.getByTestId('source-pdf')).toHaveCount(0);
});

test('forged token stays locked', async ({ page }) => {
  await page.goto('/citations/seg-unknown?token=forged-token-value');
  await expect(page.getByTestId('citation-locked')).toBeVisible();
});

test('tampered and unknown source URLs share one identical 404', async ({ request }) => {
  const tampered = await request.get(
    '/api/blobs/blob_abcdef0123456789abcdef0123456789?tenant=t-1&exp=9999999999&sig=bad',
  );
  expect(tampered.status()).toBe(404);
  const unknown = await request.get(
    '/api/blobs/blob_00000000000000000000000000000000?tenant=t-1&exp=9999999999&sig=bad',
  );
  expect(unknown.status()).toBe(404);
  expect(await tampered.json()).toEqual(await unknown.json());
});

test('signed citation opens the exact version and page', async ({ page, request }) => {
  test.skip(
    !process.env['DATABASE_URL'] || !process.env['APP_SECRET'],
    'needs DATABASE_URL + APP_SECRET',
  );
  const { Pool } = await import('pg');
  const { PDFDocument, StandardFonts } = await import('pdf-lib');
  const { seedDemoTenant } = await import('@yantra/db');
  const { LocalFileBlobStore } = await import('@yantra/blobstore');
  const { issueToken } = await import('@yantra/auth');
  const { createDocument, createDocumentVersion } = await import('@yantra/knowledge');
  const { indexVersionSegments } = await import('@yantra/knowledge');
  const { HashEmbedder } = await import('@yantra/knowledge/dist/embeddings.js');

  const pool = new Pool({ connectionString: process.env['DATABASE_URL'] as string });
  const query = async (sql: string, params?: unknown[]) => ({
    rows: (await pool.query(sql, params)).rows as Record<string, unknown>[],
  });
  const connect = async () => {
    const client = await pool.connect();
    return {
      query: async (sql: string, params?: unknown[]) => ({
        rows: (await client.query(sql, params)).rows as Record<string, unknown>[],
      }),
      release: () => client.release(),
    };
  };
  const stamp = Date.now().toString(36);
  // Blob bytes MUST live under the same root the server reads
  // (LOCAL_BLOB_ROOT, default ./data/uploads, resolved from apps/web exactly
  // like app/lib/db consumers do) — otherwise the viewer resolves while
  // /api/blobs 404s on missing bytes. Per-tenant dirs are removed after.
  const { resolve: resolveRoot, join: joinRoot } = await import('node:path');
  const root = resolveRoot(
    process.cwd(),
    process.env['LOCAL_BLOB_ROOT']?.trim() || './data/uploads',
  );
  const tenantIds: string[] = [];
  try {
    const tenant = await seedDemoTenant(connect, `demo-cite-${stamp}`, { audit: false });
    tenantIds.push(tenant.tenantId);

    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const page1 = pdf.addPage([595, 842]);
    page1.drawText('Torque Guide', { x: 60, y: 760, size: 24, font });
    const page2 = pdf.addPage([595, 842]);
    page2.drawText('SEAL-204 torque 45Nm in three passes.', { x: 60, y: 700, size: 12, font });
    const bytes = new Uint8Array(await pdf.save());

    const store = new LocalFileBlobStore(root, query);
    const ref = await store.put(tenant.tenantId, bytes, {
      filename: 'torque.pdf',
      mimeType: 'application/pdf',
    });
    const doc = await createDocument(query, {
      tenantId: tenant.tenantId,
      sourceType: 'pdf',
      title: 'Torque Guide',
    });
    const version = await createDocumentVersion(query, {
      tenantId: tenant.tenantId,
      documentId: doc.id,
      versionLabel: 'v3',
      blobFileId: ref.fileId,
    });
    const embedder = new HashEmbedder();
    const [vector] = await embedder.embed(['SEAL-204 torque 45Nm in three passes.']);
    await indexVersionSegments(connect, {
      tenantId: tenant.tenantId,
      documentId: doc.id,
      versionId: version.id,
      segments: [
        {
          page: 2,
          sectionPath: ['Torque'],
          kind: 'text',
          text: 'SEAL-204 torque 45Nm in three passes.',
          embedding: (vector ?? []) as number[],
        },
      ],
    });

    const secret = process.env['APP_SECRET'] as string;
    const token = issueToken({ tenantId: tenant.tenantId, userId: tenant.adminUserId }, secret);
    const segment = await query('select id from document_segment where tenant_id = $1 limit 1', [
      tenant.tenantId,
    ]);
    const segmentId = String(segment.rows[0]?.['id']);
    await page.goto(`/citations/${segmentId}?token=${token}`);
    await expect(page.getByTestId('citation-title')).toContainText('Torque Guide v3');
    await expect(page.getByTestId('citation-title')).toContainText('p.2');
    const embed = page.getByTestId('source-pdf');
    await expect(embed).toBeVisible();
    const src = (await embed.getAttribute('src')) ?? '';
    expect(src).toContain(ref.fileId);
    expect(src).toContain('#page=2');

    const bytesResponse = await request.get(src);
    expect(bytesResponse.status()).toBe(200);
    expect(bytesResponse.headers()['content-type']).toContain('application/pdf');
    expect(bytesResponse.headers()['cache-control']).toBe('no-store');
    expect((await bytesResponse.body()).length).toBe(bytes.length);

    // A stored HTML upload serves as inert bytes, never executable markup.
    const evil = await store.put(tenant.tenantId, new TextEncoder().encode('<script>x</script>'), {
      filename: 'evil.html',
      mimeType: 'text/html',
    });
    const { createSourceUrl } = await import('@yantra/knowledge');
    const evilUrl = createSourceUrl({ fileId: evil.fileId, tenantId: tenant.tenantId }, secret);
    const evilResponse = await request.get(evilUrl);
    expect(evilResponse.status()).toBe(200);
    expect(evilResponse.headers()['content-type']).toContain('application/octet-stream');
    expect(evilResponse.headers()['content-security-policy']).toContain('sandbox');
    expect(evilResponse.headers()['x-content-type-options']).toBe('nosniff');
    expect(evilResponse.headers()['cache-control']).toBe('no-store');
    expect(evilResponse.headers()['content-disposition']).toContain('attachment');

    // The viewer page itself refuses to leak the URL bearer as a Referer.
    const viewerResponse = await request.get(`/citations/${segmentId}?token=${token}`);
    expect(viewerResponse.headers()['referrer-policy']).toBe('no-referrer');
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
      // Per-tenant dirs only — root is the shared dev blob store.
      const { rm } = await import('node:fs/promises');
      for (const tenantId of tenantIds) {
        await rm(joinRoot(root, tenantId.toLowerCase()), { recursive: true, force: true });
      }
    } finally {
      await pool.end();
    }
  }
});
