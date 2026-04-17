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
  getReadyToAssign,
  removeBudget,
  setBudget,
  setBudgetViewMode,
  setBudgetRollover,
  updateBudgetMonthlyLimit,
} from '../finance/ledger';
import type { BudgetEnvelope, Budget, FinanceState } from '../finance/types';
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

  const envelopeMode = state.preferences.budgetViewMode === 'envelope';
  const statuses = useMemo(() => getBudgetStatus(state, year, month), [state, year, month]);
  const envelopeByBudgetId = useMemo(() => {
    const list = getBudgetEnvelopes(state, year, month);
    return new Map(list.map((e) => [e.budgetId, e]));
  }, [state.transactions, state.budgets, year, month]);
  const readyToAssign = useMemo(() => getReadyToAssign(state, year, month), [state.transactions, state.budgets, year, month]);
  const breakdown = useMemo(
    () => getCategoryBreakdown(state.transactions, year, month),
    [state.transactions, year, month],
  );
  const categoryOptions = useMemo(() => getCategoryOptions(), []);

  const [showAdd, setShowAdd] = useState(false);
  const [editCategory, setEditCategory] = useState<string | null>(null);
  const [category, setCategory] = useState('Groceries');
  const [limit, setLimit] = useState('');
  const [inlineLimits, setInlineLimits] = useState<Record<string, string>>({});

  const totalLimit = statuses.reduce((s, b) => s + b.limit, 0);
  const totalSpent = statuses.reduce((s, b) => s + b.spent, 0);

  const rows: Array<{ env: BudgetEnvelope; budget: Budget }> | null = envelopeMode
    ? state.budgets
        .map((budget) => {
          const env = envelopeByBudgetId.get(budget.id);
          return env ? { env, budget } : null;
        })
        .filter((r): r is { env: BudgetEnvelope; budget: Budget } => r !== null)
    : null;

  const unbudgeted = breakdown
    .filter((b) => !statuses.some((s) => s.category === b.category))
    .slice(0, 4);

  const openAdd = () => {
    setEditCategory(null);
    setCategory('Groceries');
    setLimit('');
    setShowAdd(true);
  };

  const openEdit = (cat: string, currentLimit: number) => {
    setEditCategory(cat);
    setCategory(cat);
    setLimit(String(currentLimit));
    setShowAdd(true);
  };

  const save = () => {
    const numeric = Number.parseFloat(limit);
    if (!Number.isFinite(numeric) || numeric < 0) return;
    onStateChange(setBudget(state, category, numeric));
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
            {now.toLocaleString('default', { month: 'long', year: 'numeric' })} ·{' '}
            {envelopeMode
              ? `${formatCurrency(totalSpent)} spent · ${formatCurrency(totalLimit)} assigned`
              : `${formatCurrency(totalSpent)} spent of ${formatCurrency(totalLimit)} budgeted`}
          </Text>
        </View>
        <Button label="New budget" onPress={openAdd} />
      </View>

      <View style={styles.modeRow}>
        <Text style={[styles.modeLabel, { color: palette.textMuted }]}>View</Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
          <Pressable
            onPress={() => onStateChange(setBudgetViewMode(state, 'flow'))}
            style={({ hovered }) => [
              styles.modePill,
              {
                backgroundColor: !envelopeMode ? palette.primarySoft : palette.surface,
                borderColor: !envelopeMode ? palette.primary : hovered ? palette.primary : palette.borderSoft,
              },
            ]}
          >
            <Text style={{ color: palette.text, fontWeight: '700', fontSize: typography.small }}>Flow</Text>
          </Pressable>
          <Pressable
            onPress={() => onStateChange(setBudgetViewMode(state, 'envelope'))}
            style={({ hovered }) => [
              styles.modePill,
              {
                backgroundColor: envelopeMode ? palette.primarySoft : palette.surface,
                borderColor: envelopeMode ? palette.primary : hovered ? palette.primary : palette.borderSoft,
              },
            ]}
          >
            <Text style={{ color: palette.text, fontWeight: '700', fontSize: typography.small }}>Envelope</Text>
          </Pressable>
        </View>
      </View>

      {envelopeMode ? (
        <Card title="Ready to assign" eyebrow="This month’s income minus assigned to categories">
          <Text style={[styles.rtaAmount, { color: readyToAssign < 0 ? palette.danger : palette.primary }]}>
            {formatCurrency(readyToAssign)}
          </Text>
          <Text style={{ color: palette.textSubtle, fontSize: typography.small, marginTop: 6, lineHeight: 19 }}>
            Assign dollars to envelopes until this reaches zero. Income uses all positive inflows this month.
          </Text>
        </Card>
      ) : null}

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
                  setShowAdd(true);
                }}
              />
            ))}
          </View>
        </Card>
      ) : envelopeMode && rows ? (
        <View style={{ gap: spacing.md }}>
          {rows.map(({ env, budget }) => {
            if (!budget) return null;
            const pct =
              env.assigned + env.carriedIn > 0
                ? Math.min(1, env.spent / (env.assigned + env.carriedIn))
                : budget.monthlyLimit > 0
                  ? Math.min(1, env.spent / budget.monthlyLimit)
                  : 0;
            const color =
              env.status === 'over'
                ? palette.danger
                : env.status === 'warning'
                  ? palette.warning
                  : palette.success;
            const limitKey = budget.id;
            const limitDraft =
              inlineLimits[limitKey] ?? String(budget.monthlyLimit === 0 ? '' : budget.monthlyLimit);

            return (
              <View
                key={budget.id}
                style={[
                  styles.budget,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.borderSoft,
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
                      <Text style={{ fontSize: 20 }}>{getCategoryIcon(env.category)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Pressable onPress={() => openEdit(env.category, budget.monthlyLimit)}>
                        <Text style={[styles.cat, { color: palette.text }]}>{env.category}</Text>
                      </Pressable>
                      <Text style={[styles.catMeta, { color: palette.textMuted }]}>
                        Rolled in {formatCurrency(env.carriedIn)} · spent {formatCurrency(env.spent)}
                      </Text>
                    </View>
                  </View>
                  <Badge
                    label={
                      env.status === 'over'
                        ? 'Over envelope'
                        : env.status === 'warning'
                          ? 'Getting close'
                          : 'On track'
                    }
                    tone={
                      env.status === 'over' ? 'danger' : env.status === 'warning' ? 'warning' : 'success'
                    }
                  />
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, alignItems: 'flex-end' }}>
                  <View style={{ flex: 1, minWidth: 140 }}>
                    <Text style={[styles.inlineLabel, { color: palette.textMuted }]}>Assigned (monthly)</Text>
                    <Input
                      value={limitDraft}
                      onChangeText={(t) => setInlineLimits((prev) => ({ ...prev, [limitKey]: t }))}
                      onBlur={() => {
                        const n = Number.parseFloat(limitDraft);
                        if (Number.isFinite(n) && n >= 0) {
                          onStateChange(updateBudgetMonthlyLimit(state, budget.id, n));
                          setInlineLimits((prev) => {
                            const next = { ...prev };
                            delete next[limitKey];
                            return next;
                          });
                        }
                      }}
                      placeholder="0"
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Text style={{ color: palette.textMuted, fontSize: typography.small }}>Rollover</Text>
                    <Button
                      label={budget.rollover !== false ? 'On' : 'Off'}
                      size="sm"
                      variant="secondary"
                      onPress={() =>
                        onStateChange(setBudgetRollover(state, budget.id, !(budget.rollover !== false)))
                      }
                    />
                  </View>
                </View>
                <View style={[styles.track, { backgroundColor: palette.surfaceSunken }]}>
                  <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: color }]} />
                </View>
                <Text
                  style={[
                    styles.remaining,
                    { color: env.available < 0 ? palette.danger : palette.textSubtle },
                  ]}
                >
                  {env.available >= 0
                    ? `${formatCurrency(env.available)} available`
                    : `${formatCurrency(Math.abs(env.available))} over available`}
                </Text>
                <Pressable onPress={() => openEdit(env.category, budget.monthlyLimit)}>
                  <Text style={{ color: palette.primary, fontSize: typography.micro, fontWeight: '700' }}>
                    Edit in modal · remove
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={{ gap: spacing.md }}>
          {statuses.map((status) => {
            const pct = Math.min(1, status.pct);
            const color =
              status.status === 'over'
                ? palette.danger
                : status.status === 'warning'
                  ? palette.warning
                  : palette.success;
            return (
              <Pressable
                key={status.category}
                onPress={() => openEdit(status.category, status.limit)}
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
                        {formatCurrency(status.spent)} of {formatCurrency(status.limit)} ·{' '}
                        {Math.round(status.pct * 100)}%
                      </Text>
                    </View>
                  </View>
                  <Badge
                    label={
                      status.status === 'over'
                        ? 'Over budget'
                        : status.status === 'warning'
                          ? 'Getting close'
                          : 'On track'
                    }
                    tone={
                      status.status === 'over'
                        ? 'danger'
                        : status.status === 'warning'
                          ? 'warning'
                          : 'success'
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
                  {status.limit - status.spent > 0
                    ? `${formatCurrency(status.limit - status.spent)} remaining`
                    : `${formatCurrency(status.spent - status.limit)} over`}
                </Text>
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
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  title: { fontSize: typography.display, fontWeight: '800' },
  subtitle: { fontSize: typography.small, marginTop: 4 },
  modeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  modeLabel: { fontSize: typography.small, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  modePill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  rtaAmount: { fontSize: 28, fontWeight: '800', letterSpacing: -0.3 },
  inlineLabel: { fontSize: typography.micro, fontWeight: '700', marginBottom: 4, textTransform: 'uppercase' },
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
});
