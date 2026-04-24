import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import test from 'node:test';

import {
  inferStatementYear,
  parseDelimitedStatement,
  parseDelimitedWithMapping,
  parsePdfPagesToRows,
  parseStatementText,
  suggestColumnRoles,
} from './import.shared';
import type { PdfPageLine, PdfPageLines } from './types';

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = (name: string) => resolve(here, '..', '..', 'fixtures', 'statements', name);

test('parses Wells Fargo-style CSV rows', () => {
  const rows = parseDelimitedStatement(
    [
      'Date,Description,Amount',
      '04/05/2026,Payroll Deposit,3920.00',
      '04/04/2026,"Uber, LLC",-12.34',
    ].join('\n'),
  );

  assert.equal(rows.length, 2);
  assert.equal(rows[0]?.payee, 'Payroll Deposit');
  assert.equal(rows[0]?.amount, 3920);
  assert.equal(rows[1]?.payee, 'Uber, LLC');
  assert.equal(rows[1]?.amount, -12.34);
});

test('parses PDF statement text heuristics', () => {
  const batch = parseStatementText('04/02/2026 Shell -46.18\n04/01/2026 Starbucks -5.42');

  assert.equal(batch.format, 'pdf');
  assert.equal(batch.rows.length, 2);
  assert.equal(batch.rows[0]?.payee, 'Shell');
  assert.equal(batch.rows[0]?.amount, -46.18);
});

test('CSV wizard mapping parses debit/credit columns', () => {
  const csv = ['When,Memo,Out,In', '04/05/2026,Payroll,,3920.00', '04/04/2026,Uber,12.34,'].join('\n');
  const headers = ['When', 'Memo', 'Out', 'In'];
  const roles = suggestColumnRoles(headers);
  assert.equal(roles[0], 'date');
  assert.equal(roles[1], 'payee');
  assert.ok(roles.includes('debit'));
  assert.ok(roles.includes('credit'));

  const rows = parseDelimitedWithMapping(csv, roles);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]?.amount, 3920);
  assert.equal(rows[1]?.amount, -12.34);
});

test('Wells Fargo "Deposits/Additions" + "Withdrawals/Subtractions" headers import every row', () => {
  const text = readFileSync(fixturePath('wells-fargo-checking-2024.csv'), 'utf8');
  const totalDataLines = text.trim().split(/\r?\n/).length - 1;
  const rows = parseDelimitedStatement(text);
  assert.equal(rows.length, totalDataLines, 'every data row should parse');

  const firstDeposit = rows.find((row) => row.payee.includes('Payward Ventures'));
  assert(firstDeposit, 'should see the wire deposit');
  assert.equal(firstDeposit!.amount, 2496);

  const firstCharge = rows.find((row) => row.payee.includes('Wire Trans Svc Charge'));
  assert(firstCharge, 'should see the wire fee');
  assert.equal(firstCharge!.amount, -15);

  // Every non-transfer expense row should have a negative amount and every
  // deposit should be positive — a smoke check that debit/credit columns
  // were actually detected.
  const positives = rows.filter((r) => r.amount > 0).length;
  const negatives = rows.filter((r) => r.amount < 0).length;
  assert.ok(positives > 0, 'should detect deposits');
  assert.ok(negatives > 0, 'should detect withdrawals');
});

test('suggestColumnRoles handles Wells Fargo slash headers', () => {
  const headers = ['Date', 'Description', 'Deposits/Additions', 'Withdrawals/Subtractions'];
  const roles = suggestColumnRoles(headers);
  assert.equal(roles[0], 'date');
  assert.equal(roles[1], 'payee');
  assert.equal(roles[2], 'credit');
  assert.equal(roles[3], 'debit');
});

/**
 * Helper for building synthetic Wells Fargo-style PDF pages for tests.
 * Each row is `[xPosition, text]` pairs; we wrap them up as PdfPageLineItem
 * arrays and compute `text` by joining the strings with spaces (which is
 * what the real `readPdfPages` extractor produces).
 */
function pdfLine(items: Array<[number, string]>): PdfPageLine {
  return {
    text: items.map(([, s]) => s).join(' ').replace(/\s+/g, ' ').trim(),
    items: items.map(([x, str]) => ({ x, str })),
  };
}

