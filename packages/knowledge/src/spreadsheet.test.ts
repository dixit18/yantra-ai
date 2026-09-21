import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import {
  normalizeToken,
  parseCsv,
  parseCsvAsync,
  parseXlsx,
  parseXlsxAsync,
} from './spreadsheet.js';

function buildPartsWorkbook(): Uint8Array {
  const workbook = XLSX.utils.book_new();
  const parts = XLSX.utils.aoa_to_sheet([
    ['ACME Pumps — Spare Parts List'],
    ['Part No', 'Description', 'Qty', 'Models'],
    ['00123', 'Mechanical seal kit', 2, 'PH-200, PH-250'],
    ['BRG-110', 'Bearing 6308 sealed', 1, 'PH-200'],
    ['FLT-09', 'Suction filter mesh', 4, 'PH-250'],
  ]);
  XLSX.utils.book_append_sheet(workbook, parts, 'Parts');
  const fitment = XLSX.utils.aoa_to_sheet([
    ['Model', 'Seal kit', 'Bearing'],
    ['PH-200', '00123', 'BRG-110'],
    ['PH-250', '00123', ''],
  ]);
  XLSX.utils.book_append_sheet(workbook, fitment, 'Fitment');
  const meta = XLSX.utils.aoa_to_sheet([
    ['Received', 'Counted', 'Doubled', 'Flag', 'Problem'],
    [new Date(Date.UTC(2026, 8, 18)), 7, { t: 'n', v: 14, f: 'B2*2' }, true, { t: 'e', v: 7 }],
  ]);
  XLSX.utils.book_append_sheet(workbook, meta, 'Meta');
  const bytes = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as unknown;
  return new Uint8Array(bytes as ArrayBuffer);
}

describe('parseXlsx', () => {
  it('skips title rows and preserves headers', async () => {
    const parsed = parseXlsx(buildPartsWorkbook());
    expect(parsed.sheets.map((s) => s.name)).toEqual(['Parts', 'Fitment', 'Meta']);
    const parts = parsed.sheets[0];
    expect(parts?.headers).toEqual(['Part No', 'Description', 'Qty', 'Models']);
    expect(parts?.headerRowIndex).toBe(1);
    expect(parts?.titleRowsSkipped).toBe(1);
  });

  it('skips long title runs and keeps duplicate headers verbatim', async () => {
    const workbook = XLSX.utils.book_new();
    const titleRows = Array.from({ length: 10 }, (_, i) => [`Cover line ${i + 1}`]);
    const sheet = XLSX.utils.aoa_to_sheet([
      ...titleRows,
      ['Part', 'Part', 'Qty'],
      ['SEAL-204', 'SEAL-204-X', 2],
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Titled');
    const bytes = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as unknown;
    const parsed = parseXlsx(new Uint8Array(bytes as ArrayBuffer));
    // Duplicates are preserved, never deduplicated: dedup belongs to
    // ingestion keying, and any suffix scheme would fabricate names.
    expect(parsed.sheets[0]?.headers).toEqual(['Part', 'Part', 'Qty']);
    expect(parsed.sheets[0]?.headerRowIndex).toBe(10);
    expect(parsed.sheets[0]?.titleRowsSkipped).toBe(10);
  });

  it('keeps display text and typed values side by side', async () => {
    const parsed = parseXlsx(buildPartsWorkbook());
    const row = parsed.sheets[0]?.rows[0];
    expect(row?.[0]).toEqual({ text: '00123', value: '00123' });
    expect(row?.[2]).toEqual({ text: '2', value: 2 });
  });

  it('parses every sheet including sparse fitment rows', async () => {
    const parsed = parseXlsx(buildPartsWorkbook());
    const fitment = parsed.sheets[1];
    expect(fitment?.rows).toHaveLength(2);
    expect(fitment?.rows[1]).toEqual([
      { text: 'PH-250', value: 'PH-250' },
      { text: '00123', value: '00123' },
      { text: '', value: null },
    ]);
  });

  it('offers the async path with identical results', async () => {
    const bytes = buildPartsWorkbook();
    await expect(parseXlsxAsync(bytes)).resolves.toEqual(parseXlsx(bytes));
  });

  it('preserves dates, booleans, formulas, and error cells with types', async () => {
    const parsed = parseXlsx(buildPartsWorkbook());
    const meta = parsed.sheets.find((s) => s.name === 'Meta');
    expect(meta?.headers).toEqual(['Received', 'Counted', 'Doubled', 'Flag', 'Problem']);
    const row = meta?.rows[0];
    expect(row?.[0]?.value instanceof Date).toBe(true);
    expect(row?.[1]).toEqual({ text: '7', value: 7 });
    expect(row?.[2]).toMatchObject({ value: 14, formula: 'B2*2' });
    expect(row?.[3]?.value).toBe(true);
    expect(row?.[3]?.text.length).toBeGreaterThan(0);
    expect(row?.[4]).toMatchObject({ value: '#DIV/0!' });
  });

  it('treats single-column sheets as headerless data, never crowning row zero', async () => {
    const workbook = XLSX.utils.book_new();
    const titleRows = Array.from({ length: 12 }, (_, i) => [`Report line ${i + 1}`]);
    const sheet = XLSX.utils.aoa_to_sheet([...titleRows, ['Part No'], ['SEAL-204'], ['BRG-110']]);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Single');
    const bytes = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as unknown;
    const parsed = parseXlsx(new Uint8Array(bytes as ArrayBuffer));
    // One column carries no structural evidence for which row is the header —
    // claiming row zero would mislabel fourteen rows. Positional access instead.
    expect(parsed.sheets[0]?.headers).toEqual([]);
    expect(parsed.sheets[0]?.rows).toHaveLength(15);
  });

  it('survives 200-column sheets', async () => {
    const workbook = XLSX.utils.book_new();
    const header = Array.from({ length: 200 }, (_, i) => `C${i + 1}`);
    const sheet = XLSX.utils.aoa_to_sheet([header, new Array<string>(200).fill('x')]);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Wide');
    const bytes = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as unknown;
    const parsed = parseXlsx(new Uint8Array(bytes as ArrayBuffer));
    expect(parsed.sheets[0]?.headers).toHaveLength(200);
    expect(parsed.sheets[0]?.rows[0]).toHaveLength(200);
  });

  it('rejects oversize and password-protected workbooks distinctly', async () => {
    const { MAX_XLSX_BYTES } = await import('./spreadsheet.js');
    await expect(parseXlsxAsync(new Uint8Array(MAX_XLSX_BYTES + 1))).rejects.toMatchObject({
      code: 'corrupt',
    });
    const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0]);
    await expect(parseXlsxAsync(ole)).rejects.toMatchObject({ code: 'encrypted' });
  });

  it('rejects empty and corrupt inputs with codes', async () => {
    await expect(parseXlsxAsync(new Uint8Array())).rejects.toMatchObject({ code: 'empty' });
    await expect(parseXlsxAsync(new Uint8Array([0, 1, 2, 3, 4]))).rejects.toMatchObject({
      code: 'corrupt',
    });
  });
});

