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
  normalizeBudget,
  rotateTransactionCategory,
  setBudget,
  setBudgetRollover,
} from './ledger';
import type { Budget, FinanceAccount, FinanceState, FinanceTransaction } from './types';

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

function minimalState(accounts: FinanceAccount[], transactions: FinanceTransaction[], budgets: Budget[]): FinanceState {
  const seed = createFinanceState();
  return {
    ...seed,
    accounts,
    transactions,
    budgets: budgets.map((b) => normalizeBudget(b)),
  };
}

test('envelope carry rolls surplus and debt across three months when rollover is on', () => {
  const acct: FinanceAccount = {
    id: 'acct-t',
    name: 'Checking',
    institution: 'T',
    type: 'checking',
    source: 'manual',
    openingBalance: 0,
    lastSynced: '2026-01-01',
  };
  const budgets: Budget[] = [
    {
      id: 'b-env-1',
      category: 'Groceries',
      monthlyLimit: 100,
      createdAt: '2026-01-01T12:00:00.000Z',
      rollover: true,
    },
  ];
  const transactions: FinanceTransaction[] = [
    {
      id: 't1',
      accountId: acct.id,
      date: '2026-01-15',
      payee: 'Store',
      amount: -40,
      category: 'Groceries',
      source: 'manual',
      reviewed: true,
    },
    {
      id: 't2',
      accountId: acct.id,
      date: '2026-02-10',
      payee: 'Store',
      amount: -130,
      category: 'Groceries',
      source: 'manual',
      reviewed: true,
    },
    {
      id: 't3',
      accountId: acct.id,
      date: '2026-03-05',
      payee: 'Store',
      amount: -50,
      category: 'Groceries',
      source: 'manual',
      reviewed: true,
    },
  ];
  const state = minimalState([acct], transactions, budgets);

  const jan = getBudgetEnvelopes(state, 2026, 1)[0];
  assert.equal(jan.carriedIn, 0);
  assert.equal(jan.assigned, 100);
  assert.equal(jan.spent, 40);
  assert.equal(jan.available, 60);

  const feb = getBudgetEnvelopes(state, 2026, 2)[0];
  assert.equal(feb.carriedIn, 60);
  assert.equal(feb.spent, 130);
  assert.equal(feb.available, 30);

  const mar = getBudgetEnvelopes(state, 2026, 3)[0];
  assert.equal(mar.carriedIn, 30);
  assert.equal(mar.spent, 50);
  assert.equal(mar.available, 80);
});

test('envelope rollover off ignores surplus but still rolls debt', () => {
  const acct: FinanceAccount = {
    id: 'acct-t2',
    name: 'Checking',
    institution: 'T',
    type: 'checking',
    source: 'manual',
    openingBalance: 0,
    lastSynced: '2026-01-01',
  };
  const budgets: Budget[] = [
    {
      id: 'b-env-2',
      category: 'Dining',
      monthlyLimit: 100,
      createdAt: '2026-01-01T12:00:00.000Z',
      rollover: false,
    },
  ];
  const transactions: FinanceTransaction[] = [
    {
      id: 'd1',
      accountId: acct.id,
      date: '2026-01-10',
      payee: 'Cafe',
      amount: -50,
      category: 'Dining',
      source: 'manual',
      reviewed: true,
    },
    {
      id: 'd2',
      accountId: acct.id,
      date: '2026-02-10',
      payee: 'Cafe',
      amount: -130,
      category: 'Dining',
      source: 'manual',
      reviewed: true,
    },
  ];
  const state = minimalState([acct], transactions, budgets);

  const feb = getBudgetEnvelopes(state, 2026, 2)[0];
  assert.equal(feb.carriedIn, 0);
  assert.equal(feb.available, -30);
});

test('toggling rollover mid-stream changes carry into next month', () => {
  const acct: FinanceAccount = {
    id: 'acct-t3',
    name: 'Checking',
    institution: 'T',
    type: 'checking',
    source: 'manual',
    openingBalance: 0,
    lastSynced: '2026-01-01',
  };
  let state: FinanceState = minimalState(
    [acct],
    [
      {
        id: 'e1',
        accountId: acct.id,
        date: '2026-01-20',
        payee: 'X',
        amount: -30,
        category: 'Fuel',
        source: 'manual',
        reviewed: true,
      },
    ],
    [
      {
        id: 'b-fuel',
        category: 'Fuel',
        monthlyLimit: 100,
        createdAt: '2026-01-01T12:00:00.000Z',
        rollover: true,
      },
    ],
  );

  const janOn = getBudgetEnvelopes(state, 2026, 1)[0];
  assert.equal(janOn.available, 70);

  state = setBudgetRollover(state, 'b-fuel', false);
  const febOff = getBudgetEnvelopes(state, 2026, 2)[0];
  assert.equal(febOff.carriedIn, 0);

  state = setBudgetRollover(state, 'b-fuel', true);
  const febOn = getBudgetEnvelopes(state, 2026, 2)[0];
  assert.equal(febOn.carriedIn, 70);
});

test('budget created after months with spending still gets correct carry from first active month', () => {
  const acct: FinanceAccount = {
    id: 'acct-t4',
    name: 'Checking',
    institution: 'T',
    type: 'checking',
    source: 'manual',
    openingBalance: 0,
    lastSynced: '2026-01-01',
  };
  const transactions: FinanceTransaction[] = [
    {
      id: 's1',
      accountId: acct.id,
      date: '2026-01-05',
      payee: 'Shop',
      amount: -200,
      category: 'Shopping',
      source: 'manual',
      reviewed: true,
    },
    {
      id: 's2',
      accountId: acct.id,
      date: '2026-02-05',
      payee: 'Shop',
      amount: -50,
      category: 'Shopping',
      source: 'manual',
      reviewed: true,
    },
  ];
  const budgets: Budget[] = [
    {
      id: 'b-shop',
      category: 'Shopping',
      monthlyLimit: 100,
      createdAt: '2026-03-01T12:00:00.000Z',
      rollover: true,
    },
  ];
  const state = minimalState([acct], transactions, budgets);

  const mar = getBudgetEnvelopes(state, 2026, 3)[0];
  assert.equal(mar.carriedIn, 0);
  assert.equal(mar.assigned, 100);
  assert.equal(mar.spent, 0);
  assert.equal(mar.available, 100);
});
