import { createElement, useRef } from 'react';
import { Platform, Pressable, Text, TextInput, View, type TextStyle, type ViewStyle } from 'react-native';

import type { ImportRecord } from '../../finance/types';
import { FinanceCard } from './FinanceCard';

export type ImportHubSectionStyles = {
  bodyText: TextStyle;
  importControls: ViewStyle;
  importButtonRow: ViewStyle;
  primaryButton: ViewStyle;
  primaryButtonText: TextStyle;
  secondaryButton: ViewStyle;
  secondaryButtonText: TextStyle;
  buttonDisabled: ViewStyle;
  textArea: TextStyle;
  importMessage: TextStyle;
  importList: ViewStyle;
  importRow: ViewStyle;
  importCopy: ViewStyle;
  importFile: TextStyle;
  importMeta: TextStyle;
  importStatus: TextStyle;
  emptyState: ViewStyle;
  emptyTitle: TextStyle;
  emptyBody: TextStyle;
};

type Props = {
  styles: ImportHubSectionStyles;
  importing: boolean;
  importMessage: string;
  pastedStatement: string;
  onPastedStatementChange: (value: string) => void;
  onUploadStatements: () => void;
  onResetDemo: () => void;
  onExportCsv: () => void;
  onExportBackup: () => void;
  onImportBackupFileSelected: (event: { target: { files?: FileList | null; value?: string } }) => void;
  onImportPastedText: () => void;
  onImportTip: () => void;
  imports: ImportRecord[];
  hasTransactions: boolean;
};

export function ImportHubSection({
  styles,
  importing,
  importMessage,
  pastedStatement,
  onPastedStatementChange,
  onUploadStatements,
  onResetDemo,
  onExportCsv,
  onExportBackup,
  onImportBackupFileSelected,
  onImportPastedText,
  onImportTip,
  imports,
  hasTransactions,
}: Props) {
  const webBackupInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <FinanceCard title="Import hub" eyebrow="Statements" tone="accent">
      <Text style={styles.bodyText}>
        Upload Wells Fargo statements as PDF, CSV, XLS, or XLSX on web. Paste statement text on any
        device to keep the review loop moving. Export a JSON backup anytime to move data between
        browsers or devices — restoring a backup replaces the open ledger.
      </Text>
      <View style={styles.importControls}>
        <View style={styles.importButtonRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Upload statement files"
            style={[styles.primaryButton, importing && styles.buttonDisabled]}
            disabled={importing}
            onPress={() => void onUploadStatements()}
          >
            <Text style={styles.primaryButtonText}>
              {importing ? 'Importing...' : Platform.OS === 'web' ? 'Upload statements' : 'Web uploads'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reset workspace to demo data"
            style={styles.secondaryButton}
            onPress={onResetDemo}
          >
            <Text style={styles.secondaryButtonText}>Reset demo</Text>
          </Pressable>
          {Platform.OS === 'web' && hasTransactions ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Export transactions as CSV"
              style={styles.secondaryButton}
              onPress={onExportCsv}
            >
              <Text style={styles.secondaryButtonText}>Export CSV</Text>
            </Pressable>
          ) : null}
          {Platform.OS === 'web' ? (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Download full ledger backup as JSON"
                style={styles.secondaryButton}
                onPress={onExportBackup}
              >
                <Text style={styles.secondaryButtonText}>Export backup</Text>
              </Pressable>
              {createElement('input', {
                ref: (el: HTMLInputElement | null) => {
                  webBackupInputRef.current = el;
                },
                type: 'file',
                accept: 'application/json,.json',
                style: { display: 'none' },
                'aria-hidden': true,
                onChange: (e: { target: HTMLInputElement }) => {
                  onImportBackupFileSelected(e);
                  e.target.value = '';
                },
              })}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Restore ledger from a JSON backup file"
                style={styles.secondaryButton}
                onPress={() => webBackupInputRef.current?.click()}
              >
                <Text style={styles.secondaryButtonText}>Import backup</Text>
              </Pressable>
            </>
          ) : null}
        </View>
        <TextInput
          style={styles.textArea}
          multiline
          placeholder="Paste Wells Fargo statement text or CSV rows here."
          placeholderTextColor="#7d9aa0"
          value={pastedStatement}
          onChangeText={onPastedStatementChange}
          accessibilityLabel="Statement text to import"
        />
        <View style={styles.importButtonRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Import pasted statement text"
            style={styles.secondaryButton}
            onPress={onImportPastedText}
          >
            <Text style={styles.secondaryButtonText}>Import pasted text</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={styles.secondaryButton} onPress={onImportTip}>
            <Text style={styles.secondaryButtonText}>How to import</Text>
          </Pressable>
        </View>
      </View>
      <Text style={styles.importMessage}>{importMessage}</Text>
      <View style={styles.importList}>
        {imports.length ? (
          imports.slice(0, 6).map((record) => (
            <View key={record.id} style={styles.importRow}>
              <View style={styles.importCopy}>
                <Text style={styles.importFile}>{record.fileName}</Text>
                <Text style={styles.importMeta}>
                  {record.format.toUpperCase()} | {record.rows} rows | {record.note}
                </Text>
              </View>
              <Text style={styles.importStatus}>{record.format}</Text>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No files imported yet</Text>
            <Text style={styles.emptyBody}>
              Start with a Wells Fargo PDF or a spreadsheet export. The importer will map rows into
              the selected account.
            </Text>
          </View>
        )}
      </View>
    </FinanceCard>
  );
}