describe('parseCsv', () => {
  const csv = 'Part No,Description,Qty\n00123,Mechanical seal kit,2\nBRG-110,Bearing,1\n';

  it('parses comma text like a single-sheet workbook', async () => {
    const parsed = parseCsv(csv, 'parts');
    expect(parsed.sheets).toHaveLength(1);
    expect(parsed.sheets[0]?.name).toBe('parts');
    expect(parsed.sheets[0]?.headers).toEqual(['Part No', 'Description', 'Qty']);
    expect(parsed.sheets[0]?.rows[0]?.[0]).toEqual({ text: '00123', value: '00123' });
  });

  it('offers the async path and rejects empty text', async () => {
    await expect(parseCsvAsync(csv)).resolves.toEqual(parseCsv(csv));
    await expect(parseCsvAsync('')).rejects.toMatchObject({ code: 'empty' });
    await expect(parseCsvAsync('   \n  ')).rejects.toMatchObject({ code: 'empty' });
  });

  it('handles quotes, commas, and CRLF without a library', () => {
    const parsed = parseCsv('Name,Note\r\n"Seal, kit","say ""hi"""\r\n', 'q');
    expect(parsed.sheets[0]?.rows).toEqual([
      [
        { text: 'Seal, kit', value: 'Seal, kit' },
        { text: 'say "hi"', value: 'say "hi"' },
      ],
    ]);
  });

  it('keeps quoted multiline fields in one row', () => {
    const parsed = parseCsv('Name,Note\n"line one\nline two",plain\n', 'm');
    expect(parsed.sheets[0]?.rows).toEqual([
      [
        { text: 'line one\nline two', value: 'line one\nline two' },
        { text: 'plain', value: 'plain' },
      ],
    ]);
  });

  it('detects semicolon and tab delimiters, strips BOM, rejects dangling quotes', () => {
    const semi = parseCsv('Part;Qty\nSEAL-204;2\n', 's');
    expect(semi.sheets[0]?.headers).toEqual(['Part', 'Qty']);
    const tabbed = parseCsv('Part\tQty\nSEAL-204\t2\n', 't');
    expect(tabbed.sheets[0]?.headers).toEqual(['Part', 'Qty']);
    const bom = parseCsv('\uFEFFPart,Qty\nSEAL-204,2\n', 'b');
    expect(bom.sheets[0]?.headers).toEqual(['Part', 'Qty']);
    expect(() => parseCsv('A,B\n"x,y\n', 'u')).toThrow(/unclosed quote/);
  });
});

describe('normalizeToken', () => {
  it('trims, collapses, and uppercases without touching raw storage', () => {
    expect(normalizeToken('  seal-204  x ')).toBe('SEAL-204 X');
    expect(normalizeToken('brg-110')).toBe('BRG-110');
  });
});
