import { inferCategory } from './categories';
import type { ParsedStatementBatch, ParsedStatementRow } from './types';

const HEADER_ALIASES: Record<string, string[]> = {
  date: ['date', 'when', 'day', 'transaction date', 'posted date', 'entry date'],
  payee: ['payee', 'merchant', 'description', 'memo', 'name', 'details', 'transaction description'],
  amount: ['amount', 'transaction amount'],
  debit: ['debit', 'withdrawal', 'outflow', 'out', 'money out', 'withdrawals'],
  credit: ['credit', 'deposit', 'inflow', 'in', 'money in', 'deposits'],
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

/** RFC-style split: comma or tab delimiter, double-quote escaping. */
function splitDelimitedLine(line: string, delimiter: ',' | '\t'): string[] {
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

    if (char === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function detectDelimiter(headerLine: string): ',' | '\t' {
  const tabCount = (headerLine.match(/\t/g) ?? []).length;
  const commaCount = (headerLine.match(/,/g) ?? []).length;
  if (tabCount > 0 && tabCount >= commaCount) {
    return '\t';
  }
  return ',';
}

function normalizeHeaders(headers: string[]): string[] {
  return headers.map((header) => header.trim().toLowerCase());
}

export type WizardColumnRole =
  | 'date'
  | 'payee'
  | 'amount'
  | 'debit'
  | 'credit'
  | 'category'
  | 'ignore';

export interface CsvPreviewResult {
  headers: string[];
  rows: string[][];
}

/** First line = headers; returns up to `maxDataRows` data rows (trimmed cells). */
export function previewDelimitedCsv(text: string, maxDataRows = 10): CsvPreviewResult | null {
  const lines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return null;
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitDelimitedLine(lines[0], delimiter).map((cell) => cell.trim());
  const rows = lines
    .slice(1, 1 + maxDataRows)
    .map((line) => splitDelimitedLine(line, delimiter).map((cell) => cell.trim()));

  return { headers, rows };
}

export function suggestColumnRoles(headers: string[]): WizardColumnRole[] {
  const normalized = normalizeHeaders(headers);
  const roles: WizardColumnRole[] = normalized.map(() => 'ignore');

  const assignFirst = (aliases: string[], role: WizardColumnRole) => {
    const idx = pickHeaderIndex(normalized, aliases);
    if (idx >= 0 && roles[idx] === 'ignore') {
      roles[idx] = role;
    }
  };

  assignFirst(HEADER_ALIASES.date, 'date');
  assignFirst(HEADER_ALIASES.payee, 'payee');
  assignFirst(HEADER_ALIASES.amount, 'amount');
  assignFirst(HEADER_ALIASES.debit, 'debit');
  assignFirst(HEADER_ALIASES.credit, 'credit');
  assignFirst(HEADER_ALIASES.category, 'category');

  return roles;
}

export interface WizardColumnMapping {
  /** Column index for each role; -1 if unused */
  date: number;
  payee: number;
  amount: number;
  debit: number;
  credit: number;
  category: number;
}

export function rolesToMapping(headersLength: number, roles: WizardColumnRole[]): WizardColumnMapping {
  const m: WizardColumnMapping = {
    date: -1,
    payee: -1,
    amount: -1,
    debit: -1,
    credit: -1,
    category: -1,
  };

  for (let i = 0; i < Math.min(headersLength, roles.length); i += 1) {
    const r = roles[i];
    if (r === 'ignore') continue;
    if (r === 'date' && m.date < 0) m.date = i;
    else if (r === 'payee' && m.payee < 0) m.payee = i;
    else if (r === 'amount' && m.amount < 0) m.amount = i;
    else if (r === 'debit' && m.debit < 0) m.debit = i;
    else if (r === 'credit' && m.credit < 0) m.credit = i;
    else if (r === 'category' && m.category < 0) m.category = i;
  }

  return m;
}

export function mappingIsComplete(m: WizardColumnMapping): boolean {
  if (m.date < 0 || m.payee < 0) return false;
  if (m.amount >= 0) return true;
  return m.debit >= 0 || m.credit >= 0;
}

export function parseDelimitedWithMapping(text: string, roles: WizardColumnRole[]): ParsedStatementRow[] {
  const preview = previewDelimitedCsv(text, 100_000);
  if (!preview) {
    return [];
  }

  const mapping = rolesToMapping(preview.headers.length, roles);
  if (!mappingIsComplete(mapping)) {
    return [];
  }

  const lines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const delimiter = detectDelimiter(lines[0]);

  const syntheticHeaders = ['date', 'payee', 'amount'];
  if (mapping.category >= 0) {
    syntheticHeaders.push('category');
  }

  const out: ParsedStatementRow[] = [];

  for (let li = 1; li < lines.length; li += 1) {
    const cells = splitDelimitedLine(lines[li], delimiter).map((c) => c.trim());
    const dateVal = cells[mapping.date] ?? '';
    const payeeVal = cells[mapping.payee] ?? '';
    let amountVal: unknown = '';

    if (mapping.amount >= 0) {
      amountVal = cells[mapping.amount] ?? '';
    } else {
      const debitRaw = mapping.debit >= 0 ? cells[mapping.debit] : '';
      const creditRaw = mapping.credit >= 0 ? cells[mapping.credit] : '';
      const creditAmount = parseAmount(creditRaw);
      const debitAmount = parseAmount(debitRaw);

      if (creditAmount != null && creditAmount !== 0) {
        amountVal = Math.abs(creditAmount);
      } else if (debitAmount != null && debitAmount !== 0) {
        amountVal = -Math.abs(debitAmount);
      } else {
        amountVal = '';
      }
    }

    const row: string[] = [dateVal, payeeVal, String(amountVal)];
    if (mapping.category >= 0) {
      row.push(cells[mapping.category] ?? '');
    }

    const parsed = rowToStatementRow(row, syntheticHeaders);
    if (parsed) {
      out.push(parsed);
    }
  }

  return out;
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

  const delimiter = detectDelimiter(lines[0]);
  const header = splitDelimitedLine(lines[0], delimiter).map((entry) => entry.trim().toLowerCase());
  const rows = lines
    .slice(1)
    .map((line) => splitDelimitedLine(line, delimiter))
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
