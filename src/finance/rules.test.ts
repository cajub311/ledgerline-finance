import assert from 'node:assert/strict';
import test from 'node:test';

import { applyImportedBatch, createFinanceState } from './ledger';
import {
  addRule,
  applyRules,
  applyRulesToTransactions,
  safeRegexTest,
} from './rules';
import type { FinanceRule, FinanceTransaction, ParsedStatementBatch } from './types';

function tx(
  partial: Partial<FinanceTransaction> & Pick<FinanceTransaction, 'id' | 'accountId' | 'payee' | 'amount'>,
): FinanceTransaction {
  return {
    id: partial.id,
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

test('first matching rule wins (precedence)', () => {
  const rules: FinanceRule[] = [
    {
      id: 'a',
      name: 'Specific',
      category: 'Groceries',
      payeePattern: 'XyzAbc',
      enabled: true,
    },
    {
      id: 'b',
      name: 'Broad',
      category: 'Dining',
      payeePattern: 'Xyz',
      enabled: true,
    },
  ];
  const t = tx({ id: '1', accountId: 'acct', payee: 'XyzAbc Market', amount: -5 });
  const out = applyRules(t, rules);
  assert.equal(out.category, 'Groceries');
});

test('invalid regex never throws; rule does not match', () => {
  assert.equal(safeRegexTest('(', 'hello'), false);
  const rules: FinanceRule[] = [
    {
      id: 'bad',
      name: 'Bad',
      category: 'Fees',
      payeePattern: '(',
      enabled: true,
    },
  ];
  const t = tx({ id: '1', accountId: 'acct', payee: 'Any payee', amount: -10 });
  assert.doesNotThrow(() => applyRules(t, rules));
  assert.equal(applyRules(t, rules).category, 'Other');
});

test('amount range filters transactions', () => {
  const rules: FinanceRule[] = [
    {
      id: 'r',
      name: 'Small debits',
      category: 'Dining',
      payeePattern: '',
      amountMin: -20,
      amountMax: -1,
      enabled: true,
    },
  ];
  const small = tx({ id: '1', accountId: 'a', payee: 'Cafe', amount: -5 });
  const big = tx({ id: '2', accountId: 'a', payee: 'Cafe', amount: -50 });
  assert.equal(applyRules(small, rules).category, 'Dining');
  assert.equal(applyRules(big, rules).category, 'Other');
});

test('account scoping: rule only applies to matching accountId', () => {
  const rules: FinanceRule[] = [
    {
      id: 'r',
      name: 'Acct1 only',
      category: 'Fuel',
      payeePattern: 'Shell',
      accountId: 'acct-1',
      enabled: true,
    },
  ];
  const on1 = tx({ id: '1', accountId: 'acct-1', payee: 'Shell', amount: -40 });
  const on2 = tx({ id: '2', accountId: 'acct-2', payee: 'Shell', amount: -40 });
  assert.equal(applyRules(on1, rules).category, 'Fuel');
  assert.equal(applyRules(on2, rules).category, 'Other');
});

test('applyRulesToTransactions is idempotent', () => {
  const rules: FinanceRule[] = [
    {
      id: 'r',
      name: 'x',
      category: 'Shopping',
      payeePattern: 'AMAZON',
      enabled: true,
    },
  ];
  const txs = [tx({ id: '1', accountId: 'a', payee: 'AMAZON MKTPLACE', amount: -12 })];
  const once = applyRulesToTransactions(txs, rules);
  const twice = applyRulesToTransactions(once, rules);
  assert.deepEqual(once, twice);
});

test('applyImportedBatch dedupe unchanged; rules categorize before dedupe', () => {
  let state = createFinanceState();
  const accountId = state.accounts[0]?.id;
  assert.ok(accountId);

  state = addRule(state, {
    name: 'Test',
    category: 'Groceries',
    payeePattern: 'UniquePayee123',
    enabled: true,
  });

  const batch: ParsedStatementBatch = {
    format: 'csv',
    sourceLabel: 'test.csv',
    notes: [],
    rows: [{ date: '2026-04-01', payee: 'UniquePayee123', amount: -9.99, category: '', notes: '' }],
  };

  const after = applyImportedBatch(state, accountId, batch);
  const imported = after.transactions.find((t) => t.payee === 'UniquePayee123');
  assert.ok(imported);
  assert.equal(imported.category, 'Groceries');

  const again = applyImportedBatch(after, accountId, batch);
  assert.equal(
    again.transactions.filter((t) => t.payee === 'UniquePayee123').length,
    1,
    'duplicate import row should not create second transaction',
  );
});
