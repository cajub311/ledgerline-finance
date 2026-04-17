import { parseObjectStatementRows, parseStatementText } from './import.shared';
import { pageTextItemsToLines, type PdfTextItem } from './pdfText';
import type { ParsedStatementBatch } from './types';

async function readPdfText(arrayBuffer: ArrayBuffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist/build/pdf.mjs');

  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

  const document = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const parts: string[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const lines = pageTextItemsToLines(textContent.items as PdfTextItem[]);
    if (lines.length > 0) {
      parts.push(...lines);
    }
  }

  return parts.join('\n');
}

export async function parseStatementBlob(file: File): Promise<ParsedStatementBatch> {
  const lowerName = file.name.toLowerCase();
  const buffer = await file.arrayBuffer();

  if (lowerName.endsWith('.json') || /application\/json/i.test(file.type)) {
    const peek = new TextDecoder('utf-8', { fatal: false }).decode(buffer.slice(0, 512));
    const looksLikeBackup = /^\s*\{/.test(peek) && /"version"\s*:\s*1/.test(peek) && /"transactions"\s*:\s*\[/.test(peek);
    if (looksLikeBackup) {
      throw new Error(
        `"${file.name}" is a full Ledgerline backup. Use “Restore from JSON” under Backups instead of statement import.`,
      );
    }
  }

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
