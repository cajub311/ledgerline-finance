import { normalizeCategory } from './categories';
import type { FinanceRule, FinanceTransaction } from './types';

export function safeRegex(source: string, flags = 'i'): RegExp | null {
  const trimmed = source.trim();
  if (!trimmed) return null;
  try {
    return new RegExp(trimmed, flags);
  } catch {
    return null;
  }
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

/** Whether a single transaction satisfies this rule's conditions (ignores rule order). */
export function transactionMatchesRule(
  transaction: FinanceTransaction,
  rule: Pick<FinanceRule, 'payeePattern' | 'accountId' | 'amountMin' | 'amountMax'>,
): boolean {
  if (rule.accountId !== undefined && rule.accountId !== '' && transaction.accountId !== rule.accountId) {
    return false;
  }

  if (isFiniteNumber(rule.amountMin) && transaction.amount < rule.amountMin) {
    return false;
  }
  if (isFiniteNumber(rule.amountMax) && transaction.amount > rule.amountMax) {
    return false;
  }

  const pattern = rule.payeePattern?.trim() ?? '';
  if (pattern) {
    const re = safeRegex(pattern);
    if (!re || !re.test(transaction.payee)) {
      return false;
    }
  }

  return true;
}

/** First matching rule in `rules` sets category; otherwise the transaction is unchanged. */
export function applyRules(transaction: FinanceTransaction, rules: FinanceRule[]): FinanceTransaction {
  for (const rule of rules) {
    if (!rule.category?.trim()) continue;
    if (transactionMatchesRule(transaction, rule)) {
      return {
        ...transaction,
        category: normalizeCategory(rule.category, transaction.payee),
      };
    }
  }
  return transaction;
}

export function applyRulesToTransactions(
  transactions: FinanceTransaction[],
  rules: FinanceRule[],
): FinanceTransaction[] {
  return transactions.map((tx) => applyRules(tx, rules));
}

function newRuleId(): string {
  return `fr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function addRule(rules: FinanceRule[], draft: Omit<FinanceRule, 'id'>): FinanceRule[] {
  const rule: FinanceRule = {
    id: newRuleId(),
    category: draft.category,
    payeePattern: draft.payeePattern,
    accountId: draft.accountId,
    amountMin: draft.amountMin,
    amountMax: draft.amountMax,
  };
  return [...rules, rule];
}

export function updateRule(rules: FinanceRule[], id: string, patch: Partial<Omit<FinanceRule, 'id'>>): FinanceRule[] {
  return rules.map((r) => (r.id === id ? { ...r, ...patch, id: r.id } : r));
}

export function deleteRule(rules: FinanceRule[], id: string): FinanceRule[] {
  return rules.filter((r) => r.id !== id);
}

export function moveRule(rules: FinanceRule[], fromIndex: number, toIndex: number): FinanceRule[] {
  if (fromIndex === toIndex) return rules;
  if (fromIndex < 0 || fromIndex >= rules.length) return rules;
  if (toIndex < 0 || toIndex >= rules.length) return rules;
  const next = [...rules];
  const [removed] = next.splice(fromIndex, 1);
  if (!removed) return rules;
  next.splice(toIndex, 0, removed);
  return next;
}

/** Counts transactions that satisfy the rule predicate (for “would match N” previews). */
export function countTransactionsMatchingRule(
  transactions: FinanceTransaction[],
  rule: Pick<FinanceRule, 'payeePattern' | 'accountId' | 'amountMin' | 'amountMax'>,
): number {
  return transactions.filter((tx) => transactionMatchesRule(tx, rule)).length;
}
