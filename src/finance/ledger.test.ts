import assert from 'node:assert/strict';
import test from 'node:test';

import { parseDelimitedStatement } from './import.shared';
import {
  addManualTransaction,
  applyImportedBatch,
  createFinanceState,
  getCashFlowForecast,
  getBudgetStatus,
  getFinanceSummary,
  getGuidanceSnapshot,
  rotateTransactionCategory,
  setBudget,
} from './ledger';

test('summary reflects the seeded ledger', () => {
  const state = createFinanceState();
  const summary = getFinanceSummary(state);

  assert.ok(summary.netWorth > 0);
  assert.ok(summary.monthSpend > 0);
  assert.ok(summary.importedFiles > 0);
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

test('guidance snapshot computes action steps and pacing metrics', () => {
  const state = createFinanceState();
  const snapshot = getGuidanceSnapshot(state, new Date('2026-04-10T12:00:00.000Z'));

  assert.ok(snapshot.steps.length > 0);
  assert.ok(snapshot.monthlySubscriptionBurn > 0);
  assert.ok(snapshot.projectedMonthEndSpend >= 0);
  assert.ok(snapshot.reviewCompletionPct <= 100);
});

test('cash flow forecast projects 30-day horizon and threshold alerts', () => {
  const state = createFinanceState();
  const forecast = getCashFlowForecast(state, 30, 1000, new Date('2026-04-10T12:00:00.000Z'));

  assert.equal(forecast.horizonDays, 30);
  assert.equal(forecast.points.length, 31);
  assert.equal(forecast.points[0]?.label, 'Today');
  assert.ok(Number.isFinite(forecast.projectedEndBalance));
  assert.ok(forecast.maxProjectedBalance >= forecast.minProjectedBalance);
  assert.ok(forecast.recurringIncomeMonthly >= 0);
  assert.ok(forecast.recurringExpenseMonthly >= 0);
});
