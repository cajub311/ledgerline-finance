import { inferCategory } from './categories';
import type {
  ParsedStatementBatch,
  ParsedStatementRow,
  PdfPageLine,
  PdfPageLines,
} from './types';

const HEADER_ALIASES: Record<string, string[]> = {
  date: [
    'date',
    'when',
    'day',
    'transaction date',
    'posted date',
    'entry date',
    'post date',
    'trans date',
    'posting date',
  ],
  payee: [
    'payee',
    'merchant',
    'description',
    'memo',
    'name',
    'details',
    'transaction description',
    'transaction',
    'narrative',
    'reference',
  ],
  amount: [
    'amount',
    'transaction amount',
    'amount (usd)',
    'value',
    'transaction value',
  ],
  debit: [
    'debit',
    'withdrawal',
    'withdrawals',
    'outflow',
    'out',
    'money out',
    'withdrawals/subtractions',
    'withdrawal/subtraction',
    'subtractions',
    'payments',
    'charges',
    'debits',
  ],
  credit: [
    'credit',
    'deposit',
    'deposits',
    'inflow',
    'in',
    'money in',
    'deposits/additions',
    'deposit/addition',
    'additions',
    'credits',
  ],
  category: ['category', 'spending category', 'memo category'],
  notes: [
    'notes',
    'memo',
    'memo/notes',
    'original statement',
    'statement',
    'reference',
  ],
  type: ['type', 'transaction type'],
};

/**
 * Split a normalized header into tokens so "deposits/additions" also matches
 * "deposits" and "withdrawals/subtractions" also matches "withdrawals".
 * Splits on slash, backslash, parens, brackets, hyphen, em dash, comma,
 * pipe, ampersand, and runs of whitespace. Collapses repeated spaces.
 */
function tokenizeHeader(header: string): string[] {
  const raw = header.trim().toLowerCase();
  if (!raw) return [];
  const parts = raw
    .split(/[\\/()\[\]|&,]|\s[-–—]\s|\s+/g)
    .map((part) => part.trim())
    .filter(Boolean);
  // Also include the full header so exact multi-word aliases keep matching.
  return Array.from(new Set([raw, ...parts]));
}

