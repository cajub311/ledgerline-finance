import { parseObjectStatementRows, parsePdfPagesToRows, parseStatementText } from './import.shared';
import type { ParsedStatementBatch, PdfPageLines } from './types';

/**
 * Version of PDF.js to load from the CDN. Pinned so the app behaves the
 * same in production regardless of what `pdfjs-dist` gets installed as a
 * dev dependency. Bumped deliberately when we want a new version.
 */
const PDFJS_CDN_VERSION = '4.10.38';

/**
 * Loads PDF.js from the unpkg CDN at runtime. We hide the dynamic import
 * behind `new Function(...)` so Metro's static analyzer doesn't try to
 * rewrite it into a bundled chunk — previously, Metro was pulling in the
 * optional Node-only dependencies of `pdfjs-dist` (v5) and producing a
 * broken chunk that threw "Requiring unknown module '825'" at runtime.
 *
 * The worker is also loaded from the CDN; both the main module and the
 * worker need to be the same version or PDF.js will refuse to run.
 */
type PdfjsTextItem = {
  str?: string;
  /** [a,b,c,d,e,f]; e = x-position, f = y-position in PDF page units. */
  transform?: number[];
};

type PdfjsLib = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (params: { data: ArrayBuffer }) => {
    promise: Promise<{
      numPages: number;
      getPage: (pageNumber: number) => Promise<{
        getTextContent: () => Promise<{ items: PdfjsTextItem[] }>;
      }>;
    }>;
  };
};

let pdfjsLibPromise: Promise<PdfjsLib> | null = null;

function loadPdfjsLib(): Promise<PdfjsLib> {
  if (pdfjsLibPromise) return pdfjsLibPromise;
  const url = `https://unpkg.com/pdfjs-dist@${PDFJS_CDN_VERSION}/build/pdf.min.mjs`;
  const runtimeImport = new Function('u', 'return import(u)') as (
    u: string,
  ) => Promise<PdfjsLib>;
  pdfjsLibPromise = runtimeImport(url).then((lib) => {
    lib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${PDFJS_CDN_VERSION}/build/pdf.worker.min.mjs`;
    return lib;
  });
  return pdfjsLibPromise;
}

/**
 * Pull each page's text out of the PDF, preserving spatial structure so
 * a downstream column-aware parser can figure out which numbers are
 * deposits, withdrawals, and running balances. Falls back to a plain
 * concatenated string form for text-only heuristics if the column parser
 * can't find headers.
 */
async function readPdfPages(arrayBuffer: ArrayBuffer): Promise<{
  pages: PdfPageLines[];
  flatText: string;
}> {
  const pdfjs = await loadPdfjsLib();
  const document = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const pages: PdfPageLines[] = [];
  const flatLines: string[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const textContent = await page.getTextContent();

    // Group text items by y-coordinate (rounded to the nearest unit). PDF
    // coordinates place origin at the bottom-left, so higher y = higher
    // on the page. We bucket by y to reconstruct visual lines.
    const byY = new Map<number, Array<{ str: string; x: number }>>();
    for (const item of textContent.items) {
      const transform = item.transform;
      if (!transform || transform.length < 6) continue;
      const x = Number(transform[4] ?? 0);
      const y = Number(transform[5] ?? 0);
      const str = String(item.str ?? '');
      if (!str.trim()) continue;
      const yKey = Math.round(y);
      const list = byY.get(yKey) ?? [];
      list.push({ str, x });
      byY.set(yKey, list);
    }

    // Sort lines top-to-bottom (decreasing y because PDF y-axis points up).
    const yKeys = [...byY.keys()].sort((a, b) => b - a);
    const lines = yKeys
      .map((y) => {
        const items = byY.get(y)!.slice().sort((a, b) => a.x - b.x);
        const text = items
          .map((it) => it.str)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        return { text, items };
      })
      .filter((line) => line.text.length > 0);

    pages.push({ lines });
    for (const line of lines) flatLines.push(line.text);
  }

  return { pages, flatText: flatLines.join('\n') };
}

export async function parseStatementBlob(file: File): Promise<ParsedStatementBatch> {
  const lowerName = file.name.toLowerCase();
  const buffer = await file.arrayBuffer();

  if (lowerName.endsWith('.pdf') || file.type === 'application/pdf') {
    const { pages, flatText } = await readPdfPages(buffer);
    const columnRows = parsePdfPagesToRows(pages);

    if (columnRows.length > 0) {
      return {
        format: 'pdf',
        rows: columnRows,
        sourceLabel: file.name,
        notes: [
          `Parsed ${columnRows.length} row${columnRows.length === 1 ? '' : 's'} from PDF using column-aware layout.`,
        ],
      };
    }

    const parsed = parseStatementText(flatText);
    return {
      ...parsed,
      format: 'pdf',
      sourceLabel: file.name,
      notes: [...parsed.notes, 'Imported from PDF via statement text extraction.'],
    };
  }

  if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || /spreadsheet|excel/i.test(file.type)) {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
    const rows = parseObjectStatementRows(records);

    return {
      format: 'xlsx',
      rows,
      sourceLabel: file.name,
      notes: ['Imported from the first worksheet in the workbook.'],
    };
  }

  const text = await file.text();
  const parsed = parseStatementText(text);

  return {
    ...parsed,
    format: 'csv',
    sourceLabel: file.name,
    notes: [...parsed.notes, 'Imported from text/CSV.'],
  };
}
