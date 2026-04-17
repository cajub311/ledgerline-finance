import assert from 'node:assert/strict';
import test from 'node:test';

import { parseDelimitedStatement } from './import.shared';
import type { FinanceAccount, FinanceState, FinanceTransaction } from './types';

import {
  addManualTransaction,
  applyImportedBatch,
  createFinanceState,
  getBudgetStatus,
  getFinanceSummary,
  getSafeToSpend,
  rehydrateFinanceState,
  rotateTransactionCategory,
  setBudget,
  projectRecurring,
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

function stateWithTxs(transactions: FinanceTransaction[]): FinanceState {
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
      } satisfies FinanceAccount,
    ],
    transactions,
    budgets: [],
    imports: [],
    goals: [],
  });
}

test('projectRecurring excludes dates past horizon', () => {
  const txs = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date(2026, 3, 6 + i * 7);
    const iso = `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`;
    txs.push(
      tx({
        accountId: 'acct-t',
        date: iso,
        payee: 'Weekly Gym',
        amount: -20,
        category: 'Subscriptions',
      }),
    );
  }
  const state = stateWithTxs(txs);
  const asOf = new Date(2026, 3, 17);
  const horizonEnd = '2026-04-27';
  const rows = projectRecurring(state, 10, asOf);
  const last = rows.filter((r) => r.payee === 'Weekly Gym').pop();
  assert.ok(last);
  assert.ok(last!.date <= horizonEnd);
  assert.ok(!rows.some((r) => r.date > horizonEnd));
});

test('projectRecurring emits multiple weekly instances inside horizon', () => {
  const txs = [
    tx({ accountId: 'acct-t', date: '2026-04-03', payee: 'Coffee Sub', amount: -5, category: 'Dining' }),
    tx({ accountId: 'acct-t', date: '2026-04-10', payee: 'Coffee Sub', amount: -5, category: 'Dining' }),
  ];
  const state = stateWithTxs(txs);
  const asOf = new Date(2026, 3, 11);
  const rows = projectRecurring(state, 25, asOf).filter((r) => r.payee === 'Coffee Sub');
  assert.ok(rows.length >= 2);
  for (let i = 1; i < rows.length; i++) {
    assert.ok(rows[i]!.date > rows[i - 1]!.date);
  }
});

test('projectRecurring sorts charges before income on the same day', () => {
  const txs = [
    tx({ accountId: 'acct-t', date: '2026-04-01', payee: 'Stream Co', amount: -10, category: 'Subscriptions' }),
    tx({ accountId: 'acct-t', date: '2026-04-08', payee: 'Stream Co', amount: -10, category: 'Subscriptions' }),
    tx({ accountId: 'acct-t', date: '2026-04-15', payee: 'Stream Co', amount: -10, category: 'Subscriptions' }),
    tx({ accountId: 'acct-t', date: '2026-04-01', payee: 'Payroll Inc', amount: 500, category: 'Income' }),
    tx({ accountId: 'acct-t', date: '2026-04-08', payee: 'Payroll Inc', amount: 500, category: 'Income' }),
    tx({ accountId: 'acct-t', date: '2026-04-15', payee: 'Payroll Inc', amount: 500, category: 'Income' }),
  ];
  const state = stateWithTxs(txs);
  const asOf = new Date(2026, 3, 16);
  const rows = projectRecurring(state, 14, asOf);
  const apr22 = rows.filter((r) => r.date === '2026-04-22');
  assert.equal(apr22.length, 2);
  assert.equal(apr22[0]?.kind, 'charge');
  assert.equal(apr22[1]?.kind, 'income');
});

test('projectRecurring confidence is capped at 0.95', () => {
  const txs = [
    tx({ accountId: 'acct-t', date: '2026-01-01', payee: 'Net Co', amount: -10, category: 'Subscriptions' }),
    tx({ accountId: 'acct-t', date: '2026-02-01', payee: 'Net Co', amount: -10, category: 'Subscriptions' }),
  ];
  const state = stateWithTxs(txs);
  const rows = projectRecurring(state, 400, new Date(2026, 5, 1));
  assert.ok(rows.every((r) => r.confidence <= 0.95));
});
