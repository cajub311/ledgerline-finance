import assert from 'node:assert/strict';
import test from 'node:test';

import { parseDelimitedStatement } from './import.shared';
import {
  addManualTransaction,
  applyImportedBatch,
  createFinanceState,
  getBudgetStatus,
  getFinanceSummary,
  getNetWorthSeries,
  getSafeToSpend,
  rotateTransactionCategory,
  setBudget,
} from './ledger';
import type { FinanceAccount, FinanceState, FinanceTransaction } from './types';

test('summary reflects the seeded ledger', () => {
  const state = createFinanceState();
  const summary = getFinanceSummary(state);

  assert.ok(summary.netWorth > 0);
  assert.ok(summary.monthSpend > 0);
  assert.ok(summary.importedFiles > 0);
  assert.ok(state.preferences.forecastLowBalanceThreshold >= 0);
});

test('safe to spend is non-negative and bounded by liquid cash', () => {
  const state = createFinanceState();
  const summary = getFinanceSummary(state);
  const safe = getSafeToSpend(state);
  assert.ok(safe >= 0);
  assert.ok(safe <= summary.liquidCash + 0.01);
});

test('manual transactions are added to the selected account', () => {
  const state = createFinanceState();
  const nextState = addManualTransaction(state, {
    accountId: 'acct-cash',
    date: '2026-04-06',
    payee: 'Coffee Shop',
    amount: '-4.75',
    category: 'Dining',
    notes: 'Morning run',
  });

  assert.equal(nextState.transactions.length, state.transactions.length + 1);
  assert.equal(nextState.transactions[0]?.payee, 'Coffee Shop');
});

test('imported rows dedupe against existing transactions', () => {
  const state = createFinanceState();
  const batch = {
    format: 'csv' as const,
    sourceLabel: 'wells-fargo-account-activity.csv',
    notes: [],
    rows: parseDelimitedStatement(
      ['Date,Description,Amount', '04/05/2026,Payroll Deposit,3920.00'].join('\n'),
    ),
  };

  const nextState = applyImportedBatch(state, 'acct-wf-checking', batch);
  assert.equal(nextState.transactions.length, state.transactions.length);
  assert.equal(nextState.imports[0]?.rows, 0);
});

test('rotating a category advances to the next preset', () => {
  const state = createFinanceState();
  const nextState = rotateTransactionCategory(state, 'tx-003');
  const updated = nextState.transactions.find((transaction) => transaction.id === 'tx-003');

  assert.ok(updated);
  assert.notEqual(updated?.category, 'Groceries');
});

test('setBudget adds a category limit visible in budget status', () => {
  const state = setBudget(createFinanceState(), 'TestCat', 100);
  const now = new Date();
  const statuses = getBudgetStatus(state, now.getFullYear(), now.getMonth() + 1);
  const row = statuses.find((s) => s.category === 'TestCat');

  assert.ok(row);
  assert.equal(row?.limit, 100);
});

const AS_OF = new Date('2026-04-15T12:00:00.000Z');

test('getNetWorthSeries length matches window for 3 / 6 / 12', () => {
  const state = createFinanceState();
  assert.equal(getNetWorthSeries(state, 3, AS_OF).length, 3);
  assert.equal(getNetWorthSeries(state, 6, AS_OF).length, 6);
  assert.equal(getNetWorthSeries(state, 12, AS_OF).length, 12);
});

test('getNetWorthSeries uses monotonic transaction dates in sort', () => {
  const acct: FinanceAccount = {
    id: 'a-nw',
    name: 'C',
    institution: 'X',
    type: 'checking',
    source: 'manual',
    openingBalance: 1000,
    lastSynced: '2026-01-01',
  };
  const txs: FinanceTransaction[] = [
    {
      id: 'z',
      accountId: acct.id,
      date: '2026-02-01',
      payee: 'Late id',
      amount: -10,
      category: 'Dining',
      source: 'manual',
      reviewed: true,
    },
    {
      id: 'a',
      accountId: acct.id,
      date: '2026-02-01',
      payee: 'Early id',
      amount: -5,
      category: 'Dining',
      source: 'manual',
      reviewed: true,
    },
  ];
  const state: FinanceState = {
    ...createFinanceState(),
    accounts: [acct],
    transactions: txs,
  };
  const series = getNetWorthSeries(state, 3, new Date('2026-04-01'));
  const feb = series.find((p) => p.monthKey === '2026-02');
  assert.ok(feb);
  assert.equal(feb?.netWorth, 985);
});

test('getNetWorthSeries last point matches getFinanceSummary netWorth', () => {
  const state = createFinanceState();
  const summary = getFinanceSummary(state);
  const last = getNetWorthSeries(state, 6, AS_OF).at(-1);
  assert.ok(last);
  assert.equal(last?.netWorth, summary.netWorth);
});

test('getNetWorthSeries liabilities are non-positive', () => {
  const state = createFinanceState();
  for (const p of getNetWorthSeries(state, 6, AS_OF)) {
    assert.ok(p.liabilities <= 0, `month ${p.monthKey}`);
  }
});

test('getNetWorthSeries is idempotent for same inputs', () => {
  const state = createFinanceState();
  const a = getNetWorthSeries(state, 6, AS_OF);
  const b = getNetWorthSeries(state, 6, AS_OF);
  assert.deepEqual(a, b);
});
