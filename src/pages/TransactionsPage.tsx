import { useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { DateInput } from '../components/ui/DateInput';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Select } from '../components/ui/Select';
import { buildTransactionsCsv } from '../finance/export';
import {
  addManualTransaction,
  deleteTransaction,
  deleteTransactions,
  getAccountsWithBalances,
  getAllTags,
  getCategoryIcon,
  getCategoryOptions,
  normalizeTag,
  setTransactionsCategory,
  setTransactionsReviewed,
  setTransactionsTags,
  toggleTransactionReview,
  updateTransaction,
} from '../finance/ledger';
import type { FinanceState, FinanceTransaction } from '../finance/types';
import { useTheme } from '../theme/ThemeContext';
import { radius, spacing, typography } from '../theme/tokens';
import { downloadText, formatCurrency, formatIsoDate } from '../utils/format';

interface TransactionsPageProps {
  state: FinanceState;
  onStateChange: (next: FinanceState) => void;
}

type FilterTab = 'all' | 'unreviewed' | 'income' | 'expense';

export function TransactionsPage({ state, onStateChange }: TransactionsPageProps) {
  const { palette } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const narrow = windowWidth < 640;
  const accounts = useMemo(() => getAccountsWithBalances(state), [state]);
  const categoryOptions = useMemo(() => getCategoryOptions(), []);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterTab>('all');
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const allTags = useMemo(() => getAllTags(state), [state]);

  const [showAdd, setShowAdd] = useState(false);
  const [addDate, setAddDate] = useState(() => formatIsoDate());
  const [addPayee, setAddPayee] = useState('');
  const [addAmount, setAddAmount] = useState('');
  const [addCategory, setAddCategory] = useState('Other');
  const [addNotes, setAddNotes] = useState('');
  const [addAccount, setAddAccount] = useState<string>(accounts[0]?.id ?? '');

  const [editing, setEditing] = useState<FinanceTransaction | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set<string>());
  const [bulkCategory, setBulkCategory] = useState<string>('Other');
  const [bulkTagDraft, setBulkTagDraft] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const min = Number.parseFloat(minAmount);
    const max = Number.parseFloat(maxAmount);
    const hasMin = Number.isFinite(min);
    const hasMax = Number.isFinite(max);
    return state.transactions
      .filter((tx) => {
        if (accountFilter !== 'all' && tx.accountId !== accountFilter) return false;
        if (categoryFilter !== 'all' && tx.category !== categoryFilter) return false;
        if (tagFilter !== 'all' && !(tx.tags ?? []).includes(tagFilter)) return false;
        if (filter === 'unreviewed' && tx.reviewed) return false;
        if (filter === 'income' && tx.amount <= 0) return false;
        if (filter === 'expense' && tx.amount >= 0) return false;
        if (dateFrom && tx.date < dateFrom) return false;
        if (dateTo && tx.date > dateTo) return false;
        if (hasMin && Math.abs(tx.amount) < min) return false;
        if (hasMax && Math.abs(tx.amount) > max) return false;
        if (q) {
          const hay = `${tx.payee} ${tx.category} ${tx.notes ?? ''} ${(tx.tags ?? []).join(' ')}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [
    state.transactions,
    query,
    filter,
    accountFilter,
    categoryFilter,
    tagFilter,
    dateFrom,
    dateTo,
    minAmount,
    maxAmount,
  ]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const tx of filtered) {
      if (tx.amount > 0) income += tx.amount;
      else expense += Math.abs(tx.amount);
    }
    return { income, expense, net: income - expense };
  }, [filtered]);

  // Drop any selections that are no longer visible/exist.
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const visible = new Set(filtered.map((tx) => tx.id));
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (visible.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [filtered]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const selectAllVisible = () => {
    setSelectedIds(new Set(filtered.slice(0, 300).map((tx) => tx.id)));
  };

  const bulkMarkReviewed = (reviewed: boolean) => {
    if (selectedIds.size === 0) return;
    onStateChange(setTransactionsReviewed(state, Array.from(selectedIds), reviewed));
    clearSelection();
  };

  const bulkDelete = () => {
    if (selectedIds.size === 0) return;
    onStateChange(deleteTransactions(state, Array.from(selectedIds)));
    clearSelection();
  };

  const bulkRecategorize = () => {
    if (selectedIds.size === 0) return;
    onStateChange(setTransactionsCategory(state, Array.from(selectedIds), bulkCategory));
    clearSelection();
  };

  const applyBulkTags = (mode: 'merge' | 'remove') => {
    if (selectedIds.size === 0) return;
    const tokens = bulkTagDraft
      .split(/[\s,]+/)
      .map((t) => normalizeTag(t))
      .filter((t): t is string => Boolean(t));
    if (tokens.length === 0) return;
    onStateChange(setTransactionsTags(state, Array.from(selectedIds), tokens, mode));
    setBulkTagDraft('');
    clearSelection();
  };

  const exportFilteredCsv = () => {
    const csv = buildTransactionsCsv(state, { transactions: filtered });
    downloadText(
      csv,
      `ledgerline-filtered-${new Date().toISOString().slice(0, 10)}.csv`,
      'text/csv',
    );
  };

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
        <Button
          label={narrow ? 'Export CSV' : 'Export filtered CSV'}
          variant="ghost"
          onPress={exportFilteredCsv}
          disabled={filtered.length === 0}
        />
        {narrow ? null : (
          <Button label="Add transaction" onPress={() => setShowAdd(true)} />
        )}
      </View>

      {selectedIds.size > 0 ? (
        <View
          style={[
            styles.bulkBar,
            {
              backgroundColor: palette.primarySoft,
              borderColor: palette.primary,
            },
          ]}
        >
          <Text style={{ color: palette.primary, fontWeight: '800' }}>
            {selectedIds.size} selected
          </Text>
          <View style={{ flex: 1 }} />
          <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button label="Review" size="sm" variant="secondary" onPress={() => bulkMarkReviewed(true)} />
            <Button label="Unreview" size="sm" variant="ghost" onPress={() => bulkMarkReviewed(false)} />
            <View style={{ minWidth: 150 }}>
              <Select
                value={bulkCategory}
                onChange={setBulkCategory}
                options={categoryOptions.map((c) => ({
                  value: c,
                  label: c,
                  icon: getCategoryIcon(c),
                }))}
              />
            </View>
            <Button label="Apply" size="sm" variant="primary" onPress={bulkRecategorize} />
            <View style={{ minWidth: 160, flexDirection: 'row', gap: 4 }}>
              <Input
                value={bulkTagDraft}
                onChangeText={setBulkTagDraft}
                placeholder="tag1, tag2"
                style={{ flex: 1 }}
              />
            </View>
            <Button
              label="Add tags"
              size="sm"
              variant="secondary"
              onPress={() => applyBulkTags('merge')}
              disabled={!bulkTagDraft.trim()}
            />
            <Button
              label="Remove tags"
              size="sm"
              variant="ghost"
              onPress={() => applyBulkTags('remove')}
              disabled={!bulkTagDraft.trim()}
            />
            <Button label="Delete" size="sm" variant="danger" onPress={bulkDelete} />
            <Button label="Clear" size="sm" variant="ghost" onPress={clearSelection} />
          </View>
        </View>
      ) : null}

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
          {allTags.length > 0 ? (
            <Select
              label="Tag"
              value={tagFilter}
              onChange={setTagFilter}
              options={[
                { value: 'all', label: 'Any tag' },
                ...allTags.map(({ tag, count }) => ({
                  value: tag,
                  label: `#${tag} (${count})`,
                })),
              ]}
            />
          ) : null}
          <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
            <Button
              label={showAdvanced ? 'Hide date & amount filters' : 'Date & amount filters'}
              variant="ghost"
              size="sm"
              onPress={() => setShowAdvanced((v) => !v)}
            />
            {dateFrom || dateTo || minAmount || maxAmount ? (
              <Button
                label="Clear"
                variant="ghost"
                size="sm"
                onPress={() => {
                  setDateFrom('');
                  setDateTo('');
                  setMinAmount('');
                  setMaxAmount('');
                }}
              />
            ) : null}
          </View>
          {showAdvanced ? (
            <View style={{ gap: spacing.sm }}>
              <View style={styles.filterPair}>
                <View style={{ flex: 1, minWidth: 160 }}>
                  <DateInput label="From date" value={dateFrom} onChange={setDateFrom} />
                </View>
                <View style={{ flex: 1, minWidth: 160 }}>
                  <DateInput label="To date" value={dateTo} onChange={setDateTo} />
                </View>
              </View>
              <View style={styles.filterPair}>
                <View style={{ flex: 1, minWidth: 160 }}>
                  <Input
                    label="Min amount"
                    value={minAmount}
                    onChangeText={setMinAmount}
                    placeholder="0"
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={{ flex: 1, minWidth: 160 }}>
                  <Input
                    label="Max amount"
                    value={maxAmount}
                    onChangeText={setMaxAmount}
                    placeholder="10000"
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
              <Text style={{ color: palette.textSubtle, fontSize: typography.micro }}>
                Amount filters use the absolute value (ignores sign).
              </Text>
            </View>
          ) : null}
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
            <View style={[styles.bulkHeader, { borderBottomColor: palette.borderSoft }]}>
              <Pressable
                onPress={
                  selectedIds.size > 0 ? clearSelection : selectAllVisible
                }
                style={styles.checkboxWrap}
              >
                <View
                  style={[
                    styles.checkbox,
                    {
                      borderColor:
                        selectedIds.size > 0 ? palette.primary : palette.border,
                      backgroundColor:
                        selectedIds.size > 0 ? palette.primary : 'transparent',
                    },
                  ]}
                >
                  {selectedIds.size > 0 ? (
                    <Text style={{ color: palette.primaryText, fontWeight: '800' }}>
                      {selectedIds.size === filtered.length ? '✓' : '—'}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
              <Text style={[styles.bulkHeaderText, { color: palette.textSubtle }]}>
                {selectedIds.size === 0
                  ? 'Select to bulk-review or recategorize'
                  : `${selectedIds.size} of ${filtered.length} selected`}
              </Text>
            </View>
            {filtered.slice(0, 300).map((tx) => {
              const account = accounts.find((a) => a.id === tx.accountId);
              const selected = selectedIds.has(tx.id);
              return (
                <Pressable
                  key={tx.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${tx.payee}, ${formatCurrency(tx.amount)}, ${tx.date}, ${
                    account?.name ?? 'unknown account'
                  }, ${tx.category}${tx.reviewed ? '' : ', to review'}`}
                  accessibilityHint="Opens editor. Long press to multi-select."
                  onPress={() => {
                    if (selectedIds.size > 0) {
                      toggleSelect(tx.id);
                    } else {
                      setEditing(tx);
                    }
                  }}
                  onLongPress={() => toggleSelect(tx.id)}
                  style={({ hovered }) => [
                    styles.row,
                    {
                      borderBottomColor: palette.borderSoft,
                      backgroundColor: selected
                        ? palette.primarySoft
                        : hovered
                          ? palette.surfaceSunken
                          : 'transparent',
                    },
                  ]}
                >
                  <Pressable
                    onPress={() => toggleSelect(tx.id)}
                    style={styles.checkboxWrap}
                    hitSlop={6}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        {
                          borderColor: selected ? palette.primary : palette.border,
                          backgroundColor: selected ? palette.primary : 'transparent',
                        },
                      ]}
                    >
                      {selected ? (
                        <Text
                          style={{ color: palette.primaryText, fontWeight: '800', fontSize: 12 }}
                        >
                          ✓
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                  <View style={styles.rowIcon}>
                    <Text style={{ fontSize: 18 }}>{getCategoryIcon(tx.category)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.topLine}>
                      <Text style={[styles.payee, { color: palette.text }]}>{tx.payee}</Text>
                      {!tx.reviewed ? <Badge label="To review" tone="warning" /> : null}
                      {(tx.tags ?? []).map((t) => (
                        <Pressable
                          key={t}
                          onPress={() => setTagFilter(t)}
                          accessibilityRole="button"
                          accessibilityLabel={`Filter by tag ${t}`}
                          style={[
                            styles.tagChip,
                            {
                              backgroundColor:
                                tagFilter === t ? palette.primary : palette.surfaceSunken,
                              borderColor:
                                tagFilter === t ? palette.primary : palette.borderSoft,
                            },
                          ]}
                        >
                          <Text
                            style={{
                              color: tagFilter === t ? palette.primaryText : palette.textMuted,
                              fontSize: typography.micro,
                              fontWeight: '700',
                            }}
                          >
                            #{t}
                          </Text>
                        </Pressable>
                      ))}
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
        <DateInput label="Date" value={addDate} onChange={setAddDate} />
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
      {narrow ? (
        <Pressable
          onPress={() => setShowAdd(true)}
          accessibilityRole="button"
          accessibilityLabel="Add transaction"
          style={({ pressed, hovered }) => [
            styles.fab,
            Platform.OS === 'web' ? (webFixedFab as object) : null,
            {
              backgroundColor: palette.primary,
              shadowColor: '#000',
              opacity: pressed ? 0.9 : hovered ? 0.95 : 1,
            },
          ]}
        >
          <Text style={styles.fabPlus}>+</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const webFixedFab = {
  position: 'fixed' as const,
  bottom: 20,
  right: 20,
  zIndex: 50,
};

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
  const [tagsDraft, setTagsDraft] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (transaction) {
      setDate(transaction.date);
      setPayee(transaction.payee);
      setAmount(String(transaction.amount));
      setCategory(transaction.category);
      setAccountId(transaction.accountId);
      setNotes(transaction.notes ?? '');
      setTagsDraft((transaction.tags ?? []).join(' '));
      setConfirmDelete(false);
    }
  }, [transaction]);

  const allTags = useMemo(() => getAllTags(state), [state]);

  if (!transaction) return null;

  const parsedTags = tagsDraft
    .split(/[\s,]+/)
    .map((t) => normalizeTag(t))
    .filter((t): t is string => Boolean(t));

  const suggestedTags = allTags
    .map((entry) => entry.tag)
    .filter((t) => !parsedTags.includes(t))
    .slice(0, 8);

  const addTagToDraft = (tag: string) => {
    const next = [...parsedTags, tag].join(' ');
    setTagsDraft(next);
  };

  const save = () => {
    const numeric = Number.parseFloat(amount);
    onSave(transaction.id, {
      date,
      payee,
      amount: Number.isFinite(numeric) ? numeric : transaction.amount,
      category,
      accountId,
      notes: notes.trim() || undefined,
      tags: parsedTags,
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
      <DateInput label="Date" value={date} onChange={setDate} />
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
      <Input
        label="Tags (space or comma separated)"
        value={tagsDraft}
        onChangeText={setTagsDraft}
        placeholder="trip-2026 tax reimbursable"
      />
      {suggestedTags.length > 0 ? (
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          <Text style={{ color: palette.textSubtle, fontSize: typography.micro, marginRight: 4 }}>
            Add existing:
          </Text>
          {suggestedTags.map((t) => (
            <Pressable
              key={t}
              onPress={() => addTagToDraft(t)}
              accessibilityRole="button"
              accessibilityLabel={`Add tag ${t}`}
              style={[
                styles.tagChip,
                {
                  backgroundColor: palette.surfaceSunken,
                  borderColor: palette.borderSoft,
                },
              ]}
            >
              <Text style={{ color: palette.textMuted, fontSize: typography.micro, fontWeight: '700' }}>
                #{t}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
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
  bulkBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexWrap: 'wrap',
  },
  bulkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  bulkHeaderText: {
    fontSize: typography.micro,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  checkboxWrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  tagChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  filterPair: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
    alignItems: 'flex-end',
  },
  fab: {
    position: 'absolute',
    bottom: spacing.lg,
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  fabPlus: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 34,
    marginTop: -2,
  },
});