function pdfPages(lines: PdfPageLine[]): PdfPageLines[] {
  return [{ lines }];
}

test('inferStatementYear pulls year from "Statement period 01/01/2024 to ..." headers', () => {
  const pages = pdfPages([
    pdfLine([[40, 'Wells Fargo Everyday Checking']]),
    pdfLine([[40, 'Statement period activity from 01/01/2024 to 01/31/2024']]),
    pdfLine([[40, 'Account number 1234567890']]),
  ]);
  assert.equal(inferStatementYear(pages), 2024);
});

test('inferStatementYear ignores "Member FDIC since 1929"-style noise and picks the statement year', () => {
  const pages = pdfPages([
    pdfLine([[40, 'Wells Fargo Bank, N.A. Member FDIC since 1929']]),
    pdfLine([[40, 'January 1, 2024 - January 31, 2024']]),
  ]);
  assert.equal(inferStatementYear(pages), 2024);
});

test('parsePdfPagesToRows handles a Wells-Fargo-style transaction page', () => {
  // Mimic the spatial layout of a real WF "Transaction history" page:
  // - Statement-period line at top (gives the year)
  // - "Beginning balance on 1/1" line (must be skipped)
  // - Header row with Date/Description/Deposits/Withdrawals/Balance columns
  // - Date-led transaction rows; deposits at x≈360, withdrawals at x≈460,
  //   balance at x≈540
  const pages = pdfPages([
    pdfLine([[40, 'Statement period activity from 01/01/2024 to 01/31/2024']]),
    pdfLine([
      [40, 'Date'],
      [120, 'Description'],
      [350, 'Deposits/Additions'],
      [450, 'Withdrawals/Subtractions'],
      [540, 'Ending Daily Balance'],
    ]),
    pdfLine([
      [40, '1/1'],
      [120, 'Beginning balance on 1/1'],
      [540, '5,000.00'],
    ]),
    pdfLine([
      [40, '1/2'],
      [120, 'Wire Trans Svc Charge'],
      [460, '15.00'],
      [540, '4,985.00'],
    ]),
    pdfLine([
      [40, '1/2'],
      [120, 'WT Fed#06223 Mvb Bank Inc Org=Payward Ventures Inc'],
      [360, '2,496.00'],
      [540, '7,481.00'],
    ]),
    pdfLine([
      [40, '1/5'],
      [120, 'Atlas Manufacturing Direct Deposit'],
      [360, '682.52'],
      [540, '8,163.52'],
    ]),
    pdfLine([[120, 'Ending balance on 1/31'], [540, '8,163.52']]),
  ]);

  const rows = parsePdfPagesToRows(pages);
  assert.equal(rows.length, 3, 'beginning + ending balance lines must be skipped');

  const charge = rows.find((r) => r.payee.includes('Wire Trans Svc Charge'));
  assert.ok(charge, 'wire fee row must parse');
  assert.equal(charge!.amount, -15, 'withdrawal column → negative amount');
  assert.equal(charge!.date, '2024-01-02', 'MM/DD-only date must use inferred statement year');

  const deposit = rows.find((r) => r.payee.includes('Payward Ventures'));
  assert.ok(deposit, 'wire deposit row must parse');
  assert.equal(deposit!.amount, 2496, 'deposit column → positive amount');
  assert.equal(deposit!.date, '2024-01-02');

  const payroll = rows.find((r) => r.payee.includes('Atlas Manufacturing'));
  assert.ok(payroll);
  assert.equal(payroll!.amount, 682.52);
});

test('parsePdfPagesToRows coalesces a split date token ("1/" + "2") back into a date', () => {
  // pdfjs sometimes splits "1/2" across two items — the parser must rejoin
  // them before testing against DATE_TOKEN, otherwise the row is dropped.
  const pages = pdfPages([
    pdfLine([[40, 'Statement period 01/01/2024 to 01/31/2024']]),
    pdfLine([
      [40, 'Date'],
      [120, 'Description'],
      [350, 'Deposits/Additions'],
      [450, 'Withdrawals/Subtractions'],
      [540, 'Ending Daily Balance'],
    ]),
    pdfLine([
      [40, '1/'],
      [52, '2'],
      [120, 'Split Date Merchant'],
      [460, '12.34'],
      [540, '4,987.66'],
    ]),
  ]);

  const rows = parsePdfPagesToRows(pages);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.date, '2024-01-02');
  assert.equal(rows[0]?.payee, 'Split Date Merchant');
  assert.equal(rows[0]?.amount, -12.34);
});

