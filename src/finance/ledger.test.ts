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

test('getNetWorthSeries: length, monotonic months, final matches summary, liabilities non-positive', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-04-20T12:00:00Z') });
  const state = createFinanceState();
  const summary = getFinanceSummary(state);

  const s3 = getNetWorthSeries(state, 3);
  assert.equal(s3.length, 3);
  for (let i = 1; i < s3.length; i += 1) {
    assert.ok(s3[i]!.monthKey >= s3[i - 1]!.monthKey);
  }
  assert.equal(s3[s3.length - 1]!.netWorth, summary.netWorth);
  for (const p of s3) {
    assert.ok(p.assets >= 0);
    assert.ok(p.liabilities <= 0);
  }

  const sAll = getNetWorthSeries(state, 0);
  assert.ok(sAll.length >= s3.length);
  assert.equal(sAll[sAll.length - 1]!.netWorth, summary.netWorth);

  t.mock.timers.reset();
});

test('getNetWorthSeries: credit liability stays in liabilities bucket', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-04-15T12:00:00Z') });
  const accounts: FinanceAccount[] = [
    {
      id: 'a-check',
      name: 'Checking',
      institution: 'X',
      type: 'checking',
      source: 'manual',
      openingBalance: 1000,
      lastSynced: '2026-04-01',
    },
    {
      id: 'a-card',
      name: 'Card',
      institution: 'X',
      type: 'credit',
      source: 'manual',
      openingBalance: -100,
      lastSynced: '2026-04-01',
    },
  ];
  const transactions: FinanceTransaction[] = [
    {
      id: 'nw-1',
      accountId: 'a-check',
      date: '2026-04-10',
      payee: 'Shop',
      amount: -50,
      category: 'Shopping',
      source: 'manual',
      reviewed: true,
    },
  ];
  const state: FinanceState = {
    ...createFinanceState(),
    accounts,
    transactions,
    budgets: [],
    goals: [],
    imports: [],
  };
  const series = getNetWorthSeries(state, 2);
  const last = series[series.length - 1]!;
  assert.equal(last.assets, 950);
  assert.equal(last.liabilities, -100);
  assert.equal(last.netWorth, 850);
  assert.equal(last.netWorth, getFinanceSummary(state).netWorth);
  t.mock.timers.reset();
});
