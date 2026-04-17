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
  updateBudgetEnvelope,
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

function stateWithBudgetAndTxs(budget: Budget, txs: FinanceTransaction[]): FinanceState {
  const base = createFinanceState();
  return {
    ...base,
    transactions: txs.map((t) => ({ ...t })),
    budgets: [budget],
  };
}

test('envelope carry rolls across three months', () => {
  const acct = createFinanceState().accounts[0]!.id;
  const budget: Budget = {
    id: 'env-test',
    category: 'EnvTestCat',
    monthlyLimit: 100,
    createdAt: '2026-01-01T00:00:00.000Z',
    rollover: true,
  };
  const txs: FinanceTransaction[] = [
    {
      id: 'e1',
      accountId: acct,
      date: '2026-01-20',
      payee: 'Shop',
      amount: -80,
      category: 'EnvTestCat',
      source: 'manual',
      reviewed: true,
    },
    {
      id: 'e2',
      accountId: acct,
      date: '2026-02-05',
      payee: 'Shop',
      amount: -120,
      category: 'EnvTestCat',
      source: 'manual',
      reviewed: true,
    },
  ];
  const state = stateWithBudgetAndTxs(budget, txs);

  const jan = getBudgetEnvelopes(state, 2026, 1)[0]!;
  assert.equal(jan.carriedIn, 0);
  assert.equal(jan.assigned, 100);
  assert.equal(jan.spent, 80);
  assert.equal(jan.available, 20);

  const feb = getBudgetEnvelopes(state, 2026, 2)[0]!;
  assert.equal(feb.carriedIn, 20);
  assert.equal(feb.available, 0);

  const mar = getBudgetEnvelopes(state, 2026, 3)[0]!;
  assert.equal(mar.carriedIn, 0);
  assert.equal(mar.spent, 0);
  assert.equal(mar.available, 100);
});

test('envelope rollover off ignores surplus but keeps debt', () => {
  const acct = createFinanceState().accounts[0]!.id;
  const budget: Budget = {
    id: 'env-roll',
    category: 'RollCat',
    monthlyLimit: 100,
    createdAt: '2026-01-01T00:00:00.000Z',
    rollover: true,
  };
  const txs: FinanceTransaction[] = [
    {
      id: 'r1',
      accountId: acct,
      date: '2026-01-10',
      payee: 'A',
      amount: -50,
      category: 'RollCat',
      source: 'manual',
      reviewed: true,
    },
  ];
  let state = stateWithBudgetAndTxs(budget, txs);
  const jan = getBudgetEnvelopes(state, 2026, 1)[0]!;
  assert.equal(jan.available, 50);

  state = updateBudgetEnvelope(state, budget.id, { rollover: false });
  const feb = getBudgetEnvelopes(state, 2026, 2)[0]!;
  assert.equal(feb.carriedIn, 0);
  assert.equal(feb.available, 100);

  const overspendTx: FinanceTransaction[] = [
    ...txs,
    {
      id: 'r2',
      accountId: acct,
      date: '2026-02-05',
      payee: 'B',
      amount: -130,
      category: 'RollCat',
      source: 'manual',
      reviewed: true,
    },
  ];
  state = stateWithBudgetAndTxs({ ...budget, rollover: false }, overspendTx);
  const febDebt = getBudgetEnvelopes(state, 2026, 2)[0]!;
  assert.equal(febDebt.available, -30);
  const mar = getBudgetEnvelopes(state, 2026, 3)[0]!;
  assert.equal(mar.carriedIn, -30);
});

test('toggling rollover off stops surplus carry on recompute', () => {
  const acct = createFinanceState().accounts[0]!.id;
  const budget: Budget = {
    id: 'toggle',
    category: 'ToggleCat',
    monthlyLimit: 100,
    createdAt: '2026-01-01T00:00:00.000Z',
    rollover: true,
  };
  const txs: FinanceTransaction[] = [
    {
      id: 't1',
      accountId: acct,
      date: '2026-01-12',
      payee: 'Spend',
      amount: -40,
      category: 'ToggleCat',
      source: 'manual',
      reviewed: true,
    },
  ];
  let state = stateWithBudgetAndTxs(budget, txs);
  const febOn = getBudgetEnvelopes(state, 2026, 2)[0]!;
  assert.equal(febOn.carriedIn, 60);

  state = updateBudgetEnvelope(state, budget.id, { rollover: false });
  const febOff = getBudgetEnvelopes(state, 2026, 2)[0]!;
  assert.equal(febOff.carriedIn, 0);
});

test('budget created after prior months with spending starts clean then reflects spend', () => {
  const acct = createFinanceState().accounts[0]!.id;
  const budget: Budget = {
    id: 'late-bgt',
    category: 'LateCat',
    monthlyLimit: 200,
    createdAt: '2026-04-01T00:00:00.000Z',
    rollover: true,
  };
  const txs: FinanceTransaction[] = [
    {
      id: 'l1',
      accountId: acct,
      date: '2026-03-15',
      payee: 'Early',
      amount: -90,
      category: 'LateCat',
      source: 'manual',
      reviewed: true,
    },
    {
      id: 'l2',
      accountId: acct,
      date: '2026-04-10',
      payee: 'April',
      amount: -250,
      category: 'LateCat',
      source: 'manual',
      reviewed: true,
    },
  ];
  const state = stateWithBudgetAndTxs(budget, txs);
  const april = getBudgetEnvelopes(state, 2026, 4)[0]!;
  assert.equal(april.spent, 250);
  assert.equal(april.carriedIn, 0);
  assert.equal(april.assigned, 200);
  assert.equal(april.available, -50);
});
