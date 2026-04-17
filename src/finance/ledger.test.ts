import assert from 'node:assert/strict';
import test from 'node:test';

import { parseDelimitedStatement } from './import.shared';
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
import type { FinanceState, FinanceTransaction } from './types';

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

function iso(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function recurringTestState(txs: FinanceTransaction[]): FinanceState {
  const seed = createFinanceState();
  return { ...seed, transactions: txs };
}

test('projectRecurring: excludes dates past horizon', () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const d0 = new Date(start);
  d0.setDate(d0.getDate() - 14);
  const d1 = new Date(start);
  d1.setDate(d1.getDate() - 7);
  const txs: FinanceTransaction[] = [
    {
      id: 'pr-1',
      accountId: 'acct-wf-checking',
      date: iso(d0),
      payee: 'Weekly Gym',
      amount: -15,
      category: 'Health',
      source: 'manual',
      reviewed: true,
    },
    {
      id: 'pr-2',
      accountId: 'acct-wf-checking',
      date: iso(d1),
      payee: 'Weekly Gym',
      amount: -15,
      category: 'Health',
      source: 'manual',
      reviewed: true,
    },
  ];
  const state = recurringTestState(txs);
  const end = new Date(start);
  end.setDate(end.getDate() + 5);
  const projected = projectRecurring(state, 5);
  for (const p of projected) {
    assert.ok(p.date <= iso(end));
  }
});

test('projectRecurring: weekly cadence yields multiple instances inside horizon', () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const txs: FinanceTransaction[] = [14, 7].map((daysAgo, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() - daysAgo);
    return {
      id: `wk-${i}`,
      accountId: 'acct-wf-checking',
      date: iso(d),
      payee: 'Weekly Cafe',
      amount: -5,
      category: 'Dining',
      source: 'manual' as const,
      reviewed: true,
    };
  });
  const state = recurringTestState(txs);
  const projected = projectRecurring(state, 30).filter((p) => p.payee === 'Weekly Cafe');
  assert.ok(projected.length >= 3);
});

test('projectRecurring: ascending date order when income and charges interleave', () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const chargeDates = [90, 60, 30].map((ago) => {
    const d = new Date(start);
    d.setDate(d.getDate() - ago);
    return iso(d);
  });
  const incomeDates = [60, 30].map((ago) => {
    const d = new Date(start);
    d.setDate(d.getDate() - ago);
    return iso(d);
  });
  const txs: FinanceTransaction[] = [
    ...chargeDates.map((date, i) => ({
      id: `c-${i}`,
      accountId: 'acct-wf-checking',
      date,
      payee: 'Rent Bill',
      amount: -100,
      category: 'Housing',
      source: 'manual' as const,
      reviewed: true,
    })),
    ...incomeDates.map((date, i) => ({
      id: `i-${i}`,
      accountId: 'acct-wf-checking',
      date,
      payee: 'Payroll Inc',
      amount: 500,
      category: 'Income',
      source: 'manual' as const,
      reviewed: true,
    })),
  ];
  const state = recurringTestState(txs);
  const projected = projectRecurring(state, 45);
  for (let i = 1; i < projected.length; i += 1) {
    assert.ok(projected[i - 1]!.date <= projected[i]!.date);
  }
  const hasCharge = projected.some((p) => p.kind === 'charge');
  const hasIncome = projected.some((p) => p.kind === 'income');
  assert.ok(hasCharge);
  assert.ok(hasIncome);
});

test('projectRecurring: confidence capped at 0.95', () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const txs: FinanceTransaction[] = [];
  for (let k = 10; k >= 1; k -= 1) {
    const d = new Date(start);
    d.setDate(d.getDate() - k * 30);
    txs.push({
      id: `m-${k}`,
      accountId: 'acct-wf-checking',
      date: iso(d),
      payee: 'Monthly Sub',
      amount: -9.99,
      category: 'Subscriptions',
      source: 'manual',
      reviewed: true,
    });
  }
  const state = recurringTestState(txs);
  const projected = projectRecurring(state, 60);
  const row = projected.find((p) => p.payee === 'Monthly Sub');
  assert.ok(row);
  assert.ok(row.confidence <= 0.95);
});
