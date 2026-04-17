import { parseObjectStatementRows, parseStatementText } from './import.shared';
import type { ParsedStatementBatch } from './types';

interface PdfTextItem {
  str?: string;
  transform?: number[];
  hasEOL?: boolean;
}

function sortPdfTextItems(items: PdfTextItem[]): PdfTextItem[] {
  return items.slice().sort((a, b) => {
    const ta = a.transform;
    const tb = b.transform;
    if (!ta || !tb || ta.length < 6 || tb.length < 6) {
      return 0;
    }
    const yA = ta[5] ?? 0;
    const yB = tb[5] ?? 0;
    const rowEps = 2.5;
    if (Math.abs(yA - yB) > rowEps) {
      return yB - yA;
    }
    const xA = ta[4] ?? 0;
    const xB = tb[4] ?? 0;
    return xA - xB;
  });
}

async function readPdfText(arrayBuffer: ArrayBuffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist/build/pdf.mjs');

  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

  const document = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const pageLines: string[][] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const items = sortPdfTextItems(textContent.items as PdfTextItem[]);

    const lines: string[] = [];
    let current = '';
    let lastY: number | null = null;

    for (const item of items) {
      const str = item.str ?? '';
      if (!str.trim()) {
        continue;
      }

      const t = item.transform;
      const y = t && t.length >= 6 ? t[5]! : null;

      if (y != null && lastY != null && Math.abs(y - lastY) > 2.5) {
        const trimmed = current.replace(/\s+/g, ' ').trim();
        if (trimmed) {
          lines.push(trimmed);
        }
        current = '';
      }

      if (current.length > 0 && !/\s$/.test(current) && !/^\s/.test(str)) {
        current += ' ';
      }
      current += str;
      if (y != null) {
        lastY = y;
      }

      if (item.hasEOL) {
        const trimmed = current.replace(/\s+/g, ' ').trim();
        if (trimmed) {
          lines.push(trimmed);
        }
        current = '';
        lastY = null;
      }
    }

    const tail = current.replace(/\s+/g, ' ').trim();
    if (tail) {
      lines.push(tail);
    }

    if (lines.length > 0) {
      pageLines.push(lines);
    }
  }

  return pageLines.map((lines) => lines.join('\n')).join('\n\n');
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
      notes: [
        ...parsed.notes,
        'Imported from PDF via text extraction (position-aware layout).',
      ],
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
    notes: [...parsed.notes, 'Imported from text/CSV/TSV.'],
  };
}
