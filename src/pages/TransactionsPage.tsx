import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Select } from '../components/ui/Select';
import {
  addManualTransaction,
  deleteTransaction,
  getAccountsWithBalances,
  getCategoryIcon,
  getCategoryOptions,
  toggleTransactionReview,
  updateTransaction,
} from '../finance/ledger';
import type { FinanceState, FinanceTransaction } from '../finance/types';
import { useTheme } from '../theme/ThemeContext';
import { radius, spacing, typography } from '../theme/tokens';
import { formatCurrency, formatIsoDate } from '../utils/format';

interface TransactionsPageProps {
  state: FinanceState;
  onStateChange: (next: FinanceState) => void;
}

type FilterTab = 'all' | 'unreviewed' | 'income' | 'expense';

export function TransactionsPage({ state, onStateChange }: TransactionsPageProps) {
  const { palette } = useTheme();
  const accounts = useMemo(() => getAccountsWithBalances(state), [state]);
  const categoryOptions = useMemo(() => getCategoryOptions(), []);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterTab>('all');
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const [showAdd, setShowAdd] = useState(false);
  const [addDate, setAddDate] = useState(() => formatIsoDate());
  const [addPayee, setAddPayee] = useState('');
  const [addAmount, setAddAmount] = useState('');
  const [addCategory, setAddCategory] = useState('Other');
  const [addNotes, setAddNotes] = useState('');
  const [addAccount, setAddAccount] = useState<string>(accounts[0]?.id ?? '');

  const [editing, setEditing] = useState<FinanceTransaction | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.transactions
      .filter((tx) => {
        if (accountFilter !== 'all' && tx.accountId !== accountFilter) return false;
        if (categoryFilter !== 'all' && tx.category !== categoryFilter) return false;
        if (filter === 'unreviewed' && tx.reviewed) return false;
        if (filter === 'income' && tx.amount <= 0) return false;
        if (filter === 'expense' && tx.amount >= 0) return false;
        if (q) {
          const hay = `${tx.payee} ${tx.category} ${tx.notes ?? ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [state.transactions, query, filter, accountFilter, categoryFilter]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const tx of filtered) {
      if (tx.amount > 0) income += tx.amount;
      else expense += Math.abs(tx.amount);
    }
    return { income, expense, net: income - expense };
  }, [filtered]);

  const submitAdd = () => {
    const next = addManualTransaction(state, {
      accountId: addAccount || accounts[0]?.id || '',
      date: addDate,
      payee: addPayee,
      amount: addAmount,
      category: addCategory,
      notes: addNotes,
    });
    if (next !== state) {
      onStateChange(next);
      setAddPayee('');
      setAddAmount('');
      setAddNotes('');
      setShowAdd(false);
    }
  };

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={styles.header}>
        <View style={{ flex: 1, minWidth: 240 }}>
          <Text style={[styles.title, { color: palette.text }]}>Transactions</Text>
          <Text style={[styles.subtitle, { color: palette.textMuted }]}>
            {filtered.length} shown · {formatCurrency(totals.income)} in · {formatCurrency(totals.expense)} out · net {formatCurrency(totals.net)}
          </Text>
        </View>
        <Button label="Add transaction" onPress={() => setShowAdd(true)} />
      </View>

      <Card padding={spacing.md}>
        <View style={{ gap: spacing.md }}>
          <Input
            placeholder="Search payee, category, or notes"
            value={query}
            onChangeText={setQuery}
          />
          <Select<FilterTab>
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All' },
              { value: 'unreviewed', label: 'To review' },
              { value: 'income', label: 'Income' },
              { value: 'expense', label: 'Expenses' },
            ]}
          />
          <Select
            label="Account"
            value={accountFilter}
            onChange={setAccountFilter}
            options={[
              { value: 'all', label: 'All accounts' },
              ...accounts.map((a) => ({ value: a.id, label: a.name })),
            ]}
          />
          <Select
            label="Category"
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={[
              { value: 'all', label: 'All' },
              ...categoryOptions.map((c) => ({ value: c, label: c, icon: getCategoryIcon(c) })),
            ]}
          />
        </View>
      </Card>

      <Card padding={spacing.sm}>
        {filtered.length === 0 ? (
          <View style={{ padding: spacing.xl, alignItems: 'center', gap: 6 }}>
            <Text style={{ color: palette.text, fontWeight: '700' }}>No transactions match.</Text>
            <Text style={{ color: palette.textSubtle, fontSize: typography.small }}>
              Adjust filters or add a manual entry.
            </Text>
          </View>
        ) : (
          <View>
            {filtered.slice(0, 300).map((tx) => {
              const account = accounts.find((a) => a.id === tx.accountId);
              return (
                <Pressable
                  key={tx.id}
                  onPress={() => setEditing(tx)}
                  style={({ hovered }) => [
                    styles.row,
                    {
                      borderBottomColor: palette.borderSoft,
                      backgroundColor: hovered ? palette.surfaceSunken : 'transparent',
                    },
                  ]}
                >
                  <View style={styles.rowIcon}>
                    <Text style={{ fontSize: 18 }}>{getCategoryIcon(tx.category)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.topLine}>
                      <Text style={[styles.payee, { color: palette.text }]}>{tx.payee}</Text>
                      {!tx.reviewed ? <Badge label="To review" tone="warning" /> : null}
                    </View>
                    <Text style={[styles.meta, { color: palette.textSubtle }]}>
                      {tx.date} · {tx.category} · {account?.name ?? '—'}
                      {tx.notes ? ` · ${tx.notes}` : ''}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.amount,
                      { color: tx.amount >= 0 ? palette.success : palette.text },
                    ]}
                  >
                    {tx.amount >= 0 ? '+' : ''}
                    {formatCurrency(tx.amount)}
                  </Text>
                </Pressable>
              );
            })}
            {filtered.length > 300 ? (
              <Text style={[styles.overflow, { color: palette.textSubtle }]}>
                Showing first 300 of {filtered.length}. Refine filters for more.
              </Text>
            ) : null}
          </View>
        )}
      </Card>

      <Modal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        title="Add transaction"
        subtitle="Manual entries are saved as reviewed."
        footer={
          <>
            <Button label="Cancel" variant="ghost" onPress={() => setShowAdd(false)} />
            <Button label="Save transaction" onPress={submitAdd} />
          </>
        }
      >
        <Input label="Date (YYYY-MM-DD)" value={addDate} onChangeText={setAddDate} />
        <Input label="Payee" value={addPayee} onChangeText={setAddPayee} placeholder="Payee name" />
        <Input
          label="Amount (negative for expense)"
          value={addAmount}
          onChangeText={setAddAmount}
          placeholder="-12.50"
          keyboardType="decimal-pad"
        />
        <Select
          label="Account"
          value={addAccount}
          onChange={setAddAccount}
          options={accounts.map((a) => ({ value: a.id, label: a.name }))}
        />
        <Select
          label="Category"
          value={addCategory}
          onChange={setAddCategory}
          options={categoryOptions.map((c) => ({ value: c, label: c, icon: getCategoryIcon(c) }))}
        />
        <Input label="Notes" value={addNotes} onChangeText={setAddNotes} placeholder="Optional" />
      </Modal>

      <EditTransactionModal
        transaction={editing}
        state={state}
        onClose={() => setEditing(null)}
        onSave={(id, patch) => {
          onStateChange(updateTransaction(state, id, patch));
          setEditing(null);
        }}
        onToggleReview={(id) => {
          onStateChange(toggleTransactionReview(state, id));
          setEditing(null);
        }}
        onDelete={(id) => {
          onStateChange(deleteTransaction(state, id));
          setEditing(null);
        }}
      />
    </View>
  );
}

interface EditProps {
  transaction: FinanceTransaction | null;
  state: FinanceState;
  onClose: () => void;
  onSave: (id: string, patch: Parameters<typeof updateTransaction>[2]) => void;
  onToggleReview: (id: string) => void;
  onDelete: (id: string) => void;
}

function EditTransactionModal({ transaction, state, onClose, onSave, onToggleReview, onDelete }: EditProps) {
  const { palette } = useTheme();
  const accounts = useMemo(() => getAccountsWithBalances(state), [state]);
  const categoryOptions = useMemo(() => getCategoryOptions(), []);
  const [date, setDate] = useState('');
  const [payee, setPayee] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Other');
  const [accountId, setAccountId] = useState('');
  const [notes, setNotes] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (transaction) {
      setDate(transaction.date);
      setPayee(transaction.payee);
      setAmount(String(transaction.amount));
      setCategory(transaction.category);
      setAccountId(transaction.accountId);
      setNotes(transaction.notes ?? '');
      setConfirmDelete(false);
    }
  }, [transaction]);

  if (!transaction) return null;

  const save = () => {
    const numeric = Number.parseFloat(amount);
    onSave(transaction.id, {
      date,
      payee,
      amount: Number.isFinite(numeric) ? numeric : transaction.amount,
      category,
      accountId,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Modal
      visible={Boolean(transaction)}
      onClose={onClose}
      title={transaction.reviewed ? 'Edit transaction' : 'Review transaction'}
      subtitle={transaction.source === 'imported' ? 'Imported from statement' : 'Manually added'}
      footer={
        <>
          <Button
            label={confirmDelete ? 'Confirm delete' : 'Delete'}
            variant={confirmDelete ? 'danger' : 'ghost'}
            onPress={() => {
              if (confirmDelete) onDelete(transaction.id);
              else setConfirmDelete(true);
            }}
          />
          <View style={{ flex: 1 }} />
          <Button
            label={transaction.reviewed ? 'Mark unreviewed' : 'Mark reviewed'}
            variant="secondary"
            onPress={() => onToggleReview(transaction.id)}
          />
          <Button label="Save" onPress={save} />
        </>
      }
    >
      <Input label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} />
      <Input label="Payee" value={payee} onChangeText={setPayee} />
      <Input label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      <Select
        label="Account"
        value={accountId}
        onChange={setAccountId}
        options={accounts.map((a) => ({ value: a.id, label: a.name }))}
      />
      <ScrollView style={{ maxHeight: 100 }} contentContainerStyle={{ gap: spacing.sm }}>
        <Select
          label="Category"
          value={category}
          onChange={setCategory}
          options={categoryOptions.map((c) => ({ value: c, label: c, icon: getCategoryIcon(c) }))}
        />
      </ScrollView>
      <Input label="Notes" value={notes} onChangeText={setNotes} />
      {confirmDelete ? (
        <Text style={{ color: palette.danger, fontSize: typography.small }}>
          Click Confirm delete to remove this transaction permanently.
        </Text>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  title: { fontSize: typography.display, fontWeight: '800' },
  subtitle: { fontSize: typography.small, marginTop: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  topLine: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  payee: { fontSize: typography.body, fontWeight: '700' },
  meta: { fontSize: typography.micro, marginTop: 3 },
  amount: { fontSize: typography.body, fontWeight: '800' },
  overflow: {
    fontSize: typography.micro,
    textAlign: 'center',
    padding: spacing.md,
  },
});
