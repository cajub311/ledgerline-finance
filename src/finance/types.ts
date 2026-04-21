export type AccountType = 'checking' | 'savings' | 'credit' | 'cash' | 'loan' | 'investment';
export type AccountSource = 'imported' | 'manual';
export type ImportFormat = 'csv' | 'xlsx' | 'pdf' | 'text';
export type TransactionSource = 'imported' | 'manual';

export interface FinanceAccount {
  id: string;
  name: string;
  institution: string;
  type: AccountType;
  source: AccountSource;
  openingBalance: number;
  lastSynced: string;
  notes?: string;
}

export interface FinanceTransaction {
  id: string;
  accountId: string;
  date: string;
  payee: string;
  amount: number;
  category: string;
  source: TransactionSource;
  reviewed: boolean;
  notes?: string;
  /** Free-form tags normalized to lower-kebab, max 8 per transaction, max 16 chars each. */
  tags?: string[];
}

export interface ImportRecord {
  id: string;
  fileName: string;
  format: ImportFormat;
  rows: number;
  importedAt: string;
  note: string;
}

export interface Budget {
  id: string;
  category: string;
  monthlyLimit: number;
  createdAt: string;
  /** When true, surplus and debt roll into the next month; when false, surplus does not roll (debt still does) */
  rollover: boolean;
  /** Optional opening envelope balance at the budget start month */
  carry?: number;
}

export interface FinancialGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  createdAt: string;
}

export interface FinancePreferences {
  /** Balance threshold for cash-flow forecast warnings; 0 disables highlights */
  forecastLowBalanceThreshold: number;
  /** Budgets tab: classic limit vs spend, or envelope with rollover */
  budgetViewMode: 'flow' | 'envelope';
}

/** User-defined auto-categorization rule (first match in `rules` order wins). */
export interface FinanceRule {
  id: string;
  /** Optional label for the list UI */
  name?: string;
  /** Regex tested against payee; empty string matches any payee */
  payeePattern: string;
  /** When set, only transactions on this account are considered */
  accountId?: string;
  /** Inclusive lower bound on `amount` (negative for outflows) */
  amountMin?: number;
  /** Inclusive upper bound on `amount` */
  amountMax?: number;
  /** Category applied when the rule matches */
  assignCategory: string;
  /** Optional tags to add to matching transactions (merged with existing). */
  addTags?: string[];
  /** Optional: mark matching transactions as reviewed. */
  markReviewed?: boolean;
}

export interface FinanceState {
  version: 1;
  householdName: string;
  currency: 'USD';
  accounts: FinanceAccount[];
  transactions: FinanceTransaction[];
  imports: ImportRecord[];
  budgets: Budget[];
  goals: FinancialGoal[];
  preferences: FinancePreferences;
  /** Ordered rules for auto-categorization (import + bulk re-apply) */
  rules: FinanceRule[];
}

export interface ManualTransactionDraft {
  accountId: string;
  date: string;
  payee: string;
  amount: string;
  category: string;
  notes: string;
}

export interface ParsedStatementRow {
  date: string;
  payee: string;
  amount: number;
  category: string;
  notes?: string;
}

/**
 * One visual line of a PDF page reconstructed from text items, with each
 * item's x-position preserved so a column-aware parser can tell which
 * numbers are deposits, withdrawals, and running balances.
 */
export interface PdfPageLineItem {
  str: string;
  x: number;
}

export interface PdfPageLine {
  text: string;
  items: PdfPageLineItem[];
}

export interface PdfPageLines {
  lines: PdfPageLine[];
}

export interface ParsedStatementBatch {
  format: ImportFormat;
  rows: ParsedStatementRow[];
  sourceLabel: string;
  notes: string[];
}

export interface FinanceSummary {
  netWorth: number;
  liquidCash: number;
  monthIncome: number;
  monthSpend: number;
  uncategorizedCount: number;
  unreviewedCount: number;
  importedRows: number;
  importedFiles: number;
}

export interface CategoryBreakdownItem {
  category: string;
  total: number;
  pct: number;
}

export interface MonthlyTrendItem {
  label: string;
  monthKey: string;
  income: number;
  spend: number;
}

export interface TopMerchantItem {
  payee: string;
  total: number;
  count: number;
}

export interface DetectedSubscription {
  payee: string;
  amount: number;
  frequency: 'weekly' | 'monthly' | 'annual';
  lastCharged: string;
  annualCost: number;
  occurrences: number;
}

export interface BudgetStatus {
  category: string;
  limit: number;
  spent: number;
  pct: number;
  status: 'ok' | 'warning' | 'over';
}

/** Per-budget envelope row for a calendar month (YNAB-style assign + rollover). */
export interface BudgetEnvelopeRow {
  budgetId: string;
  category: string;
  assigned: number;
  carriedIn: number;
  spent: number;
  available: number;
  pct: number;
  status: 'ok' | 'warning' | 'over';
}

export interface GoalStats {
  pct: number;
  remaining: number;
  daysLeft: number;
  monthlyRequired: number;
}

export interface DetectedRecurringIncome {
  payee: string;
  amount: number;
  frequency: 'weekly' | 'monthly' | 'annual';
  lastReceived: string;
  annualTotal: number;
  occurrences: number;
}

export interface CashFlowProjectionPoint {
  date: string;
  balance: number;
}

export interface CashFlowProjection {
  points: CashFlowProjectionPoint[];
  /** Dates (YYYY-MM-DD) where projected balance is below threshold */
  belowThresholdDates: string[];
  startBalance: number;
  horizonDays: number;
}

/** One month in the net-worth history series (end-of-month balances). */
export interface NetWorthMonthPoint {
  monthKey: string;
  label: string;
  netWorth: number;
  assets: number;
  liabilities: number;
}

/** Projected upcoming charge or income from detected recurring patterns */
export interface ProjectedRecurringItem {
  date: string;
  payee: string;
  amount: number;
  frequency: 'weekly' | 'monthly' | 'annual';
  kind: 'charge' | 'income';
  /** 0–0.95 confidence from pattern strength */
  confidence: number;
}
