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

test('getNetWorthSeries: length matches months, dates monotonic, final matches summary', () => {
  const state = createFinanceState();
  const summary = getFinanceSummary(state);
  const series6 = getNetWorthSeries(state, 6);
  assert.equal(series6.length, 6);
  for (let i = 1; i < series6.length; i += 1) {
    assert.ok(series6[i - 1]!.monthKey <= series6[i]!.monthKey);
  }
  const last = series6[series6.length - 1];
  assert.ok(last);
  assert.equal(last.netWorth, summary.netWorth);
});

test('getNetWorthSeries: liabilities are non-positive (sum of negative balances)', () => {
  const state = createFinanceState();
  const series = getNetWorthSeries(state, 12);
  for (const p of series) {
    assert.ok(p.liabilities <= 0);
    assert.ok(p.assets >= 0);
  }
});

test('getNetWorthSeries: ALL spans from earliest tx month to current', () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const pad = (n: number) => `${n}`.padStart(2, '0');
  const mkPrev = (delta: number) => {
    const idx = y * 12 + (m - 1) - delta;
    const yy = Math.floor(idx / 12);
    const mm = (idx % 12) + 1;
    return `${yy}-${pad(mm)}`;
  };
  const d1 = `${mkPrev(4)}-10`;
  const d2 = `${mkPrev(2)}-12`;
  const acct: FinanceAccount = {
    id: 'acct-test-nw',
    name: 'Test',
    institution: 'T',
    type: 'checking',
    source: 'manual',
    openingBalance: 1000,
    lastSynced: d1,
  };
  const txs: FinanceTransaction[] = [
    {
      id: 'nw-tx-1',
      accountId: acct.id,
      date: d1,
      payee: 'A',
      amount: 50,
      category: 'Income',
      source: 'manual',
      reviewed: true,
    },
    {
      id: 'nw-tx-2',
      accountId: acct.id,
      date: d2,
      payee: 'B',
      amount: -25,
      category: 'Dining',
      source: 'manual',
      reviewed: true,
    },
  ];
  const minimal: FinanceState = {
    ...createFinanceState(),
    accounts: [acct],
    transactions: txs,
    budgets: [],
    goals: [],
    imports: [],
  };
  const all = getNetWorthSeries(minimal, 0);
  assert.ok(all.length >= 2);
  assert.equal(all[0]?.monthKey, mkPrev(4));
  const summary = getFinanceSummary(minimal);
  assert.equal(all[all.length - 1]?.netWorth, summary.netWorth);
});
