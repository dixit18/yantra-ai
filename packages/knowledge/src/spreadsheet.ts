// P2-XLSX-013 — spreadsheet parser for parts/fitment tables (XLSX + CSV).
// One library (SheetJS) for both formats, in-process, no native deps.
// Preservation contract: headers verbatim (blanks kept as ''), every cell as
// {text (formatted display), value (typed raw)} — leading-zero part numbers
// stay text, quantities stay numbers. Duplicate header names are preserved,
// never deduplicated: any suffix scheme would fabricate names, so keyed
// consumers handle collisions downstream at ingestion time. Title rows above
// the header are skipped and counted, never mistaken for headers. Heavy
// inputs parse through the async entry points (true streaming waits for
// measured need — see below).
import * as XLSX from 'xlsx';

export type SheetErrorCode = 'empty' | 'corrupt' | 'encrypted';

export class SpreadsheetParseError extends Error {
  readonly code: SheetErrorCode;

  constructor(code: SheetErrorCode, message: string) {
    super(message);
    this.name = 'SpreadsheetParseError';
    this.code = code;
  }
}

// Parse working set is a small multiple of input (inflated ZIP + cell
// objects). Matches the blob cap so anything storable is parseable.
export const MAX_XLSX_BYTES = 10 * 1024 * 1024;

export interface SheetCell {
  text: string;
  value: string | number | boolean | Date | null;
  formula?: string;
}

export interface SheetTable {
  name: string;
  headers: string[];
  headerRowIndex: number;
  titleRowsSkipped: number;
  rows: SheetCell[][];
}

export interface ParsedWorkbook {
  sheets: SheetTable[];
}

// Part/model token normalization for the later exact-token retrieval path.
// Lives here (not applied during parse) so raw values are never lost.
export function normalizeToken(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toUpperCase();
}

interface RawCell {
  v?: unknown;
  w?: string;
  f?: string;
  t?: string;
}

function cellOf(raw: unknown): SheetCell {
  const cell = (raw ?? {}) as RawCell;
  // Error cells carry numeric codes (7 = #DIV/0!) that must never pass as
  // data: surface the error literal instead. A missing/garbled label degrades
  // to #ERROR rather than inventing a value.
  if (cell.t === 'e') {
    const label =
      typeof cell.w === 'string' && cell.w && cell.w !== 'undefined' ? cell.w : '#ERROR';
    return { text: label, value: label };
  }
  let value: SheetCell['value'];
  if (cell.v instanceof Date) {
    value = cell.v;
  } else if (
    typeof cell.v === 'string' ||
    typeof cell.v === 'number' ||
    typeof cell.v === 'boolean'
  ) {
    value = cell.v === '' ? null : cell.v;
  } else {
    value = null;
  }
  // Blank means absent: SheetJS may surface empty cells as '' strings.
  const text = typeof cell.w === 'string' ? cell.w : value === null ? '' : String(value);
  const out: SheetCell = { text, value };
  // Formula cells carry the expression alongside the cached value so later
  // stages can tell computed from authored data.
  if (typeof cell.f === 'string' && cell.f.length > 0) {
    out.formula = cell.f;
  }
  return out;
}

function nonEmptyCount(cells: SheetCell[]): number {
  return cells.filter((c) => c.text.trim().length > 0).length;
}

function tableFromGrid(name: string, grid: SheetCell[][]): SheetTable {
  // Prefer the first multi-column header (skips title rows). A sheet with
  // only single-column rows is headerless: one column carries no structural
  // evidence for which row is the header, so claiming row zero would mislabel
  // the sheet. Consumers read such sheets positionally.
  const headerRowIndex = grid.findIndex((line) => nonEmptyCount(line) >= 2);
  if (headerRowIndex < 0) {
    return { name, headers: [], headerRowIndex: 0, titleRowsSkipped: 0, rows: grid };
  }
  const headerRow = grid[headerRowIndex] as SheetCell[];
  const width = Math.max(headerRow.length, 1);
  const headers = headerRow.map((c) => c.text.trim());
  while (headers.length < width) {
    headers.push('');
  }
  const rows = grid.slice(headerRowIndex + 1).map((line) => {
    const cells = [...line];
    while (cells.length < width) {
      cells.push({ text: '', value: null });
    }
    return cells.slice(0, width);
  });
  return { name, headers, headerRowIndex, titleRowsSkipped: headerRowIndex, rows };
}

