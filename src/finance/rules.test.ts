import assert from 'node:assert/strict';
import test from 'node:test';

import { applyImportedBatch, createFinanceState } from './ledger';
import type { FinanceRule, FinanceTransaction } from './types';
import {
  applyRules,
  applyRulesToTransactions,
  safeRegexTest,
} from './rules';

function tx(partial: Partial<FinanceTransaction> & Pick<FinanceTransaction, 'payee' | 'amount' | 'accountId'>): FinanceTransaction {
  return {
    id: partial.id ?? 'tx-test',
    accountId: partial.accountId,
    date: partial.date ?? '2026-01-15',
    payee: partial.payee,
    amount: partial.amount,
    category: partial.category ?? 'Other',
    source: partial.source ?? 'imported',
    reviewed: partial.reviewed ?? false,
    notes: partial.notes,
  };
}

test('applyRules: first matching rule wins (precedence)', () => {
  const rules: FinanceRule[] = [
    { id: 'r1', payeePattern: 'amazon', assignCategory: 'Shopping' },
    { id: 'r2', payeePattern: 'amazon prime', assignCategory: 'Subscriptions' },
  ];
  const out = applyRules(rules, tx({ payee: 'AMAZON PRIME VIDEO', amount: -14.99, accountId: 'a1' }));
  assert.equal(out, 'Shopping');
});

test('safeRegexTest: invalid pattern never throws and matches nothing', () => {
  assert.doesNotThrow(() => safeRegexTest('(unclosed', 'hello'));
  assert.equal(safeRegexTest('(unclosed', 'hello'), false);
});

test('applyRules: amount range is inclusive', () => {
  const rules: FinanceRule[] = [
    { id: 'r1', payeePattern: '', assignCategory: 'Fuel', amountMin: -60, amountMax: -40 },
  ];
  assert.equal(applyRules(rules, tx({ payee: 'Shell', amount: -50, accountId: 'a' })), 'Fuel');
  assert.equal(applyRules(rules, tx({ payee: 'Shell', amount: -30, accountId: 'a' })), undefined);
  assert.equal(applyRules(rules, tx({ payee: 'Shell', amount: -70, accountId: 'a' })), undefined);
});

test('applyRules: account scoping', () => {
  const rules: FinanceRule[] = [{ id: 'r1', payeePattern: 'coffee', assignCategory: 'Dining', accountId: 'acct-a' }];
  assert.equal(applyRules(rules, tx({ payee: 'Coffee Shop', amount: -5, accountId: 'acct-a' })), 'Dining');
  assert.equal(applyRules(rules, tx({ payee: 'Coffee Shop', amount: -5, accountId: 'acct-b' })), undefined);
});

test('applyRulesToTransactions: idempotent (two passes same as one)', () => {
  const rules: FinanceRule[] = [{ id: 'r1', payeePattern: 'gym', assignCategory: 'Health' }];
  const txs = [tx({ id: '1', payee: 'Planet Fitness', amount: -22, accountId: 'x', category: 'Other' })];
  const once = applyRulesToTransactions(rules, txs);
  const twice = applyRulesToTransactions(rules, once);
  assert.deepEqual(once, twice);
});

test('applyImportedBatch: dedupe unchanged when importing duplicate keys', () => {
  const state = createFinanceState();
  const batch = {
    format: 'csv' as const,
    sourceLabel: 'dup.csv',
    notes: [] as string[],
    rows: [
      { date: '2026-04-05', payee: 'Payroll Deposit', amount: 3920, category: 'Income', notes: undefined },
    ],
  };
  const next = applyImportedBatch(state, 'acct-wf-checking', batch);
  assert.equal(next.transactions.length, state.transactions.length);
  assert.equal(next.imports[0]?.rows, 0);
});

test('applyImportedBatch: user rules categorize new rows before storage', () => {
  const state = {
    ...createFinanceState(),
    rules: [{ id: 'r1', payeePattern: 'uniquepayee123', assignCategory: 'Subscriptions' }],
  };
  const batch = {
    format: 'csv' as const,
    sourceLabel: 'new.csv',
    notes: [] as string[],
    rows: [
      {
        date: '2026-12-01',
        payee: 'UNIQUEPAYEE123 MONTHLY',
        amount: -9.99,
        category: 'Other',
        notes: undefined,
      },
    ],
  };
  const next = applyImportedBatch(state, 'acct-wf-checking', batch);
  const added = next.transactions.find((t) => t.payee.includes('UNIQUEPAYEE123'));
  assert.ok(added);
  assert.equal(added?.category, 'Subscriptions');
});
