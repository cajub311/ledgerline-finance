import seedData from '../data/financeSeed.json';
import { CATEGORY_ICONS, CATEGORY_OPTIONS, cycleCategory, normalizeCategory } from './categories';
import { applyRules, applyRulesToTransactions } from './rules';
import type {
  Budget,
  BudgetEnvelopeRow,
  BudgetStatus,
  CashFlowProjection,
  CashFlowProjectionPoint,
  CategoryBreakdownItem,
  DetectedRecurringIncome,
  DetectedSubscription,
  FinanceAccount,
  FinanceRule,
  FinancialGoal,
  FinancePreferences,
  FinanceState,
  FinanceSummary,
  FinanceTransaction,
  GoalStats,
  ImportRecord,
  ManualTransactionDraft,
  MonthlyTrendItem,
  NetWorthMonthPoint,
  ParsedStatementBatch,
  ParsedStatementRow,
  ProjectedRecurringItem,
  TopMerchantItem,
} from './types';

const DEFAULT_PREFERENCES: FinancePreferences = {
  forecastLowBalanceThreshold: 500,
  budgetViewMode: 'flow',
};

function mergePreferences(partial?: Partial<FinancePreferences> | null): FinancePreferences {
  return {
    forecastLowBalanceThreshold:
      typeof partial?.forecastLowBalanceThreshold === 'number' &&
      Number.isFinite(partial.forecastLowBalanceThreshold) &&
      partial.forecastLowBalanceThreshold >= 0
        ? partial.forecastLowBalanceThreshold
        : DEFAULT_PREFERENCES.forecastLowBalanceThreshold,
    budgetViewMode: partial?.budgetViewMode === 'envelope' ? 'envelope' : 'flow',
  };
}

function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

function cloneTransactions(transactions: FinanceTransaction[]): FinanceTransaction[] {
  return transactions.map((transaction) => ({ ...transaction }));
}

function cloneAccounts(accounts: FinanceAccount[]): FinanceAccount[] {
  return accounts.map((account) => ({ ...account }));
}

function cloneImports(imports: ImportRecord[]): ImportRecord[] {
  return imports.map((record) => ({ ...record }));
}

function normalizeBudget(budget: Budget): Budget {
  return {
    ...budget,
    rollover: typeof budget.rollover === 'boolean' ? budget.rollover : true,
    carry:
      typeof budget.carry === 'number' && Number.isFinite(budget.carry) ? Number(budget.carry) : undefined,
  };
}

function cloneBudgets(budgets: Budget[]): Budget[] {
  return budgets.map((b) => normalizeBudget({ ...b }));
}

function cloneGoals(goals: FinancialGoal[]): FinancialGoal[] {
  return goals.map((g) => ({ ...g }));
}

function cloneRules(rules: FinanceRule[]): FinanceRule[] {
  return rules.map((r) => ({ ...r }));
}

/** Normalize a single tag string. Returns null for things we should drop. */
export function normalizeTag(raw: string): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 16);
  return cleaned || null;
}

/** Normalize + dedupe + cap a tag list to 8 entries. */
export function normalizeTags(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of raw) {
    const t = normalizeTag(String(entry));
    if (!t) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= 8) break;
  }
  return out.length ? out : undefined;
}

function normalizeTransaction(transaction: FinanceTransaction): FinanceTransaction {
  return {
    ...transaction,
    category: normalizeCategory(transaction.category, transaction.payee),
    notes: transaction.notes?.trim() || undefined,
    tags: normalizeTags(transaction.tags),
  };
}

function getTransactionKey(transaction: Pick<FinanceTransaction, 'accountId' | 'date' | 'payee' | 'amount'>): string {
  return [
    transaction.accountId,
    transaction.date,
    transaction.payee.trim().toLowerCase(),
    transaction.amount.toFixed(2),
  ].join('|');
}

