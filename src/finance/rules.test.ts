import assert from 'node:assert/strict';
import test from 'node:test';

import { parseDelimitedStatement } from './import.shared';
import { applyImportedBatch, createFinanceState } from './ledger';
import {
  addRule,
  applyRules,
  applyRulesToTransactions,
  countMatchingTransactions,
  deleteRule,
  moveRule,
  safeRegex,
  transactionMatchesRule,
  updateRule,
} from './rules';
import type { FinanceRule, FinanceTransaction } from './types';

function tx(partial: Partial<FinanceTransaction> & Pick<FinanceTransaction, 'id' | 'payee' | 'amount'>): FinanceTransaction {
  return {
    accountId: 'a1',
    date: '2026-01-01',
    category: 'Other',
    source: 'manual',
    reviewed: true,
    ...partial,
  };
}

test('safeRegex returns null for invalid patterns and never throws', () => {
  assert.equal(safeRegex(''), null);
  assert.equal(safeRegex('   '), null);
  assert.equal(safeRegex('('), null);
  assert.equal(safeRegex('[', 'i'), null);
  const ok = safeRegex('foo', 'i');
  assert.ok(ok);
  assert.ok(ok!.test('FOO'));
});

test('applyRules: first matching rule wins', () => {
  const rules: FinanceRule[] = [
    { id: 'r1', category: 'Dining', payeeRegex: 'star' },
    { id: 'r2', category: 'Groceries', payeeRegex: 'starbucks' },
  ];
  const t = tx({ id: '1', payee: 'Starbucks #12', amount: -5 });
  assert.equal(applyRules(rules, t), 'Dining');
});

test('invalid payeeRegex never matches', () => {
  const rules: FinanceRule[] = [{ id: 'r1', category: 'Dining', payeeRegex: '(' }];
  const t = tx({ id: '1', payee: 'Any', amount: -1 });
  assert.equal(applyRules(rules, t), undefined);
});

test('amount range filters', () => {
  const rules: FinanceRule[] = [{ id: 'r1', category: 'Fees', minAmount: -20, maxAmount: -5 }];
  assert.equal(applyRules(rules, tx({ id: '1', payee: 'X', amount: -10 })), 'Fees');
  assert.equal(applyRules(rules, tx({ id: '2', payee: 'X', amount: -30 })), undefined);
  assert.equal(applyRules(rules, tx({ id: '3', payee: 'X', amount: 10 })), undefined);
});

test('account scoping', () => {
  const rules: FinanceRule[] = [
    { id: 'r1', category: 'Dining', payeeRegex: 'coffee', accountIds: ['acct-a'] },
  ];
  assert.ok(transactionMatchesRule(tx({ id: '1', payee: 'Coffee', amount: -3, accountId: 'acct-a' }), rules[0]!));
  assert.ok(!transactionMatchesRule(tx({ id: '2', payee: 'Coffee', amount: -3, accountId: 'acct-b' }), rules[0]!));
});

test('applyRulesToTransactions is idempotent when rules unchanged', () => {
  const rules: FinanceRule[] = [{ id: 'r1', category: 'Fuel', payeeRegex: 'shell' }];
  const transactions = [tx({ id: '1', payee: 'Shell', amount: -40, category: 'Other' })];
  const once = applyRulesToTransactions(rules, transactions);
  const twice = applyRulesToTransactions(rules, once);
  assert.deepEqual(once, twice);
  assert.equal(once[0]?.category, 'Fuel');
});

test('import dedupe unchanged when duplicate row is imported', () => {
  const state = createFinanceState();
  const batch = {
    format: 'csv' as const,
    sourceLabel: 'dup.csv',
    notes: [],
    rows: parseDelimitedStatement(
      ['Date,Description,Amount', '04/05/2026,Payroll Deposit,3920.00'].join('\n'),
    ),
  };
  const withRules: typeof state = {
    ...state,
    rules: [{ id: 'r1', category: 'Income', payeeRegex: 'payroll' }],
  };
  const next = applyImportedBatch(withRules, 'acct-wf-checking', batch);
  assert.equal(next.transactions.length, state.transactions.length);
  assert.equal(next.imports[0]?.rows, 0);
});

test('addRule updateRule deleteRule moveRule preserve ids', () => {
  let rules: FinanceRule[] = [];
  const r: FinanceRule = { id: 'x', category: 'Dining', payeeRegex: 'a' };
  rules = addRule(rules, r);
  rules = updateRule(rules, 'x', { payeeRegex: 'b' });
  assert.equal(rules[0]?.payeeRegex, 'b');
  rules = moveRule(rules, 'x', 0);
  assert.equal(rules[0]?.id, 'x');
  rules = deleteRule(rules, 'x');
  assert.equal(rules.length, 0);
});

test('countMatchingTransactions excludes rows caught by higher-precedence rules', () => {
  const higher: FinanceRule[] = [{ id: 'h', category: 'Dining', payeeRegex: 'star' }];
  const draft: FinanceRule = { id: 'd', category: 'Groceries', payeeRegex: 'starbucks' };
  const txs = [tx({ id: '1', payee: 'Starbucks', amount: -4 })];
  assert.equal(countMatchingTransactions(txs, draft, higher), 0);
});
