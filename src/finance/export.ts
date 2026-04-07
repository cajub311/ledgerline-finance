import type { FinanceState, FinanceTransaction } from './types';

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
