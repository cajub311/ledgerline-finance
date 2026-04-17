import * as XLSX from 'xlsx';

import type { FinanceState } from './types';

function sheetFromRows(headers: string[], rows: Array<Record<string, unknown>>): XLSX.WorkSheet {
  const data = [headers, ...rows.map((row) => headers.map((h) => row[h] ?? ''))];
  return XLSX.utils.aoa_to_sheet(data);
}

/** Portable backup: multiple sheets (accounts, transactions, budgets, goals, imports). */
export function buildFinanceBackupWorkbook(state: FinanceState): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  const accountHeaders = ['id', 'name', 'institution', 'type', 'source', 'openingBalance', 'lastSynced', 'notes'];
  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(
      accountHeaders,
      state.accounts.map((a) => ({
        id: a.id,
        name: a.name,
        institution: a.institution,
        type: a.type,
        source: a.source,
        openingBalance: a.openingBalance,
        lastSynced: a.lastSynced,
        notes: a.notes ?? '',
      })),
    ),
    'Accounts',
  );

  const txHeaders = [
    'id',
    'accountId',
    'date',
    'payee',
    'amount',
    'category',
    'source',
    'reviewed',
    'notes',
  ];
  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(
      txHeaders,
      state.transactions.map((t) => ({
        id: t.id,
        accountId: t.accountId,
        date: t.date,
        payee: t.payee,
        amount: t.amount,
        category: t.category,
        source: t.source,
        reviewed: t.reviewed ? 'yes' : 'no',
        notes: t.notes ?? '',
      })),
    ),
    'Transactions',
  );

  const budgetHeaders = ['id', 'category', 'monthlyLimit', 'createdAt'];
  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(
      budgetHeaders,
      state.budgets.map((b) => ({
        id: b.id,
        category: b.category,
        monthlyLimit: b.monthlyLimit,
        createdAt: b.createdAt,
      })),
    ),
    'Budgets',
  );

  const goalHeaders = ['id', 'name', 'targetAmount', 'currentAmount', 'targetDate', 'createdAt'];
  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(
      goalHeaders,
      state.goals.map((g) => ({
        id: g.id,
        name: g.name,
        targetAmount: g.targetAmount,
        currentAmount: g.currentAmount,
        targetDate: g.targetDate,
        createdAt: g.createdAt,
      })),
    ),
    'Goals',
  );

  const importHeaders = ['id', 'fileName', 'format', 'rows', 'importedAt', 'note'];
  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(
      importHeaders,
      state.imports.map((r) => ({
        id: r.id,
        fileName: r.fileName,
        format: r.format,
        rows: r.rows,
        importedAt: r.importedAt,
        note: r.note,
      })),
    ),
    'Import_history',
  );

  const metaHeaders = ['key', 'value'];
  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(metaHeaders, [
      { key: 'version', value: state.version },
      { key: 'householdName', value: state.householdName },
      { key: 'currency', value: state.currency },
      {
        key: 'forecastLowBalanceThreshold',
        value: state.preferences.forecastLowBalanceThreshold,
      },
    ]),
    'Meta',
  );

  return wb;
}

export function financeBackupToXlsxArrayBuffer(state: FinanceState): ArrayBuffer {
  const wb = buildFinanceBackupWorkbook(state);
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
}
