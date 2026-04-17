import assert from 'node:assert/strict';
import test from 'node:test';

import { parseDelimitedStatement } from './import.shared';
import {
  addManualTransaction,
  applyImportedBatch,
  createFinanceState,
  getBudgetEnvelopes,
  getBudgetStatus,
  getFinanceSummary,
  getSafeToSpend,
  rotateTransactionCategory,
  setBudget,
  updateBudget,
} from './ledger';
import type { Budget, FinanceState, FinanceTransaction } from './types';

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

function minimalState(overrides: {
  transactions: FinanceTransaction[];
  budgets: Budget[];
}): FinanceState {
  const seed = createFinanceState();
  return {
    ...seed,
    transactions: overrides.transactions,
    budgets: overrides.budgets,
  };
}

test('envelope carry rolls surplus across three months', () => {
  const accountId = 'acct-wf-checking';
  const budget: Budget = {
    id: 'b-env-1',
    category: 'Groceries',
    monthlyLimit: 100,
    createdAt: '2026-01-01T00:00:00.000Z',
    rollover: true,
  };
  const transactions: FinanceTransaction[] = [
    {
      id: 'e1',
      accountId,
      date: '2026-01-20',
      payee: 'Store',
      amount: -50,
      category: 'Groceries',
      source: 'manual',
      reviewed: true,
    },
    {
      id: 'e2',
      accountId,
      date: '2026-02-10',
      payee: 'Store',
      amount: -80,
      category: 'Groceries',
      source: 'manual',
      reviewed: true,
    },
    {
      id: 'e3',
      accountId,
      date: '2026-03-05',
      payee: 'Store',
      amount: -30,
      category: 'Groceries',
      source: 'manual',
      reviewed: true,
    },
  ];
  const state = minimalState({ transactions, budgets: [budget] });

  const jan = getBudgetEnvelopes(state, 2026, 1)[0];
  const feb = getBudgetEnvelopes(state, 2026, 2)[0];
  const mar = getBudgetEnvelopes(state, 2026, 3)[0];

  assert.equal(jan.carriedIn, 0);
  assert.equal(jan.assigned, 100);
  assert.equal(jan.spent, 50);
  assert.equal(jan.available, 50);

  assert.equal(feb.carriedIn, 50);
  assert.equal(feb.available, 70);

  assert.equal(mar.carriedIn, 70);
  assert.equal(mar.available, 140);
});

test('envelope rollover off ignores surplus but still rolls debt', () => {
  const accountId = 'acct-wf-checking';
  const budget: Budget = {
    id: 'b-env-2',
    category: 'Dining',
    monthlyLimit: 50,
    createdAt: '2026-01-01T00:00:00.000Z',
    rollover: false,
  };
  const transactions: FinanceTransaction[] = [
    {
      id: 'd1',
      accountId,
      date: '2026-01-05',
      payee: 'Cafe',
      amount: -20,
      category: 'Dining',
      source: 'manual',
      reviewed: true,
    },
    {
      id: 'd2',
      accountId,
      date: '2026-02-05',
      payee: 'Cafe',
      amount: -80,
      category: 'Dining',
      source: 'manual',
      reviewed: true,
    },
    {
      id: 'd3',
      accountId,
      date: '2026-03-05',
      payee: 'Cafe',
      amount: -10,
      category: 'Dining',
      source: 'manual',
      reviewed: true,
    },
  ];
  const state = minimalState({ transactions, budgets: [budget] });

  const feb = getBudgetEnvelopes(state, 2026, 2)[0];
  assert.equal(feb.carriedIn, 0);

  const mar = getBudgetEnvelopes(state, 2026, 3)[0];
  assert.equal(mar.carriedIn, -30);
  assert.equal(mar.available, 10);
});

test('toggling rollover mid-stream changes carry into the next month', () => {
  const accountId = 'acct-wf-checking';
  let budget: Budget = {
    id: 'b-env-3',
    category: 'Shopping',
    monthlyLimit: 100,
    createdAt: '2026-01-01T00:00:00.000Z',
    rollover: true,
  };
  const transactions: FinanceTransaction[] = [
    {
      id: 's1',
      accountId,
      date: '2026-01-10',
      payee: 'Mart',
      amount: -40,
      category: 'Shopping',
      source: 'manual',
      reviewed: true,
    },
    {
      id: 's2',
      accountId,
      date: '2026-02-10',
      payee: 'Mart',
      amount: -30,
      category: 'Shopping',
      source: 'manual',
      reviewed: true,
    },
  ];
  let state = minimalState({ transactions, budgets: [budget] });

  const febOn = getBudgetEnvelopes(state, 2026, 2)[0];
  assert.equal(febOn.carriedIn, 60);

  state = updateBudget(state, 'b-env-3', { rollover: false });
  const febOff = getBudgetEnvelopes(state, 2026, 2)[0];
  assert.equal(febOff.carriedIn, 0);

  state = updateBudget(state, 'b-env-3', { rollover: true });
  const febRestored = getBudgetEnvelopes(state, 2026, 2)[0];
  assert.equal(febRestored.carriedIn, 60);
});

test('budget created after prior spending months only rolls from creation onward', () => {
  const accountId = 'acct-wf-checking';
  const budget: Budget = {
    id: 'b-env-4',
    category: 'Fuel',
    monthlyLimit: 100,
    createdAt: '2026-03-01T00:00:00.000Z',
    rollover: true,
  };
  const transactions: FinanceTransaction[] = [
    {
      id: 'f1',
      accountId,
      date: '2026-01-15',
      payee: 'Pump',
      amount: -200,
      category: 'Fuel',
      source: 'manual',
      reviewed: true,
    },
    {
      id: 'f2',
      accountId,
      date: '2026-03-10',
      payee: 'Pump',
      amount: -40,
      category: 'Fuel',
      source: 'manual',
      reviewed: true,
    },
  ];
  const state = minimalState({ transactions, budgets: [budget] });

  const mar = getBudgetEnvelopes(state, 2026, 3)[0];
  assert.equal(mar.carriedIn, 0);
  assert.equal(mar.spent, 40);
  assert.equal(mar.available, 60);
});
