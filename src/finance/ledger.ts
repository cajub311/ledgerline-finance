import seedData from '../data/financeSeed.json';
import { CATEGORY_ICONS, CATEGORY_OPTIONS, cycleCategory, normalizeCategory } from './categories';
import type {
  Budget,
  BudgetStatus,
  CategoryBreakdownItem,
  DetectedSubscription,
  FinanceAccount,
  FinancialGoal,
  FinanceState,
  FinanceSummary,
  FinanceTransaction,
  GoalStats,
  ImportRecord,
  ManualTransactionDraft,
  MonthlyTrendItem,
  ParsedStatementBatch,
  ParsedStatementRow,
  TopMerchantItem,
} from './types';

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

function cloneBudgets(budgets: Budget[]): Budget[] {
  return budgets.map((b) => ({ ...b }));
}

function cloneGoals(goals: FinancialGoal[]): FinancialGoal[] {
  return goals.map((g) => ({ ...g }));
}

function normalizeTransaction(transaction: FinanceTransaction): FinanceTransaction {
  return {
    ...transaction,
    category: normalizeCategory(transaction.category, transaction.payee),
    notes: transaction.notes?.trim() || undefined,
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

export function createFinanceState(): FinanceState {
  const accounts = cloneAccounts(seedData.accounts as FinanceAccount[]);
  const transactions = cloneTransactions(seedData.transactions as FinanceTransaction[]).map(
    normalizeTransaction,
  );
  const imports = cloneImports(seedData.imports as ImportRecord[]);
  const budgets = cloneBudgets((seedData as { budgets?: Budget[] }).budgets ?? []);
  const goals = cloneGoals((seedData as { goals?: FinancialGoal[] }).goals ?? []);

  return {
    version: 1,
    householdName: String(seedData.householdName ?? 'Ledgerline'),
    currency: 'USD',
    accounts,
    transactions,
    imports,
    budgets,
    goals,
  };
}

export function rehydrateFinanceState(snapshot: Partial<FinanceState> | null | undefined): FinanceState {
  const seed = createFinanceState();

  if (!snapshot) {
    return seed;
  }

  return {
    version: 1,
    householdName: snapshot.householdName ?? seed.householdName,
    currency: snapshot.currency ?? 'USD',
    accounts: cloneAccounts(snapshot.accounts?.length ? (snapshot.accounts as FinanceAccount[]) : seed.accounts),
    transactions: cloneTransactions(
      snapshot.transactions?.length ? (snapshot.transactions as FinanceTransaction[]) : seed.transactions,
    ).map(normalizeTransaction),
    imports: cloneImports(snapshot.imports?.length ? (snapshot.imports as ImportRecord[]) : seed.imports),
    budgets: cloneBudgets(snapshot.budgets ?? seed.budgets),
    goals: cloneGoals(snapshot.goals ?? seed.goals),
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

export interface TransactionEdits {
  payee?: string;
  amount?: number;
  date?: string;
  category?: string;
  notes?: string;
}

/** Apply an arbitrary set of field edits to a single transaction. */
export function editTransaction(
  state: FinanceState,
  transactionId: string,
  edits: TransactionEdits,
): FinanceState {
  return {
    ...state,
    transactions: state.transactions.map((transaction) =>
      transaction.id === transactionId
        ? {
            ...transaction,
            ...(edits.payee !== undefined && edits.payee.trim() ? { payee: edits.payee.trim() } : {}),
            ...(edits.amount !== undefined && Number.isFinite(edits.amount) ? { amount: edits.amount } : {}),
            ...(edits.date !== undefined && edits.date.trim() ? { date: edits.date.trim() } : {}),
            ...(edits.category !== undefined && edits.category.trim() ? { category: normalizeCategory(edits.category.trim(), transaction.payee) } : {}),
            ...(edits.notes !== undefined ? { notes: edits.notes.trim() || undefined } : {}),
          }
        : transaction,
    ),
  };
}

function mapImportedRowToTransaction(
  row: ParsedStatementRow,
  accountId: string,
  sourceLabel: string,
): FinanceTransaction {
  return normalizeTransaction({
    id: createId('tx'),
    accountId,
    date: row.date,
    payee: row.payee,
    amount: row.amount,
    category: normalizeCategory(row.category, row.payee),
    source: 'imported',
    reviewed: false,
    notes: row.notes ?? sourceLabel,
  });
}

export function applyImportedBatch(
  state: FinanceState,
  accountId: string,
  batch: ParsedStatementBatch,
): FinanceState {
  const existingKeys = new Set(state.transactions.map(getTransactionKey));
  const incoming = batch.rows.map((row) => mapImportedRowToTransaction(row, accountId, batch.sourceLabel));
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

export function hasUnreviewedTransactions(state: FinanceState): boolean {
  return state.transactions.some((transaction) => !transaction.reviewed);
}

export function getLatestTransactions(state: FinanceState, limit = 16): FinanceTransaction[] {
  return [...state.transactions]
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, limit);
}

export function getAccountsWithBalances(
  state: FinanceState,
): Array<FinanceAccount & { currentBalance: number; kindLabel: string }> {
  return getAccountBalances(state).map((account) => ({
    ...account,
    kindLabel:
      account.type === 'credit' || account.type === 'loan'
        ? 'Liability'
        : account.source === 'manual'
          ? 'Manual'
          : 'Imported',
  }));
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

// ─── Budget management ────────────────────────────────────────────────────────

export function setBudget(state: FinanceState, category: string, limit: number): FinanceState {
  const existing = state.budgets.find((b) => b.category === category);

  if (existing) {
    return {
      ...state,
      budgets: state.budgets.map((b) =>
        b.category === category ? { ...b, monthlyLimit: limit } : b,
      ),
    };
  }

  const newBudget: Budget = {
    id: createId('bgt'),
    category,
    monthlyLimit: limit,
    createdAt: new Date().toISOString(),
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
