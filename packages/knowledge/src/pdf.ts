// P2-PARSE-012 — structure-preserving PDF parser. pdfjs-dist in-process (no
// worker service, no Python): pages, font-size-ranked section paths, and
// spatially grouped table rows. Reading order comes from positioned glyphs,
// never from hasEOL hints, so untagged PDFs parse the same as tagged ones.
// Pure function of bytes: failures are typed errors, retries just re-invoke.
// Scope limits (documented, not bugs): headings are size-ranked, so same-size
// bold subheads and two-column interleaves stay plain text; single-column
// tables without column gutters are not detected as tables.
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

export type PdfErrorCode = 'empty' | 'encrypted' | 'corrupt';

export class PdfParseError extends Error {
  readonly code: PdfErrorCode;

  constructor(code: PdfErrorCode, message: string) {
    super(message);
    this.name = 'PdfParseError';
    this.code = code;
  }
}

// Maps pdf.js failures to stable codes. Pure so the encrypted branch stays
// tested without shipping an encrypted fixture binary.
export function classifyPdfError(error: unknown): Exclude<PdfErrorCode, 'empty'> {
  const name = error instanceof Error ? error.name : '';
  return name.includes('Password') ? 'encrypted' : 'corrupt';
}

export interface PdfSegment {
  page: number;
  sectionPath: string[];
  kind: 'heading' | 'text' | 'table';
  text: string;
  table?: { rows: string[][] };
}

export interface ParsedPdf {
  numPages: number;
  segments: PdfSegment[];
}

// Parse-time working set runs several times the input size (pdfjs objects +
// glyph caches). Blobs are capped at 10 MB upstream; the parser tolerates a
// margin above that and refuses beyond it instead of OOMing the API process.
export const MAX_PDF_BYTES = 20 * 1024 * 1024;

interface RawItem {
  str: string;
  transform: [number, number, number, number, number, number];
}

interface PlacedItem extends RawItem {
  size: number;
  x: number;
  y: number;
}

function glyphSize(transform: RawItem['transform']): number {
  return Math.hypot(transform[2] ?? 0, transform[3] ?? 0);
}

function bodySize(items: PlacedItem[]): number {
  const counts = new Map<number, number>();
  for (const item of items) {
    const size = Math.round(item.size * 2) / 2;
    counts.set(size, (counts.get(size) ?? 0) + 1);
  }
  let best = 12;
  let bestCount = 0;
  for (const [size, count] of counts) {
    // Ties break toward the smaller size: body copy is near-always the
    // smallest frequent size, and a 1–2 item page must not elect a title.
    if (count > bestCount || (count === bestCount && size < best)) {
      best = size;
      bestCount = count;
    }
  }
  return best;
}

interface PlacedLine {
  y: number;
  items: PlacedItem[];
}

function toLines(items: PlacedItem[], tolerance: number): PlacedLine[] {
  const sorted = [...items].sort((a, b) => b.y - a.y);
  const lines: PlacedLine[] = [];
  for (const item of sorted) {
    const line = lines.find((l) => Math.abs(l.y - item.y) <= tolerance);
    if (line) {
      line.items.push(item);
    } else {
      lines.push({ y: item.y, items: [item] });
    }
  }
  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x);
  }
  return lines;
}

function isRowLine(line: PlacedLine, body: number): boolean {
  if (line.items.length < 3) {
    return false;
  }
  const text = line.items.map((i) => i.str).join('');
  // Dot leaders (table of contents) align in columns but carry no data.
  if (/\.{5,}/.test(text)) {
    return false;
  }
  let wideGaps = 0;
  for (let i = 1; i < line.items.length; i += 1) {
    const prev = line.items[i - 1];
    const current = line.items[i];
    if (prev && current && current.x - prev.x > body * 0.8) {
      wideGaps += 1;
    }
  }
  return wideGaps >= 2;
}

