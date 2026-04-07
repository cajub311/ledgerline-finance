import assert from 'node:assert/strict';
import test from 'node:test';

import { parseDelimitedStatement, parseStatementText } from './import.shared';

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
