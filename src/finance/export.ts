import type {
  FinanceAccount,
  FinanceState,
  FinanceTransaction,
  MonthlyTrendItem,
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

export interface CsvBuildOptions {
  /** Optional filter — pass a pre-filtered list to export only those rows. */
  transactions?: FinanceTransaction[];
}

export function buildTransactionsCsv(state: FinanceState, options: CsvBuildOptions = {}): string {
  const source = options.transactions ?? state.transactions;
  const rows = [
    ['date', 'payee', 'amount', 'category', 'account', 'reviewed', 'source', 'notes'],
    ...source
      .slice()
      .sort((left, right) => right.date.localeCompare(left.date))
      .map((transaction) => transactionToRow(state, transaction)),
  ];

  return rows
    .map((row) => row.map((value) => escapeCsv(value)).join(','))
    .join('\n');
}

// ─── QIF (Quicken Interchange Format) ────────────────────────────────────────
// Widely accepted by Quicken, GnuCash, Moneydance, Banktivity, and many others.
// We emit one file per account since QIF is single-account per block.

function formatQifDate(iso: string): string {
  // QIF expects MM/DD/YYYY (or MM/DD'YY); use 4-digit year form.
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${m}/${d}/${y}`;
}

function qifHeaderForAccount(account: FinanceAccount): string {
  const type =
    account.type === 'credit' || account.type === 'loan'
      ? 'CCard'
      : account.type === 'cash'
        ? 'Cash'
        : account.type === 'investment'
          ? 'Invst'
          : 'Bank';
  return `!Type:${type}`;
}

export function buildAccountQif(state: FinanceState, accountId: string): string {
  const account = state.accounts.find((a) => a.id === accountId);
  if (!account) return '';
  const txs = state.transactions
    .filter((tx) => tx.accountId === accountId)
    .sort((a, b) => a.date.localeCompare(b.date));

  const lines: string[] = [qifHeaderForAccount(account)];
  for (const tx of txs) {
    lines.push(`D${formatQifDate(tx.date)}`);
    lines.push(`T${tx.amount.toFixed(2)}`);
    lines.push(`P${tx.payee}`);
    lines.push(`L${tx.category}`);
    if (tx.notes) lines.push(`M${tx.notes.replace(/\n+/g, ' ')}`);
    lines.push('^');
  }
  return lines.join('\n') + '\n';
}

/** Build a single-file QIF containing multiple accounts using !Account blocks. */
export function buildMultiAccountQif(state: FinanceState): string {
  const parts: string[] = [];
  for (const account of state.accounts) {
    parts.push('!Account');
    parts.push(`N${account.name}`);
    const type =
      account.type === 'credit' || account.type === 'loan'
        ? 'CCard'
        : account.type === 'cash'
          ? 'Cash'
          : account.type === 'investment'
            ? 'Invst'
            : 'Bank';
    parts.push(`T${type}`);
    parts.push('^');
    parts.push(buildAccountQif(state, account.id).trimEnd());
  }
  return parts.join('\n') + '\n';
}

// ─── OFX 1.0.2 / 2.1 (SGML-ish; widely accepted) ─────────────────────────────

function ofxDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${y}${m}${d}`;
}

function ofxFitId(tx: FinanceTransaction): string {
  // Stable ID derived from date + amount + payee hash-ish.
  const hash = tx.payee.replace(/[^A-Za-z0-9]/g, '').slice(0, 10).toUpperCase();
  return `${ofxDate(tx.date)}${tx.amount.toFixed(2).replace('.', '').replace('-', 'N')}${hash || 'X'}`.slice(0, 32);
}

export function buildAccountOfx(state: FinanceState, accountId: string): string {
  const account = state.accounts.find((a) => a.id === accountId);
  if (!account) return '';
  const txs = state.transactions
    .filter((tx) => tx.accountId === accountId)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (txs.length === 0) return '';
  const start = ofxDate(txs[0].date);
  const end = ofxDate(txs[txs.length - 1].date);
  const isCredit = account.type === 'credit';
  const msgSet = isCredit ? 'CREDITCARDMSGSRSV1' : 'BANKMSGSRSV1';
  const stmt = isCredit ? 'CCSTMTTRNRS' : 'STMTTRNRS';
  const stmtRs = isCredit ? 'CCSTMTRS' : 'STMTRS';
  const acctFrom = isCredit ? 'CCACCTFROM' : 'BANKACCTFROM';

  const now = new Date();
  const nowStr =
    `${now.getFullYear()}${`${now.getMonth() + 1}`.padStart(2, '0')}${`${now.getDate()}`.padStart(2, '0')}` +
    `${`${now.getHours()}`.padStart(2, '0')}${`${now.getMinutes()}`.padStart(2, '0')}${`${now.getSeconds()}`.padStart(2, '0')}`;

  const body = [
    `<OFX>`,
    `  <SIGNONMSGSRSV1><SONRS><STATUS><CODE>0</CODE><SEVERITY>INFO</SEVERITY></STATUS><DTSERVER>${nowStr}</DTSERVER><LANGUAGE>ENG</LANGUAGE></SONRS></SIGNONMSGSRSV1>`,
    `  <${msgSet}>`,
    `    <${stmt}>`,
    `      <TRNUID>1</TRNUID><STATUS><CODE>0</CODE><SEVERITY>INFO</SEVERITY></STATUS>`,
    `      <${stmtRs}>`,
    `        <CURDEF>USD</CURDEF>`,
    `        <${acctFrom}>`,
    !isCredit ? `          <BANKID>LEDGERLINE</BANKID>` : '',
    `          <ACCTID>${account.id}</ACCTID>`,
    !isCredit
      ? `          <ACCTTYPE>${account.type === 'savings' ? 'SAVINGS' : 'CHECKING'}</ACCTTYPE>`
      : '',
    `        </${acctFrom}>`,
    `        <BANKTRANLIST>`,
    `          <DTSTART>${start}</DTSTART><DTEND>${end}</DTEND>`,
    ...txs.map((tx) =>
      [
        `          <STMTTRN>`,
        `            <TRNTYPE>${tx.amount >= 0 ? 'CREDIT' : 'DEBIT'}</TRNTYPE>`,
        `            <DTPOSTED>${ofxDate(tx.date)}</DTPOSTED>`,
        `            <TRNAMT>${tx.amount.toFixed(2)}</TRNAMT>`,
        `            <FITID>${ofxFitId(tx)}</FITID>`,
        `            <NAME>${escapeOfxText(tx.payee)}</NAME>`,
        tx.notes ? `            <MEMO>${escapeOfxText(tx.notes)}</MEMO>` : '',
        `          </STMTTRN>`,
      ]
        .filter(Boolean)
        .join('\n'),
    ),
    `        </BANKTRANLIST>`,
    `      </${stmtRs}>`,
    `    </${stmt}>`,
    `  </${msgSet}>`,
    `</OFX>`,
  ]
    .filter(Boolean)
    .join('\n');

  // OFX 1.0 header keeps it compatible with Quicken/etc.
  return (
    `OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\nSECURITY:NONE\nENCODING:USASCII\nCHARSET:1252\n` +
    `COMPRESSION:NONE\nOLDFILEUID:NONE\nNEWFILEUID:NONE\n\n${body}\n`
  );
}

function escapeOfxText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ─── Helper: monthly summary for PDF headers ─────────────────────────────────

export function summarizeMonth(
  state: FinanceState,
  trend: MonthlyTrendItem[] | undefined,
): { income: number; spend: number; net: number } {
  const row = trend?.[trend.length - 1];
  if (row) return { income: row.income, spend: row.spend, net: row.income - row.spend };
  const now = new Date();
  const key = `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, '0')}`;
  let income = 0;
  let spend = 0;
  for (const tx of state.transactions) {
    if (!tx.date.startsWith(key)) continue;
    if (tx.amount > 0) income += tx.amount;
    else spend += Math.abs(tx.amount);
  }
  return { income, spend, net: income - spend };
}
