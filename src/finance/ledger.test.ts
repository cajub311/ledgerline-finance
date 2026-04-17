import assert from 'node:assert/strict';
import test from 'node:test';

import { parseDelimitedStatement } from './import.shared';
import type { Budget, FinanceState } from './types';
import {
  addManualTransaction,
  applyImportedBatch,
  createFinanceState,
  getBudgetEnvelopes,
  getBudgetStatus,
  getFinanceSummary,
  getSafeToSpend,
  rehydrateFinanceState,
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

test('envelope carry math across three months with rollover', () => {
  const base = createFinanceState();
  const cat = 'EnvelopeTestCat';
  const b: Budget = {
    id: 'bgt-env-test',
    category: cat,
    monthlyLimit: 100,
    createdAt: '2026-01-15T12:00:00.000Z',
    rollover: true,
  };
  const state: FinanceState = {
    ...base,
    budgets: [b],
    transactions: [
      {
        id: 'e1',
        accountId: 'acct-wf-checking',
        date: '2026-01-10',
        payee: 'Shop',
        amount: -40,
        category: cat,
        source: 'manual',
        reviewed: true,
      },
      {
        id: 'e2',
        accountId: 'acct-wf-checking',
        date: '2026-02-05',
        payee: 'Shop',
        amount: -30,
        category: cat,
        source: 'manual',
        reviewed: true,
      },
      {
        id: 'e3',
        accountId: 'acct-wf-checking',
        date: '2026-03-05',
        payee: 'Shop',
        amount: -20,
        category: cat,
        source: 'manual',
        reviewed: true,
      },
    ],
  };

  const jan = getBudgetEnvelopes(state, 2026, 1)[0];
  const feb = getBudgetEnvelopes(state, 2026, 2)[0];
  const mar = getBudgetEnvelopes(state, 2026, 3)[0];

  assert.equal(jan.carriedIn, 0);
  assert.equal(jan.assigned, 100);
  assert.equal(jan.spent, 40);
  assert.equal(jan.available, 60);

  assert.equal(feb.carriedIn, 60);
  assert.equal(feb.available, 130);

  assert.equal(mar.carriedIn, 130);
  assert.equal(mar.available, 210);
});

test('toggling rollover mid-stream drops surplus but keeps debt', () => {
  const base = createFinanceState();
  const cat = 'RolloverToggleCat';
  let b: Budget = {
    id: 'bgt-roll',
    category: cat,
    monthlyLimit: 100,
    createdAt: '2026-01-01T00:00:00.000Z',
    rollover: true,
  };
  const txs = [
    {
      id: 'r1',
      accountId: 'acct-wf-checking',
      date: '2026-01-20',
      payee: 'X',
      amount: -20,
      category: cat,
      source: 'manual' as const,
      reviewed: true,
    },
    {
      id: 'r2',
      accountId: 'acct-wf-checking',
      date: '2026-02-20',
      payee: 'X',
      amount: -150,
      category: cat,
      source: 'manual' as const,
      reviewed: true,
    },
  ];
  let state: FinanceState = { ...base, budgets: [b], transactions: [...base.transactions, ...txs] };

  const febOn = getBudgetEnvelopes(state, 2026, 2)[0];
  assert.equal(febOn.carriedIn, 80);

  b = { ...b, rollover: false };
  state = { ...state, budgets: [b] };
  const febOff = getBudgetEnvelopes(state, 2026, 2)[0];
  assert.equal(febOff.carriedIn, 0);
  assert.equal(febOff.available, -50);

  const marOff = getBudgetEnvelopes(state, 2026, 3)[0];
  assert.ok(marOff.carriedIn < 0);
  assert.equal(marOff.assigned, 100);
});

test('budget created after months with spending still gets correct carry from creation', () => {
  const base = createFinanceState();
  const cat = 'LateBudgetCat';
  const b: Budget = {
    id: 'bgt-late',
    category: cat,
    monthlyLimit: 50,
    createdAt: '2026-03-01T00:00:00.000Z',
    rollover: true,
  };
  const state: FinanceState = {
    ...base,
    budgets: [b],
    transactions: [
      {
        id: 'l1',
        accountId: 'acct-wf-checking',
        date: '2026-01-15',
        payee: 'Past',
        amount: -200,
        category: cat,
        source: 'manual',
        reviewed: true,
      },
      {
        id: 'l2',
        accountId: 'acct-wf-checking',
        date: '2026-03-10',
        payee: 'Now',
        amount: -10,
        category: cat,
        source: 'manual',
        reviewed: true,
      },
    ],
  };

  const mar = getBudgetEnvelopes(state, 2026, 3)[0];
  assert.equal(mar.carriedIn, 0);
  assert.equal(mar.spent, 10);
  assert.equal(mar.available, 40);
});

test('getBudgetEnvelopes is idempotent for the same inputs', () => {
  const state = setBudget(createFinanceState(), 'TestCat', 100);
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const a = getBudgetEnvelopes(state, y, m);
  const b = getBudgetEnvelopes(state, y, m);
  assert.deepEqual(a, b);
});

test('rehydrate fills default rollover and budgetsViewMode on budgets', () => {
  const raw = {
    version: 1,
    householdName: 'T',
    currency: 'USD' as const,
    accounts: [],
    transactions: [],
    imports: [],
    budgets: [{ id: 'x', category: 'C', monthlyLimit: 10, createdAt: '2026-01-01T00:00:00.000Z' }],
    goals: [],
    preferences: { forecastLowBalanceThreshold: 0 },
  };
  const s = rehydrateFinanceState(raw as unknown as Partial<FinanceState>);
  assert.equal(s.budgets[0]?.rollover, true);
  assert.equal(s.preferences.budgetsViewMode, 'flow');
});
