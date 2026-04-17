import type { FinanceState, FinanceTransaction } from './types';
import { formatCurrencyPlain } from '../utils/format';
import { getAccountsWithBalances, getFinanceSummary } from './ledger';

export interface PdfStatementOptions {
  /** Restrict to transactions matching YYYY-MM (month filter). */
  month?: string;
  /** Restrict to a single accountId. */
  accountId?: string;
  /** Title override (otherwise inferred). */
  title?: string;
  /** Subtitle override. */
  subtitle?: string;
}

/**
 * Render a print-ready PDF statement of the ledger.
 * Uses jsPDF + jsPDF-AutoTable, imported lazily so native platforms don't bundle them.
 */
export async function buildStatementPdf(
  state: FinanceState,
  options: PdfStatementOptions = {},
): Promise<Blob> {
  const [{ default: jsPDF }, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  // jspdf-autotable is registered as a side-effect import in recent versions,
  // but we still fetch its default (function) fallback when needed.
  const autoTable =
    (autoTableModule as { default?: (doc: unknown, config: unknown) => void }).default ??
    (autoTableModule as unknown as (doc: unknown, config: unknown) => void);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();

  const accounts = getAccountsWithBalances(state);
  const filtered = filterTransactions(state.transactions, options);
  const summary = getFinanceSummary(state);

  const title =
    options.title ??
    (options.month
      ? `Statement — ${monthLabel(options.month)}`
      : options.accountId
        ? `Statement — ${accounts.find((a) => a.id === options.accountId)?.name ?? 'Account'}`
        : 'Ledgerline — Full statement');

  const subtitle =
    options.subtitle ??
    `${state.householdName} · Generated ${new Date().toLocaleString()}`;

  // Header
  doc.setFillColor(74, 91, 240);
  doc.rect(0, 0, pageWidth, 64, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Ledgerline', 36, 30);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Personal finance statement', 36, 48);

  // Title block
  doc.setTextColor(20, 24, 41);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(title, 36, 96);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(90, 100, 128);
  doc.text(subtitle, 36, 112);

  // Summary box
  const periodIncome = filtered.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const periodSpend = filtered
    .filter((t) => t.amount < 0 && t.category !== 'Transfer')
    .reduce((s, t) => s + Math.abs(t.amount), 0);
  const periodNet = periodIncome - periodSpend;

  const boxY = 128;
  const boxH = 72;
  doc.setDrawColor(220, 225, 240);
  doc.setFillColor(246, 247, 253);
  doc.roundedRect(36, boxY, pageWidth - 72, boxH, 6, 6, 'FD');

  const cellW = (pageWidth - 72) / 4;
  const cells: Array<{ label: string; value: string; color?: [number, number, number] }> = [
    { label: 'Transactions', value: `${filtered.length}` },
    { label: 'Income (period)', value: formatCurrencyPlain(periodIncome), color: [18, 162, 106] },
    { label: 'Spend (period)', value: formatCurrencyPlain(periodSpend), color: [200, 58, 49] },
    {
      label: 'Net (period)',
      value: formatCurrencyPlain(periodNet),
      color: periodNet >= 0 ? [18, 162, 106] : [200, 58, 49],
    },
  ];

  cells.forEach((cell, idx) => {
    const x = 36 + cellW * idx + 12;
    doc.setTextColor(110, 118, 140);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(cell.label.toUpperCase(), x, boxY + 22);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...(cell.color ?? [20, 24, 41]));
    doc.text(cell.value, x, boxY + 46);
  });

  // Extra context line
  doc.setTextColor(90, 100, 128);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(
    `Net worth ${formatCurrencyPlain(summary.netWorth)} · Liquid cash ${formatCurrencyPlain(
      summary.liquidCash,
    )} · Accounts ${accounts.length}`,
    36,
    boxY + boxH + 16,
  );

  // Transaction table
  const rows = filtered
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((tx) => {
      const acct = accounts.find((a) => a.id === tx.accountId);
      return [
        tx.date,
        tx.payee,
        tx.category,
        acct?.name ?? '—',
        formatCurrencyPlain(tx.amount),
      ];
    });

  autoTable(doc, {
    startY: boxY + boxH + 28,
    head: [['Date', 'Payee', 'Category', 'Account', 'Amount']],
    body: rows,
    theme: 'striped',
    headStyles: {
      fillColor: [74, 91, 240],
      textColor: 255,
      fontSize: 9,
      fontStyle: 'bold',
    },
    bodyStyles: { fontSize: 9, textColor: [30, 36, 55] },
    alternateRowStyles: { fillColor: [246, 247, 253] },
    columnStyles: {
      0: { cellWidth: 70 },
      2: { cellWidth: 90 },
      3: { cellWidth: 110 },
      4: { halign: 'right', cellWidth: 80 },
    },
    margin: { left: 36, right: 36 },
    didDrawPage: (data: { pageNumber: number }) => {
      const pageNum = data.pageNumber;
      const totalPages = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(140, 148, 170);
      doc.text(
        `Page ${pageNum} of ${totalPages} · Ledgerline (local-first)`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 18,
        { align: 'center' },
      );
    },
  });

  const blob = doc.output('blob');
  return blob as Blob;
}

function filterTransactions(
  transactions: FinanceTransaction[],
  options: PdfStatementOptions,
): FinanceTransaction[] {
  return transactions.filter((tx) => {
    if (options.month && !tx.date.startsWith(options.month)) return false;
    if (options.accountId && tx.accountId !== options.accountId) return false;
    return true;
  });
}

function monthLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  if (Number.isNaN(d.getTime())) return yyyymm;
  return d.toLocaleString('default', { month: 'long', year: 'numeric' });
}