function pickHeaderIndex(headers: string[], aliases: string[]): number {
  // 1) Exact match on the normalized header.
  for (const alias of aliases) {
    const match = headers.findIndex((header) => header === alias);
    if (match >= 0) return match;
  }

  // 2) Token-wise match (handles "deposits/additions", "money in (usd)", etc.).
  for (let i = 0; i < headers.length; i += 1) {
    const tokens = tokenizeHeader(headers[i]);
    for (const alias of aliases) {
      if (tokens.includes(alias)) return i;
    }
  }

  // 3) Last-resort substring match for long-form aliases first to avoid
  //    accidentally matching a shared short word like "in".
  const longAliases = [...aliases].sort((a, b) => b.length - a.length);
  for (const alias of longAliases) {
    if (alias.length < 4) continue;
    const match = headers.findIndex((header) => header.includes(alias));
    if (match >= 0) return match;
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

function parseDate(raw: unknown, fallbackYear?: number): string | null {
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

  // MM/DD with no year — Wells Fargo and many other bank PDFs print only
  // month/day in the transaction table, with the year living in the
  // statement header. Use the caller-supplied fallback year if we have one.
  if (parts.length === 2 && fallbackYear) {
    const [first, second] = parts;
    if (/^\d{1,2}$/.test(first) && /^\d{1,2}$/.test(second)) {
      return `${fallbackYear}-${first.padStart(2, '0')}-${second.padStart(2, '0')}`;
    }
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

  const headers = splitCsvLine(lines[0]).map((cell) => cell.trim());
  const rows = lines
    .slice(1, 1 + maxDataRows)
    .map((line) => splitCsvLine(line).map((cell) => cell.trim()));

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

  const syntheticHeaders = ['date', 'payee', 'amount'];
  if (mapping.category >= 0) {
    syntheticHeaders.push('category');
  }

  const out: ParsedStatementRow[] = [];

  for (let li = 1; li < lines.length; li += 1) {
    const cells = splitCsvLine(lines[li]).map((c) => c.trim());
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

/**
 * Tokens a bank uses to label the deposits (money in) column of a
 * statement table. Matched case-insensitively against header-line text.
 */
const DEPOSIT_HEADER_TOKENS = [
  'deposits/additions',
  'deposits / additions',
  'deposits',
  'additions',
  'credits',
  'money in',
  'inflow',
];

/**
 * Tokens a bank uses to label the withdrawals (money out) column of a
 * statement table. Matched case-insensitively.
 */
const WITHDRAWAL_HEADER_TOKENS = [
  'withdrawals/subtractions',
  'withdrawals / subtractions',
  'withdrawals',
  'subtractions',
  'debits',
  'charges',
  'money out',
  'outflow',
];

/**
 * Tokens a bank uses to label the running balance column. Amounts in this
 * column should be ignored — they are cumulative and double-count against
 * the deposit/withdrawal amounts.
 */
const BALANCE_HEADER_TOKENS = [
  'ending daily balance',
  'daily balance',
  'balance',
];

const AMOUNT_TOKEN = /^[(-]?\$?\d{1,3}(?:,\d{3})*(?:\.\d{2})\)?$/;
const DATE_TOKEN = /^\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?$/;

interface ColumnHeader {
  kind: 'deposit' | 'withdrawal' | 'balance';
  x: number;
  /** Right edge of the header text so we can match right-aligned numbers. */
  xRight: number;
}

function findColumnHeaders(line: PdfPageLine): ColumnHeader[] {
  const lower = line.text.toLowerCase();
  const headers: ColumnHeader[] = [];

  const findAnchor = (tokens: string[]): { x: number; xRight: number } | null => {
    for (const token of tokens) {
      const idx = lower.indexOf(token);
      if (idx < 0) continue;
      // Approximate the x-range by matching item text containing the first word
      const firstWord = token.split(/\s|\//)[0];
      const matching = line.items.filter((it) =>
        it.str.toLowerCase().includes(firstWord),
      );
      if (matching.length === 0) continue;
      const xs = matching.map((it) => it.x);
      return { x: Math.min(...xs), xRight: Math.max(...xs) + 40 };
    }
    return null;
  };

  const deposit = findAnchor(DEPOSIT_HEADER_TOKENS);
  if (deposit) headers.push({ kind: 'deposit', ...deposit });

  const withdrawal = findAnchor(WITHDRAWAL_HEADER_TOKENS);
  if (withdrawal) headers.push({ kind: 'withdrawal', ...withdrawal });

  const balance = findAnchor(BALANCE_HEADER_TOKENS);
  if (balance) headers.push({ kind: 'balance', ...balance });

  return headers;
}

/**
 * Classify a number's x-position as deposit, withdrawal, or balance by
 * picking the column header whose center is closest. If no headers are
 * usable, returns null.
 */
function classifyAmountColumn(
  x: number,
  columns: ColumnHeader[],
): 'deposit' | 'withdrawal' | 'balance' | null {
  if (columns.length === 0) return null;
  let best: ColumnHeader | null = null;
  let bestDistance = Infinity;
  for (const col of columns) {
    const center = (col.x + col.xRight) / 2;
    const distance = Math.abs(x - center);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = col;
    }
  }
  return best ? best.kind : null;
}

/**
 * Lines that look like rollover/total rows in a bank statement and must
 * not be treated as transactions, even when they have a leading date and
 * a trailing amount. Matched as a prefix on the lowercased line text.
 */
const STATEMENT_NOISE_PREFIXES = [
  'beginning balance',
  'ending balance',
  'beginning daily balance',
  'ending daily balance',
  'totals',
  'total deposits',
  'total withdrawals',
  'total credits',
  'total debits',
  'overdraft and returned item fees',
  'monthly service fee',
  'page ',
];

function isStatementNoiseLine(text: string): boolean {
  const lower = text.toLowerCase().trim();
  if (!lower) return true;
  return STATEMENT_NOISE_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

const MONTH_NAMES = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

/**
 * Sniff the statement year out of any header / period line on the PDF.
 * Wells Fargo's "Statement period" line and Chase's "Opening/Closing
 * Date" line both contain a 4-digit year; common monthly-summary headers
 * like "January 1, 2024 - January 31, 2024" do too. Returns the FIRST
 * 4-digit year we see in a plausible context, or null if none.
 */
export function inferStatementYear(pages: PdfPageLines[]): number | null {
  const yearRange = (y: number) => y >= 1990 && y <= 2099;

  // Pass 1: prefer years that appear next to the words "statement", "period",
  // "opening", "closing", "ending balance on", a month name, or in a date
  // like 01/01/2024.
  const yearWithContext = (text: string): number | null => {
    const lower = text.toLowerCase();
    if (
      !/statement|period|opening|closing|ending balance|beginning balance|cycle|through|to /.test(lower) &&
      !MONTH_NAMES.some((m) => lower.includes(m)) &&
      !/\b\d{1,2}[/-]\d{1,2}[/-](19|20)\d{2}\b/.test(text)
    ) {
      return null;
    }
    const fullDate = text.match(/\b\d{1,2}[/-]\d{1,2}[/-](\d{4})\b/);
    if (fullDate) {
      const y = Number.parseInt(fullDate[1], 10);
      if (yearRange(y)) return y;
    }
    const slashShort = text.match(/\b\d{1,2}[/-]\d{1,2}[/-](\d{2})\b/);
    if (slashShort) {
      const y = 2000 + Number.parseInt(slashShort[1], 10);
      if (yearRange(y)) return y;
    }
    const bare = text.match(/\b(19|20)(\d{2})\b/);
    if (bare) {
      const y = Number.parseInt(bare[1] + bare[2], 10);
      if (yearRange(y)) return y;
    }
    return null;
  };

  for (const page of pages) {
    for (const line of page.lines) {
      const y = yearWithContext(line.text);
      if (y) return y;
    }
  }

  // Pass 2: any 4-digit year on the page, just in case the WF header
  // wording shifts. Bias toward the most recent plausible year so we
  // don't accidentally pin to "Member FDIC since 1929".
  const years: number[] = [];
  for (const page of pages) {
    for (const line of page.lines) {
      const matches = line.text.matchAll(/\b(19|20)(\d{2})\b/g);
      for (const m of matches) {
        const y = Number.parseInt(m[1] + m[2], 10);
        if (yearRange(y) && y >= 2000) years.push(y);
      }
    }
  }
  if (years.length === 0) return null;
  // Pick the mode if there's a clear winner; otherwise the max.
  const counts = new Map<number, number>();
  for (const y of years) counts.set(y, (counts.get(y) ?? 0) + 1);
  let best = years[0];
  let bestCount = 0;
  for (const [y, c] of counts) {
    if (c > bestCount || (c === bestCount && y > best)) {
      best = y;
      bestCount = c;
    }
  }
  return best;
}

/**
 * Extract statement rows from a PDF whose pages preserve per-item x/y
 * positions. Looks for a header line containing deposit/withdrawal
 * column labels, then interprets each subsequent date-led line as a
 * transaction by classifying its numeric tokens against those columns.
 *
 * Falls back to returning [] if no usable header is found; callers
 * should then try the plain-text heuristic parser.
 */
export function parsePdfPagesToRows(pages: PdfPageLines[]): ParsedStatementRow[] {
  const rows: ParsedStatementRow[] = [];
  const fallbackYear = inferStatementYear(pages) ?? undefined;

  for (const page of pages) {
    let columns: ColumnHeader[] = [];
    let pending: {
      date: string;
      descParts: string[];
      amount: number | null;
    } | null = null;

    const flushPending = () => {
      if (!pending) return;
      if (pending.amount != null && pending.descParts.length > 0) {
        const payee = pending.descParts
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (payee && !isStatementNoiseLine(payee)) {
          rows.push({
            date: pending.date,
            payee,
            amount: pending.amount,
            category: inferCategory(payee),
          });
        }
      }
      pending = null;
    };

    for (const line of page.lines) {
      // Refresh column positions whenever we hit a header line (statements
      // often repeat the table header at page breaks).
      const maybeHeaders = findColumnHeaders(line);
      if (
        maybeHeaders.some((h) => h.kind === 'deposit') ||
        maybeHeaders.some((h) => h.kind === 'withdrawal')
      ) {
        columns = maybeHeaders;
        flushPending();
        continue;
      }

      if (columns.length === 0) continue;

      const items = line.items;
      if (items.length === 0) continue;

      // Skip "Beginning balance on …" / "Ending balance" / page footers
      // even when they happen to start with a date-shaped token.
      if (isStatementNoiseLine(line.text)) {
        flushPending();
        continue;
      }

      const firstToken = items[0].str.trim();

      if (DATE_TOKEN.test(firstToken)) {
        flushPending();
        const date = parseDate(firstToken, fallbackYear);
        if (!date) continue;

        const descParts: string[] = [];
        let amount: number | null = null;

        for (let i = 1; i < items.length; i += 1) {
          const token = items[i].str.trim();
          if (!token) continue;
          if (AMOUNT_TOKEN.test(token)) {
            const parsed = parseAmount(token);
            if (parsed == null) continue;
            const column = classifyAmountColumn(items[i].x, columns);
            if (column === 'deposit') {
              amount = Math.abs(parsed);
            } else if (column === 'withdrawal') {
              amount = -Math.abs(parsed);
            }
            // balance or unclassified: ignore
          } else {
            descParts.push(token);
          }
        }

        pending = { date, descParts, amount };
        continue;
      }

      // Continuation line — append descriptive text and pick up an amount
      // if the first row was a date-only stub without the amount.
      if (pending) {
        for (const item of items) {
          const token = item.str.trim();
          if (!token) continue;
          if (AMOUNT_TOKEN.test(token)) {
            if (pending.amount != null) continue;
            const parsed = parseAmount(token);
            if (parsed == null) continue;
            const column = classifyAmountColumn(item.x, columns);
            if (column === 'deposit') pending.amount = Math.abs(parsed);
            else if (column === 'withdrawal') pending.amount = -Math.abs(parsed);
          } else {
            pending.descParts.push(token);
          }
        }
      }
    }

    flushPending();
  }

  return rows;
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

  // Try to sniff a year from any line that looks like a statement period
  // header so MM/DD-only transaction dates land in the correct year.
  const fallbackYear = (() => {
    for (const raw of text.split(/\r?\n/)) {
      const lower = raw.toLowerCase();
      if (
        !/statement|period|opening|closing|ending balance|beginning balance|cycle|through/.test(lower) &&
        !/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/.test(raw)
      ) {
        continue;
      }
      const full = raw.match(/\b\d{1,2}[/-]\d{1,2}[/-](\d{4})\b/);
      if (full) {
        const y = Number.parseInt(full[1], 10);
        if (y >= 1990 && y <= 2099) return y;
      }
      const short = raw.match(/\b\d{1,2}[/-]\d{1,2}[/-](\d{2})\b/);
      if (short) return 2000 + Number.parseInt(short[1], 10);
      const bare = raw.match(/\b(20\d{2})\b/);
      if (bare) return Number.parseInt(bare[1], 10);
    }
    return undefined;
  })();

  const textRows = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !isStatementNoiseLine(line))
    .map((line) => {
      const compact = line.replace(/\s+/g, ' ');

      // Three-amount layout (Wells Fargo "Date  Description  Deposit
      // Withdrawal  Balance"): grab the date, take the first non-zero
      // money column as the transaction amount, and discard the trailing
      // running balance.
      const triCol = compact.match(
        /^(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)\s+(.+?)\s+([(-]?\$?\d[\d,]*\.\d{2}\)?)\s+([(-]?\$?\d[\d,]*\.\d{2}\)?)\s+([(-]?\$?\d[\d,]*\.\d{2}\)?)$/,
      );
      if (triCol) {
        const [, dateRaw, payee, depositRaw, withdrawalRaw] = triCol;
        const date = parseDate(dateRaw, fallbackYear);
        const deposit = parseAmount(depositRaw);
        const withdrawal = parseAmount(withdrawalRaw);
        const amount =
          deposit != null && deposit !== 0
            ? Math.abs(deposit)
            : withdrawal != null && withdrawal !== 0
              ? -Math.abs(withdrawal)
              : null;
        if (date && amount != null) {
          return {
            date,
            payee: payee.trim(),
            amount,
            category: inferCategory(payee),
          } satisfies ParsedStatementRow;
        }
      }

      // Two-amount layout: "Date  Description  Amount  Balance" — the
      // first amount is the transaction, the second is the running
      // balance. Sign falls out from the next paragraph's heuristic.
      const twoCol = compact.match(
        /^(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)\s+(.+?)\s+([(-]?\$?\d[\d,]*\.\d{2}\)?)\s+([(-]?\$?\d[\d,]*\.\d{2}\)?)$/,
      );
      if (twoCol) {
        const [, dateRaw, payee, amountRaw] = twoCol;
        const date = parseDate(dateRaw, fallbackYear);
        const amount = parseAmount(amountRaw);
        if (date && amount != null) {
          return {
            date,
            payee: payee.trim(),
            amount,
            category: inferCategory(payee),
          } satisfies ParsedStatementRow;
        }
      }

      const match = compact.match(
        /^(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)\s+(.+?)\s+([(-]?\$?\d[\d,]*\.\d{2}\)?)$/,
      );

      if (!match) {
        return null;
      }

      const [, dateRaw, payee, amountRaw] = match;
      const date = parseDate(dateRaw, fallbackYear);
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
