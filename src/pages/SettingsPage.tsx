import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { createFinanceState } from '../finance/ledger';
import type { FinanceState } from '../finance/types';
import { clearFinanceState } from '../finance/storage';
import { useTheme } from '../theme/ThemeContext';
import { spacing, typography } from '../theme/tokens';
import { formatCurrency } from '../utils/format';

interface SettingsPageProps {
  state: FinanceState;
  onStateChange: (next: FinanceState) => void;
}

export function SettingsPage({ state, onStateChange }: SettingsPageProps) {
  const { palette, mode, setMode } = useTheme();
  const [householdDraft, setHouseholdDraft] = useState(state.householdName);
  const [confirm, setConfirm] = useState(false);

  const save = () => {
    const name = householdDraft.trim();
    if (!name || name === state.householdName) return;
    onStateChange({ ...state, householdName: name });
  };

  const reset = async () => {
    if (!confirm) {
      setConfirm(true);
      return;
    }
    try {
      await clearFinanceState();
    } catch {
      // ignore
    }
    onStateChange(createFinanceState());
    setConfirm(false);
  };

  const totals = {
    accounts: state.accounts.length,
    transactions: state.transactions.length,
    budgets: state.budgets.length,
    goals: state.goals.length,
    imports: state.imports.length,
  };

  return (
    <View style={{ gap: spacing.lg }}>
      <View>
        <Text style={[styles.title, { color: palette.text }]}>Settings</Text>
        <Text style={[styles.subtitle, { color: palette.textMuted }]}>
          Customize how Ledgerline looks and manage your data.
        </Text>
      </View>

      <Card title="Appearance" eyebrow="Theme">
        <Select
          value={mode}
          onChange={setMode}
          options={[
            { value: 'dark', label: '🌙 Dark' },
            { value: 'light', label: '☀️ Light' },
          ]}
        />
      </Card>

      <Card title="Household" eyebrow="Name">
        <Input
          label="Household or workspace name"
          value={householdDraft}
          onChangeText={setHouseholdDraft}
        />
        <Button
          label="Save name"
          onPress={save}
          disabled={householdDraft.trim() === state.householdName}
        />
      </Card>

      <Card title="Your data" eyebrow="Local-first">
        <View style={{ gap: spacing.sm }}>
          <Line label="Accounts" value={`${totals.accounts}`} />
          <Line label="Transactions" value={`${totals.transactions}`} />
          <Line label="Budgets" value={`${totals.budgets}`} />
          <Line label="Goals" value={`${totals.goals}`} />
          <Line label="Imports recorded" value={`${totals.imports}`} />
          <Line label="Currency" value={state.currency} />
          <Line
            label="Estimated monthly net"
            value={formatCurrency(
              state.transactions
                .filter((tx) => tx.date.startsWith(new Date().toISOString().slice(0, 7)))
                .reduce((sum, tx) => sum + tx.amount, 0),
            )}
          />
        </View>
        <Text style={{ color: palette.textSubtle, fontSize: typography.micro, lineHeight: 17 }}>
          Everything you see lives in this browser (IndexedDB / localStorage). Clearing site data
          wipes your ledger, so export a backup from the Import tab before clearing browser data.
        </Text>
      </Card>

      <Card title="Danger zone" eyebrow="Reset">
        <Text style={{ color: palette.textMuted, fontSize: typography.small, lineHeight: 19 }}>
          Clear all accounts, transactions, budgets, and goals. This returns the app to the seeded
          demo data. Export a backup first if you want to keep your records.
        </Text>
        <Button
          label={confirm ? 'Click again to confirm reset' : 'Reset ledger to demo data'}
          variant="danger"
          onPress={reset}
        />
      </Card>
    </View>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  const { palette } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={{ color: palette.textMuted, fontSize: typography.small }}>{label}</Text>
      <Text style={{ color: palette.text, fontSize: typography.small, fontWeight: '700' }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: typography.display, fontWeight: '800' },
  subtitle: { fontSize: typography.small, marginTop: 4 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
