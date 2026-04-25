import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildAccountOfx,
  buildAccountQif,
  buildMultiAccountQif,
  buildTransactionsCsv,
} from './export';
import { createFinanceState, setTransactionsTags } from './ledger';
import type { FinanceState } from './types';

function seedState(): FinanceState {
  return createFinanceState();
}

test('buildTransactionsCsv respects a filtered subset', () => {
  const state = seedState();
  const subset = state.transactions.slice(0, 2);
  const csv = buildTransactionsCsv(state, { transactions: subset });
  const lines = csv.trim().split('\n');
  // Header + 2 rows
  assert.equal(lines.length, 3);
  assert.match(lines[0], /^date,payee,amount,debit,credit,category/);
});

test('QIF emits one block per transaction with header for the account type', () => {
  const state = seedState();
  const acct = state.accounts[0];
  const qif = buildAccountQif(state, acct.id);
  assert.match(qif, /^!Type:/);
  const blocks = qif.split(/^\^\s*$/m).filter((b) => b.trim());
  const txCount = state.transactions.filter((t) => t.accountId === acct.id).length;
  // QIF block count should roughly match transactions plus header.
  assert.ok(blocks.length >= txCount);
  assert.match(qif, /D\d{2}\/\d{2}\/\d{4}/);
});

test('multi-account QIF has one !Account header per account', () => {
  const state = seedState();
  const qif = buildMultiAccountQif(state);
  const matches = qif.match(/!Account/g);
  assert.equal(matches?.length ?? 0, state.accounts.length);
});

test('OFX export includes proper sign-on header, account block, and transactions', () => {
  const state = seedState();
  const acct = state.accounts[0];
  const ofx = buildAccountOfx(state, acct.id);
  assert.match(ofx, /OFXHEADER:100/);
  assert.match(ofx, /<OFX>/);
  assert.match(ofx, /<STMTTRN>/);
});

test('CSV export surfaces transaction tags in a dedicated column', () => {
  let state = seedState();
  state = setTransactionsTags(state, [state.transactions[0].id], ['trip-2026', 'tax']);
  const csv = buildTransactionsCsv(state, { transactions: [state.transactions[0]] });
  const [header, row] = csv.split(/\r?\n/);
  assert.match(header, /tags,transaction_id$/);
  assert.match(row, /trip-2026 tax/);
});

test('buildTransactionsCsv includes transaction_id column', () => {
  const state = seedState();
  const tx = state.transactions[0];
  const csv = buildTransactionsCsv(state, { transactions: [tx] });
  const [header, row] = csv.split(/\r?\n/);
  assert.match(header, /transaction_id$/);
  assert.ok(row.endsWith(tx.id));
});

test('QIF memo line includes notes and #tag suffixes so round-trips are safe', () => {
  let state = seedState();
  const targetId = state.transactions.find((t) => t.accountId === state.accounts[0].id)!.id;
  state = setTransactionsTags(state, [targetId], ['tax', 'trip-2026']);
  const qif = buildAccountQif(state, state.accounts[0].id);
  assert.match(qif, /#tax/);
  assert.match(qif, /#trip-2026/);
});
