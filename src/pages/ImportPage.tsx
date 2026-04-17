import { useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { buildTransactionsCsv, buildTransactionsXlsxBuffer } from '../finance/export';
import { parseStatementBlob } from '../finance/import';
import {
  mappingIsComplete,
  parseDelimitedWithMapping,
  parseStatementText,
  previewDelimitedCsv,
  rolesToMapping,
  suggestColumnRoles,
  type WizardColumnRole,
} from '../finance/import.shared';
import {
  applyImportedBatch,
  getAccountsWithBalances,
} from '../finance/ledger';
import { parseFinanceBackupJson, serializeFinanceState } from '../finance/backup';
import type { FinanceState } from '../finance/types';
import { useTheme } from '../theme/ThemeContext';
import { radius, spacing, typography } from '../theme/tokens';
import { formatCurrency, getErrorMessage } from '../utils/format';
import { pickWebStatementFiles } from '../utils/webFilePicker';

interface ImportPageProps {
  state: FinanceState;
  onStateChange: (next: FinanceState) => void;
}

export function ImportPage({ state, onStateChange }: ImportPageProps) {
  const { palette } = useTheme();
  const accounts = useMemo(() => getAccountsWithBalances(state), [state]);

  const [accountId, setAccountId] = useState<string>(accounts[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [pasted, setPasted] = useState('');
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState<'info' | 'success' | 'danger'>('info');

  const [wizardCsvText, setWizardCsvText] = useState('');
  const [wizardSourceLabel, setWizardSourceLabel] = useState('');
  const [wizardRoles, setWizardRoles] = useState<WizardColumnRole[]>([]);
  const [wizardHeaders, setWizardHeaders] = useState<string[]>([]);
  const [wizardPreviewRows, setWizardPreviewRows] = useState<string[][]>([]);

  const webOnly = Platform.OS === 'web';

  const notify = (text: string, kind: 'info' | 'success' | 'danger' = 'info') => {
    setMessage(text);
    setTone(kind);
  };

  const wizardMapping = useMemo(
    () => rolesToMapping(wizardHeaders.length, wizardRoles),
    [wizardHeaders.length, wizardRoles],
  );
  const wizardReady = mappingIsComplete(wizardMapping);
  const wizardParsedCount = useMemo(() => {
    if (!wizardReady || !wizardCsvText.trim()) return 0;
    return parseDelimitedWithMapping(wizardCsvText, wizardRoles).length;
  }, [wizardCsvText, wizardRoles, wizardReady]);

  const ROLE_OPTIONS: ReadonlyArray<{ value: WizardColumnRole; label: string }> = [
    { value: 'ignore', label: 'Ignore' },
    { value: 'date', label: 'Date' },
    { value: 'payee', label: 'Description / payee' },
    { value: 'amount', label: 'Amount (signed)' },
    { value: 'debit', label: 'Debit' },
    { value: 'credit', label: 'Credit' },
    { value: 'category', label: 'Category' },
  ];

  const loadWizardFromText = (text: string, sourceLabel: string) => {
    const trimmed = text.trim();
    const preview = previewDelimitedCsv(trimmed, 10);
    if (!preview) {
      notify('Need a header row plus at least one data row.', 'danger');
      return;
    }
    setWizardCsvText(trimmed);
    setWizardSourceLabel(sourceLabel);
    setWizardHeaders(preview.headers);
    setWizardPreviewRows(preview.rows);
    setWizardRoles(suggestColumnRoles(preview.headers));
    notify(`Loaded ${preview.headers.length} columns — confirm mappings below.`, 'info');
  };

  const handleWizardCsvFile = async () => {
    if (!webOnly) {
      notify('CSV wizard file pick works on the web.', 'danger');
      return;
    }
    try {
      setBusy(true);
      const files = await pickWebStatementFiles();
      const file = files.find((f) => {
        const n = f.name.toLowerCase();
        return n.endsWith('.csv') || n.endsWith('.tsv') || n.endsWith('.txt');
      });
      if (!file) {
        notify('Select a .csv or .tsv file for the mapping wizard.', 'danger');
        return;
      }
      const text = await file.text();
      loadWizardFromText(text, file.name);
    } catch (error) {
      notify(`Could not read file: ${getErrorMessage(error)}`, 'danger');
    } finally {
      setBusy(false);
    }
  };

  const clearWizard = () => {
    setWizardCsvText('');
    setWizardSourceLabel('');
    setWizardRoles([]);
    setWizardHeaders([]);
    setWizardPreviewRows([]);
  };

  const applyWizardImport = () => {
    if (!accountId) {
      notify('Add an account first.', 'danger');
      return;
    }
    if (!wizardReady) {
      notify('Map date, description, and either amount or debit/credit columns.', 'danger');
      return;
    }
    const rows = parseDelimitedWithMapping(wizardCsvText, wizardRoles);
    if (rows.length === 0) {
      notify('No valid rows after mapping — check your columns.', 'danger');
      return;
    }
    const batch = {
      format: 'csv' as const,
      rows,
      sourceLabel: wizardSourceLabel || 'csv-wizard',
      notes: ['Imported via CSV column mapping wizard.'],
    };
    const before = state.transactions.length;
    const next = applyImportedBatch(state, accountId, batch);
    const added = next.transactions.length - before;
    onStateChange(next);
    clearWizard();
    notify(
      `Imported ${added} transaction${added === 1 ? '' : 's'}${rows.length - added > 0 ? `, ${rows.length - added} duplicate${rows.length - added === 1 ? '' : 's'} skipped` : ''}.`,
      'success',
    );
  };

  const handleFilePick = async () => {
    if (!accountId) {
      notify('Add an account first.', 'danger');
      return;
    }
    try {
      setBusy(true);
      const files = await pickWebStatementFiles();
      if (files.length === 0) {
        setBusy(false);
        return;
      }
      let imported = 0;
      let skipped = 0;
      let workingState = state;
      for (const file of files) {
        const batch = await parseStatementBlob(file);
        const before = workingState.transactions.length;
        workingState = applyImportedBatch(workingState, accountId, batch);
        const added = workingState.transactions.length - before;
        imported += added;
        skipped += batch.rows.length - added;
      }
      onStateChange(workingState);
      notify(
        `Imported ${imported} transaction${imported === 1 ? '' : 's'}${skipped > 0 ? `, ${skipped} duplicate${skipped === 1 ? '' : 's'} skipped` : ''}.`,
        'success',
      );
    } catch (error) {
      notify(`Import failed: ${getErrorMessage(error)}`, 'danger');
    } finally {
      setBusy(false);
    }
  };

  const handlePaste = () => {
    if (!accountId) {
      notify('Add an account first.', 'danger');
      return;
    }
    const trimmed = pasted.trim();
    if (!trimmed) {
      notify('Paste CSV or statement text below first.', 'danger');
      return;
    }
    const batch = parseStatementText(trimmed);
    if (batch.rows.length === 0) {
      notify('Could not find transactions in the pasted text.', 'danger');
      return;
    }
    const before = state.transactions.length;
    const next = applyImportedBatch(state, accountId, batch);
    const added = next.transactions.length - before;
    onStateChange(next);
    setPasted('');
    notify(
      `Added ${added} transaction${added === 1 ? '' : 's'}${added < batch.rows.length ? `, ${batch.rows.length - added} duplicate${batch.rows.length - added === 1 ? '' : 's'} skipped` : ''}.`,
      'success',
    );
  };

  const exportCsv = () => {
    if (typeof document === 'undefined') return;
    const csv = buildTransactionsCsv(state);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ledgerline-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    notify(`Exported ${state.transactions.length} transactions to CSV.`, 'success');
  };

  const exportXlsx = async () => {
    if (typeof document === 'undefined') return;
    try {
      setBusy(true);
      const bytes = await buildTransactionsXlsxBuffer(state);
      const arrayBuffer = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer;
      const blob = new Blob([arrayBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ledgerline-transactions-${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      notify(`Exported ${state.transactions.length} transactions to Excel (.xlsx).`, 'success');
    } catch (error) {
      notify(`Excel export failed: ${getErrorMessage(error)}`, 'danger');
    } finally {
      setBusy(false);
    }
  };

  const exportJson = () => {
    if (typeof document === 'undefined') return;
    const blob = new Blob([serializeFinanceState(state)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ledgerline-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    notify('Full backup exported.', 'success');
  };

  const importBackup = async () => {
    try {
      setBusy(true);
      const files = await pickWebStatementFiles();
      const file = files.find((f) => f.name.toLowerCase().endsWith('.json'));
      if (!file) {
        notify('Select a .json backup file.', 'danger');
        return;
      }
      const text = await file.text();
      const restored = parseFinanceBackupJson(text);
      onStateChange(restored);
      notify('Backup restored.', 'success');
    } catch (error) {
      notify(`Restore failed: ${getErrorMessage(error)}`, 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: spacing.lg }}>
      <View>
        <Text style={[styles.title, { color: palette.text }]}>Import & export</Text>
        <Text style={[styles.subtitle, { color: palette.textMuted }]}>
          Upload statements (CSV, TSV, XLSX, or PDF), paste text, or back up your whole ledger. European semicolon CSVs
          and tab exports are detected automatically.
        </Text>
      </View>

      {message ? (
        <View
          style={[
            styles.banner,
            {
              backgroundColor:
                tone === 'success'
                  ? palette.successSoft
                  : tone === 'danger'
                    ? palette.dangerSoft
                    : palette.primarySoft,
              borderColor:
                tone === 'success'
                  ? palette.success
                  : tone === 'danger'
                    ? palette.danger
                    : palette.primary,
            },
          ]}
        >
          <Text
            style={{
              color:
                tone === 'success'
                  ? palette.success
                  : tone === 'danger'
                    ? palette.danger
                    : palette.primary,
              fontWeight: '700',
            }}
          >
            {message}
          </Text>
        </View>
      ) : null}

      <Card title="Import into account" eyebrow="Step 1 · Destination">
        {accounts.length === 0 ? (
          <Text style={{ color: palette.textMuted, fontSize: typography.small }}>
            Add an account first from the Accounts tab.
          </Text>
        ) : (
          <Select
            value={accountId}
            onChange={setAccountId}
            options={accounts.map((a) => ({ value: a.id, label: `${a.name} · ${formatCurrency(a.currentBalance)}` }))}
          />
        )}
      </Card>

      <Card title="CSV import wizard" eyebrow="Preview · map columns · dedupe">
        <Text style={{ color: palette.textMuted, fontSize: typography.small, lineHeight: 19, marginBottom: spacing.md }}>
          For bank exports (CSV, TSV, or semicolon-separated): we auto-suggest column roles. Preview the first 10 rows,
          adjust mappings, then import. Duplicates are skipped using the same date + payee + amount key as quick import.
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginBottom: spacing.md }}>
          <Button
            label={busy ? 'Loading…' : 'Load CSV / TSV file'}
            onPress={handleWizardCsvFile}
            disabled={busy || !webOnly || !accountId}
            variant="secondary"
          />
          <Button
            label="Load pasted CSV below"
            onPress={() => {
              const t = pasted.trim();
              if (!t) {
                notify('Paste CSV into the box in “Paste statement text” first, or use Load CSV file.', 'danger');
                return;
              }
              loadWizardFromText(t, 'pasted-csv-wizard');
            }}
            disabled={!accountId}
            variant="ghost"
          />
          {wizardHeaders.length > 0 ? (
            <Button label="Clear wizard" onPress={clearWizard} variant="ghost" />
          ) : null}
        </View>

        {wizardHeaders.length > 0 ? (
          <View style={{ gap: spacing.md }}>
            <Text style={{ color: palette.textSubtle, fontSize: typography.micro, fontWeight: '700' }}>
              Column mapping
            </Text>
            {wizardHeaders.map((header, colIdx) => (
              <Select
                key={`${header}-${colIdx}`}
                label={header || `Column ${colIdx + 1}`}
                value={wizardRoles[colIdx] ?? 'ignore'}
                onChange={(value) => {
                  setWizardRoles((prev) => {
                    const next = [...prev];
                    while (next.length < wizardHeaders.length) {
                      next.push('ignore');
                    }
                    next[colIdx] = value;
                    return next;
                  });
                }}
                options={ROLE_OPTIONS}
              />
            ))}

            <Text style={{ color: palette.textSubtle, fontSize: typography.micro, fontWeight: '700' }}>
              Preview (first 10 rows)
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View>
                <View style={[styles.tableRow, { borderColor: palette.borderSoft }]}>
                  {wizardHeaders.map((h, i) => (
                    <Text key={`h-${i}`} style={[styles.tableCell, { color: palette.primary, fontWeight: '800' }]}>
                      {h || '—'}
                    </Text>
                  ))}
                </View>
                {wizardPreviewRows.map((row, ri) => (
                  <View
                    key={`r-${ri}`}
                    style={[styles.tableRow, { borderColor: palette.borderSoft, backgroundColor: palette.surfaceSunken }]}
                  >
                    {wizardHeaders.map((_, ci) => (
                      <Text key={`c-${ri}-${ci}`} style={[styles.tableCell, { color: palette.text }]}>
                        {row[ci] ?? ''}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>

            <Text style={{ color: wizardReady ? palette.textMuted : palette.warning, fontSize: typography.small }}>
              {wizardReady
                ? `Ready to import ${wizardParsedCount} parsed row${wizardParsedCount === 1 ? '' : 's'} (duplicates will be skipped on commit).`
                : 'Map at least: Date, Description, and either a single Amount column or separate Debit/Credit columns.'}
            </Text>
            <Button
              label={busy ? 'Working…' : 'Import with these mappings'}
              onPress={applyWizardImport}
              disabled={!wizardReady || busy || !accountId}
              fullWidth
            />
          </View>
        ) : null}
      </Card>

      <View style={styles.grid}>
        <Card title="Upload files" eyebrow="CSV · TSV · XLSX · PDF" style={styles.flex1}>
          <Text style={{ color: palette.textMuted, fontSize: typography.small, lineHeight: 19 }}>
            We detect delimiters and column headers for most banks. Full-app JSON backups should use “Restore from JSON”
            — picking one as a statement shows a clear error. Duplicates are skipped by date, payee, and amount.
          </Text>
          <Button
            label={busy ? 'Importing…' : 'Choose file(s)'}
            onPress={handleFilePick}
            disabled={busy || !webOnly || !accountId}
            fullWidth
          />
          {!webOnly ? (
            <Text style={{ color: palette.textSubtle, fontSize: typography.micro }}>
              File upload is available on the web. Paste text below on mobile.
            </Text>
          ) : null}
        </Card>

        <Card title="Paste statement text" eyebrow="Works on any device" style={styles.flex1}>
          <Input
            placeholder={
              'Date, Payee, Amount\n04/01/2026, Spotify, -11.99\n04/02/2026, Payroll, 1960.00'
            }
            value={pasted}
            onChangeText={setPasted}
            multiline
            numberOfLines={8}
            style={{ minHeight: 160, textAlignVertical: 'top' }}
          />
          <Button
            label="Parse pasted text"
            variant="secondary"
            onPress={handlePaste}
            disabled={!accountId}
            fullWidth
          />
        </Card>
      </View>

      <Card title="Backups" eyebrow="Full state">
        <Text style={{ color: palette.textMuted, fontSize: typography.small, lineHeight: 19 }}>
          Exports capture accounts, transactions, budgets, goals, and import history. Keep one handy
          before major imports — restoring replaces your ledger.
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
          <Button label="Export CSV (transactions)" variant="secondary" onPress={exportCsv} />
          <Button label="Export Excel (.xlsx)" variant="secondary" onPress={exportXlsx} disabled={busy} />
          <Button label="Export JSON backup" onPress={exportJson} />
          <Button label="Restore from JSON" variant="ghost" onPress={importBackup} disabled={busy} />
        </View>
      </Card>

      {state.imports.length > 0 ? (
        <Card title="Import history" eyebrow="Latest first">
          <ScrollView style={{ maxHeight: 260 }} contentContainerStyle={{ gap: spacing.sm }}>
            {state.imports.slice(0, 15).map((record) => (
              <View
                key={record.id}
                style={[styles.historyRow, { borderBottomColor: palette.borderSoft }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: palette.text, fontWeight: '700' }}>{record.fileName}</Text>
                  <Text style={{ color: palette.textSubtle, fontSize: typography.micro, marginTop: 2 }}>
                    {new Date(record.importedAt).toLocaleString()} · {record.format.toUpperCase()}
                  </Text>
                </View>
                <Text style={{ color: palette.text, fontWeight: '700' }}>
                  {record.rows} rows
                </Text>
              </View>
            ))}
          </ScrollView>
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: typography.display, fontWeight: '800' },
  subtitle: { fontSize: typography.small, marginTop: 4 },
  banner: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  grid: { flexDirection: 'row', gap: spacing.lg, flexWrap: 'wrap' },
  flex1: { flex: 1, minWidth: 320 },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tableCell: {
    minWidth: 120,
    maxWidth: 220,
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontSize: typography.micro,
  },
});
