import type { FinanceRule, FinanceState, FinanceTransaction } from './types';
import { normalizeCategory } from './categories';
import { normalizeTag } from './ledger';

/** Safe RegExp.test: never throws on invalid patterns. */
export function safeRegexTest(pattern: string, text: string): boolean {
  const p = pattern.trim();
  if (!p) return true;
  try {
    return new RegExp(p, 'i').test(text);
  } catch {
    return false;
  }
}

function amountInRange(amount: number, rule: FinanceRule): boolean {
  if (rule.amountMin !== undefined && Number.isFinite(rule.amountMin) && amount < rule.amountMin) {
    return false;
  }
  if (rule.amountMax !== undefined && Number.isFinite(rule.amountMax) && amount > rule.amountMax) {
    return false;
  }
  return true;
}

function ruleMatches(rule: FinanceRule, tx: FinanceTransaction): boolean {
  if (rule.accountId && rule.accountId !== tx.accountId) return false;
  if (!amountInRange(tx.amount, rule)) return false;
  if (!safeRegexTest(rule.payeePattern, tx.payee)) return false;
  return true;
}

/**
 * Returns the category from the first matching rule, or undefined if none match.
 * Precedence: order in `rules` array (first wins).
 */
export function applyRules(rules: FinanceRule[], tx: FinanceTransaction): string | undefined {
  for (const rule of rules) {
    if (ruleMatches(rule, tx)) {
      return normalizeCategory(rule.assignCategory, tx.payee);
    }
  }
  return undefined;
}

/**
 * Apply ordered rules to a list of transactions (immutable). Applies the
 * first match's category, merges its addTags, and flips reviewed if the
 * rule requested it.
 */
export function applyRulesToTransactions(
  rules: FinanceRule[],
  transactions: FinanceTransaction[],
): FinanceTransaction[] {
  return transactions.map((tx) => {
    let firstMatch: FinanceRule | undefined;
    for (const rule of rules) {
      if (ruleMatches(rule, tx)) {
        firstMatch = rule;
        break;
      }
    }
    if (!firstMatch) return tx;

    const nextCategory = normalizeCategory(firstMatch.assignCategory, tx.payee);
    const addTags = (firstMatch.addTags ?? [])
      .map((t) => normalizeTag(t))
      .filter((t): t is string => Boolean(t));

    const mergedTags = addTags.length
      ? mergeTagList(tx.tags, addTags)
      : tx.tags;

    const nextReviewed =
      firstMatch.markReviewed === true ? true : tx.reviewed;

    if (
      nextCategory === tx.category &&
      mergedTags === tx.tags &&
      nextReviewed === tx.reviewed
    ) {
      return tx;
    }

    return {
      ...tx,
      category: nextCategory,
      tags: mergedTags,
      reviewed: nextReviewed,
    };
  });
}

function mergeTagList(existing: string[] | undefined, incoming: string[]): string[] | undefined {
  const out = existing ? [...existing] : [];
  for (const t of incoming) {
    if (!t) continue;
    if (out.includes(t)) continue;
    out.push(t);
    if (out.length >= 8) break;
  }
  return out.length ? out : undefined;
}

export function addRule(state: FinanceState, rule: FinanceRule): FinanceState {
  return { ...state, rules: [...state.rules, rule] };
}

export function updateRule(state: FinanceState, ruleId: string, patch: Partial<FinanceRule>): FinanceState {
  return {
    ...state,
    rules: state.rules.map((r) => (r.id === ruleId ? { ...r, ...patch, id: r.id } : r)),
  };
}

export function deleteRule(state: FinanceState, ruleId: string): FinanceState {
  return { ...state, rules: state.rules.filter((r) => r.id !== ruleId) };
}

export function moveRule(state: FinanceState, ruleId: string, toIndex: number): FinanceState {
  const idx = state.rules.findIndex((r) => r.id === ruleId);
  if (idx < 0) return state;
  const next = [...state.rules];
  const [removed] = next.splice(idx, 1);
  if (!removed) return state;
  const clamped = Math.max(0, Math.min(toIndex, next.length));
  next.splice(clamped, 0, removed);
  return { ...state, rules: next };
}

/** Count transactions that would match a rule (for editor preview). */
export function countRuleMatches(
  state: FinanceState,
  rule: Pick<FinanceRule, 'payeePattern' | 'accountId' | 'amountMin' | 'amountMax'>,
): number {
  const synthetic: FinanceRule = {
    id: '__preview__',
    payeePattern: rule.payeePattern,
    accountId: rule.accountId,
    amountMin: rule.amountMin,
    amountMax: rule.amountMax,
    assignCategory: 'Other',
  };
  return state.transactions.reduce((n, tx) => n + (ruleMatches(synthetic, tx) ? 1 : 0), 0);
}
