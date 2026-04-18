import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import test from 'node:test';

import {
  parseDelimitedStatement,
  parseDelimitedWithMapping,
  parseStatementText,
  suggestColumnRoles,
} from './import.shared';

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
