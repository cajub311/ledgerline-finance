import { normalizeCategory } from './categories';
import type { FinanceRule, FinanceTransaction } from './types';

/** Build a RegExp from user input; returns null if the pattern is invalid (never throws). */
export function safeRegex(source: string, flags = 'i'): RegExp | null {
  const trimmed = source.trim();
  if (!trimmed) return null;
  try {
    return new RegExp(trimmed, flags);
  } catch {
    return null;
  }
}

export function transactionMatchesRule(transaction: FinanceTransaction, rule: FinanceRule): boolean {
  if (rule.accountIds && rule.accountIds.length > 0 && !rule.accountIds.includes(transaction.accountId)) {
    return false;
  }

  const { minAmount, maxAmount } = rule;
  if (minAmount !== undefined && Number.isFinite(minAmount) && transaction.amount < minAmount) {
    return false;
  }
  if (maxAmount !== undefined && Number.isFinite(maxAmount) && transaction.amount > maxAmount) {
    return false;
  }

  const pattern = rule.payeeRegex?.trim();
  if (pattern) {
    const re = safeRegex(pattern);
    if (!re || !re.test(transaction.payee)) {
      return false;
    }
  }

  return true;
}

/**
 * Returns the category from the first matching rule, or `undefined` if none match.
 * First rule in the array wins.
 */
export function applyRules(rules: FinanceRule[], transaction: FinanceTransaction): string | undefined {
  for (const rule of rules) {
    if (transactionMatchesRule(transaction, rule)) {
      return normalizeCategory(rule.category, transaction.payee);
    }
  }
  return undefined;
}

export function applyRulesToTransactions(
  rules: FinanceRule[],
  transactions: FinanceTransaction[],
): FinanceTransaction[] {
  return transactions.map((tx) => {
    const next = applyRules(rules, tx);
    if (next === undefined) return tx;
    return { ...tx, category: next };
  });
}

export function addRule(rules: FinanceRule[], rule: FinanceRule): FinanceRule[] {
  return [...rules, rule];
}

export function updateRule(
  rules: FinanceRule[],
  ruleId: string,
  patch: Partial<Omit<FinanceRule, 'id'>>,
): FinanceRule[] {
  return rules.map((r) => (r.id === ruleId ? { ...r, ...patch, id: r.id } : r));
}

export function deleteRule(rules: FinanceRule[], ruleId: string): FinanceRule[] {
  return rules.filter((r) => r.id !== ruleId);
}

export function moveRule(rules: FinanceRule[], ruleId: string, toIndex: number): FinanceRule[] {
  const from = rules.findIndex((r) => r.id === ruleId);
  if (from < 0) return rules;
  const next = [...rules];
  const [removed] = next.splice(from, 1);
  const clamped = Math.max(0, Math.min(toIndex, next.length));
  next.splice(clamped, 0, removed);
  return next;
}

/**
 * Count transactions that would match `draft` if it sat after `higherPrecedenceRules`
 * in rule order (earlier rules win; those matches are excluded from the count).
 */
export function countMatchingTransactions(
  allTransactions: FinanceTransaction[],
  draft: FinanceRule,
  higherPrecedenceRules: FinanceRule[],
): number {
  let n = 0;
  for (const tx of allTransactions) {
    let matchedHigher = false;
    for (const r of higherPrecedenceRules) {
      if (transactionMatchesRule(tx, r)) {
        matchedHigher = true;
        break;
      }
    }
    if (matchedHigher) continue;
    if (transactionMatchesRule(tx, draft)) n += 1;
  }
  return n;
}
