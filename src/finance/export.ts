import type { FinanceState, FinanceTransaction } from './types';

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function transactionToRow(state: FinanceState, transaction: FinanceTransaction): string[] {
  const account = state.accounts.find((entry) => entry.id === transaction.accountId);
  const isIncome = transaction.amount > 0;
  const debit = isIncome ? '' : Math.abs(transaction.amount).toFixed(2);
  const credit = isIncome ? transaction.amount.toFixed(2) : '';

  return [
    transaction.date,
    transaction.payee,
    transaction.amount.toFixed(2),
    debit,
    credit,
    transaction.category,
    account?.name ?? transaction.accountId,
    account?.institution ?? '',
    transaction.reviewed ? 'Yes' : 'No',
    transaction.source,
    transaction.notes ?? '',
    transaction.id,
  ];
}

const CSV_HEADERS = [
  'Date',
  'Payee',
  'Amount',
  'Debit',
  'Credit',
  'Category',
  'Account',
  'Institution',
  'Reviewed',
  'Source',
  'Notes',
  'Transaction ID',
];

export function buildTransactionsCsv(state: FinanceState): string {
  const rows = [
    CSV_HEADERS,
    ...state.transactions
      .slice()
      .sort((left, right) => right.date.localeCompare(left.date))
      .map((transaction) => transactionToRow(state, transaction)),
  ];

  return rows
    .map((row) => row.map((value) => escapeCsv(value)).join(','))
    .join('\r\n');
}
