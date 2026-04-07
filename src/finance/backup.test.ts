import assert from 'node:assert/strict';
import test from 'node:test';

import { parseFinanceBackupJson, serializeFinanceState } from './backup';
import { createFinanceState, setBudget } from './ledger';

test('backup JSON round-trips through parse and matches rehydration', () => {
  const state = setBudget(createFinanceState(), 'Groceries', 400);
  const json = serializeFinanceState(state);
  const restored = parseFinanceBackupJson(json);

  assert.equal(restored.budgets.length, state.budgets.length);
  assert.equal(restored.transactions.length, state.transactions.length);
  assert.ok(restored.budgets.some((b) => b.category === 'Groceries' && b.monthlyLimit === 400));
});
