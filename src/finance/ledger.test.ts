import assert from 'node:assert/strict';
import test from 'node:test';

import { parseDelimitedStatement } from './import.shared';
import type { Budget, FinanceAccount, FinanceState, FinanceTransaction } from './types';
import {
  addManualTransaction,
  applyImportedBatch,
  createFinanceState,
  getBudgetEnvelopes,
  getBudgetStatus,
  getFinanceSummary,
  getNetWorthSeries,
  getSafeToSpend,
  patchBudget,
  projectRecurring,
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

function envelopeState(overrides: {
  budgets: Budget[];
  transactions: FinanceTransaction[];
  budgetViewMode?: 'flow' | 'envelope';
}): FinanceState {
  const base = createFinanceState();
  return {
    ...base,
    budgets: overrides.budgets,
    transactions: overrides.transactions,
    preferences: {
      ...base.preferences,
      budgetViewMode: overrides.budgetViewMode ?? base.preferences.budgetViewMode,
    },
  };
}

test('getBudgetEnvelopes carry math across three months with rollover', () => {
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
      amount: -50,
      category: 'Groceries',
      source: 'manual',
      reviewed: true,
    },
    {
      id: 't2',
      accountId: 'acct-wf-checking',
      date: '2026-02-15',
      payee: 'Store',
      amount: -120,
      category: 'Groceries',
      source: 'manual',
      reviewed: true,
    },
    {
      id: 't3',
      accountId: 'acct-wf-checking',
      date: '2026-03-10',
      payee: 'Store',
      amount: -30,
      category: 'Groceries',
      source: 'manual',
      reviewed: true,
    },
  ];
  const state = envelopeState({ budgets: [b], transactions: txs });

  const jan = getBudgetEnvelopes(state, 2026, 1)[0];
  const feb = getBudgetEnvelopes(state, 2026, 2)[0];
  const mar = getBudgetEnvelopes(state, 2026, 3)[0];

  assert.ok(jan && feb && mar);
  assert.equal(jan.carriedIn, 0);
  assert.equal(jan.available, 50);
  assert.equal(feb.carriedIn, 50);
  assert.equal(feb.available, 30);
  assert.equal(mar.carriedIn, 30);
  assert.equal(mar.available, 100);
});

test('getBudgetEnvelopes rollover false drops surplus but rolls debt', () => {
  const b: Budget = {
    id: 'b-env-2',
    category: 'Dining',
    monthlyLimit: 100,
    createdAt: '2026-01-01T12:00:00.000Z',
    rollover: false,
  };
  const txs: FinanceTransaction[] = [
    {
      id: 't1',
      accountId: 'acct-wf-checking',
      date: '2026-01-10',
      payee: 'Cafe',
      amount: -40,
      category: 'Dining',
      source: 'manual',
      reviewed: true,
    },
    {
      id: 't2',
      accountId: 'acct-wf-checking',
      date: '2026-02-10',
      payee: 'Cafe',
      amount: -130,
      category: 'Dining',
      source: 'manual',
      reviewed: true,
    },
  ];
  const state = envelopeState({ budgets: [b], transactions: txs });
  const feb = getBudgetEnvelopes(state, 2026, 2)[0];
  assert.ok(feb);
  assert.equal(feb.carriedIn, 0);
  assert.equal(feb.available, -30);
});

test('getBudgetEnvelopes ignores spending before budget creation month', () => {
  const b: Budget = {
    id: 'b-env-3',
    category: 'Shopping',
    monthlyLimit: 100,
    createdAt: '2026-03-01T12:00:00.000Z',
    rollover: true,
  };
  const txs: FinanceTransaction[] = [
    {
      id: 't0',
      accountId: 'acct-wf-checking',
      date: '2026-01-20',
      payee: 'Early',
      amount: -200,
      category: 'Shopping',
      source: 'manual',
      reviewed: true,
    },
    {
      id: 't1',
      accountId: 'acct-wf-checking',
      date: '2026-03-15',
      payee: 'Mall',
      amount: -30,
      category: 'Shopping',
      source: 'manual',
      reviewed: true,
    },
  ];
  const state = envelopeState({ budgets: [b], transactions: txs });
  const mar = getBudgetEnvelopes(state, 2026, 3)[0];
  assert.ok(mar);
  assert.equal(mar.carriedIn, 0);
  assert.equal(mar.spent, 30);
  assert.equal(mar.available, 70);
});

