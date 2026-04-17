import { normalizeCategory } from './categories';
import type { FinanceRule, FinanceState, FinanceTransaction } from './types';

function createRuleId(): string {
  return `rule-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

/**
 * Test pattern against text without throwing on invalid regex.
 * Returns false if the pattern is invalid or the test throws.
 */
export function safeRegexTest(pattern: string, text: string): boolean {
  const trimmed = pattern.trim();
  if (!trimmed) return true;
  try {
    return new RegExp(trimmed, 'u').test(text);
  } catch {
    return false;
  }
}

function ruleMatches(rule: FinanceRule, transaction: FinanceTransaction): boolean {
  if (rule.enabled === false) return false;
  if (rule.accountId && rule.accountId !== transaction.accountId) return false;

  const pattern = rule.payeePattern?.trim() ?? '';
  if (pattern && !safeRegexTest(pattern, transaction.payee)) return false;

  if (rule.amountMin !== undefined && Number.isFinite(rule.amountMin) && transaction.amount < rule.amountMin) {
    return false;
  }
  if (rule.amountMax !== undefined && Number.isFinite(rule.amountMax) && transaction.amount > rule.amountMax) {
    return false;
  }

  return true;
}

/** First matching rule assigns category; otherwise the transaction is unchanged. */
export function applyRules(transaction: FinanceTransaction, rules: FinanceRule[]): FinanceTransaction {
  for (const rule of rules) {
    if (!ruleMatches(rule, transaction)) continue;
    const category = normalizeCategory(rule.category, transaction.payee);
    if (category === transaction.category) return transaction;
    return { ...transaction, category };
  }
  return transaction;
}

export function applyRulesToTransactions(
  transactions: FinanceTransaction[],
  rules: FinanceRule[],
): FinanceTransaction[] {
  return transactions.map((tx) => applyRules(tx, rules));
}

/** How many transactions currently match this rule (same predicates as applyRules). */
export function countRuleMatches(
  transactions: FinanceTransaction[],
  rule: Pick<FinanceRule, 'enabled' | 'accountId' | 'payeePattern' | 'amountMin' | 'amountMax' | 'category'>,
): number {
  const synthetic: FinanceRule = {
    id: '__count__',
    name: '',
    category: rule.category,
    payeePattern: rule.payeePattern ?? '',
    amountMin: rule.amountMin,
    amountMax: rule.amountMax,
    accountId: rule.accountId,
    enabled: rule.enabled !== false,
  };
  return transactions.filter((tx) => ruleMatches(synthetic, tx)).length;
}

export function addRule(
  state: FinanceState,
  draft: Omit<FinanceRule, 'id'> & { id?: string },
): FinanceState {
  const rule: FinanceRule = {
    id: draft.id ?? createRuleId(),
    name: draft.name.trim() || 'Untitled rule',
    category: draft.category,
    payeePattern: draft.payeePattern ?? '',
    amountMin: draft.amountMin,
    amountMax: draft.amountMax,
    accountId: draft.accountId,
    enabled: draft.enabled !== false,
  };
  return { ...state, rules: [...state.rules, rule] };
}

export function updateRule(state: FinanceState, ruleId: string, patch: Partial<Omit<FinanceRule, 'id'>>): FinanceState {
  return {
    ...state,
    rules: state.rules.map((rule) => {
      if (rule.id !== ruleId) return rule;
      return {
        ...rule,
        ...patch,
        name: patch.name !== undefined ? patch.name.trim() || 'Untitled rule' : rule.name,
        payeePattern: patch.payeePattern !== undefined ? patch.payeePattern : rule.payeePattern,
        enabled: patch.enabled !== undefined ? patch.enabled : rule.enabled,
      };
    }),
  };
}

export function deleteRule(state: FinanceState, ruleId: string): FinanceState {
  return { ...state, rules: state.rules.filter((r) => r.id !== ruleId) };
}

export function moveRule(state: FinanceState, ruleId: string, toIndex: number): FinanceState {
  const idx = state.rules.findIndex((r) => r.id === ruleId);
  if (idx < 0) return state;
  const item = state.rules[idx];
  const without = state.rules.filter((_, i) => i !== idx);
  const clamped = Math.max(0, Math.min(toIndex, without.length));
  const next = [...without];
  next.splice(clamped, 0, item);
  return { ...state, rules: next };
}

export function reapplyRulesToAllTransactions(state: FinanceState): FinanceState {
  return {
    ...state,
    transactions: applyRulesToTransactions(state.transactions, state.rules).map((tx) => ({
      ...tx,
      category: normalizeCategory(tx.category, tx.payee),
    })),
  };
}
