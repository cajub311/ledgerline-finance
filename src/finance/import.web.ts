import { parseObjectStatementRows, parseStatementText } from './import.shared';
import type { ParsedStatementBatch } from './types';

type PdfTextItem = {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
};

/** Group PDF text items into lines by Y position so statement columns stay readable for parsing. */
function pdfItemsToStatementText(items: PdfTextItem[]): string {
  const positioned = items
    .map((item) => {
      const str = (item.str ?? '').trim();
      const t = item.transform;
      const x = Array.isArray(t) && t.length >= 6 ? t[4]! : 0;
      const y = Array.isArray(t) && t.length >= 6 ? t[5]! : 0;
      return { str, x, y };
    })
    .filter((e) => e.str.length > 0);

  if (positioned.length === 0) {
    return '';
  }

  const yTolerance = 3;
  positioned.sort((a, b) => (Math.abs(a.y - b.y) < yTolerance ? a.x - b.x : b.y - a.y));

  const lines: { y: number; parts: { x: number; str: string }[] }[] = [];

  for (const item of positioned) {
    const line = lines.find((l) => Math.abs(l.y - item.y) < yTolerance);
    if (line) {
      line.parts.push({ x: item.x, str: item.str });
    } else {
      lines.push({ y: item.y, parts: [{ x: item.x, str: item.str }] });
    }
  }

  return lines
    .sort((a, b) => b.y - a.y)
    .map((line) =>
      line.parts
        .sort((a, b) => a.x - b.x)
        .map((p) => p.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean)
    .join('\n');
}

async function readPdfText(arrayBuffer: ArrayBuffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist/build/pdf.mjs');

  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

  const document = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const parts: string[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const items = textContent.items as PdfTextItem[];
    const pageText = pdfItemsToStatementText(items);
    if (pageText) {
      parts.push(pageText);
    }
  }

  return parts.join('\n\n');
}

/** First worksheet as CSV text (for column-mapping wizard with original bank headers). */
export async function firstWorksheetToCsvText(buffer: ArrayBuffer): Promise<string> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_csv(sheet);
}

/** Raw text suitable for the column-mapping wizard: CSV/TXT as-is, first XLSX sheet as CSV, PDF as extracted lines. */
export async function fileToWizardDelimitedText(file: File): Promise<string> {
  const lowerName = file.name.toLowerCase();
  const buffer = await file.arrayBuffer();

  if (lowerName.endsWith('.pdf') || file.type === 'application/pdf') {
    return readPdfText(buffer);
  }

  if (
    lowerName.endsWith('.xlsx') ||
    lowerName.endsWith('.xls') ||
    /spreadsheet|excel/i.test(file.type)
  ) {
    return firstWorksheetToCsvText(buffer);
  }

  return file.text();
}

export async function parseStatementBlob(file: File): Promise<ParsedStatementBatch> {
  const lowerName = file.name.toLowerCase();
  const buffer = await file.arrayBuffer();

  if (lowerName.endsWith('.pdf') || file.type === 'application/pdf') {
    const text = await readPdfText(buffer);
    const parsed = parseStatementText(text);

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
    const csvText = XLSX.utils.sheet_to_csv(sheet);
    const parsed = parseStatementText(csvText);

    return {
      ...parsed,
      format: 'xlsx',
      sourceLabel: file.name,
      notes: [...parsed.notes, 'Imported from the first worksheet (CSV layout from Excel).'],
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
