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
  setBudgetRollover,
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

function tx(p: Partial<FinanceTransaction> & Pick<FinanceTransaction, 'id' | 'date' | 'payee' | 'amount' | 'category'>): FinanceTransaction {
  return {
    id: p.id,
    accountId: p.accountId ?? 'acct-test',
    date: p.date,
    payee: p.payee,
    amount: p.amount,
    category: p.category,
    source: p.source ?? 'manual',
    reviewed: p.reviewed ?? true,
    notes: p.notes,
  };
}

function withBudgetAndTxs(seed: FinanceState, budget: Budget, txs: FinanceTransaction[]): FinanceState {
  return { ...seed, budgets: [budget], transactions: txs };
}

test('envelope carry rolls across three months with rollover on', () => {
  const seed = createFinanceState();
  const budget: Budget = {
    id: 'b-env-1',
    category: 'Groceries',
    monthlyLimit: 100,
    createdAt: '2026-01-10T12:00:00.000Z',
    rollover: true,
  };
  const txs = [
    tx({ id: 't1', date: '2026-01-15', payee: 'A', amount: -80, category: 'Groceries' }),
    tx({ id: 't2', date: '2026-02-12', payee: 'B', amount: -50, category: 'Groceries' }),
  ];
  const state = withBudgetAndTxs(seed, budget, txs);

  const jan = getBudgetEnvelopes(state, 2026, 1)[0];
  const feb = getBudgetEnvelopes(state, 2026, 2)[0];
  const mar = getBudgetEnvelopes(state, 2026, 3)[0];

  assert.ok(jan && feb && mar);
  assert.equal(jan.carriedIn, 0);
  assert.equal(jan.assigned, 100);
  assert.equal(jan.spent, 80);
  assert.equal(jan.available, 20);

  assert.equal(feb.carriedIn, 20);
  assert.equal(feb.assigned, 100);
  assert.equal(feb.spent, 50);
  assert.equal(feb.available, 70);

  assert.equal(mar.carriedIn, 70);
  assert.equal(mar.assigned, 100);
  assert.equal(mar.spent, 0);
  assert.equal(mar.available, 170);
});

test('envelope rollover off drops surplus but still rolls debt', () => {
  const seed = createFinanceState();
  const surplusBudget: Budget = {
    id: 'b-s',
    category: 'Dining',
    monthlyLimit: 100,
    createdAt: '2026-01-05T00:00:00.000Z',
    rollover: false,
  };
  const s1 = withBudgetAndTxs(seed, surplusBudget, [
    tx({ id: 'd1', date: '2026-01-08', payee: 'x', amount: -40, category: 'Dining' }),
  ]);
  const febSurplus = getBudgetEnvelopes(s1, 2026, 2)[0];
  assert.equal(febSurplus.carriedIn, 0, 'surplus under spent should not roll when rollover off');

  const debtBudget: Budget = {
    id: 'b-d',
    category: 'Shopping',
    monthlyLimit: 100,
    createdAt: '2026-01-05T00:00:00.000Z',
    rollover: false,
  };
  const s2 = withBudgetAndTxs(seed, debtBudget, [
    tx({ id: 's1', date: '2026-01-08', payee: 'x', amount: -150, category: 'Shopping' }),
  ]);
  const febDebt = getBudgetEnvelopes(s2, 2026, 2)[0];
  assert.equal(febDebt.carriedIn, -50, 'overspend debt should still carry into next month');
});

test('budget created mid-year ignores pre-creation spending for carry', () => {
  const seed = createFinanceState();
  const budget: Budget = {
    id: 'b-late',
    category: 'Fuel',
    monthlyLimit: 200,
    createdAt: '2026-03-01T00:00:00.000Z',
    rollover: true,
  };
  const txs = [
    tx({ id: 'f0', date: '2026-01-10', payee: 'Early', amount: -999, category: 'Fuel' }),
    tx({ id: 'f1', date: '2026-02-10', payee: 'Early2', amount: -50, category: 'Fuel' }),
    tx({ id: 'f2', date: '2026-03-20', payee: 'In budget month', amount: -30, category: 'Fuel' }),
  ];
  const state = withBudgetAndTxs(seed, budget, txs);
  const mar = getBudgetEnvelopes(state, 2026, 3)[0];
  assert.ok(mar);
  assert.equal(mar.carriedIn, 0);
  assert.equal(mar.assigned, 200);
  assert.equal(mar.spent, 30);
  assert.equal(mar.available, 170);
});

test('toggling rollover mid-stream drops previously accumulated surplus from carry', () => {
  const seed = createFinanceState();
  const budget: Budget = {
    id: 'b-toggle',
    category: 'Groceries',
    monthlyLimit: 100,
    createdAt: '2026-01-01T00:00:00.000Z',
    rollover: true,
  };
  let state = withBudgetAndTxs(seed, budget, [
    tx({ id: 'g1', date: '2026-01-20', payee: 'Shop', amount: -50, category: 'Groceries' }),
  ]);

  const febOn = getBudgetEnvelopes(state, 2026, 2)[0];
  assert.ok(febOn);
  assert.equal(febOn.carriedIn, 50);

  state = setBudgetRollover(state, budget.id, false);
  const marOff = getBudgetEnvelopes(state, 2026, 3)[0];
  assert.ok(marOff);
  assert.equal(marOff.carriedIn, 0);
});
