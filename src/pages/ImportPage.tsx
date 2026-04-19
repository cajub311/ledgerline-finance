import { useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { buildTransactionsCsv } from '../finance/export';
import { parseStatementBlob } from '../finance/import';
import { parseStatementText } from '../finance/import.shared';
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

  const notify = (text: string, kind: 'info' | 'success' | 'danger' = 'info') => {
    setMessage(text);
    setTone(kind);
  };

  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  const ingestFiles = async (files: File[]) => {
    if (!accountId) {
      notify('Add an account first.', 'danger');
      return;
    }
    if (files.length === 0) return;
    try {
      setBusy(true);
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

  const handleFilePick = async () => {
    if (!accountId) {
      notify('Add an account first.', 'danger');
      return;
    }
    try {
      const files = await pickWebStatementFiles();
      await ingestFiles(files);
    } catch (error) {
      notify(`Import failed: ${getErrorMessage(error)}`, 'danger');
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
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ledgerline-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    notify(`Exported ${state.transactions.length} transactions to CSV.`, 'success');
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

  const webOnly = Platform.OS === 'web';

  return (
    <View style={{ gap: spacing.lg }}>
      <View>
        <Text style={[styles.title, { color: palette.text }]}>Import & export</Text>
        <Text style={[styles.subtitle, { color: palette.textMuted }]}>
          Upload statements from any bank (CSV, XLSX, or PDF), paste text, or back up your whole ledger.
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

      <View style={styles.grid}>
        <Card title="Upload files" eyebrow="CSV · XLSX · PDF" style={styles.flex1}>
          <Text style={{ color: palette.textMuted, fontSize: typography.small, lineHeight: 19 }}>
            We detect the column headers automatically for most banks. Duplicates are skipped by
            date, payee, and amount.
          </Text>
          {webOnly ? (
            <Pressable
              onPress={handleFilePick}
              disabled={busy || !accountId}
              {...({
                onDragEnter: (e: unknown) => {
                  const event = e as { preventDefault: () => void; stopPropagation: () => void };
                  event.preventDefault();
                  event.stopPropagation();
                  dragDepth.current += 1;
                  setDragging(true);
                },
                onDragOver: (e: unknown) => {
                  const event = e as { preventDefault: () => void };
                  event.preventDefault();
                },
                onDragLeave: (e: unknown) => {
                  const event = e as { preventDefault: () => void; stopPropagation: () => void };
                  event.preventDefault();
                  event.stopPropagation();
                  dragDepth.current = Math.max(0, dragDepth.current - 1);
                  if (dragDepth.current === 0) setDragging(false);
                },
                onDrop: (e: unknown) => {
                  const event = e as {
                    preventDefault: () => void;
                    stopPropagation: () => void;
                    dataTransfer?: { files?: FileList };
                  };
                  event.preventDefault();
                  event.stopPropagation();
                  dragDepth.current = 0;
                  setDragging(false);
                  const files = Array.from(event.dataTransfer?.files ?? []);
                  if (files.length > 0) void ingestFiles(files);
                },
              } as Record<string, unknown>)}
              style={({ hovered }) => [
                styles.dropZone,
                {
                  borderColor: dragging
                    ? palette.primary
                    : hovered
                      ? palette.primary
                      : palette.border,
                  backgroundColor: dragging
                    ? palette.primarySoft
                    : hovered
                      ? palette.surfaceSunken
                      : palette.surface,
                  opacity: !accountId || busy ? 0.6 : 1,
                },
              ]}
            >
              <Text style={{ fontSize: 32 }}>📂</Text>
              <Text style={{ color: palette.text, fontWeight: '700' }}>
                {busy ? 'Importing…' : dragging ? 'Drop to import' : 'Drop files here or click to browse'}
              </Text>
              <Text style={{ color: palette.textSubtle, fontSize: typography.micro }}>
                CSV, XLSX, or PDF · multiple files okay
              </Text>
            </Pressable>
          ) : (
            <>
              <Button
                label="Choose file(s)"
                onPress={handleFilePick}
                disabled
                fullWidth
              />
              <Text style={{ color: palette.textSubtle, fontSize: typography.micro }}>
                File upload is available on the web. Paste text below on mobile.
              </Text>
            </>
          )}
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
  dropZone: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
});
