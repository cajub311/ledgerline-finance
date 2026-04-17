import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseDelimitedStatement,
  parseDelimitedWithMapping,
  parseStatementText,
  suggestColumnRoles,
} from './import.shared';

test('parses tab-separated (TSV) export rows', () => {
  const rows = parseDelimitedStatement(
    ['Date\tDescription\tAmount', '04/05/2026\tCoffee\t-4.50', '04/04/2026\tDeposit\t100.00'].join('\n'),
  );

  assert.equal(rows.length, 2);
  assert.equal(rows[0]?.payee, 'Coffee');
  assert.equal(rows[0]?.amount, -4.5);
  assert.equal(rows[1]?.amount, 100);
});

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
