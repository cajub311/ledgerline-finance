import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Select } from '../components/ui/Select';
import {
  getBudgetEnvelopes,
  getBudgetStatus,
  getCategoryBreakdown,
  getCategoryIcon,
  getCategoryOptions,
  getEnvelopeAssignedTotal,
  getFinanceSummary,
  getReadyToAssign,
  patchBudget,
  removeBudget,
  setBudget,
  setBudgetEnvelopeMode,
} from '../finance/ledger';
import type { FinanceState } from '../finance/types';
import { useTheme } from '../theme/ThemeContext';
import { radius, spacing, typography } from '../theme/tokens';
import { formatCurrency } from '../utils/format';

interface BudgetsPageProps {
  state: FinanceState;
  onStateChange: (next: FinanceState) => void;
}

export function BudgetsPage({ state, onStateChange }: BudgetsPageProps) {
  const { palette } = useTheme();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const envelopeMode = state.preferences.budgetEnvelopeMode;

  const statuses = useMemo(() => getBudgetStatus(state, year, month), [state, year, month]);
  const envelopesById = useMemo(
    () => getBudgetEnvelopes(state, year, month),
    [state.transactions, state.budgets, year, month],
  );
  const readyToAssign = useMemo(() => getReadyToAssign(state, year, month), [state, year, month]);
  const summary = useMemo(() => getFinanceSummary(state), [state]);
  const assignedThisMonth = useMemo(
    () => getEnvelopeAssignedTotal(state, year, month),
    [state.budgets, year, month],
  );

  const breakdown = useMemo(
    () => getCategoryBreakdown(state.transactions, year, month),
    [state.transactions, year, month],
  );
  const categoryOptions = useMemo(() => getCategoryOptions(), []);

  const [showAdd, setShowAdd] = useState(false);
  const [editCategory, setEditCategory] = useState<string | null>(null);
  const [category, setCategory] = useState('Groceries');
  const [limit, setLimit] = useState('');
  const [rolloverDraft, setRolloverDraft] = useState(true);

  const totalLimit = statuses.reduce((s, b) => s + b.limit, 0);
  const totalSpent = statuses.reduce((s, b) => s + b.spent, 0);

  const unbudgeted = breakdown
    .filter((b) => !statuses.some((s) => s.category === b.category))
    .slice(0, 4);

  const openAdd = () => {
    setEditCategory(null);
    setCategory('Groceries');
    setLimit('');
    setRolloverDraft(true);
    setShowAdd(true);
  };

  const openEdit = (cat: string, currentLimit: number, rollover: boolean) => {
    setEditCategory(cat);
    setCategory(cat);
    setLimit(String(currentLimit));
    setRolloverDraft(rollover);
    setShowAdd(true);
  };

  const save = () => {
    const numeric = Number.parseFloat(limit);
    if (!Number.isFinite(numeric) || numeric < 0) return;
    let next = setBudget(state, category, numeric);
    const b = next.budgets.find((x) => x.category === category);
    if (b) next = patchBudget(next, b.id, { rollover: rolloverDraft });
    onStateChange(next);
    setShowAdd(false);
  };

  const del = () => {
    if (editCategory) {
      onStateChange(removeBudget(state, editCategory));
      setShowAdd(false);
    }
  };

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={styles.header}>
        <View style={{ flex: 1, minWidth: 240 }}>
          <Text style={[styles.title, { color: palette.text }]}>Budgets</Text>
          <Text style={[styles.subtitle, { color: palette.textMuted }]}>
            {now.toLocaleString('default', { month: 'long', year: 'numeric' })} · {formatCurrency(totalSpent)} spent of{' '}
            {formatCurrency(totalLimit)} budgeted
          </Text>
        </View>
        <Button label="New budget" onPress={openAdd} />
      </View>

      <Card title="Budget style" eyebrow="View">
        <Select
          value={envelopeMode ? 'envelope' : 'flow'}
          onChange={(v) => onStateChange(setBudgetEnvelopeMode(state, v === 'envelope'))}
          options={[
            { value: 'flow', label: 'Flow (limit vs spent)' },
            { value: 'envelope', label: 'Envelope (rollover)' },
          ]}
        />
        {envelopeMode ? (
          <View
            style={[
              styles.rtaBanner,
              {
                backgroundColor:
                  readyToAssign >= 0 ? palette.successSoft : palette.dangerSoft,
                borderColor: readyToAssign >= 0 ? palette.success : palette.danger,
              },
            ]}
          >
            <Text style={[styles.rtaLabel, { color: palette.textMuted }]}>Ready to assign</Text>
            <Text
              style={[
                styles.rtaValue,
                { color: readyToAssign >= 0 ? palette.success : palette.danger },
              ]}
            >
              {formatCurrency(readyToAssign)}
            </Text>
            <Text style={[styles.rtaHint, { color: palette.textSubtle }]}>
              This month’s income ({formatCurrency(summary.monthIncome)}) minus assigned envelope limits (
              {formatCurrency(assignedThisMonth)}).
            </Text>
          </View>
        ) : null}
      </Card>

      {statuses.length === 0 ? (
        <Card
          title="Start with a budget"
          eyebrow="Recommended"
        >
          <Text style={{ color: palette.textMuted, fontSize: typography.small, lineHeight: 20 }}>
            Cap discretionary categories like Dining, Groceries, or Shopping. Budgets update in real time
            as transactions come in.
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
            {['Groceries', 'Dining', 'Shopping', 'Subscriptions', 'Fuel'].map((c) => (
              <Button
                key={c}
                label={`+ ${c}`}
                variant="secondary"
                size="sm"
                onPress={() => {
                  setEditCategory(null);
                  setCategory(c);
                  setLimit('');
                  setRolloverDraft(true);
                  setShowAdd(true);
                }}
              />
            ))}
          </View>
        </Card>
      ) : (
        <View style={{ gap: spacing.md }}>
          {statuses.map((status) => {
            const budgetRow = state.budgets.find((b) => b.category === status.category);
            const env = budgetRow ? envelopesById[budgetRow.id] : undefined;
            const displayOver = envelopeMode && env ? env.available < 0 : status.status === 'over';
            const displayWarn = envelopeMode && env ? env.status === 'warning' && !displayOver : status.status === 'warning';
            const envelopeDenom =
              envelopeMode && env ? Math.abs(env.carriedIn + env.assigned) : 0;
            const pct =
              envelopeMode && env
                ? Math.min(1, envelopeDenom > 1e-6 ? env.spent / envelopeDenom : 0)
                : Math.min(1, status.pct);
            const color =
              displayOver
                ? palette.danger
                : displayWarn
                  ? palette.warning
                  : palette.success;
            return (
              <Pressable
                key={status.category}
                onPress={() =>
                  openEdit(status.category, status.limit, budgetRow?.rollover !== false)
                }
                style={({ hovered }) => [
                  styles.budget,
                  {
                    backgroundColor: palette.surface,
                    borderColor: hovered ? palette.primary : palette.borderSoft,
                  },
                ]}
              >
                <View style={styles.budgetTop}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 }}>
                    <View
                      style={[
                        styles.iconChip,
                        { backgroundColor: palette.surfaceSunken, borderColor: palette.borderSoft },
                      ]}
                    >
                      <Text style={{ fontSize: 20 }}>{getCategoryIcon(status.category)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cat, { color: palette.text }]}>{status.category}</Text>
                      <Text style={[styles.catMeta, { color: palette.textMuted }]}>
                        {envelopeMode && env ? (
                          <>
                            Spent {formatCurrency(env.spent)} · assigned {formatCurrency(env.assigned)}
                            {env.carriedIn !== 0 ? ` · rolled ${formatCurrency(env.carriedIn)}` : ''} · available{' '}
                            {formatCurrency(env.available)} · {Math.round(Math.min(1, pct) * 100)}%
                          </>
                        ) : (
                          <>
                            {formatCurrency(status.spent)} of {formatCurrency(status.limit)} ·{' '}
                            {Math.round(status.pct * 100)}%
                          </>
                        )}
                      </Text>
                    </View>
                  </View>
                  <Badge
                    label={
                      displayOver
                        ? 'Over budget'
                        : displayWarn
                          ? 'Getting close'
                          : 'On track'
                    }
                    tone={
                      displayOver ? 'danger' : displayWarn ? 'warning' : 'success'
                    }
                  />
                </View>
                <View style={[styles.track, { backgroundColor: palette.surfaceSunken }]}>
                  <View
                    style={[
                      styles.fill,
                      { width: `${pct * 100}%`, backgroundColor: color },
                    ]}
                  />
                </View>
                <Text style={[styles.remaining, { color: palette.textSubtle }]}>
                  {envelopeMode && env
                    ? env.available >= 0
                      ? `${formatCurrency(env.available)} available`
                      : `${formatCurrency(Math.abs(env.available))} over`
                    : status.limit - status.spent > 0
                      ? `${formatCurrency(status.limit - status.spent)} remaining`
                      : `${formatCurrency(status.spent - status.limit)} over`}
                </Text>
                {envelopeMode && budgetRow ? (
                  <View style={styles.inlineLimit}>
                    <Input
                      label="Monthly limit"
                      value={String(budgetRow.monthlyLimit)}
                      onChangeText={(t) => {
                        if (t.trim() === '') return;
                        const n = Number.parseFloat(t);
                        if (!Number.isFinite(n) || n < 0) return;
                        onStateChange(patchBudget(state, budgetRow.id, { monthlyLimit: n }));
                      }}
                      keyboardType="decimal-pad"
                    />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      )}

      {unbudgeted.length > 0 ? (
        <Card title="Categories you're spending on (without a budget)" eyebrow="Suggestions">
          <View style={{ gap: spacing.sm }}>
            {unbudgeted.map((b) => (
              <View key={b.category} style={styles.rowBetween}>
                <Text style={{ color: palette.text, fontWeight: '600' }}>
                  <Text>{getCategoryIcon(b.category)}  </Text>
                  {b.category}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <Text style={{ color: palette.textMuted }}>{formatCurrency(b.total)}</Text>
                  <Button
                    label="Set budget"
                    size="sm"
                    variant="secondary"
                    onPress={() => {
                      setEditCategory(null);
                      setCategory(b.category);
                      setLimit(String(Math.ceil(b.total / 10) * 10));
                      setRolloverDraft(true);
                      setShowAdd(true);
                    }}
                  />
                </View>
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      <Modal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        title={editCategory ? 'Edit budget' : 'New budget'}
        footer={
          <>
            {editCategory ? (
              <Button label="Remove" variant="danger" onPress={del} />
            ) : null}
            <View style={{ flex: 1 }} />
            <Button label="Cancel" variant="ghost" onPress={() => setShowAdd(false)} />
            <Button label="Save" onPress={save} />
          </>
        }
      >
        {editCategory ? null : (
          <Select
            label="Category"
            value={category}
            onChange={setCategory}
            options={categoryOptions.map((c) => ({ value: c, label: c, icon: getCategoryIcon(c) }))}
          />
        )}
        <Input
          label="Monthly limit (USD)"
          value={limit}
          onChangeText={setLimit}
          placeholder="e.g. 400"
          keyboardType="decimal-pad"
        />
        <Select
          label="Rollover unused balance"
          value={rolloverDraft ? 'on' : 'off'}
          onChange={(v) => setRolloverDraft(v === 'on')}
          options={[
            { value: 'on', label: 'On (surplus rolls forward)' },
            { value: 'off', label: 'Off (surplus does not roll; debt still rolls)' },
          ]}
        />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  title: { fontSize: typography.display, fontWeight: '800' },
  subtitle: { fontSize: typography.small, marginTop: 4 },
  budget: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  budgetTop: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  iconChip: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  cat: { fontSize: typography.subtitle, fontWeight: '700' },
  catMeta: { fontSize: typography.small, marginTop: 2 },
  track: { height: 8, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
  remaining: { fontSize: typography.small, fontWeight: '600' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rtaBanner: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 4,
  },
  rtaLabel: { fontSize: typography.micro, fontWeight: '700', textTransform: 'uppercase' },
  rtaValue: { fontSize: typography.title, fontWeight: '800' },
  rtaHint: { fontSize: typography.micro, lineHeight: 17, marginTop: 4 },
  inlineLimit: { marginTop: spacing.sm },
});
