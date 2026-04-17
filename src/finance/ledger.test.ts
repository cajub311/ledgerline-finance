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
  patchBudget,
  rotateTransactionCategory,
  setBudget,
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

function envelopeState(base: FinanceState, budgets: Budget[], txs: FinanceTransaction[]): FinanceState {
  return { ...base, budgets, transactions: txs };
}

test('getBudgetEnvelopes: carry math across three months with rollover', () => {
  const b: Budget = {
    id: 'b-env-1',
    category: 'Groceries',
    monthlyLimit: 100,
    createdAt: '2026-01-01T12:00:00.000Z',
    rollover: true,
  };
  const txs: FinanceTransaction[] = [
    {
      id: 't1',
      accountId: 'acct-wf-checking',
      date: '2026-01-15',
      payee: 'Store',
      amount: -60,
      category: 'Groceries',
      source: 'manual',
      reviewed: true,
    },
    {
      id: 't2',
      accountId: 'acct-wf-checking',
      date: '2026-02-10',
      payee: 'Store',
      amount: -50,
      category: 'Groceries',
      source: 'manual',
      reviewed: true,
    },
    {
      id: 't3',
      accountId: 'acct-wf-checking',
      date: '2026-03-05',
      payee: 'Store',
      amount: -30,
      category: 'Groceries',
      source: 'manual',
      reviewed: true,
    },
  ];
  const state = envelopeState(createFinanceState(), [b], txs);
  const e1 = getBudgetEnvelopes(state, 2026, 1)[b.id];
  const e2 = getBudgetEnvelopes(state, 2026, 2)[b.id];
  const e3 = getBudgetEnvelopes(state, 2026, 3)[b.id];
  assert.equal(e1?.carriedIn, 0);
  assert.equal(e1?.available, 40);
  assert.equal(e2?.carriedIn, 40);
  assert.equal(e2?.available, 90);
  assert.equal(e3?.carriedIn, 90);
  assert.equal(e3?.available, 160);
});

test('getBudgetEnvelopes: toggling rollover mid-stream changes carry', () => {
  const b: Budget = {
    id: 'b-env-2',
    category: 'Dining',
    monthlyLimit: 100,
    createdAt: '2026-01-01T12:00:00.000Z',
    rollover: true,
  };
  const txs: FinanceTransaction[] = [
    {
      id: 't1',
      accountId: 'acct-wf-checking',
      date: '2026-01-20',
      payee: 'Cafe',
      amount: -40,
      category: 'Dining',
      source: 'manual',
      reviewed: true,
    },
    {
      id: 't2',
      accountId: 'acct-wf-checking',
      date: '2026-02-05',
      payee: 'Cafe',
      amount: -30,
      category: 'Dining',
      source: 'manual',
      reviewed: true,
    },
  ];
  let state = envelopeState(createFinanceState(), [b], txs);
  const febOn = getBudgetEnvelopes(state, 2026, 2)[b.id];
  assert.equal(febOn?.carriedIn, 60);

  state = patchBudget(state, b.id, { rollover: false });
  const febOff = getBudgetEnvelopes(state, 2026, 2)[b.id];
  assert.equal(febOff?.carriedIn, 0);
});

test('getBudgetEnvelopes: budget created after months already have spending', () => {
  const b: Budget = {
    id: 'b-late',
    category: 'Shopping',
    monthlyLimit: 200,
    createdAt: '2026-03-01T12:00:00.000Z',
    rollover: true,
  };
  const txs: FinanceTransaction[] = [
    {
      id: 't1',
      accountId: 'acct-wf-checking',
      date: '2026-01-10',
      payee: 'Mall',
      amount: -80,
      category: 'Shopping',
      source: 'manual',
      reviewed: true,
    },
    {
      id: 't2',
      accountId: 'acct-wf-checking',
      date: '2026-02-10',
      payee: 'Mall',
      amount: -90,
      category: 'Shopping',
      source: 'manual',
      reviewed: true,
    },
    {
      id: 't3',
      accountId: 'acct-wf-checking',
      date: '2026-03-10',
      payee: 'Mall',
      amount: -50,
      category: 'Shopping',
      source: 'manual',
      reviewed: true,
    },
  ];
  const state = envelopeState(createFinanceState(), [b], txs);
  const mar = getBudgetEnvelopes(state, 2026, 3)[b.id];
  assert.equal(mar?.carriedIn, 0);
  assert.equal(mar?.spent, 50);
  assert.equal(mar?.available, 150);
});
