import { inferCategory } from './categories';
import type { ParsedStatementBatch, ParsedStatementRow } from './types';

const HEADER_ALIASES: Record<string, string[]> = {
  date: ['date', 'transaction date', 'posted date', 'entry date'],
  payee: ['payee', 'merchant', 'description', 'name', 'details', 'transaction description'],
  amount: ['amount', 'transaction amount'],
  debit: ['debit', 'withdrawal', 'outflow'],
  credit: ['credit', 'deposit', 'inflow'],
  category: ['category', 'spending category', 'memo category'],
  notes: ['notes', 'memo', 'memo/notes', 'original statement', 'statement', 'reference'],
  type: ['type', 'transaction type'],
};

function pickHeaderIndex(headers: string[], aliases: string[]): number {
  for (const alias of aliases) {
    const match = headers.findIndex((header) => header === alias);

    if (match >= 0) {
      return match;
    }
  }

  return -1;
}

function parseAmount(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }

  if (raw == null) {
    return null;
  }

  const text = String(raw).trim();

  if (!text) {
    return null;
  }

  const normalized = text.replace(/\$/g, '').replace(/,/g, '').trim();
  const wrappedNegative = /^\(.*\)$/.test(normalized);
  const numeric = Number.parseFloat(normalized.replace(/[()]/g, ''));

  if (!Number.isFinite(numeric)) {
    return null;
  }

  return wrappedNegative ? -Math.abs(numeric) : numeric;
}

function parseDate(raw: unknown): string | null {
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
    return raw.trim();
  }

  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const excelEpoch = new Date(Math.round((raw - 25569) * 86400 * 1000));
    return toIsoDate(excelEpoch);
  }

  const text = String(raw ?? '').trim();

  if (!text) {
    return null;
  }

  const parts = text.split(/[/-]/).map((segment) => segment.trim());

  if (parts.length === 3) {
    const [first, second, third] = parts;

    if (first.length === 4) {
      return `${first.padStart(4, '0')}-${second.padStart(2, '0')}-${third.padStart(2, '0')}`;
    }

    const year = third.length === 2 ? `20${third}` : third;
    return `${year}-${first.padStart(2, '0')}-${second.padStart(2, '0')}`;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : toIsoDate(parsed);
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function normalizeHeaders(headers: string[]): string[] {
  return headers.map((header) => header.trim().toLowerCase());
}

function rowToStatementRow(
  row: string[] | Record<string, unknown>,
  headers: string[],
): ParsedStatementRow | null {
  const normalizedHeaders = normalizeHeaders(headers);

  const dateIndex = pickHeaderIndex(normalizedHeaders, HEADER_ALIASES.date);
  const payeeIndex = pickHeaderIndex(normalizedHeaders, HEADER_ALIASES.payee);
  const amountIndex = pickHeaderIndex(normalizedHeaders, HEADER_ALIASES.amount);
  const debitIndex = pickHeaderIndex(normalizedHeaders, HEADER_ALIASES.debit);
  const creditIndex = pickHeaderIndex(normalizedHeaders, HEADER_ALIASES.credit);
  const categoryIndex = pickHeaderIndex(normalizedHeaders, HEADER_ALIASES.category);
  const notesIndex = pickHeaderIndex(normalizedHeaders, HEADER_ALIASES.notes);
  const typeIndex = pickHeaderIndex(normalizedHeaders, HEADER_ALIASES.type);

  const value = (index: number): unknown => {
    if (index < 0) {
      return '';
    }

    if (Array.isArray(row)) {
      return row[index] ?? '';
    }

    const header = headers[index];
    const matchingKey = Object.keys(row).find(
      (key) => key.trim().toLowerCase() === header.trim().toLowerCase(),
    );

    return matchingKey ? row[matchingKey] : '';
  };

  const date = parseDate(value(dateIndex));
  const payee = String(value(payeeIndex) ?? '').trim();
  const primaryAmount = parseAmount(value(amountIndex));

  let resolvedAmount = primaryAmount;

  if (resolvedAmount == null) {
    const creditAmount = parseAmount(value(creditIndex));
    const debitAmount = parseAmount(value(debitIndex));

    if (creditAmount != null) {
      resolvedAmount = Math.abs(creditAmount);
    } else if (debitAmount != null) {
      resolvedAmount = -Math.abs(debitAmount);
    }
  }

  if (!date || !payee || resolvedAmount == null || !Number.isFinite(resolvedAmount)) {
    return null;
  }

  const typeValue = String(value(typeIndex) ?? '').trim().toLowerCase();

  if (typeValue === 'debit' || typeValue === 'withdrawal' || typeValue === 'outflow') {
    resolvedAmount = -Math.abs(resolvedAmount);
  }

  if (typeValue === 'credit' || typeValue === 'deposit' || typeValue === 'inflow') {
    resolvedAmount = Math.abs(resolvedAmount);
  }

  const category = String(value(categoryIndex) ?? '').trim();
  const notes = String(value(notesIndex) ?? '').trim();

  return {
    date,
    payee,
    amount: resolvedAmount,
    category: category || inferCategory(payee),
    notes: notes || undefined,
  };
}

export function parseDelimitedStatement(text: string): ParsedStatementRow[] {
  const lines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const header = splitCsvLine(lines[0]).map((entry) => entry.trim().toLowerCase());
  const rows = lines
    .slice(1)
    .map((line) => splitCsvLine(line))
    .map((row) => rowToStatementRow(row, header))
    .filter((entry): entry is ParsedStatementRow => entry !== null);

  return rows;
}

export function parseObjectStatementRows(records: Array<Record<string, unknown>>): ParsedStatementRow[] {
  if (records.length === 0) {
    return [];
  }

  const headers = Object.keys(records[0]);
  return records
    .map((record) => rowToStatementRow(record, headers))
    .filter((entry): entry is ParsedStatementRow => Boolean(entry));
}

export function parseStatementText(text: string): ParsedStatementBatch {
  const csvRows = parseDelimitedStatement(text);

  if (csvRows.length > 0) {
    return {
      format: 'csv',
      rows: csvRows,
      sourceLabel: 'pasted-statement',
      notes: [],
    };
  }

  const textRows = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const compact = line.replace(/\s+/g, ' ');
      const match = compact.match(
        /^(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)\s+(.+?)\s+([(-]?\$?\d[\d,]*\.\d{2}\)?)$/,
      );

      if (!match) {
        return null;
      }

      const [, dateRaw, payee, amountRaw] = match;
      const date = parseDate(dateRaw);
      const amount = parseAmount(amountRaw);

      if (!date || amount == null) {
        return null;
      }

      return {
        date,
        payee: payee.trim(),
        amount,
        category: inferCategory(payee),
      } satisfies ParsedStatementRow;
    })
    .filter((entry): entry is ParsedStatementRow => entry !== null);

  return {
    format: 'pdf',
    rows: textRows,
    sourceLabel: 'pasted-statement-text',
    notes: textRows.length
      ? ['Parsed from statement text using date/amount heuristics.']
      : ['No rows matched the statement-text parser.'],
  };
}
