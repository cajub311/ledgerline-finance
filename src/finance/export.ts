import type {
  Budget,
  FinanceAccount,
  FinanceState,
  FinanceTransaction,
  FinancialGoal,
  ImportRecord,
} from './types';

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

function transactionToRow(state: FinanceState, transaction: FinanceTransaction): string[] {
  const account = state.accounts.find((entry) => entry.id === transaction.accountId);

  return [
    transaction.date,
    transaction.payee,
    transaction.amount.toFixed(2),
    transaction.category,
    account?.name ?? transaction.accountId,
    transaction.reviewed ? 'yes' : 'no',
    transaction.source,
    transaction.notes ?? '',
  ];
}

export function buildTransactionsCsv(state: FinanceState): string {
  const rows = [
    ['date', 'payee', 'amount', 'category', 'account', 'reviewed', 'source', 'notes'],
    ...state.transactions
      .slice()
      .sort((left, right) => right.date.localeCompare(left.date))
      .map((transaction) => transactionToRow(state, transaction)),
  ];

  return rows
    .map((row) => row.map((value) => escapeCsv(value)).join(','))
    .join('\n');
}

function accountToRow(account: FinanceAccount): string[] {
  return [
    account.id,
    account.name,
    account.institution,
    account.type,
    account.source,
    account.openingBalance.toFixed(2),
    account.lastSynced,
    account.notes ?? '',
  ];
}

function budgetToRow(budget: Budget): string[] {
  return [budget.id, budget.category, budget.monthlyLimit.toFixed(2), budget.createdAt];
}

function goalToRow(goal: FinancialGoal): string[] {
  return [
    goal.id,
    goal.name,
    goal.targetAmount.toFixed(2),
    goal.currentAmount.toFixed(2),
    goal.targetDate,
    goal.createdAt,
  ];
}

function importToRow(record: ImportRecord): string[] {
  return [
    record.id,
    record.fileName,
    record.format,
    String(record.rows),
    record.importedAt,
    record.note,
  ];
}

/**
 * Human-readable multi-section CSV for spreadsheets or moving data between tools.
 * Lines starting with `#` are comments for humans; most spreadsheet apps ignore them or treat as one column.
 */
export function buildFullLedgerCsv(state: FinanceState): string {
  const generated = new Date().toISOString();
  const header = [
    '# Ledgerline Finance — full export',
    `# generated_utc,${generated}`,
    `# household,${escapeCsv(state.householdName)}`,
    `# currency,${state.currency}`,
    `# preferences.forecast_low_balance_threshold,${String(state.preferences.forecastLowBalanceThreshold)}`,
    '',
    '# section,transactions',
    ['id', 'account_id', 'date', 'payee', 'amount', 'category', 'source', 'reviewed', 'notes'].join(','),
    ...state.transactions
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((t) =>
        [
          t.id,
          t.accountId,
          t.date,
          t.payee,
          t.amount.toFixed(2),
          t.category,
          t.source,
          t.reviewed ? 'yes' : 'no',
          t.notes ?? '',
        ]
          .map((v) => escapeCsv(String(v)))
          .join(','),
      ),
    '',
    '# section,accounts',
    [
      'id',
      'name',
      'institution',
      'type',
      'source',
      'opening_balance',
      'last_synced',
      'notes',
    ].join(','),
    ...state.accounts.map((a) => accountToRow(a).map((v) => escapeCsv(String(v))).join(',')),
    '',
    '# section,budgets',
    ['id', 'category', 'monthly_limit', 'created_at'].join(','),
    ...state.budgets.map((b) => budgetToRow(b).map((v) => escapeCsv(String(v))).join(',')),
    '',
    '# section,goals',
    ['id', 'name', 'target_amount', 'current_amount', 'target_date', 'created_at'].join(','),
    ...state.goals.map((g) => goalToRow(g).map((v) => escapeCsv(String(v))).join(',')),
    '',
    '# section,import_history',
    ['id', 'file_name', 'format', 'rows', 'imported_at', 'note'].join(','),
    ...state.imports.map((r) => importToRow(r).map((v) => escapeCsv(String(v))).join(',')),
  ];

  return header.join('\n');
}
