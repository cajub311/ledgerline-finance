import type { FinanceState, FinanceTransaction, ParsedStatementRow } from './types';

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

/** Canonical CSV for the mapping wizard after PDF/XLSX auto-extract (standard column names). */
export function buildWizardCsvFromParsedRows(rows: ParsedStatementRow[]): string {
  const header = ['date', 'payee', 'amount', 'category', 'notes'];
  const lines = [
    header.join(','),
    ...rows.map((row) =>
      [
        row.date,
        row.payee,
        row.amount.toFixed(2),
        row.category,
        row.notes ?? '',
      ]
        .map((value) => escapeCsv(String(value)))
        .join(','),
    ),
  ];
  return lines.join('\n');
}

export async function buildLedgerWorkbookBuffer(state: FinanceState): Promise<ArrayBuffer> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  const txHeader = ['date', 'payee', 'amount', 'category', 'account', 'reviewed', 'source', 'notes'];
  const txRows = [
    txHeader,
    ...state.transactions
      .slice()
      .sort((left, right) => right.date.localeCompare(left.date))
      .map((transaction) => transactionToRow(state, transaction)),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(txRows), 'Transactions');

  const accHeader = ['name', 'institution', 'type', 'opening_balance', 'last_synced', 'notes'];
  const accRows = [
    accHeader,
    ...state.accounts.map((a) => [
      a.name,
      a.institution,
      a.type,
      a.openingBalance.toFixed(2),
      a.lastSynced,
      a.notes ?? '',
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(accRows), 'Accounts');

  const budgetHeader = ['category', 'monthly_limit', 'created_at'];
  const budgetRows = [
    budgetHeader,
    ...state.budgets.map((b) => [b.category, b.monthlyLimit.toFixed(2), b.createdAt]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(budgetRows), 'Budgets');

  const goalHeader = ['name', 'target_amount', 'current_amount', 'target_date', 'created_at'];
  const goalRows = [
    goalHeader,
    ...state.goals.map((g) => [
      g.name,
      g.targetAmount.toFixed(2),
      g.currentAmount.toFixed(2),
      g.targetDate,
      g.createdAt,
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(goalRows), 'Goals');

  const impHeader = ['file_name', 'format', 'rows', 'imported_at', 'note'];
  const impRows = [
    impHeader,
    ...state.imports.map((r) => [r.fileName, r.format, String(r.rows), r.importedAt, r.note]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(impRows), 'Import_history');

  const metaRows = [
    ['household_name', state.householdName],
    ['currency', state.currency],
    ['forecast_low_balance_threshold', String(state.preferences.forecastLowBalanceThreshold)],
    ['exported_at', new Date().toISOString()],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(metaRows), 'Meta');

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as Uint8Array;
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
}
