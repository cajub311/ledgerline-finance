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
}

export interface FinancialGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  createdAt: string;
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

export interface CashFlowForecastPoint {
  date: string;
  label: string;
  projectedBalance: number;
  recurringDelta: number;
  baselineDelta: number;
}

export interface CashFlowForecast {
  horizonDays: number;
  threshold: number;
  baselineDailyNet: number;
  recurringIncomeMonthly: number;
  recurringExpenseMonthly: number;
  projectedEndBalance: number;
  startingBalance: number;
  minProjectedBalance: number;
  maxProjectedBalance: number;
  lowBalanceDates: string[];
  points: CashFlowForecastPoint[];
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

export interface GoalStats {
  pct: number;
  remaining: number;
  daysLeft: number;
  monthlyRequired: number;
}

export type GuidancePriority = 'high' | 'medium' | 'low';
export type GuidanceCta = 'review' | 'categorize' | 'budgets' | 'subscriptions' | 'goals' | 'none';

export interface GuidanceStep {
  id: string;
  priority: GuidancePriority;
  title: string;
  detail: string;
  cta: GuidanceCta;
}

export interface GuidanceSnapshot {
  safeToSpend: number;
  projectedMonthEndNet: number;
  projectedMonthEndSpend: number;
  monthlySubscriptionBurn: number;
  averageDailySpend: number;
  daysRemainingInMonth: number;
  reviewCompletionPct: number;
  steps: GuidanceStep[];
}