export async function parsePdf(bytes: Uint8Array): Promise<ParsedPdf> {
  if (bytes.length === 0) {
    throw new PdfParseError('empty', 'cannot parse an empty PDF');
  }
  if (bytes.length > MAX_PDF_BYTES) {
    throw new PdfParseError('corrupt', `PDF exceeds the ${MAX_PDF_BYTES} byte parse limit`);
  }
  // Structural typing via unknown: pdfjs major versions drift these shapes,
  // and the parser only needs two members. (v6 exposes no destroy() on the
  // Node path — verified at runtime — so there is nothing to release.)
  let pdfDocument: {
    numPages: number;
    getPage: (n: number) => Promise<unknown>;
  };
  try {
    const loading = pdfjsLib.getDocument({
      data: bytes.slice(),
      useWorkerFetch: false,
      useSystemFonts: true,
    });
    pdfDocument = (await loading.promise) as unknown as typeof pdfDocument;
  } catch (error) {
    const code = classifyPdfError(error);
    throw new PdfParseError(
      code,
      code === 'encrypted'
        ? 'PDF requires a password'
        : `PDF could not be opened: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
  }

  // No explicit teardown on the v6 Node path (no destroy method exists —
  // verified at runtime); the loading task releases workers when settled.
  return extractSegments(pdfDocument);
}

async function extractSegments(pdfDocument: {
  numPages: number;
  getPage: (n: number) => Promise<unknown>;
}): Promise<ParsedPdf> {
  const segments: PdfSegment[] = [];
  // Pass 1: positioned items per page (empty pages contribute nothing).
  // Whitespace-only items are spacing artifacts, not content.
  const pages: { pageNumber: number; placed: PlacedItem[] }[] = [];
  for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
    const page = (await pdfDocument.getPage(pageNumber)) as {
      getTextContent: () => Promise<{ items: unknown[] }>;
    };
    let content: { items: unknown[] };
    try {
      content = await page.getTextContent();
    } catch (error) {
      throw new PdfParseError(
        'corrupt',
        `PDF page ${pageNumber} could not be read: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
    const placed: PlacedItem[] = [];
    for (const raw of content.items) {
      const item = raw as Partial<RawItem>;
      if (typeof item.str !== 'string' || !item.str.trim() || !Array.isArray(item.transform)) {
        continue;
      }
      const transform = item.transform as [number, number, number, number, number, number];
      placed.push({
        str: item.str,
        transform,
        size: glyphSize(transform),
        x: transform[4] ?? 0,
        y: transform[5] ?? 0,
      });
    }
    if (placed.length > 0) {
      pages.push({ pageNumber, placed });
    }
  }
  // Body size and heading ranks are document-wide: a 2-item page must not
  // elect its title, and level indices must mean the same on every page.
  const body = bodySize(pages.flatMap((p) => p.placed));
  const headingSizes = [
    ...new Set(pages.flatMap((p) => p.placed).map((p) => Math.round(p.size * 2) / 2)),
  ]
    .filter((size) => size >= body * 1.2)
    .sort((a, b) => b - a);
  // Section stack carries across pages: a body-continuation page inherits the
  // previous section instead of emitting path-less segments.
  const stack: string[] = [];

  // Pass 2: lines, headings, row-blocks per page.
  for (const { pageNumber, placed } of pages) {
    const tolerance = Math.max(1.5, body * 0.15);
    const lines = toLines(placed, tolerance);

    let rowBlock: string[][] = [];
    const flushRows = (sectionPath: string[]) => {
      if (rowBlock.length >= 2) {
        const width = Math.max(...rowBlock.map((r) => r.length));
        const rows = rowBlock.map((r) => [...r, ...new Array<string>(width - r.length).fill('')]);
        segments.push({
          page: pageNumber,
          sectionPath,
          kind: 'table',
          text: rows.map((r) => r.join(' | ')).join('\n'),
          table: { rows },
        });
      } else {
        for (const single of rowBlock) {
          segments.push({ page: pageNumber, sectionPath, kind: 'text', text: single.join(' ') });
        }
      }
      rowBlock = [];
    };

    for (const line of lines) {
      const text = line.items
        .map((i) => i.str)
        .join('')
        .trim();
      if (!text) {
        continue;
      }
      const maxSize = Math.max(...line.items.map((i) => i.size));
      const level = headingSizes.indexOf(Math.round(maxSize * 2) / 2);
      if (level >= 0 && text.length <= 140) {
        flushRows([...stack]);
        while (stack.length > level) {
          stack.pop();
        }
        stack.push(text);
        segments.push({ page: pageNumber, sectionPath: [...stack], kind: 'heading', text });
        continue;
      }
      if (isRowLine(line, body)) {
        rowBlock.push(line.items.map((i) => i.str.trim()).filter((s) => s.length > 0));
        continue;
      }
      flushRows([...stack]);
      segments.push({ page: pageNumber, sectionPath: [...stack], kind: 'text', text });
    }
    flushRows([...stack]);
  }
  return { numPages: pdfDocument.numPages, segments };
}
