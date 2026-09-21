import { PDFDocument, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { classifyPdfError, parsePdf } from './pdf.js';

async function buildManualPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const p1 = doc.addPage([595, 842]);
  p1.drawText('Pump Manual', { x: 60, y: 760, size: 24, font: bold });
  p1.drawText('Covers installation and service for the PH-200 family.', {
    x: 60,
    y: 730,
    size: 12,
    font: helv,
  });
  p1.drawText('Safety', { x: 60, y: 690, size: 16, font: bold });
  p1.drawText('Isolate power before opening the cabinet.', { x: 60, y: 668, size: 12, font: helv });

  const p2 = doc.addPage([595, 842]);
  p2.drawText('Maintenance', { x: 60, y: 760, size: 24, font: bold });
  const rows = [
    ['Part', 'Qty', 'Note'],
    ['SEAL-204', '2', 'Viton'],
    ['BRG-110', '1', 'Sealed'],
    ['FLT-09', '4', 'Mesh'],
  ];
  rows.forEach((row, r) => {
    const y = 700 - r * 24;
    p2.drawText(row[0] ?? '', { x: 60, y, size: 12, font: r === 0 ? bold : helv });
    p2.drawText(row[1] ?? '', { x: 220, y, size: 12, font: helv });
    p2.drawText(row[2] ?? '', { x: 300, y, size: 12, font: helv });
  });
  p2.drawText('Torque values live in the fitment table, never in prose.', {
    x: 60,
    y: 560,
    size: 12,
    font: helv,
  });

  const p3 = doc.addPage([595, 842]);
  p3.drawText('Appendix', { x: 60, y: 760, size: 24, font: bold });
  p3.drawText('Revision history for auditors.', { x: 60, y: 730, size: 12, font: helv });

  return doc.save();
}

describe('parsePdf', () => {
  it('preserves page numbers and nested section paths', async () => {
    const parsed = await parsePdf(await buildManualPdf());
    expect(parsed.numPages).toBe(3);
    for (const segment of parsed.segments) {
      expect(segment.page).toBeGreaterThanOrEqual(1);
      expect(segment.page).toBeLessThanOrEqual(3);
      expect(segment.sectionPath.length).toBeGreaterThan(0);
    }
    const title = parsed.segments.find((s) => s.text === 'Pump Manual');
    expect(title?.kind).toBe('heading');
    expect(title?.page).toBe(1);
    expect(title?.sectionPath).toEqual(['Pump Manual']);
    const safety = parsed.segments.find((s) => s.text.includes('Isolate power'));
    expect(safety?.sectionPath).toEqual(['Pump Manual', 'Safety']);
    const appendix = parsed.segments.find((s) => s.text === 'Appendix');
    expect(appendix?.page).toBe(3);
  });

  it('keeps table rows grouped instead of scattering cells', async () => {
    const parsed = await parsePdf(await buildManualPdf());
    const tables = parsed.segments.filter((s) => s.kind === 'table');
    expect(tables.length).toBeGreaterThanOrEqual(1);
    const table = tables.find((s) => s.page === 2);
    expect(table?.table?.rows).toEqual([
      ['Part', 'Qty', 'Note'],
      ['SEAL-204', '2', 'Viton'],
      ['BRG-110', '1', 'Sealed'],
      ['FLT-09', '4', 'Mesh'],
    ]);
    const order = table?.text ?? '';
    expect(order.indexOf('SEAL-204') < order.indexOf('BRG-110')).toBe(true);
    expect(order.indexOf('BRG-110') < order.indexOf('FLT-09')).toBe(true);
  });

  it('keeps table-of-contents leaders as text, not tables', async () => {
    const doc = await PDFDocument.create();
    const helv = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([595, 842]);
    page.drawText('Contents', { x: 60, y: 760, size: 24, font: helv });
    const entries: [string, string][] = [
      ['Maintenance', '4'],
      ['Safety', '7'],
    ];
    entries.forEach(([title, folio], i) => {
      const y = 700 - i * 24;
      page.drawText(title, { x: 60, y, size: 12, font: helv });
      page.drawText('........', { x: 300, y, size: 12, font: helv });
      page.drawText(folio, { x: 500, y, size: 12, font: helv });
    });
    const parsed = await parsePdf(await doc.save());
    // Two consecutive leader lines MUST still not become a table.
    expect(parsed.segments.some((s) => s.kind === 'table')).toBe(false);
    expect(parsed.segments.filter((s) => s.text.includes('Maintenance')).length).toBeGreaterThan(0);
  });

  it('leaves same-size bold subheads as text (documented heuristic limit)', async () => {
    const doc = await PDFDocument.create();
    const helv = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const page = doc.addPage([595, 842]);
    page.drawText('Torque specs', { x: 60, y: 760, size: 12, font: bold });
    page.drawText('See the fitment table.', { x: 60, y: 740, size: 12, font: helv });
    const parsed = await parsePdf(await doc.save());
    expect(parsed.segments.every((s) => s.kind === 'text')).toBe(true);
  });

  it('is a pure function of bytes: retries reproduce the parse', async () => {
    const bytes = await buildManualPdf();
    const first = await parsePdf(bytes);
    const second = await parsePdf(bytes);
    expect(second).toEqual(first);
  });

  it('reports empty and corrupt inputs with codes', async () => {
    await expect(parsePdf(new Uint8Array())).rejects.toMatchObject({ code: 'empty' });
    await expect(parsePdf(new Uint8Array([0, 1, 2, 3, 4]))).rejects.toMatchObject({
      code: 'corrupt',
    });
  });

  it('refuses inputs beyond the parse budget', async () => {
    const { MAX_PDF_BYTES } = await import('./pdf.js');
    await expect(parsePdf(new Uint8Array(MAX_PDF_BYTES + 1))).rejects.toMatchObject({
      code: 'corrupt',
    });
  });

  it('classifies password failures as encrypted without a fixture binary', () => {
    const passwordError = new Error('needs password');
    passwordError.name = 'PasswordException';
    expect(classifyPdfError(passwordError)).toBe('encrypted');
    expect(classifyPdfError(new Error('boom'))).toBe('corrupt');
    expect(classifyPdfError('string failure')).toBe('corrupt');
  });

  it('needs no explicit teardown on the v6 Node path', async () => {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const bytes = await buildManualPdf();
    const loading = pdfjsLib.getDocument({
      data: bytes.slice(),
      useWorkerFetch: false,
      useSystemFonts: true,
    });
    const doc = await loading.promise;
    // Pins the runtime fact behind "no destroy call": if pdfjs ever exposes
    // destroy(), this fails and teardown must be revisited.
    expect((doc as unknown as Record<string, unknown>)['destroy']).toBeUndefined();
  });
});
