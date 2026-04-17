import assert from 'node:assert/strict';
import test from 'node:test';

import { parseDelimitedStatement } from './import.shared';
import type { Budget, FinanceState, FinanceTransaction } from './types';

import {
  addManualTransaction,
  applyImportedBatch,
  createFinanceState,
  getBudgetEnvelopes,
  getBudgetStatus,
  getFinanceSummary,
  getReadyToAssign,
  getSafeToSpend,
  rehydrateFinanceState,
  rotateTransactionCategory,
  setBudget,
  setBudgetRollover,
  updateBudgetMonthlyLimit,
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

function tx(partial: Omit<FinanceTransaction, 'id' | 'source' | 'reviewed'> & { id?: string }): FinanceTransaction {
  return {
    id: partial.id ?? `tx-${partial.date}-${partial.amount}`,
    accountId: partial.accountId,
    date: partial.date,
    payee: partial.payee,
    amount: partial.amount,
    category: partial.category,
    source: 'manual',
    reviewed: true,
    notes: partial.notes,
  };
}

function envelopeTestState(budgets: Budget[], transactions: FinanceTransaction[]): FinanceState {
  return rehydrateFinanceState({
    accounts: [
      {
        id: 'acct-t',
        name: 'Checking',
        institution: 'Test',
        type: 'checking',
        source: 'manual',
        openingBalance: 0,
        lastSynced: '2026-01-01T00:00:00.000Z',
      },
    ],
    transactions,
    budgets,
    imports: [],
    goals: [],
  });
}

test('envelope carry rolls across three months when rollover is on', () => {
  const category = 'EnvelopeCarryCat';
  const budgets: Budget[] = [
    {
      id: 'b-env-1',
      category,
      monthlyLimit: 100,
      createdAt: '2026-01-01T12:00:00.000Z',
      rollover: true,
    },
  ];
  const transactions = [
    tx({ accountId: 'acct-t', date: '2026-01-15', payee: 'A', amount: -80, category }),
    tx({ accountId: 'acct-t', date: '2026-02-10', payee: 'B', amount: -50, category }),
  ];
  const state = envelopeTestState(budgets, transactions);

  const mar = getBudgetEnvelopes(state, 2026, 3).find((e) => e.category === category);
  assert.ok(mar);
  assert.equal(mar?.carriedIn, 70);
  assert.equal(mar?.assigned, 100);
  assert.equal(mar?.spent, 0);
  assert.equal(mar?.available, 170);
});

test('envelope rollover off drops surplus carry but still rolls debt', () => {
  const category = 'RollToggleCat';
  const budgetsSurplus: Budget[] = [
    {
      id: 'b-rt-1',
      category,
      monthlyLimit: 100,
      createdAt: '2026-01-01T12:00:00.000Z',
      rollover: false,
    },
  ];
  const txsSurplus = [tx({ accountId: 'acct-t', date: '2026-01-20', payee: 'x', amount: -40, category })];
  const febOff = getBudgetEnvelopes(envelopeTestState(budgetsSurplus, txsSurplus), 2026, 2)[0];
  assert.equal(febOff?.carriedIn, 0);

  const budgetsDebt: Budget[] = [
    {
      id: 'b-rt-2',
      category: 'DebtCat',
      monthlyLimit: 100,
      createdAt: '2026-01-01T12:00:00.000Z',
      rollover: false,
    },
  ];
  const txsDebt = [tx({ accountId: 'acct-t', date: '2026-01-12', payee: 'y', amount: -130, category: 'DebtCat' })];
  const febDebt = getBudgetEnvelopes(envelopeTestState(budgetsDebt, txsDebt), 2026, 2)[0];
  assert.equal(febDebt?.carriedIn, -30);
});

test('toggling rollover on an existing budget changes forward carry', () => {
  const category = 'MidToggle';
  let state = envelopeTestState(
    [
      {
        id: 'b-mt',
        category,
        monthlyLimit: 100,
        createdAt: '2026-01-01T12:00:00.000Z',
        rollover: true,
      },
    ],
    [tx({ accountId: 'acct-t', date: '2026-01-05', payee: 's', amount: -40, category })],
  );

  const febOn = getBudgetEnvelopes(state, 2026, 2)[0];
  assert.equal(febOn?.carriedIn, 60);

  state = setBudgetRollover(state, 'b-mt', false);
  const febOff = getBudgetEnvelopes(state, 2026, 2)[0];
  assert.equal(febOff?.carriedIn, 0);
});

test('budget created mid-year ignores pre-creation spending for carry', () => {
  const category = 'LateBudget';
  const budgets: Budget[] = [
    {
      id: 'b-late',
      category,
      monthlyLimit: 200,
      createdAt: '2026-03-01T00:00:00.000Z',
      rollover: true,
    },
  ];
  const transactions = [
    tx({ accountId: 'acct-t', date: '2026-02-01', payee: 'early', amount: -999, category }),
    tx({ accountId: 'acct-t', date: '2026-03-05', payee: 'm', amount: -50, category }),
  ];
  const state = envelopeTestState(budgets, transactions);
  const mar = getBudgetEnvelopes(state, 2026, 3)[0];
  assert.equal(mar?.carriedIn, 0);
  assert.equal(mar?.available, 150);
});

test('ready to assign is income minus assigned for the month', () => {
  const state = envelopeTestState(
    [
      {
        id: 'b1',
        category: 'C1',
        monthlyLimit: 60,
        createdAt: '2026-04-01T00:00:00.000Z',
        rollover: true,
      },
      {
        id: 'b2',
        category: 'C2',
        monthlyLimit: 40,
        createdAt: '2026-04-01T00:00:00.000Z',
        rollover: true,
      },
    ],
    [tx({ accountId: 'acct-t', date: '2026-04-10', payee: 'job', amount: 5000, category: 'Income' })],
  );
  assert.equal(getReadyToAssign(state, 2026, 4), 4900);
});

test('import dedupe unchanged after envelope types', () => {
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

test('inline monthly limit update keeps budget id stable', () => {
  let state = setBudget(createFinanceState(), 'InlineCat', 80);
  const id = state.budgets.find((b) => b.category === 'InlineCat')?.id;
  assert.ok(id);
  state = updateBudgetMonthlyLimit(state, id!, 95);
  const b = state.budgets.find((x) => x.id === id);
  assert.equal(b?.monthlyLimit, 95);
});
