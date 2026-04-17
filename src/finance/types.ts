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
  /** When true (default), surplus and debt roll into the next month; when false, surplus does not roll but debt still does. */
  rollover: boolean;
  /** Optional manual adjustment added to starting carry-in for the budget’s first active month. */
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
  /** When true, Budgets and the dashboard “over budget” count use envelope rollover math. */
  envelopeBudgeting?: boolean;
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

/** Per-budget envelope view for a calendar month (YNAB-style rollover). */
export interface BudgetEnvelope {
  budgetId: string;
  category: string;
  assigned: number;
  carriedIn: number;
  spent: number;
  available: number;
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
