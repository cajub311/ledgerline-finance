import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import {
  buildAccountOfx,
  buildAccountQif,
  buildMultiAccountQif,
  buildTransactionsCsv,
} from '../finance/export';
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
import {
  downloadBlob,
  downloadText,
  formatCurrency,
  formatIsoDate,
  getErrorMessage,
} from '../utils/format';
import { pickWebStatementFiles } from '../utils/webFilePicker';

interface ImportPageProps {
  state: FinanceState;
  onStateChange: (next: FinanceState) => void;
}

type ExportScope = 'all' | 'month' | 'account';

export function ImportPage({ state, onStateChange }: ImportPageProps) {
  const { palette } = useTheme();
  const accounts = useMemo(() => getAccountsWithBalances(state), [state]);

  const [accountId, setAccountId] = useState<string>(accounts[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [pasted, setPasted] = useState('');
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState<'info' | 'success' | 'danger'>('info');
  const [lastImport, setLastImport] = useState<{ snapshot: FinanceState; count: number } | null>(
    null,
  );

  const [wizardCsvText, setWizardCsvText] = useState('');
  const [wizardSourceLabel, setWizardSourceLabel] = useState('');
  const [wizardRoles, setWizardRoles] = useState<WizardColumnRole[]>([]);
  const [wizardHeaders, setWizardHeaders] = useState<string[]>([]);
  const [wizardPreviewRows, setWizardPreviewRows] = useState<string[][]>([]);

  // Export options
  const [exportScope, setExportScope] = useState<ExportScope>('all');
  const [exportMonth, setExportMonth] = useState<string>(() => formatIsoDate().slice(0, 7));
  const [exportAccount, setExportAccount] = useState<string>(accounts[0]?.id ?? '');

  // Drag/drop
  const [dropActive, setDropActive] = useState(false);
  const dropZoneRef = useRef<View>(null);

  const webOnly = Platform.OS === 'web';

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    // Keep selected exportAccount valid
    if (!accounts.find((a) => a.id === exportAccount) && accounts[0]) {
      setExportAccount(accounts[0].id);
    }
  }, [accounts, exportAccount]);

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
      const file = files.find((f) => f.name.toLowerCase().endsWith('.csv'));
      if (!file) {
        notify('Select a .csv file for the mapping wizard.', 'danger');
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
    const snapshot = state;
    const before = state.transactions.length;
    const next = applyImportedBatch(state, accountId, batch);
    const added = next.transactions.length - before;
    onStateChange(next);
    setLastImport({ snapshot, count: added });
    clearWizard();
    notify(
      `Imported ${added} transaction${added === 1 ? '' : 's'}${rows.length - added > 0 ? `, ${rows.length - added} duplicate${rows.length - added === 1 ? '' : 's'} skipped` : ''}.`,
      'success',
    );
  };

  const importFiles = async (files: File[]) => {
    if (!accountId) {
      notify('Add an account first.', 'danger');
      return;
    }
    if (files.length === 0) return;
    try {
      setBusy(true);
      let imported = 0;
      let skipped = 0;
      const snapshot = state;
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
      setLastImport({ snapshot, count: imported });
      notify(
        `Imported ${imported} transaction${imported === 1 ? '' : 's'} from ${files.length} file${
          files.length === 1 ? '' : 's'
        }${skipped > 0 ? `, ${skipped} duplicate${skipped === 1 ? '' : 's'} skipped` : ''}.`,
        'success',
      );
    } catch (error) {
      notify(`Import failed: ${getErrorMessage(error)}`, 'danger');
    } finally {
      setBusy(false);
    }
  };

  const handleFilePick = async () => {
    const files = await pickWebStatementFiles();
    await importFiles(files);
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
    const snapshot = state;
    const before = state.transactions.length;
    const next = applyImportedBatch(state, accountId, batch);
    const added = next.transactions.length - before;
    onStateChange(next);
    setLastImport({ snapshot, count: added });
    setPasted('');
    notify(
      `Added ${added} transaction${added === 1 ? '' : 's'}${added < batch.rows.length ? `, ${batch.rows.length - added} duplicate${batch.rows.length - added === 1 ? '' : 's'} skipped` : ''}.`,
      'success',
    );
  };

  const undoLastImport = () => {
    if (!lastImport) return;
    onStateChange(lastImport.snapshot);
    notify(`Reverted last import (${lastImport.count} transactions).`, 'info');
    setLastImport(null);
  };

  // ── Export helpers ────────────────────────────────────────────────────────
  const filteredForExport = useMemo(() => {
    if (exportScope === 'month') {
      return state.transactions.filter((tx) => tx.date.startsWith(exportMonth));
    }
    if (exportScope === 'account') {
      return state.transactions.filter((tx) => tx.accountId === exportAccount);
    }
    return state.transactions;
  }, [state.transactions, exportScope, exportMonth, exportAccount]);

  const exportCsv = () => {
    const csv = buildTransactionsCsv(state, { transactions: filteredForExport });
    downloadText(
      csv,
      `ledgerline-${exportScope}-${new Date().toISOString().slice(0, 10)}.csv`,
      'text/csv',
    );
    notify(`Exported ${filteredForExport.length} transactions to CSV.`, 'success');
  };

  const exportQif = () => {
    const qif =
      exportScope === 'account' && exportAccount
        ? buildAccountQif(state, exportAccount)
        : buildMultiAccountQif(state);
    if (!qif.trim()) {
      notify('Nothing to export.', 'danger');
      return;
    }
    downloadText(
      qif,
      `ledgerline-${exportScope === 'account' ? 'account' : 'full'}-${new Date()
        .toISOString()
        .slice(0, 10)}.qif`,
      'application/qif',
    );
    notify('QIF export downloaded.', 'success');
  };

  const exportOfx = () => {
    if (!exportAccount) {
      notify('Pick an account for OFX export.', 'danger');
      return;
    }
    const ofx = buildAccountOfx(state, exportAccount);
    if (!ofx.trim()) {
      notify('Account has no transactions to export.', 'danger');
      return;
    }
    const acct = accounts.find((a) => a.id === exportAccount);
    downloadText(
      ofx,
      `ledgerline-${(acct?.name ?? 'account').replace(/\s+/g, '-').toLowerCase()}-${new Date()
        .toISOString()
        .slice(0, 10)}.ofx`,
      'application/x-ofx',
    );
    notify('OFX export downloaded.', 'success');
  };

  const exportPdf = async () => {
    if (typeof document === 'undefined') return;
    try {
      setBusy(true);
      const { buildStatementPdf } = await import('../finance/exportPdf');
      const blob = await buildStatementPdf(state, {
        month: exportScope === 'month' ? exportMonth : undefined,
        accountId: exportScope === 'account' ? exportAccount : undefined,
      });
      const label =
        exportScope === 'month'
          ? exportMonth
          : exportScope === 'account'
            ? (accounts.find((a) => a.id === exportAccount)?.name ?? 'account').replace(/\s+/g, '-').toLowerCase()
            : 'full';
      downloadBlob(blob, `ledgerline-statement-${label}-${new Date().toISOString().slice(0, 10)}.pdf`);
      notify(`PDF statement with ${filteredForExport.length} transactions saved.`, 'success');
    } catch (error) {
      notify(`PDF export failed: ${getErrorMessage(error)}`, 'danger');
    } finally {
      setBusy(false);
    }
  };

  const exportJson = () => {
    downloadText(
      serializeFinanceState(state),
      `ledgerline-backup-${new Date().toISOString().slice(0, 10)}.json`,
      'application/json',
    );
    notify('Full JSON backup exported.', 'success');
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

  // ── Drag-and-drop (web only) ─────────────────────────────────────────────
  const dropHandlers = webOnly
    ? ({
        // React Native Web passes these through to the DOM element.
        onDragEnter: (e: unknown) => {
          (e as Event).preventDefault();
          setDropActive(true);
        },
        onDragOver: (e: unknown) => {
          (e as Event).preventDefault();
          setDropActive(true);
        },
        onDragLeave: (e: unknown) => {
          (e as Event).preventDefault();
          setDropActive(false);
        },
        onDrop: async (e: unknown) => {
          const ev = e as DragEvent;
          ev.preventDefault();
          setDropActive(false);
          const files = ev.dataTransfer?.files
            ? Array.from(ev.dataTransfer.files)
            : [];
          if (files.length === 0) return;
          await importFiles(files);
        },
      } as unknown as Record<string, unknown>)
    : {};

  const scopeLabel = (() => {
    if (exportScope === 'all') return `${state.transactions.length} transactions`;
    if (exportScope === 'month') return `${filteredForExport.length} in ${exportMonth}`;
    const acct = accounts.find((a) => a.id === exportAccount);
    return `${filteredForExport.length} in ${acct?.name ?? 'account'}`;
  })();

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1, minWidth: 240 }}>
          <Text style={[styles.title, { color: palette.text }]}>Import & export</Text>
          <Text style={[styles.subtitle, { color: palette.textMuted }]}>
            Bring in statements from any bank (CSV, XLSX, or PDF), paste text, or export to CSV,
            PDF, QIF, or OFX for Quicken, GnuCash, Moneydance, and others.
          </Text>
        </View>
        {lastImport ? (
          <Button label="Undo last import" variant="ghost" onPress={undoLastImport} />
        ) : null}
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

      <Card title="Import into account" eyebrow="Destination">
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

      {webOnly ? (
        <View
          ref={dropZoneRef}
          {...dropHandlers}
          style={[
            styles.dropZone,
            {
              backgroundColor: dropActive ? palette.primarySoft : palette.surface,
              borderColor: dropActive ? palette.primary : palette.border,
            },
          ]}
        >
          <Text style={[styles.dropTitle, { color: palette.text }]}>
            Drag & drop statements here
          </Text>
          <Text style={[styles.dropSub, { color: palette.textSubtle }]}>
            CSV · XLSX · PDF — multi-file, headers auto-detected, duplicates skipped by date + payee + amount.
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' }}>
            <Button
              label={busy ? 'Importing…' : 'Choose file(s)'}
              onPress={handleFilePick}
              disabled={busy || !accountId}
            />
            <Button
              label="Export JSON backup"
              variant="secondary"
              onPress={exportJson}
              disabled={busy}
            />
          </View>
        </View>
      ) : null}

      <Card title="CSV mapping wizard" eyebrow="Preview · map columns · dedupe">
        <Text style={{ color: palette.textMuted, fontSize: typography.small, lineHeight: 19, marginBottom: spacing.md }}>
          For banks with unusual CSV headers (Wells Fargo, Chase, American Express, etc.): auto-suggest
          column roles, preview the first 10 rows, adjust, then import. Duplicates are skipped on commit.
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginBottom: spacing.md }}>
          <Button
            label={busy ? 'Loading…' : 'Load CSV file'}
            onPress={handleWizardCsvFile}
            disabled={busy || !webOnly || !accountId}
            variant="secondary"
          />
          <Button
            label="Load pasted CSV"
            onPress={() => {
              const t = pasted.trim();
              if (!t) {
                notify('Paste CSV into the box in "Paste statement text" first, or use Load CSV file.', 'danger');
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
                ? `Ready to import ${wizardParsedCount} parsed row${wizardParsedCount === 1 ? '' : 's'} (duplicates skipped on commit).`
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

      <Card title="Paste statement text" eyebrow="Works on any device">
        <Input
          placeholder={'Date, Payee, Amount\n04/01/2026, Spotify, -11.99\n04/02/2026, Payroll, 1960.00'}
          value={pasted}
          onChangeText={setPasted}
          multiline
          numberOfLines={8}
          style={{ minHeight: 140, textAlignVertical: 'top' }}
        />
        <Button
          label="Parse pasted text"
          variant="secondary"
          onPress={handlePaste}
          disabled={!accountId}
        />
      </Card>

      <Card
        title="Export"
        eyebrow="CSV · PDF · QIF · OFX · JSON backup"
        action={<Badge label={scopeLabel} tone="primary" />}
      >
        <View style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {(['all', 'month', 'account'] as const).map((scope) => {
              const active = exportScope === scope;
              return (
                <Pressable
                  key={scope}
                  onPress={() => setExportScope(scope)}
                  style={[
                    styles.scopePill,
                    {
                      backgroundColor: active ? palette.primary : palette.surfaceSunken,
                      borderColor: active ? palette.primary : palette.borderSoft,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active ? palette.primaryText : palette.textMuted,
                      fontWeight: '700',
                      fontSize: typography.small,
                    }}
                  >
                    {scope === 'all' ? 'Everything' : scope === 'month' ? 'Single month' : 'Single account'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {exportScope === 'month' ? (
            <Input
              label="Month (YYYY-MM)"
              value={exportMonth}
              onChangeText={setExportMonth}
              placeholder="2026-04"
            />
          ) : null}
          {exportScope === 'account' ? (
            <Select
              label="Account"
              value={exportAccount}
              onChange={setExportAccount}
              options={accounts.map((a) => ({ value: a.id, label: a.name }))}
            />
          ) : null}

          <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
            <Button
              label={`CSV · ${filteredForExport.length}`}
              variant="secondary"
              onPress={exportCsv}
              disabled={filteredForExport.length === 0}
            />
            <Button
              label={busy ? 'Building PDF…' : 'PDF statement'}
              onPress={exportPdf}
              disabled={busy || filteredForExport.length === 0}
            />
            <Button
              label="QIF (Quicken)"
              variant="secondary"
              onPress={exportQif}
            />
            <Button
              label="OFX (bank format)"
              variant="secondary"
              onPress={exportOfx}
              disabled={exportScope !== 'account' && !exportAccount}
            />
            <Button label="JSON backup" variant="ghost" onPress={exportJson} />
            <Button label="Restore JSON" variant="ghost" onPress={importBackup} disabled={busy} />
          </View>

          <Text style={{ color: palette.textSubtle, fontSize: typography.micro, lineHeight: 16 }}>
            PDF statements are print-ready with a cover summary and color-coded totals. QIF works with
            Quicken, GnuCash, Moneydance, and Banktivity. OFX targets bank-import workflows and is
            emitted per account. Keep a JSON backup before bulk changes — restoring replaces your
            ledger.
          </Text>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  title: { fontSize: typography.display, fontWeight: '800' },
  subtitle: { fontSize: typography.small, marginTop: 4, lineHeight: 19 },
  banner: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  dropZone: {
    borderRadius: radius.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    padding: spacing.xl,
    alignItems: 'center',
    gap: 6,
  },
  dropTitle: {
    fontSize: typography.title,
    fontWeight: '800',
  },
  dropSub: {
    fontSize: typography.small,
    textAlign: 'center',
    lineHeight: 18,
  },
  scopePill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
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
