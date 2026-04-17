import assert from 'node:assert/strict';
import test from 'node:test';

import { buildFullLedgerCsv } from './export';
import { createFinanceState } from './ledger';

test('buildFullLedgerCsv includes section markers and transactions', () => {
  const state = createFinanceState();
  const csv = buildFullLedgerCsv(state);

  assert.ok(csv.includes('# section,transactions'));
  assert.ok(csv.includes('# section,accounts'));
  assert.ok(csv.includes('# section,budgets'));
  assert.ok(csv.includes('# section,goals'));
  assert.ok(csv.includes('# section,import_history'));
  assert.ok(csv.includes('id,account_id,date'));
});
