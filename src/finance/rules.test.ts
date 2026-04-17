import assert from 'node:assert/strict';
import test from 'node:test';

import { applyImportedBatch, createFinanceState } from './ledger';
import {
  addRule,
  applyRules,
  applyRulesToTransactions,
  countTransactionsMatchingRule,
  deleteRule,
  moveRule,
  safeRegex,
  transactionMatchesRule,
  updateRule,
} from './rules';
import type { FinanceRule, FinanceTransaction } from './types';

function tx(partial: Partial<FinanceTransaction> & Pick<FinanceTransaction, 'id' | 'accountId' | 'payee' | 'amount'>): FinanceTransaction {
  return {
    date: '2026-01-15',
    category: 'Other',
    source: 'imported',
    reviewed: false,
    ...partial,
  };
}

test('safeRegex returns null for invalid patterns', () => {
  assert.equal(safeRegex('('), null);
  assert.equal(safeRegex('[', ''), null);
});

test('invalid payee regex does not throw and does not match', () => {
  const rules: FinanceRule[] = [{ id: '1', category: 'Groceries', payeePattern: '(' }];
  const out = applyRules(tx({ id: 'a', accountId: 'x', payee: 'Anything', amount: -1 }), rules);
  assert.equal(out.category, 'Other');
});

test('safeRegex matches valid patterns', () => {
  const re = safeRegex('foo', 'i');
  assert.ok(re);
  assert.ok(re!.test('FOO'));
});

test('first matching rule wins (precedence)', () => {
  const rules: FinanceRule[] = [
    { id: '1', category: 'Groceries', payeePattern: 'market' },
    { id: '2', category: 'Dining', payeePattern: 'market' },
  ];
  const out = applyRules(tx({ id: 'a', accountId: 'x', payee: 'Whole Foods Market', amount: -20 }), rules);
  assert.equal(out.category, 'Groceries');
});

test('amount range filters matches', () => {
  const rule: FinanceRule = {
    id: '1',
    category: 'Fees',
    payeePattern: 'fee',
    amountMin: -100,
    amountMax: -10,
  };
  assert.ok(transactionMatchesRule(tx({ id: 'a', accountId: 'x', payee: 'Monthly fee', amount: -25 }), rule));
  assert.equal(
    transactionMatchesRule(tx({ id: 'b', accountId: 'x', payee: 'Monthly fee', amount: -5 }), rule),
    false,
  );
});

test('account scoping', () => {
  const rule: FinanceRule = { id: '1', category: 'Fuel', payeePattern: 'shell', accountId: 'acct-a' };
  assert.ok(
    transactionMatchesRule(tx({ id: 'a', accountId: 'acct-a', payee: 'Shell Station', amount: -40 }), rule),
  );
  assert.equal(
    transactionMatchesRule(tx({ id: 'b', accountId: 'acct-b', payee: 'Shell Station', amount: -40 }), rule),
    false,
  );
});

test('applyRules is idempotent when rules unchanged', () => {
  const rules: FinanceRule[] = [{ id: '1', category: 'Groceries', payeePattern: 'heb' }];
  const t = tx({ id: 'a', accountId: 'x', payee: 'HEB Grocery', amount: -12 });
  const once = applyRules(t, rules);
  const twice = applyRules(once, rules);
  assert.deepEqual(once, twice);
});

test('applyRulesToTransactions twice equals once', () => {
  const rules: FinanceRule[] = [{ id: '1', category: 'Dining', payeePattern: 'starbucks' }];
  const list = [
    tx({ id: '1', accountId: 'x', payee: 'Starbucks', amount: -5 }),
    tx({ id: '2', accountId: 'x', payee: 'Other', amount: -3 }),
  ];
  const once = applyRulesToTransactions(list, rules);
  const twice = applyRulesToTransactions(once, rules);
  assert.deepEqual(once, twice);
});

test('addRule / updateRule / deleteRule / moveRule', () => {
  let rules: FinanceRule[] = [];
  rules = addRule(rules, { category: 'A', payeePattern: 'a' });
  rules = addRule(rules, { category: 'B', payeePattern: 'b' });
  assert.equal(rules.length, 2);
  const id0 = rules[0]!.id;
  rules = updateRule(rules, id0, { category: 'A2' });
  assert.equal(rules[0]!.category, 'A2');
  rules = moveRule(rules, 0, 1);
  assert.equal(rules[1]!.category, 'A2');
  rules = deleteRule(rules, id0);
  assert.equal(rules.length, 1);
});

test('countTransactionsMatchingRule matches by payee pattern', () => {
  const txs = [tx({ id: '1', accountId: 'x', payee: 'Uber Trip', amount: -9 })];
  const n = countTransactionsMatchingRule(txs, { payeePattern: 'uber' });
  assert.equal(n, 1);
});

test('applyImportedBatch dedupe unchanged when duplicate key', () => {
  const state = createFinanceState();
  const accountId = state.accounts[0]!.id;
  const row = { date: '2026-04-01', payee: 'Dedupe Test Co', amount: -44.44, category: 'Other' };
  const batch = {
    format: 'csv' as const,
    rows: [row],
    sourceLabel: 'test.csv',
    notes: [] as string[],
  };
  const afterFirst = applyImportedBatch(state, accountId, batch);
  const afterSecond = applyImportedBatch(afterFirst, accountId, batch);
  assert.equal(
    afterSecond.transactions.filter((t) => t.payee === 'Dedupe Test Co').length,
    1,
  );
});

test('applyImportedBatch applies user rules to new rows', () => {
  const state = {
    ...createFinanceState(),
    rules: [{ id: 'r1', category: 'Subscriptions', payeePattern: 'netflix' }],
  };
  const accountId = state.accounts[0]!.id;
  const after = applyImportedBatch(state, accountId, {
    format: 'csv',
    rows: [{ date: '2026-04-02', payee: 'NETFLIX.COM', amount: -15.99, category: '' }],
    sourceLabel: 'stmt.csv',
    notes: [],
  });
  const imported = after.transactions.find((t) => t.payee === 'NETFLIX.COM');
  assert.ok(imported);
  assert.equal(imported!.category, 'Subscriptions');
});
