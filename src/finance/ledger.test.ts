import assert from 'node:assert/strict';
import test from 'node:test';

import { parseDelimitedStatement } from './import.shared';
import type { FinanceState, FinanceTransaction } from './types';
import {
  addManualTransaction,
  applyImportedBatch,
  createFinanceState,
  getBudgetStatus,
  getFinanceSummary,
  getSafeToSpend,
  projectRecurring,
  rotateTransactionCategory,
  setBudget,
} from './ledger';

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

function tx(partial: Omit<FinanceTransaction, 'source' | 'reviewed'> & { source?: FinanceTransaction['source'] }): FinanceTransaction {
  return {
    source: partial.source ?? 'manual',
    reviewed: true,
    ...partial,
  };
}

test('projectRecurring excludes projections past the horizon', () => {
  const base = createFinanceState();
  const extra: FinanceTransaction[] = [
    tx({
      id: 'pr-h1',
      accountId: 'acct-wf-checking',
      date: '2026-05-18',
      payee: 'WeeklyBillCo',
      amount: -10,
      category: 'Subscriptions',
    }),
    tx({
      id: 'pr-h2',
      accountId: 'acct-wf-checking',
      date: '2026-05-25',
      payee: 'WeeklyBillCo',
      amount: -10,
      category: 'Subscriptions',
    }),
  ];
  const state: FinanceState = { ...base, transactions: [...base.transactions, ...extra] };
  const today = '2026-06-01';
  const short = projectRecurring(state, 10, today);
  const long = projectRecurring(state, 30, today);
  assert.ok(short.every((r) => r.date <= '2026-06-11'));
  assert.ok(long.some((r) => r.date > '2026-06-11'));
  assert.ok(long.every((r) => r.date <= '2026-07-01'));
});

test('projectRecurring emits multiple weekly instances inside the horizon', () => {
  const base = createFinanceState();
  const extra: FinanceTransaction[] = [
    tx({
      id: 'pr-w1',
      accountId: 'acct-wf-checking',
      date: '2026-05-18',
      payee: 'WeeklySubX',
      amount: -12,
      category: 'Subscriptions',
    }),
    tx({
      id: 'pr-w2',
      accountId: 'acct-wf-checking',
      date: '2026-05-25',
      payee: 'WeeklySubX',
      amount: -12,
      category: 'Subscriptions',
    }),
  ];
  const state: FinanceState = { ...base, transactions: [...base.transactions, ...extra] };
  const today = '2026-06-01';
  const rows = projectRecurring(state, 25, today);
  const hits = rows.filter((r) => r.payee === 'WeeklySubX' && r.kind === 'charge');
  assert.ok(hits.length >= 3);
  assert.deepEqual(
    hits.map((r) => r.date),
    [...hits.map((r) => r.date)].sort(),
  );
});

test('projectRecurring sorts income and charges together by date', () => {
  const base = createFinanceState();
  const extra: FinanceTransaction[] = [
    tx({
      id: 'pr-i1',
      accountId: 'acct-wf-checking',
      date: '2026-05-14',
      payee: 'Payroll Inc',
      amount: 500,
      category: 'Income',
    }),
    tx({
      id: 'pr-i2',
      accountId: 'acct-wf-checking',
      date: '2026-05-21',
      payee: 'Payroll Inc',
      amount: 500,
      category: 'Income',
    }),
    tx({
      id: 'pr-c1',
      accountId: 'acct-wf-checking',
      date: '2026-05-15',
      payee: 'RentBot',
      amount: -200,
      category: 'Housing',
    }),
    tx({
      id: 'pr-c2',
      accountId: 'acct-wf-checking',
      date: '2026-05-22',
      payee: 'RentBot',
      amount: -200,
      category: 'Housing',
    }),
  ];
  const state: FinanceState = { ...base, transactions: [...base.transactions, ...extra] };
  const today = '2026-05-23';
  const rows = projectRecurring(state, 21, today);
  const dates = rows.map((r) => r.date);
  assert.deepEqual(dates, [...dates].sort());
  const ours = rows.filter((r) => r.payee === 'Payroll Inc' || r.payee === 'RentBot').slice(0, 2);
  assert.equal(ours[0]?.date, '2026-05-28');
  assert.equal(ours[0]?.kind, 'income');
  assert.equal(ours[1]?.date, '2026-05-29');
  assert.equal(ours[1]?.kind, 'charge');
});

test('projectRecurring confidence never exceeds 0.95', () => {
  const state = createFinanceState();
  for (const r of projectRecurring(state, 60, '2026-04-10')) {
    assert.ok(r.confidence <= 0.95);
  }
});
