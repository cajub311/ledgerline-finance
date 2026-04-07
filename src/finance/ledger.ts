import seedData from '../data/financeSeed.json';
import { CATEGORY_OPTIONS, cycleCategory, normalizeCategory } from './categories';
import type {
  FinanceAccount,
  FinanceState,
  FinanceSummary,
  FinanceTransaction,
  ImportRecord,
  ManualTransactionDraft,
  ParsedStatementBatch,
  ParsedStatementRow,
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

  return {
    version: 1,
    householdName: String(seedData.householdName ?? 'Ledgerline'),
    currency: 'USD',
    accounts,
    transactions,
    imports,
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

  return [
    `Net worth ${summary.netWorth.toFixed(2)}`,
    `${summary.unreviewedCount} pending review`,
    `${summary.importedFiles} imports`,
    `${summary.uncategorizedCount} uncategorized`,
  ];
}

export function getCategoryOptions(): string[] {
  return [...CATEGORY_OPTIONS];
}
