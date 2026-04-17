import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Select } from '../components/ui/Select';
import {
  addAccount,
  deleteAccount,
  getAccountsWithBalances,
  updateAccount,
} from '../finance/ledger';
import type { AccountType, FinanceAccount, FinanceState } from '../finance/types';
import { useTheme } from '../theme/ThemeContext';
import { radius, spacing, typography } from '../theme/tokens';
import { formatCurrency } from '../utils/format';

interface AccountsPageProps {
  state: FinanceState;
  onStateChange: (next: FinanceState) => void;
}

const ACCOUNT_TYPES: Array<{ value: AccountType; label: string; icon: string }> = [
  { value: 'checking', label: 'Checking', icon: '🏦' },
  { value: 'savings', label: 'Savings', icon: '💰' },
  { value: 'credit', label: 'Credit', icon: '💳' },
  { value: 'cash', label: 'Cash', icon: '💵' },
  { value: 'loan', label: 'Loan', icon: '📋' },
  { value: 'investment', label: 'Investment', icon: '📈' },
];

function accountIcon(type: AccountType): string {
  return ACCOUNT_TYPES.find((t) => t.value === type)?.icon ?? '🏦';
}

export function AccountsPage({ state, onStateChange }: AccountsPageProps) {
  const { palette } = useTheme();
  const accounts = useMemo(() => getAccountsWithBalances(state), [state]);

  const assets = accounts
    .filter((a) => a.type !== 'credit' && a.type !== 'loan')
    .reduce((s, a) => s + a.currentBalance, 0);
  const liabilities = accounts
    .filter((a) => a.type === 'credit' || a.type === 'loan')
    .reduce((s, a) => s + Math.abs(a.currentBalance), 0);

  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState<FinanceAccount | null>(null);
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [type, setType] = useState<AccountType>('checking');
  const [opening, setOpening] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setInstitution(editing.institution);
      setType(editing.type);
      setOpening(String(editing.openingBalance));
      setNotes(editing.notes ?? '');
    }
  }, [editing]);

  const openNew = () => {
    setEditing(null);
    setName('');
    setInstitution('');
    setType('checking');
    setOpening('0');
    setNotes('');
    setShow(true);
  };

  const save = () => {
    if (!name.trim()) return;
    const parsed = Number.parseFloat(opening);
    const balance = Number.isFinite(parsed) ? parsed : 0;
    if (editing) {
      onStateChange(
        updateAccount(state, editing.id, {
          name: name.trim(),
          institution: institution.trim() || 'Manual',
          type,
          openingBalance: balance,
          notes: notes.trim() || undefined,
        }),
      );
    } else {
      onStateChange(
        addAccount(state, {
          name: name.trim(),
          institution: institution.trim() || 'Manual',
          type,
          openingBalance: balance,
          notes: notes.trim() || undefined,
        }),
      );
    }
    setShow(false);
  };

  const del = () => {
    if (editing) {
      onStateChange(deleteAccount(state, editing.id));
      setShow(false);
      setEditing(null);
    }
  };

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={styles.header}>
        <View style={{ flex: 1, minWidth: 240 }}>
          <Text style={[styles.title, { color: palette.text }]}>Accounts</Text>
          <Text style={[styles.subtitle, { color: palette.textMuted }]}>
            {formatCurrency(assets - liabilities)} net · {formatCurrency(assets)} in assets · {formatCurrency(liabilities)} in debts
          </Text>
        </View>
        <Button label="Add account" onPress={openNew} />
      </View>

      <View style={styles.grid}>
        {accounts.map((account) => {
          const isLiability = account.type === 'credit' || account.type === 'loan';
          return (
            <Pressable
              key={account.id}
              onPress={() => {
                setEditing(account);
                setShow(true);
              }}
              style={({ hovered }) => [
                styles.card,
                {
                  backgroundColor: palette.surface,
                  borderColor: hovered ? palette.primary : palette.borderSoft,
                },
              ]}
            >
              <View style={styles.rowBetween}>
                <View style={[styles.iconChip, { backgroundColor: palette.surfaceSunken, borderColor: palette.borderSoft }]}>
                  <Text style={{ fontSize: 22 }}>{accountIcon(account.type)}</Text>
                </View>
                <Badge
                  label={isLiability ? 'Liability' : account.source === 'manual' ? 'Manual' : 'Imported'}
                  tone={isLiability ? 'danger' : account.source === 'manual' ? 'warning' : 'info'}
                />
              </View>
              <Text style={[styles.accountName, { color: palette.text }]}>{account.name}</Text>
              <Text style={[styles.accountInst, { color: palette.textMuted }]}>
                {account.institution} · {account.type}
              </Text>
              <Text
                style={[
                  styles.balance,
                  {
                    color: account.currentBalance < 0
                      ? palette.danger
                      : isLiability
                        ? palette.warning
                        : palette.text,
                  },
                ]}
              >
                {formatCurrency(account.currentBalance)}
              </Text>
              <Text style={[styles.lastSync, { color: palette.textSubtle }]}>
                Last synced {account.lastSynced}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {accounts.length === 0 ? (
        <Card title="No accounts yet" eyebrow="Empty state">
          <Text style={{ color: palette.textMuted, fontSize: typography.small, lineHeight: 20 }}>
            Add a checking, savings, credit card, or cash account. You can import transactions to any
            of them from the Import tab.
          </Text>
        </Card>
      ) : null}

      <Modal
        visible={show}
        onClose={() => setShow(false)}
        title={editing ? 'Edit account' : 'Add account'}
        subtitle={editing ? 'Deleting an account removes its transactions.' : 'Track a real or manual account.'}
        footer={
          <>
            {editing ? <Button label="Delete" variant="danger" onPress={del} /> : null}
            <View style={{ flex: 1 }} />
            <Button label="Cancel" variant="ghost" onPress={() => setShow(false)} />
            <Button label="Save" onPress={save} />
          </>
        }
      >
        <Input label="Name" value={name} onChangeText={setName} placeholder="Chase Checking" />
        <Input
          label="Institution"
          value={institution}
          onChangeText={setInstitution}
          placeholder="Chase, Wells Fargo, Cash App…"
        />
        <Select
          label="Type"
          value={type}
          onChange={(v) => setType(v as AccountType)}
          options={ACCOUNT_TYPES}
        />
        <Input
          label="Opening balance (use negative for credit/loan debt)"
          value={opening}
          onChangeText={setOpening}
          keyboardType="decimal-pad"
        />
        <Input label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional" />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  title: { fontSize: typography.display, fontWeight: '800' },
  subtitle: { fontSize: typography.small, marginTop: 4 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  card: {
    minWidth: 220,
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: 6,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  iconChip: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  accountName: { fontSize: typography.subtitle, fontWeight: '800', marginTop: 8 },
  accountInst: { fontSize: typography.small },
  balance: { fontSize: typography.title, fontWeight: '800', marginTop: 8 },
  lastSync: { fontSize: typography.micro, marginTop: 4 },
});