test('parsePdfPagesToRows treats a bare 3-6 digit integer as a check number, not the amount', () => {
  // WF's "Transaction history" often has a Check Number column between
  // Date and Description. We tag it as "Check #…" in the payee so a
  // customer can still search for it, and we do NOT pick it up as the
  // transaction amount.
  const pages = pdfPages([
    pdfLine([[40, 'Statement period 01/01/2024 to 01/31/2024']]),
    pdfLine([
      [40, 'Date'],
      [120, 'Check #'],
      [180, 'Description'],
      [350, 'Deposits/Additions'],
      [450, 'Withdrawals/Subtractions'],
      [540, 'Ending Daily Balance'],
    ]),
    pdfLine([
      [40, '1/8'],
      [120, '1234'],
      [180, 'Home Depot'],
      [460, '42.19'],
      [540, '4,945.47'],
    ]),
  ]);

  const rows = parsePdfPagesToRows(pages);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.date, '2024-01-08');
  assert.match(rows[0]!.payee, /Check #1234/);
  assert.match(rows[0]!.payee, /Home Depot/);
  assert.equal(rows[0]!.amount, -42.19, 'the 42.19 withdrawal, not 1234, is the amount');
});

test('parseStatementText handles a 3-column "date description deposit withdrawal balance" line', () => {
  // No spatial info — just text. The trailing balance must NOT be picked
  // as the transaction amount.
  const text = [
    'Statement period 01/01/2024 to 01/31/2024',
    '1/2 Wire Trans Svc Charge   15.00 4,985.00',
    '1/5 Atlas Manufacturing Direct Deposit 682.52  8,163.52',
  ].join('\n');

  const batch = parseStatementText(text);
  assert.equal(batch.format, 'pdf');
  // Two transaction rows; statement-period line is not a transaction.
  const txnRows = batch.rows.filter(
    (r) => !r.payee.toLowerCase().startsWith('statement period'),
  );
  assert.ok(txnRows.length >= 2, `expected at least 2 transactions, got ${txnRows.length}`);

  const fee = txnRows.find((r) => r.payee.includes('Wire Trans Svc Charge'));
  assert.ok(fee, 'wire fee should parse');
  assert.equal(Math.abs(fee!.amount), 15, 'amount must be the transaction value (15), not the running balance');
  assert.equal(fee!.date, '2024-01-02');

  const payroll = txnRows.find((r) => r.payee.includes('Atlas Manufacturing'));
  assert.ok(payroll);
  assert.equal(payroll!.amount, 682.52);
});

test('parseStatementText skips beginning/ending balance lines even when they look like transactions', () => {
  const text = [
    'Statement period 01/01/2024 to 01/31/2024',
    'Beginning balance on 1/1 5,000.00',
    '1/2 Coffee Shop -4.75',
    'Ending balance on 1/31 4,995.25',
  ].join('\n');

  const batch = parseStatementText(text);
  const txnRows = batch.rows.filter(
    (r) =>
      !/beginning balance|ending balance|statement period/i.test(r.payee),
  );
  assert.equal(txnRows.length, 1, 'only the coffee row should parse');
  assert.equal(txnRows[0]!.payee, 'Coffee Shop');
  assert.equal(txnRows[0]!.amount, -4.75);
});

test('tolerates alternate bank wording ("Post Date", "Transaction", "Amount (USD)")', () => {
  const csv = [
    'Post Date,Transaction,Amount (USD)',
    '04/05/2026,Payroll Deposit,3920.00',
    '04/04/2026,"Uber, LLC",-12.34',
  ].join('\n');
  const rows = parseDelimitedStatement(csv);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]?.payee, 'Payroll Deposit');
  assert.equal(rows[0]?.amount, 3920);
  assert.equal(rows[1]?.amount, -12.34);
});