test('getBudgetEnvelopes rollover false still carries negative balance forward', () => {
  const b: Budget = {
    id: 'b-env-5',
    category: 'Utilities',
    monthlyLimit: 100,
    createdAt: '2026-01-01T12:00:00.000Z',
    rollover: false,
  };
  const txs: FinanceTransaction[] = [
    {
      id: 't1',
      accountId: 'acct-wf-checking',
      date: '2026-01-05',
      payee: 'Power',
      amount: -130,
      category: 'Utilities',
      source: 'manual',
      reviewed: true,
    },
  ];
  const state = envelopeState({ budgets: [b], transactions: txs });
  const feb = getBudgetEnvelopes(state, 2026, 2)[0];
  assert.ok(feb);
  assert.equal(feb.carriedIn, -30);
  assert.equal(feb.available, 70);
});

test('patchBudget toggling rollover recomputes carry chain', () => {
  const b: Budget = {
    id: 'b-env-4',
    category: 'Fuel',
    monthlyLimit: 100,
    createdAt: '2026-01-01T12:00:00.000Z',
    rollover: true,
  };
  const txs: FinanceTransaction[] = [
    {
      id: 't1',
      accountId: 'acct-wf-checking',
      date: '2026-01-12',
      payee: 'Pump',
      amount: -50,
      category: 'Fuel',
      source: 'manual',
      reviewed: true,
    },
  ];
  let state = envelopeState({ budgets: [b], transactions: txs });
  const febBefore = getBudgetEnvelopes(state, 2026, 2)[0];
  assert.ok(febBefore);
  assert.equal(febBefore.carriedIn, 50);

  state = patchBudget(state, 'b-env-4', { rollover: false });
  const febAfter = getBudgetEnvelopes(state, 2026, 2)[0];
  assert.ok(febAfter);
  assert.equal(febAfter.carriedIn, 0);
});

test('getNetWorthSeries: length matches months, dates monotonic, final matches summary', () => {
  const state = createFinanceState();
  const summary = getFinanceSummary(state);
  const series6 = getNetWorthSeries(state, 6);
  assert.equal(series6.length, 6);
  for (let i = 1; i < series6.length; i += 1) {
    assert.ok(series6[i - 1]!.monthKey <= series6[i]!.monthKey);
  }
  const last = series6[series6.length - 1];
  assert.ok(last);
  assert.equal(last.netWorth, summary.netWorth);
});

test('getNetWorthSeries: liabilities are non-positive (sum of negative balances)', () => {
  const state = createFinanceState();
  const series = getNetWorthSeries(state, 12);
  for (const p of series) {
    assert.ok(p.liabilities <= 0);
    assert.ok(p.assets >= 0);
  }
});

test('getNetWorthSeries: ALL spans from earliest tx month to current', () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const pad = (n: number) => `${n}`.padStart(2, '0');
  const mkPrev = (delta: number) => {
    const idx = y * 12 + (m - 1) - delta;
    const yy = Math.floor(idx / 12);
    const mm = (idx % 12) + 1;
    return `${yy}-${pad(mm)}`;
  };
  const d1 = `${mkPrev(4)}-10`;
  const d2 = `${mkPrev(2)}-12`;
  const acct: FinanceAccount = {
    id: 'acct-test-nw',
    name: 'Test',
    institution: 'T',
    type: 'checking',
    source: 'manual',
    openingBalance: 1000,
    lastSynced: d1,
  };
  const txs: FinanceTransaction[] = [
    {
      id: 'nw-tx-1',
      accountId: acct.id,
      date: d1,
      payee: 'A',
      amount: 50,
      category: 'Income',
      source: 'manual',
      reviewed: true,
    },
    {
      id: 'nw-tx-2',
      accountId: acct.id,
      date: d2,
      payee: 'B',
      amount: -25,
      category: 'Dining',
      source: 'manual',
      reviewed: true,
    },
  ];
  const minimal: FinanceState = {
    ...createFinanceState(),
    accounts: [acct],
    transactions: txs,
    budgets: [],
    goals: [],
    imports: [],
  };
  const all = getNetWorthSeries(minimal, 0);
  assert.ok(all.length >= 2);
  assert.equal(all[0]?.monthKey, mkPrev(4));
  const summary = getFinanceSummary(minimal);
  assert.equal(all[all.length - 1]?.netWorth, summary.netWorth);
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