function getCurrentMonthKey(date = new Date()): string {
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}`;
}

function accountBalance(account: FinanceAccount, transactions: FinanceTransaction[]): number {
  const transactionSum = transactions
    .filter((transaction) => transaction.accountId === account.id)
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  return Number((account.openingBalance + transactionSum).toFixed(2));
}

function accountTypeIsLiquid(type: FinanceAccount['type']): boolean {
  return type === 'checking' || type === 'savings' || type === 'cash';
}

function monthKeyFromParts(year: number, month: number): string {
  return `${year}-${`${month}`.padStart(2, '0')}`;
}

function shiftCalendarMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const idx = year * 12 + (month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

function monthKeysEndingAt(endYear: number, endMonth: number, count: number): string[] {
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const { year, month } = shiftCalendarMonth(endYear, endMonth, -i);
    keys.push(monthKeyFromParts(year, month));
  }
  return keys;
}

function earliestTransactionMonthKey(transactions: FinanceTransaction[]): string | null {
  let best: string | null = null;
  for (const tx of transactions) {
    const mk = tx.date.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(mk)) continue;
    if (!best || mk < best) best = mk;
  }
  return best;
}

function monthKeysFromToInclusive(startKey: string, endKey: string): string[] {
  const keys: string[] = [];
  const [sy, sm] = startKey.split('-').map(Number) as [number, number];
  let y = sy;
  let m = sm;
  const [ey, em] = endKey.split('-').map(Number) as [number, number];
  const endIdx = ey * 12 + (em - 1);
  while (y * 12 + (m - 1) <= endIdx) {
    keys.push(monthKeyFromParts(y, m));
    const next = shiftCalendarMonth(y, m, 1);
    y = next.year;
    m = next.month;
  }
  return keys;
}

function pointFromBalances(
  accounts: FinanceAccount[],
  running: Record<string, number>,
  monthKey: string,
): NetWorthMonthPoint {
  let assets = 0;
  let liabilities = 0;
  for (const account of accounts) {
    const bal = Number((running[account.id] ?? 0).toFixed(2));
    if (bal > 0) assets += bal;
    else liabilities += bal;
  }
  assets = Number(assets.toFixed(2));
  liabilities = Number(liabilities.toFixed(2));
  const netWorth = Number((assets + liabilities).toFixed(2));
  const [y, m] = monthKey.split('-').map(Number) as [number, number];
  const label = new Date(y, m - 1, 1).toLocaleString('default', { month: 'short', year: '2-digit' });
  return { monthKey, label, netWorth, assets, liabilities };
}

/**
 * End-of-month net worth series. Walks transactions once in date order.
 * Last entry uses all transactions through today (matches `getFinanceSummary(state).netWorth`).
 * @param months — number of trailing calendar months (≥1), or `0` for “all” months from first transaction to now
 */
export function getNetWorthSeries(state: FinanceState, months: number): NetWorthMonthPoint[] {
  const sorted = [...state.transactions].sort((a, b) => {
    const c = a.date.localeCompare(b.date);
    return c !== 0 ? c : a.id.localeCompare(b.id);
  });

  const now = new Date();
  const endYear = now.getFullYear();
  const endMonth = now.getMonth() + 1;
  const endKey = monthKeyFromParts(endYear, endMonth);

  let seriesKeys: string[];
  if (!months || months <= 0) {
    const earliest = earliestTransactionMonthKey(sorted);
    const startKey = earliest && earliest < endKey ? earliest : endKey;
    seriesKeys = monthKeysFromToInclusive(startKey, endKey);
    if (seriesKeys.length === 0) seriesKeys = [endKey];
  } else {
    seriesKeys = monthKeysEndingAt(endYear, endMonth, Math.max(1, months));
  }

  const running: Record<string, number> = {};
  for (const account of state.accounts) {
    running[account.id] = Number.isFinite(account.openingBalance) ? account.openingBalance : 0;
  }

  const result: NetWorthMonthPoint[] = [];
  let ptr = 0;

  for (let i = 0; i < seriesKeys.length; i += 1) {
    const mk = seriesKeys[i]!;
    const isLast = i === seriesKeys.length - 1;
    while (
      ptr < sorted.length &&
      (isLast ? true : sorted[ptr]!.date.slice(0, 7) <= mk)
    ) {
      const tx = sorted[ptr]!;
      running[tx.accountId] = Number(((running[tx.accountId] ?? 0) + tx.amount).toFixed(2));
      ptr += 1;
    }
    result.push(pointFromBalances(state.accounts, running, mk));
  }

  return result;
}

export function createFinanceState(): FinanceState {
  const accounts = cloneAccounts(seedData.accounts as FinanceAccount[]);
  const transactions = cloneTransactions(seedData.transactions as FinanceTransaction[]).map(
    normalizeTransaction,
  );
  const imports = cloneImports(seedData.imports as ImportRecord[]);
  const budgets = cloneBudgets((seedData as { budgets?: Budget[] }).budgets ?? []);
  const goals = cloneGoals((seedData as { goals?: FinancialGoal[] }).goals ?? []);
  const rules = cloneRules((seedData as { rules?: FinanceRule[] }).rules ?? []);

  return {
    version: 1,
    householdName: String(seedData.householdName ?? 'Ledgerline'),
    currency: 'USD',
    accounts,
    transactions,
    imports,
    budgets,
    goals,
    rules,
    preferences: mergePreferences(
      (seedData as { preferences?: Partial<FinancePreferences> }).preferences,
    ),
  };
}

export function rehydrateFinanceState(snapshot: Partial<FinanceState> | null | undefined): FinanceState {
  const seed = createFinanceState();

  if (!snapshot) {
    return seed;
  }

  // Use `Array.isArray` (not truthiness on `.length`) so an intentional empty
  // ledger — e.g. after "Start fresh" — round-trips instead of reverting to demo seed.
  const accounts = Array.isArray(snapshot.accounts)
    ? cloneAccounts(snapshot.accounts as FinanceAccount[])
    : seed.accounts;
  const transactions = Array.isArray(snapshot.transactions)
    ? cloneTransactions(snapshot.transactions as FinanceTransaction[]).map(normalizeTransaction)
    : seed.transactions;
  const imports = Array.isArray(snapshot.imports)
    ? cloneImports(snapshot.imports as ImportRecord[])
    : seed.imports;
  const budgets = Array.isArray(snapshot.budgets) ? cloneBudgets(snapshot.budgets as Budget[]) : seed.budgets;
  const goals = Array.isArray(snapshot.goals) ? cloneGoals(snapshot.goals as FinancialGoal[]) : seed.goals;
  const rules = Array.isArray(snapshot.rules) ? cloneRules(snapshot.rules as FinanceRule[]) : seed.rules;

  return {
    version: 1,
    householdName: snapshot.householdName ?? seed.householdName,
    currency: snapshot.currency ?? 'USD',
    accounts,
    transactions,
    imports,
    budgets,
    goals,
    rules,
    preferences: mergePreferences(snapshot.preferences ?? seed.preferences),
  };
}

export function getAccountBalances(state: FinanceState): Array<FinanceAccount & { currentBalance: number }> {
  return state.accounts.map((account) => ({
    ...account,
    currentBalance: accountBalance(account, state.transactions),
  }));
}

export function getFinanceSummary(state: FinanceState): FinanceSummary {
  const currentMonthKey = getCurrentMonthKey();
  const balances = getAccountBalances(state);
  const monthTransactions = state.transactions.filter((transaction) => transaction.date.startsWith(currentMonthKey));

  return {
    netWorth: Number(balances.reduce((sum, account) => sum + account.currentBalance, 0).toFixed(2)),
    liquidCash: Number(
      balances
        .filter((account) => accountTypeIsLiquid(account.type))
        .reduce((sum, account) => sum + account.currentBalance, 0)
        .toFixed(2),
    ),
    monthIncome: Number(
      monthTransactions
        .filter((transaction) => transaction.amount > 0)
        .reduce((sum, transaction) => sum + transaction.amount, 0)
        .toFixed(2),
    ),
    monthSpend: Number(
      monthTransactions
        .filter((transaction) => transaction.amount < 0)
        .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0)
        .toFixed(2),
    ),
    uncategorizedCount: state.transactions.filter(
      (transaction) => !transaction.category || transaction.category === 'Other',
    ).length,
    unreviewedCount: state.transactions.filter((transaction) => !transaction.reviewed).length,
    importedRows: state.imports.reduce((sum, importRecord) => sum + importRecord.rows, 0),
    importedFiles: state.imports.length,
  };
}

export function addManualTransaction(state: FinanceState, draft: ManualTransactionDraft): FinanceState {
  const date = draft.date.trim();
  const payee = draft.payee.trim();
  const amount = Number.parseFloat(draft.amount);
  const accountId = draft.accountId.trim();

  if (!date || !payee || !Number.isFinite(amount) || !accountId) {
    return state;
  }

  const transaction: FinanceTransaction = normalizeTransaction({
    id: createId('tx'),
    accountId,
    date,
    payee,
    amount,
    category: normalizeCategory(draft.category, payee),
    source: 'manual',
    reviewed: true,
    notes: draft.notes.trim() || undefined,
  });

  return {
    ...state,
    transactions: [transaction, ...state.transactions],
  };
}

export function toggleTransactionReview(state: FinanceState, transactionId: string): FinanceState {
  return {
    ...state,
    transactions: state.transactions.map((transaction) =>
      transaction.id === transactionId
        ? {
            ...transaction,
            reviewed: !transaction.reviewed,
          }
        : transaction,
    ),
  };
}

export function rotateTransactionCategory(state: FinanceState, transactionId: string): FinanceState {
  return {
    ...state,
    transactions: state.transactions.map((transaction) =>
      transaction.id === transactionId
        ? {
            ...transaction,
            category: cycleCategory(transaction.category),
          }
        : transaction,
    ),
  };
}

export function updateTransactionCategory(
  state: FinanceState,
  transactionId: string,
  category: string,
): FinanceState {
  return {
    ...state,
    transactions: state.transactions.map((transaction) =>
      transaction.id === transactionId
        ? {
            ...transaction,
            category: normalizeCategory(category, transaction.payee),
          }
        : transaction,
    ),
  };
}

export interface TransactionPatch {
  date?: string;
  payee?: string;
  amount?: number;
  category?: string;
  accountId?: string;
  notes?: string;
  reviewed?: boolean;
  tags?: string[];
}

export function updateTransaction(
  state: FinanceState,
  transactionId: string,
  patch: TransactionPatch,
): FinanceState {
  return {
    ...state,
    transactions: state.transactions.map((transaction) => {
      if (transaction.id !== transactionId) return transaction;
      const merged: FinanceTransaction = {
        ...transaction,
        ...patch,
        category:
          patch.category !== undefined
            ? normalizeCategory(patch.category, patch.payee ?? transaction.payee)
            : transaction.category,
      };
      return normalizeTransaction(merged);
    }),
  };
}

/** Subset patch shape compatible with the older redesign branch API. */
export interface TransactionEdits {
  payee?: string;
  amount?: number;
  date?: string;
  category?: string;
  notes?: string;
}

/** Apply field edits to one transaction (delegates to `updateTransaction`). */
export function editTransaction(
  state: FinanceState,
  transactionId: string,
  edits: TransactionEdits,
): FinanceState {
  const tx = state.transactions.find((t) => t.id === transactionId);
  if (!tx) return state;
  const patch: TransactionPatch = {};
  if (edits.payee !== undefined && edits.payee.trim()) patch.payee = edits.payee.trim();
  if (edits.amount !== undefined && Number.isFinite(edits.amount)) patch.amount = edits.amount;
  if (edits.date !== undefined && edits.date.trim()) patch.date = edits.date.trim();
  if (edits.category !== undefined && edits.category.trim()) {
    patch.category = normalizeCategory(edits.category.trim(), tx.payee);
  }
  if (edits.notes !== undefined) patch.notes = edits.notes.trim() || undefined;
  return updateTransaction(state, transactionId, patch);
}

export function deleteTransaction(state: FinanceState, transactionId: string): FinanceState {
  return {
    ...state,
    transactions: state.transactions.filter((transaction) => transaction.id !== transactionId),
  };
}

export function deleteTransactions(state: FinanceState, transactionIds: string[]): FinanceState {
  if (transactionIds.length === 0) return state;
  const set = new Set(transactionIds);
  return {
    ...state,
    transactions: state.transactions.filter((transaction) => !set.has(transaction.id)),
  };
}

export function setTransactionsReviewed(
  state: FinanceState,
  transactionIds: string[],
  reviewed: boolean,
): FinanceState {
  if (transactionIds.length === 0) return state;
  const set = new Set(transactionIds);
  return {
    ...state,
    transactions: state.transactions.map((transaction) =>
      set.has(transaction.id) ? { ...transaction, reviewed } : transaction,
    ),
  };
}

export function setTransactionsCategory(
  state: FinanceState,
  transactionIds: string[],
  category: string,
): FinanceState {
  if (transactionIds.length === 0) return state;
  const set = new Set(transactionIds);
  return {
    ...state,
    transactions: state.transactions.map((transaction) =>
      set.has(transaction.id)
        ? {
            ...transaction,
            category: normalizeCategory(category, transaction.payee),
          }
        : transaction,
    ),
  };
}

/**
 * Merge or replace tags on one or more transactions.
 * `mode` = 'merge' adds new tags and keeps existing ones (default).
 * `mode` = 'replace' replaces the tag list entirely (after normalization).
 * `mode` = 'remove' removes the supplied tags from each transaction.
 */
export function setTransactionsTags(
  state: FinanceState,
  transactionIds: string[],
  tags: string[],
  mode: 'merge' | 'replace' | 'remove' = 'merge',
): FinanceState {
  if (transactionIds.length === 0) return state;
  const set = new Set(transactionIds);
  const incoming = normalizeTags(tags) ?? [];
  if (incoming.length === 0 && mode !== 'replace' && mode !== 'remove') return state;

  return {
    ...state,
    transactions: state.transactions.map((transaction) => {
      if (!set.has(transaction.id)) return transaction;
      const existing = transaction.tags ?? [];
      let nextTags: string[];
      if (mode === 'replace') {
        nextTags = incoming;
      } else if (mode === 'remove') {
        const remove = new Set(incoming);
        nextTags = existing.filter((t) => !remove.has(t));
      } else {
        const merged = [...existing];
        for (const t of incoming) {
          if (!merged.includes(t)) merged.push(t);
          if (merged.length >= 8) break;
        }
        nextTags = merged;
      }
      return {
        ...transaction,
        tags: nextTags.length ? nextTags : undefined,
      };
    }),
  };
}

export interface TransferPair {
  outgoingId: string;
  incomingId: string;
  amount: number;
  daysApart: number;
}

/**
 * Find likely transfers between the user's own accounts. Classic finance-app
 * hygiene: without this, moving $500 from checking → savings shows up as
 * $500 of "expense" in checking and $500 of "income" in savings, inflating
 * every spending/income number in the app.
 *
 * Heuristic: paired transactions with opposite signs, the exact same absolute
 * amount, dated within 3 calendar days of each other, in different accounts,
 * and not already categorized as "Transfer". Each transaction can only
 * participate in one pair; we greedily match by closest date.
 */
export function detectTransfers(
  transactions: ReadonlyArray<FinanceTransaction>,
): TransferPair[] {
  const used = new Set<string>();
  const pairs: TransferPair[] = [];
  const candidates = transactions.filter((tx) => tx.category !== 'Transfer');

  const outgoing = candidates
    .filter((tx) => tx.amount < 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  for (const out of outgoing) {
    if (used.has(out.id)) continue;
    const outAmount = Math.abs(out.amount);
    let best: { tx: FinanceTransaction; days: number } | null = null;

    for (const cand of candidates) {
      if (used.has(cand.id)) continue;
      if (cand.id === out.id) continue;
      if (cand.accountId === out.accountId) continue;
      if (cand.amount <= 0) continue;
      if (Math.abs(cand.amount - outAmount) > 0.005) continue;
      const days = Math.abs(daysBetweenIso(out.date, cand.date));
      if (days > 3) continue;
      if (!best || days < best.days) {
        best = { tx: cand, days };
      }
    }

    if (best) {
      used.add(out.id);
      used.add(best.tx.id);
      pairs.push({
        outgoingId: out.id,
        incomingId: best.tx.id,
        amount: outAmount,
        daysApart: best.days,
      });
    }
  }

  return pairs;
}

/** Re-category both sides of each pair as "Transfer" and mark reviewed. */
export function applyDetectedTransfers(
  state: FinanceState,
  pairs: ReadonlyArray<TransferPair>,
): FinanceState {
  if (pairs.length === 0) return state;
  const ids = new Set<string>();
  for (const p of pairs) {
    ids.add(p.outgoingId);
    ids.add(p.incomingId);
  }
  return {
    ...state,
    transactions: state.transactions.map((tx) =>
      ids.has(tx.id)
        ? { ...tx, category: 'Transfer', reviewed: true }
        : tx,
    ),
  };
}

function daysBetweenIso(a: string, b: string): number {
  const aD = new Date(`${a}T12:00:00`);
  const bD = new Date(`${b}T12:00:00`);
  if (!Number.isFinite(aD.getTime()) || !Number.isFinite(bD.getTime())) return Infinity;
  return Math.round((bD.getTime() - aD.getTime()) / 86_400_000);
}

/** List of every unique tag across the ledger, sorted by usage desc then alphabetically. */
export function getAllTags(state: FinanceState): Array<{ tag: string; count: number }> {
  const counts = new Map<string, number>();
  for (const tx of state.transactions) {
    if (!tx.tags) continue;
    for (const t of tx.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export function addAccount(
  state: FinanceState,
  draft: Omit<FinanceAccount, 'id' | 'lastSynced' | 'source'> & {
    source?: FinanceAccount['source'];
  },
): FinanceState {
  const account: FinanceAccount = {
    id: createId('acct'),
    name: draft.name.trim() || 'Untitled account',
    institution: draft.institution.trim() || 'Manual',
    type: draft.type,
    source: draft.source ?? 'manual',
    openingBalance: Number.isFinite(draft.openingBalance) ? draft.openingBalance : 0,
    lastSynced: new Date().toISOString().slice(0, 10),
    notes: draft.notes?.trim() || undefined,
  };
  return { ...state, accounts: [...state.accounts, account] };
}

export function updateAccount(
  state: FinanceState,
  accountId: string,
  patch: Partial<Omit<FinanceAccount, 'id'>>,
): FinanceState {
  return {
    ...state,
    accounts: state.accounts.map((account) =>
      account.id === accountId ? { ...account, ...patch } : account,
    ),
  };
}

export function deleteAccount(state: FinanceState, accountId: string): FinanceState {
  return {
    ...state,
    accounts: state.accounts.filter((account) => account.id !== accountId),
    transactions: state.transactions.filter((transaction) => transaction.accountId !== accountId),
  };
}

function mapImportedRowToTransaction(
  state: FinanceState,
  row: ParsedStatementRow,
  accountId: string,
  sourceLabel: string,
): FinanceTransaction {
  let category = normalizeCategory(row.category, row.payee);
  const draft: FinanceTransaction = {
    id: createId('tx'),
    accountId,
    date: row.date,
    payee: row.payee,
    amount: row.amount,
    category,
    source: 'imported',
    reviewed: false,
    notes: row.notes ?? sourceLabel,
  };
  const fromRule = applyRules(state.rules, draft);
  if (fromRule !== undefined) {
    category = fromRule;
  }
  return normalizeTransaction({ ...draft, category });
}

export function applyImportedBatch(
  state: FinanceState,
  accountId: string,
  batch: ParsedStatementBatch,
): FinanceState {
  const existingKeys = new Set(state.transactions.map(getTransactionKey));
  const incoming = batch.rows.map((row) => mapImportedRowToTransaction(state, row, accountId, batch.sourceLabel));
  const deduped = incoming.filter((transaction) => !existingKeys.has(getTransactionKey(transaction)));
  const importRecord: ImportRecord = {
    id: createId('imp'),
    fileName: batch.sourceLabel,
    format: batch.format,
    rows: deduped.length,
    importedAt: new Date().toISOString(),
    note:
      batch.notes[0] ??
      `Imported ${deduped.length} rows into ${state.accounts.find((account) => account.id === accountId)?.name ?? accountId}.`,
  };

  return {
    ...state,
    transactions: [...deduped, ...state.transactions],
    imports: [importRecord, ...state.imports],
  };
}

export function resetFinanceState(): FinanceState {
  return createFinanceState();
}

/** Stable IDs that ship with the demo seed; used by isSeedState(). */
const SEED_ACCOUNT_IDS: Set<string> = new Set(
  (seedData.accounts as FinanceAccount[]).map((a) => a.id),
);
const SEED_TRANSACTION_IDS: Set<string> = new Set(
  (seedData.transactions as FinanceTransaction[]).map((t) => t.id),
);

/**
 * Returns true when the state still looks like the factory-shipped demo data,
 * so the UI can warn users that what they see is not their real ledger.
 *
 * Heuristic: the set of account ids and transaction ids exactly matches what
 * the seed JSON shipped. As soon as the user adds, deletes, or imports a
 * single row, this flips to false and we stop warning.
 */
export function isSeedState(state: FinanceState): boolean {
  if (state.accounts.length !== SEED_ACCOUNT_IDS.size) return false;
  for (const account of state.accounts) {
    if (!SEED_ACCOUNT_IDS.has(account.id)) return false;
  }
  if (state.transactions.length !== SEED_TRANSACTION_IDS.size) return false;
  for (const tx of state.transactions) {
    if (!SEED_TRANSACTION_IDS.has(tx.id)) return false;
  }
  return true;
}

/**
 * Produces a blank ledger with a single placeholder checking account — good
 * for first-time users who want to put in their own data without any demo
 * rows getting mixed in. Preferences are kept at their defaults.
 */
export function createEmptyFinanceState(options?: { householdName?: string }): FinanceState {
  const today = new Date().toISOString().slice(0, 10);
  const placeholderAccount: FinanceAccount = {
    id: createId('acct'),
    name: 'Primary checking',
    institution: 'Manual',
    type: 'checking',
    source: 'manual',
    openingBalance: 0,
    lastSynced: today,
  };
  return {
    version: 1,
    householdName: options?.householdName?.trim() || 'My ledger',
    currency: 'USD',
    accounts: [placeholderAccount],
    transactions: [],
    imports: [],
    budgets: [],
    goals: [],
    rules: [],
    preferences: mergePreferences(undefined),
  };
}

/** Re-run user rules on every transaction (overwrites categories where a rule matches). */
export function reapplyRulesToAllTransactions(state: FinanceState): FinanceState {
  return {
    ...state,
    transactions: applyRulesToTransactions(state.rules, state.transactions),
  };
}

export function hasUnreviewedTransactions(state: FinanceState): boolean {
  return state.transactions.some((transaction) => !transaction.reviewed);
}

export function getLatestTransactions(state: FinanceState, limit = 16): FinanceTransaction[] {
  return [...state.transactions]
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, limit);
}

const ACCOUNT_TYPE_META: Record<string, { icon: string; kindLabel: string; isLiability: boolean }> = {
  checking:   { icon: '🏦', kindLabel: 'Checking',   isLiability: false },
  savings:    { icon: '💰', kindLabel: 'Savings',    isLiability: false },
  credit:     { icon: '💳', kindLabel: 'Credit Card', isLiability: true  },
  cash:       { icon: '💵', kindLabel: 'Cash',        isLiability: false },
  loan:       { icon: '📋', kindLabel: 'Loan',        isLiability: true  },
  investment: { icon: '📈', kindLabel: 'Investment',  isLiability: false },
};

export function getAccountsWithBalances(
  state: FinanceState,
): Array<FinanceAccount & { currentBalance: number; kindLabel: string; typeIcon: string; isLiability: boolean }> {
  return getAccountBalances(state).map((account) => {
    const meta = ACCOUNT_TYPE_META[account.type] ?? { icon: '🏦', kindLabel: 'Account', isLiability: false };
    return {
      ...account,
      kindLabel: meta.kindLabel,
      typeIcon: meta.icon,
      isLiability: meta.isLiability,
    };
  });
}

export function getBudgetPills(state: FinanceState) {
  const summary = getFinanceSummary(state);
  const savingsRate = getSavingsRate(state);
  const pills: string[] = [];

  if (summary.unreviewedCount > 0) pills.push(`${summary.unreviewedCount} to review`);
  if (summary.uncategorizedCount > 0) pills.push(`${summary.uncategorizedCount} uncategorized`);
  if (savingsRate > 0) pills.push(`${savingsRate}% saved this month`);
  pills.push(`${summary.importedFiles} import${summary.importedFiles === 1 ? '' : 's'}`);

  return pills;
}

export function getCategoryOptions(): string[] {
  return [...CATEGORY_OPTIONS];
}

export function getCategoryIcon(category: string): string {
  return CATEGORY_ICONS[category] ?? '📋';
}

export function getSavingsRate(state: FinanceState): number {
  const currentMonthKey = getCurrentMonthKey();
  const monthTxs = state.transactions.filter((tx) => tx.date.startsWith(currentMonthKey));
  const income = monthTxs.filter((tx) => tx.amount > 0).reduce((s, tx) => s + tx.amount, 0);
  const spend = monthTxs
    .filter((tx) => tx.amount < 0 && tx.category !== 'Transfer')
    .reduce((s, tx) => s + Math.abs(tx.amount), 0);
  if (income === 0) return 0;
  return Number(Math.max(0, ((income - spend) / income) * 100).toFixed(1));
}

export function getBudgetHealthScore(state: FinanceState): number | null {
  if (state.budgets.length === 0) return null;
  const now = new Date();
  const statuses = getBudgetStatus(state, now.getFullYear(), now.getMonth() + 1);
  const ok = statuses.filter((s) => s.status === 'ok').length;
  return Math.round((ok / statuses.length) * 100);
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export function getCategoryBreakdown(
  transactions: FinanceTransaction[],
  year: number,
  month: number,
): CategoryBreakdownItem[] {
  const monthKey = `${year}-${`${month}`.padStart(2, '0')}`;
  const expenses = transactions.filter(
    (tx) => tx.date.startsWith(monthKey) && tx.amount < 0 && tx.category !== 'Transfer',
  );
  const totals: Record<string, number> = {};

  for (const tx of expenses) {
    totals[tx.category] = (totals[tx.category] ?? 0) + Math.abs(tx.amount);
  }

  const grandTotal = Object.values(totals).reduce((sum, v) => sum + v, 0);

  return Object.entries(totals)
    .map(([category, total]) => ({
      category,
      total: Number(total.toFixed(2)),
      pct: grandTotal > 0 ? Number((total / grandTotal).toFixed(4)) : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

export function getMonthlyTrend(
  transactions: FinanceTransaction[],
  months: number,
): MonthlyTrendItem[] {
  const result: MonthlyTrendItem[] = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const monthKey = `${year}-${`${month}`.padStart(2, '0')}`;
    const label = d.toLocaleString('default', { month: 'short', year: '2-digit' });

    const monthTxs = transactions.filter((tx) => tx.date.startsWith(monthKey));

    const income = monthTxs
      .filter((tx) => tx.amount > 0)
      .reduce((sum, tx) => sum + tx.amount, 0);

    const spend = monthTxs
      .filter((tx) => tx.amount < 0 && tx.category !== 'Transfer')
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

    result.push({
      label,
      monthKey,
      income: Number(income.toFixed(2)),
      spend: Number(spend.toFixed(2)),
    });
  }

  return result;
}

export function getTopMerchants(
  transactions: FinanceTransaction[],
  year: number,
  month: number,
  n = 5,
): TopMerchantItem[] {
  const monthKey = `${year}-${`${month}`.padStart(2, '0')}`;
  const expenses = transactions.filter(
    (tx) => tx.date.startsWith(monthKey) && tx.amount < 0 && tx.category !== 'Transfer',
  );

  const totals: Record<string, { total: number; count: number }> = {};

  for (const tx of expenses) {
    const key = tx.payee.trim();
    if (!totals[key]) {
      totals[key] = { total: 0, count: 0 };
    }
    totals[key].total += Math.abs(tx.amount);
    totals[key].count += 1;
  }

  return Object.entries(totals)
    .map(([payee, { total, count }]) => ({
      payee,
      total: Number(total.toFixed(2)),
      count,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, n);
}

export function detectSubscriptions(transactions: FinanceTransaction[]): DetectedSubscription[] {
  // Group negative transactions by normalized payee name
  const byPayee: Record<string, FinanceTransaction[]> = {};

  for (const tx of transactions) {
    if (tx.amount >= 0) continue;
    const key = tx.payee.trim().toLowerCase();
    if (!byPayee[key]) byPayee[key] = [];
    byPayee[key].push(tx);
  }

  const subscriptions: DetectedSubscription[] = [];

  for (const [, txs] of Object.entries(byPayee)) {
    if (txs.length < 2) continue;

    // Check amount consistency (within $2 of median)
    const amounts = txs.map((tx) => Math.abs(tx.amount)).sort((a, b) => a - b);
    const median = amounts[Math.floor(amounts.length / 2)];
    const consistent = amounts.every((a) => Math.abs(a - median) <= 2);

    if (!consistent) continue;

    // Check date cadence
    const dates = txs.map((tx) => new Date(tx.date).getTime()).sort((a, b) => a - b);
    const gaps: number[] = [];

    for (let i = 1; i < dates.length; i++) {
      gaps.push((dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24));
    }

    const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;

    let frequency: DetectedSubscription['frequency'];
    let annualCost: number;

    if (avgGap >= 6 && avgGap <= 10) {
      frequency = 'weekly';
      annualCost = median * 52;
    } else if (avgGap >= 25 && avgGap <= 40) {
      frequency = 'monthly';
      annualCost = median * 12;
    } else if (avgGap >= 300 && avgGap <= 400) {
      frequency = 'annual';
      annualCost = median;
    } else {
      continue;
    }

    const sorted = [...txs].sort((a, b) => b.date.localeCompare(a.date));
    subscriptions.push({
      payee: sorted[0].payee,
      amount: Number(median.toFixed(2)),
      frequency,
      lastCharged: sorted[0].date,
      annualCost: Number(annualCost.toFixed(2)),
      occurrences: txs.length,
    });
  }

  return subscriptions.sort((a, b) => b.annualCost - a.annualCost);
}

export function detectRecurringIncome(transactions: FinanceTransaction[]): DetectedRecurringIncome[] {
  const byPayee: Record<string, FinanceTransaction[]> = {};

  for (const tx of transactions) {
    if (tx.amount <= 0) continue;
    const key = tx.payee.trim().toLowerCase();
    if (!byPayee[key]) byPayee[key] = [];
    byPayee[key].push(tx);
  }

  const incomes: DetectedRecurringIncome[] = [];

  for (const [, txs] of Object.entries(byPayee)) {
    if (txs.length < 2) continue;

    const amounts = txs.map((tx) => tx.amount).sort((a, b) => a - b);
    const median = amounts[Math.floor(amounts.length / 2)];
    const consistent = amounts.every((a) => Math.abs(a - median) <= 2);

    if (!consistent) continue;

    const dates = txs.map((tx) => new Date(tx.date).getTime()).sort((a, b) => a - b);
    const gaps: number[] = [];
    for (let i = 1; i < dates.length; i++) {
      gaps.push((dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24));
    }
    const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;

    let frequency: DetectedRecurringIncome['frequency'];
    let annualTotal: number;

    if (avgGap >= 6 && avgGap <= 10) {
      frequency = 'weekly';
      annualTotal = median * 52;
    } else if (avgGap >= 25 && avgGap <= 40) {
      frequency = 'monthly';
      annualTotal = median * 12;
    } else if (avgGap >= 300 && avgGap <= 400) {
      frequency = 'annual';
      annualTotal = median;
    } else {
      continue;
    }

    const sorted = [...txs].sort((a, b) => b.date.localeCompare(a.date));
    incomes.push({
      payee: sorted[0].payee,
      amount: Number(median.toFixed(2)),
      frequency,
      lastReceived: sorted[0].date,
      annualTotal: Number(annualTotal.toFixed(2)),
      occurrences: txs.length,
    });
  }

  return incomes.sort((a, b) => b.annualTotal - a.annualTotal);
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseIsoDateLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map((n) => Number.parseInt(n, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return new Date(NaN);
  return new Date(y, m - 1, d);
}

function addCalendarDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function averageGapDaysBetweenSortedDates(sortedIsoDates: string[]): number | null {
  if (sortedIsoDates.length < 2) return null;
  const times = sortedIsoDates.map((iso) => parseIsoDateLocal(iso).getTime());
  if (times.some((t) => !Number.isFinite(t))) return null;
  const gaps: number[] = [];
  for (let i = 1; i < times.length; i++) {
    gaps.push((times[i]! - times[i - 1]!) / (1000 * 60 * 60 * 24));
  }
  return gaps.reduce((s, g) => s + g, 0) / gaps.length;
}

function defaultGapDaysForFrequency(frequency: DetectedSubscription['frequency']): number {
  if (frequency === 'weekly') return 7;
  if (frequency === 'monthly') return 30;
  return 365;
}

function patternConfidence(occurrences: number): number {
  const raw = 0.35 + 0.12 * Math.max(0, occurrences - 2);
  return Number(Math.min(0.95, raw).toFixed(4));
}

function transactionsForRecurringPayee(
  transactions: FinanceTransaction[],
  payeeNorm: string,
  kind: 'charge' | 'income',
): FinanceTransaction[] {
  return transactions.filter((tx) => {
    if (tx.payee.trim().toLowerCase() !== payeeNorm) return false;
    if (kind === 'charge') return tx.amount < 0;
    return tx.amount > 0;
  });
}

/**
 * Project next recurring charges and income from detected patterns.
 * Each next date is prior occurrence + average gap (from matching txs), rolling until past the horizon.
 */
export function projectRecurring(
  state: FinanceState,
  horizonDays: number,
  asOf: Date = new Date(),
): ProjectedRecurringItem[] {
  const txs = state.transactions;
  const today = startOfLocalDay(asOf);
  const horizonEnd = addCalendarDays(today, Math.max(0, horizonDays));
  const horizonEndTime = horizonEnd.getTime();

  const rows: ProjectedRecurringItem[] = [];

  const pushOccurrences = (
    lastIso: string,
    payee: string,
    payeeNorm: string,
    kind: 'charge' | 'income',
    frequency: ProjectedRecurringItem['frequency'],
    medianAmount: number,
    occurrences: number,
  ) => {
    const related = transactionsForRecurringPayee(txs, payeeNorm, kind);
    const dates = [...new Set(related.map((t) => t.date))].sort((a, b) => a.localeCompare(b));
    let gap = averageGapDaysBetweenSortedDates(dates);
    if (gap === null || !Number.isFinite(gap) || gap < 1) {
      gap = defaultGapDaysForFrequency(frequency);
    }
    const gapRounded = Math.max(1, Math.round(gap));
    const confidence = patternConfidence(occurrences);

    let next = addCalendarDays(parseIsoDateLocal(lastIso), gapRounded);
    if (!Number.isFinite(next.getTime())) return;

    while (next.getTime() < today.getTime()) {
      next = addCalendarDays(next, gapRounded);
    }

    while (next.getTime() <= horizonEndTime) {
      const dateStr = toIsoDateStatic(next);
      const signedAmount = kind === 'charge' ? -Math.abs(medianAmount) : Math.abs(medianAmount);
      rows.push({
        date: dateStr,
        payee,
        amount: Number(signedAmount.toFixed(2)),
        frequency,
        kind,
        confidence,
      });
      next = addCalendarDays(next, gapRounded);
    }
  };

  for (const sub of detectSubscriptions(txs)) {
    pushOccurrences(
      sub.lastCharged,
      sub.payee,
      sub.payee.trim().toLowerCase(),
      'charge',
      sub.frequency,
      sub.amount,
      sub.occurrences,
    );
  }

  for (const inc of detectRecurringIncome(txs)) {
    pushOccurrences(
      inc.lastReceived,
      inc.payee,
      inc.payee.trim().toLowerCase(),
      'income',
      inc.frequency,
      inc.amount,
      inc.occurrences,
    );
  }

  const dedupe = new Map<string, ProjectedRecurringItem>();
  for (const row of rows) {
    const key = `${row.date}|${row.kind}|${row.payee.trim().toLowerCase()}`;
    const prev = dedupe.get(key);
    if (!prev || prev.confidence < row.confidence) {
      dedupe.set(key, row);
    }
  }

  return [...dedupe.values()].sort((a, b) => {
    const c = a.date.localeCompare(b.date);
    if (c !== 0) return c;
    if (a.kind !== b.kind) return a.kind === 'charge' ? -1 : 1;
    return a.payee.localeCompare(b.payee);
  });
}

function monthSpendExcludingTransfer(transactions: FinanceTransaction[], year: number, month: number): number {
  const monthKey = `${year}-${`${month}`.padStart(2, '0')}`;
  return Number(
    transactions
      .filter((tx) => tx.date.startsWith(monthKey) && tx.amount < 0 && tx.category !== 'Transfer')
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0)
      .toFixed(2),
  );
}

/** Conservative discretionary buffer: liquid cash minus pace-adjusted rest-of-month spend. */
export function getSafeToSpend(state: FinanceState): number {
  const summary = getFinanceSummary(state);
  const liquid = summary.liquidCash;
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(year, month, 0).getDate();
  const spendSoFar = monthSpendExcludingTransfer(state.transactions, year, month);

  if (dayOfMonth <= 0 || daysInMonth <= 0) return Number(Math.max(0, liquid).toFixed(2));

  const projectedMonthSpend = (spendSoFar / dayOfMonth) * daysInMonth;
  const projectedRest = Math.max(0, projectedMonthSpend - spendSoFar);
  const raw = liquid - projectedRest;
  return Number(Math.max(0, raw).toFixed(2));
}

export interface FinancialHealthScore {
  score: number;
  label: string;
}

/** Composite 0–100 score from budgets, savings rate, categorization, and review status. */
export function getFinancialHealthScore(state: FinanceState): FinancialHealthScore {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  let score = 100;

  const envelopeMode = state.preferences.budgetViewMode === 'envelope';
  const over = envelopeMode
    ? getBudgetEnvelopes(state, year, month).filter((b) => b.status === 'over').length
    : getBudgetStatus(state, year, month).filter((b) => b.status === 'over').length;
  score -= Math.min(36, over * 12);

  const uncategorized = state.transactions.filter(
    (tx) => !tx.category || tx.category === 'Other',
  ).length;
  score -= Math.min(18, uncategorized * 2);

  const monthKey = `${year}-${`${month}`.padStart(2, '0')}`;
  const unreviewed = state.transactions.filter(
    (tx) => tx.date.startsWith(monthKey) && !tx.reviewed,
  ).length;
  score -= Math.min(15, unreviewed);

  const savingsRate = getSavingsRate(state);
  if (savingsRate >= 20) score += 5;
  else if (savingsRate < 5 && getFinanceSummary(state).monthIncome > 0) score -= 8;

  score = Math.round(Math.min(100, Math.max(0, score)));

  let label = 'Solid';
  if (score >= 85) label = 'Strong';
  else if (score >= 70) label = 'Good';
  else if (score >= 50) label = 'Fair';
  else label = 'Needs attention';

  return { score, label };
}

function subscriptionMonthlyEquivalent(sub: DetectedSubscription): number {
  if (sub.frequency === 'monthly') return sub.amount;
  if (sub.frequency === 'weekly') return sub.amount * (52 / 12);
  return sub.amount / 12;
}

function incomeMonthlyEquivalent(inc: DetectedRecurringIncome): number {
  if (inc.frequency === 'monthly') return inc.amount;
  if (inc.frequency === 'weekly') return inc.amount * (52 / 12);
  return inc.amount / 12;
}

export function projectCashFlow(
  state: FinanceState,
  horizonDays: number,
): CashFlowProjection {
  const summary = getFinanceSummary(state);
  const startBalance = summary.liquidCash;
  const threshold = state.preferences.forecastLowBalanceThreshold;
  const subs = detectSubscriptions(state.transactions);
  const incomes = detectRecurringIncome(state.transactions);

  const monthlyOut = subs.reduce((sum, s) => sum + subscriptionMonthlyEquivalent(s), 0);
  const monthlyIn = incomes.reduce((sum, i) => sum + incomeMonthlyEquivalent(i), 0);
  const dailyNet = (monthlyIn - monthlyOut) / 30.44;

  const points: CashFlowProjectionPoint[] = [];
  const belowThresholdDates: string[] = [];

  const start = new Date();
  start.setHours(0, 0, 0, 0);

  for (let d = 0; d <= Math.max(1, horizonDays); d += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + d);
    const iso = toIsoDateStatic(day);
    const balance = Number((startBalance + dailyNet * d).toFixed(2));
    points.push({ date: iso, balance });
    if (threshold > 0 && balance < threshold) {
      belowThresholdDates.push(iso);
    }
  }

  return {
    points,
    belowThresholdDates,
    startBalance,
    horizonDays: Math.max(1, horizonDays),
  };
}

function toIsoDateStatic(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function setForecastLowBalanceThreshold(state: FinanceState, threshold: number): FinanceState {
  const n = Number(threshold);
  const safe = Number.isFinite(n) && n >= 0 ? n : state.preferences.forecastLowBalanceThreshold;
  return {
    ...state,
    preferences: { ...state.preferences, forecastLowBalanceThreshold: safe },
  };
}

// ─── Budget management ────────────────────────────────────────────────────────

export function setBudget(state: FinanceState, category: string, limit: number): FinanceState {
  const existing = state.budgets.find((b) => b.category === category);

  if (existing) {
    return {
      ...state,
      budgets: state.budgets.map((b) =>
        b.category === category ? normalizeBudget({ ...b, monthlyLimit: limit }) : normalizeBudget(b),
      ),
    };
  }

  const newBudget: Budget = {
    id: createId('bgt'),
    category,
    monthlyLimit: limit,
    createdAt: new Date().toISOString(),
    rollover: true,
  };

  return {
    ...state,
    budgets: [...state.budgets, newBudget],
  };
}

export function removeBudget(state: FinanceState, category: string): FinanceState {
  return {
    ...state,
    budgets: state.budgets.filter((b) => b.category !== category),
  };
}

export function getBudgetStatus(
  state: FinanceState,
  year: number,
  month: number,
): BudgetStatus[] {
  const breakdown = getCategoryBreakdown(state.transactions, year, month);
  const spentByCategory: Record<string, number> = {};

  for (const item of breakdown) {
    spentByCategory[item.category] = item.total;
  }

  return state.budgets.map((budget) => {
    const spent = spentByCategory[budget.category] ?? 0;
    const pct = budget.monthlyLimit > 0 ? spent / budget.monthlyLimit : 0;

    return {
      category: budget.category,
      limit: budget.monthlyLimit,
      spent: Number(spent.toFixed(2)),
      pct: Number(pct.toFixed(4)),
      status: pct >= 1 ? 'over' : pct >= 0.7 ? 'warning' : 'ok',
    };
  });
}

function padMonth(m: number): string {
  return `${m}`.padStart(2, '0');
}

function monthKey(year: number, month: number): string {
  return `${year}-${padMonth(month)}`;
}

function monthSpendForCategory(
  transactions: FinanceTransaction[],
  year: number,
  month: number,
  category: string,
): number {
  const key = monthKey(year, month);
  return Number(
    transactions
      .filter(
        (tx) =>
          tx.date.startsWith(key) && tx.amount < 0 && tx.category !== 'Transfer' && tx.category === category,
      )
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0)
      .toFixed(2),
  );
}

function budgetCreationMonthIndex(createdAt: string): number {
  const t = Date.parse(createdAt);
  const d = Number.isNaN(t) ? new Date(0) : new Date(t);
  return d.getFullYear() * 12 + d.getMonth();
}

function targetMonthIndex(year: number, month: number): number {
  return year * 12 + (month - 1);
}

/**
 * Envelope / zero-based view: for each budget, assigned (= monthlyLimit for the month),
 * carry-in from prior months (from creation month through M-1), spent in M, and available.
 *
 * Rollover true: end-of-month balance (assigned + carriedIn - spent) rolls fully (surplus and debt).
 * Rollover false: surplus is dropped at month end; negative balance (debt) still rolls forward.
 */
export function getBudgetEnvelopes(
  state: FinanceState,
  year: number,
  month: number,
): BudgetEnvelopeRow[] {
  const tIdx = targetMonthIndex(year, month);

  return state.budgets.map((budget) => {
    const b = normalizeBudget(budget);
    const assigned = Number(b.monthlyLimit.toFixed(2));
    const startIdx = budgetCreationMonthIndex(b.createdAt);
    const carryBase =
      typeof b.carry === 'number' && Number.isFinite(b.carry) ? Number(b.carry.toFixed(2)) : 0;

    let rolled = carryBase;

    if (tIdx > startIdx) {
      for (let idx = startIdx; idx < tIdx; idx += 1) {
        const y = Math.floor(idx / 12);
        const m = (idx % 12) + 1;
        const spentPrev = monthSpendForCategory(state.transactions, y, m, b.category);
        const envelope = rolled + assigned - spentPrev;
        if (b.rollover) {
          rolled = Number(envelope.toFixed(2));
        } else {
          rolled = Number((envelope < 0 ? envelope : 0).toFixed(2));
        }
      }
    }

    const carriedIn = Number(rolled.toFixed(2));
    const spent = monthSpendForCategory(state.transactions, year, month, b.category);
    const available = Number((carriedIn + assigned - spent).toFixed(2));
    const denom = Math.abs(carriedIn + assigned) > 1e-6 ? Math.abs(carriedIn + assigned) : assigned;
    const pct = denom > 0 ? spent / denom : 0;
    const status: BudgetEnvelopeRow['status'] =
      available < 0 ? 'over' : pct >= 0.7 ? 'warning' : 'ok';

    return {
      budgetId: b.id,
      category: b.category,
      assigned,
      carriedIn,
      spent: Number(spent.toFixed(2)),
      available,
      pct: Number(pct.toFixed(4)),
      status,
    };
  });
}

export function setBudgetViewMode(state: FinanceState, mode: FinancePreferences['budgetViewMode']): FinanceState {
  return {
    ...state,
    preferences: { ...state.preferences, budgetViewMode: mode === 'envelope' ? 'envelope' : 'flow' },
  };
}

export function patchBudget(
  state: FinanceState,
  budgetId: string,
  patch: Partial<Pick<Budget, 'monthlyLimit' | 'rollover' | 'carry'>>,
): FinanceState {
  return {
    ...state,
    budgets: state.budgets.map((b) => {
      if (b.id !== budgetId) return normalizeBudget(b);
      const base = normalizeBudget({ ...b });
      if (patch.monthlyLimit !== undefined) {
        const n = Number(patch.monthlyLimit);
        if (Number.isFinite(n) && n >= 0) base.monthlyLimit = Number(n.toFixed(2));
      }
      if (patch.rollover !== undefined) {
        base.rollover = Boolean(patch.rollover);
      }
      if (patch.carry !== undefined) {
        const c = Number(patch.carry);
        base.carry = Number.isFinite(c) ? Number(c.toFixed(2)) : undefined;
      }
      return base;
    }),
  };
}

// ─── Financial Goals ──────────────────────────────────────────────────────────

export function addGoal(
  state: FinanceState,
  goal: Omit<FinancialGoal, 'id' | 'createdAt'>,
): FinanceState {
  const newGoal: FinancialGoal = {
    ...goal,
    id: createId('goal'),
    createdAt: new Date().toISOString(),
  };

  return {
    ...state,
    goals: [...state.goals, newGoal],
  };
}

export function updateGoalProgress(
  state: FinanceState,
  goalId: string,
  amount: number,
): FinanceState {
  return {
    ...state,
    goals: state.goals.map((g) =>
      g.id === goalId ? { ...g, currentAmount: Number(amount.toFixed(2)) } : g,
    ),
  };
}

export function removeGoal(state: FinanceState, goalId: string): FinanceState {
  return {
    ...state,
    goals: state.goals.filter((g) => g.id !== goalId),
  };
}

export function getGoalStats(goal: FinancialGoal): GoalStats {
  const pct = goal.targetAmount > 0 ? goal.currentAmount / goal.targetAmount : 0;
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
  const now = new Date();
  const target = new Date(goal.targetDate);
  const msLeft = target.getTime() - now.getTime();
  const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
  const monthsLeft = daysLeft / 30.44;
  const monthlyRequired = monthsLeft > 0 ? remaining / monthsLeft : remaining;

  return {
    pct: Number(Math.min(1, pct).toFixed(4)),
    remaining: Number(remaining.toFixed(2)),
    daysLeft,
    monthlyRequired: Number(monthlyRequired.toFixed(2)),
  };
}

// ─── Smart Insights ───────────────────────────────────────────────────────────

export function generateInsights(state: FinanceState): string[] {
  const insights: string[] = [];
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const daysInMonth = new Date(year, month, 0).getDate();
  const dayOfMonth = now.getDate();

  const thisMonth = getCategoryBreakdown(state.transactions, year, month);

  // Previous month
  const prevDate = new Date(year, month - 2, 1);
  const prevMonth = getCategoryBreakdown(
    state.transactions,
    prevDate.getFullYear(),
    prevDate.getMonth() + 1,
  );
  const prevByCategory: Record<string, number> = {};
  for (const item of prevMonth) {
    prevByCategory[item.category] = item.total;
  }

  // Month-over-month category changes
  for (const item of thisMonth.slice(0, 3)) {
    const prev = prevByCategory[item.category];
    if (prev && prev > 0) {
      const change = ((item.total - prev) / prev) * 100;
      if (Math.abs(change) >= 10) {
        const dir = change > 0 ? 'more' : 'less';
        insights.push(
          `${item.category}: $${item.total.toFixed(0)} this month — ${Math.abs(change).toFixed(0)}% ${dir} than last month.`,
        );
      }
    }
  }

  // Biggest single expense
  const monthKey = `${year}-${`${month}`.padStart(2, '0')}`;
  const biggestExpense = [...state.transactions]
    .filter((tx) => tx.date.startsWith(monthKey) && tx.amount < 0 && tx.category !== 'Transfer')
    .sort((a, b) => a.amount - b.amount)[0];

  if (biggestExpense) {
    insights.push(
      `Biggest expense this month: ${biggestExpense.payee} — $${Math.abs(biggestExpense.amount).toFixed(2)}.`,
    );
  }

  // Subscriptions summary
  const subs = detectSubscriptions(state.transactions);
  if (subs.length > 0) {
    const monthlyTotal = subs
      .filter((s) => s.frequency === 'monthly')
      .reduce((sum, s) => sum + s.amount, 0);
    const annualTotal = subs.reduce((sum, s) => sum + s.annualCost, 0);
    const names = subs
      .slice(0, 3)
      .map((s) => s.payee)
      .join(', ');
    insights.push(
      `${subs.length} recurring subscriptions detected — $${monthlyTotal.toFixed(0)}/mo ($${annualTotal.toFixed(0)}/yr). Top: ${names}.`,
    );
  }

  // Budget health
  const budgetStatuses = getBudgetStatus(state, year, month);
  const overBudget = budgetStatuses.filter((b) => b.status === 'over');
  const onTrack = budgetStatuses.filter((b) => b.status === 'ok');

  if (overBudget.length > 0) {
    insights.push(
      `Over budget in ${overBudget.map((b) => b.category).join(', ')} this month.`,
    );
  } else if (onTrack.length > 0 && budgetStatuses.length > 0) {
    insights.push(`${onTrack.length} of ${budgetStatuses.length} budgets on track this month.`);
  }

  // Spending pace
  const totalSpend = thisMonth.reduce((sum, item) => sum + item.total, 0);
  if (totalSpend > 0 && dayOfMonth < daysInMonth) {
    const projectedSpend = (totalSpend / dayOfMonth) * daysInMonth;
    insights.push(
      `Projected spend this month: $${projectedSpend.toFixed(0)} based on your pace so far.`,
    );
  }

  // Unreviewed transactions
  const unreviewed = state.transactions.filter(
    (tx) => tx.date.startsWith(monthKey) && !tx.reviewed,
  ).length;
  const total = state.transactions.filter((tx) => tx.date.startsWith(monthKey)).length;

  if (unreviewed > 0 && total > 0) {
    insights.push(`${total - unreviewed} of ${total} transactions reviewed this month.`);
  }

  // Goals nudge
  for (const goal of state.goals.slice(0, 2)) {
    const stats = getGoalStats(goal);
    if (stats.pct < 1 && stats.monthlyRequired > 0) {
      insights.push(
        `"${goal.name}" goal: save $${stats.monthlyRequired.toFixed(0)}/mo to reach $${goal.targetAmount.toFixed(0)} by ${goal.targetDate}.`,
      );
    }
  }

  return insights.slice(0, 6);
}