function readWorkbook(workbook: XLSX.WorkBook): ParsedWorkbook {
  const sheets: SheetTable[] = [];
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    if (!sheet) {
      continue;
    }
    const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1:A1');
    const grid: SheetCell[][] = [];
    for (let r = range.s.r; r <= range.e.r; r += 1) {
      const line: SheetCell[] = [];
      for (let c = range.s.c; c <= range.e.c; c += 1) {
        const address = XLSX.utils.encode_cell({ r, c });
        line.push(cellOf(sheet[address] as unknown));
      }
      if (nonEmptyCount(line) > 0) {
        grid.push(line);
      }
    }
    sheets.push(tableFromGrid(name, grid));
  }
  return { sheets };
}

export function parseXlsx(bytes: Uint8Array): ParsedWorkbook {
  if (bytes.length === 0) {
    throw new SpreadsheetParseError('empty', 'cannot parse an empty workbook');
  }
  if (bytes.length > MAX_XLSX_BYTES) {
    throw new SpreadsheetParseError(
      'corrupt',
      `workbook exceeds the ${MAX_XLSX_BYTES} byte parse limit`,
    );
  }
  // Modern .xlsx files are ZIP archives. OLE compound files are password-
  // protected (or legacy .xls) — surfaced as encrypted, not corrupt.
  // (Legacy OLE .xls is out of MVP scope; see DECISIONS.)
  if (
    bytes.length >= 8 &&
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0
  ) {
    throw new SpreadsheetParseError(
      'encrypted',
      'OLE workbook (password-protected or legacy .xls)',
    );
  }
  if (bytes.length < 2 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new SpreadsheetParseError('corrupt', 'not an XLSX (ZIP) file');
  }
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(bytes, { type: 'buffer', cellDates: true });
  } catch (error) {
    throw new SpreadsheetParseError(
      'corrupt',
      `workbook could not be opened: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
  }
  if (workbook.SheetNames.length === 0) {
    throw new SpreadsheetParseError('corrupt', 'workbook contains no worksheets');
  }
  return readWorkbook(workbook);
}

export function parseCsv(text: string, name = 'csv'): ParsedWorkbook {
  // Excel exports start with a BOM — strip it before it poisons the header.
  const cleaned = text.replace(/^\uFEFF/, '');
  if (cleaned.trim().length === 0) {
    throw new SpreadsheetParseError('empty', 'cannot parse empty CSV text');
  }
  // Owned RFC-4180-subset parser (comma, quotes, CRLF): CSV carries no type
  // information, so every field stays a string — SheetJS would coerce '00123'
  // to 123 and destroy part numbers. Numeric meaning belongs to later
  // schema-aware stages, never to inference here. Delimiter is detected from
  // the first line (comma, semicolon, tab) so EU exports don't collapse.
  const delimiter = detectDelimiter(cleaned);
  const rawRows = parseCsvGrid(cleaned, delimiter).filter((line) =>
    line.some((cell) => cell.trim().length > 0),
  );
  if (rawRows.length === 0) {
    throw new SpreadsheetParseError('corrupt', 'CSV contains no rows');
  }
  const grid: SheetCell[][] = rawRows.map((line) =>
    line.map((field) => ({ text: field, value: field === '' ? null : field })),
  );
  return { sheets: [tableFromGrid(name, grid)] };
}

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const counts = new Map([
    [',', 0],
    [';', 0],
    ['\t', 0],
  ]);
  let quoted = false;
  for (let i = 0; i < firstLine.length; i += 1) {
    const ch = firstLine[i];
    if (ch === '"') {
      quoted = !quoted;
    } else if (!quoted && counts.has(ch as string)) {
      counts.set(ch as string, (counts.get(ch as string) ?? 0) + 1);
    }
  }
  let best = ',';
  let bestCount = 0;
  for (const [delimiter, count] of counts) {
    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  }
  return best;
}

function parseCsvGrid(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let i = 0;
  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    rows.push(row);
    row = [];
  };
  while (i < text.length) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      quoted = true;
      i += 1;
      continue;
    }
    if (ch === delimiter) {
      pushField();
      i += 1;
      continue;
    }
    if (ch === '\r' && text[i + 1] === '\n') {
      pushField();
      pushRow();
      i += 2;
      continue;
    }
    if (ch === '\n') {
      pushField();
      pushRow();
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
    continue;
  }
  pushField();
  if (row.length > 0) {
    pushRow();
  }
  if (quoted) {
    throw new SpreadsheetParseError('corrupt', 'CSV has an unclosed quote');
  }
  return rows;
}

function yieldLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

export async function parseXlsxAsync(bytes: Uint8Array): Promise<ParsedWorkbook> {
  await yieldLoop();
  return parseXlsx(bytes);
}

export async function parseCsvAsync(text: string, name = 'csv'): Promise<ParsedWorkbook> {
  await yieldLoop();
  return parseCsv(text, name);
}
