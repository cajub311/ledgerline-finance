import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

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
  getFinanceSummary,
  removeBudget,
  setBudget,
  setBudgetRollover,
  setBudgetViewMode,
} from '../finance/ledger';
import type { FinanceState } from '../finance/types';
import { useTheme } from '../theme/ThemeContext';
import { radius, spacing, typography } from '../theme/tokens';
import { formatCurrency } from '../utils/format';

interface BudgetsPageProps {
  state: FinanceState;
  onStateChange: (next: FinanceState) => void;
}

function budgetStartMonthIndex(createdAt: string, fallbackYear: number, fallbackMonth: number): number {
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return fallbackYear * 12 + (fallbackMonth - 1);
  return d.getFullYear() * 12 + d.getMonth();
}

export function BudgetsPage({ state, onStateChange }: BudgetsPageProps) {
  const { palette } = useTheme();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const currentMonthIndex = year * 12 + (month - 1);

  const summary = useMemo(() => getFinanceSummary(state), [state]);
  const statuses = useMemo(() => getBudgetStatus(state, year, month), [state, year, month]);
  const envelopes = useMemo(
    () => getBudgetEnvelopes(state, year, month),
    [state.transactions, state.budgets, year, month],
  );
  const envelopeById = useMemo(() => {
    const m: Record<string, (typeof envelopes)[0]> = {};
    for (const e of envelopes) m[e.budgetId] = e;
    return m;
  }, [envelopes]);

  const breakdown = useMemo(
    () => getCategoryBreakdown(state.transactions, year, month),
    [state.transactions, year, month],
  );
  const categoryOptions = useMemo(() => getCategoryOptions(), []);

  const budgetViewMode = state.preferences.budgetViewMode === 'envelope' ? 'envelope' : 'flow';

  const totalAssignedThisMonth = useMemo(() => {
    return state.budgets.reduce((sum, b) => {
      const startIdx = budgetStartMonthIndex(b.createdAt, year, month);
      if (currentMonthIndex < startIdx) return sum;
      return sum + b.monthlyLimit;
    }, 0);
  }, [state.budgets, year, month, currentMonthIndex]);

  const readyToAssign = Number((summary.monthIncome - totalAssignedThisMonth).toFixed(2));

  const [showAdd, setShowAdd] = useState(false);
  const [editCategory, setEditCategory] = useState<string | null>(null);
  const [category, setCategory] = useState('Groceries');
  const [limit, setLimit] = useState('');
  const [inlineLimits, setInlineLimits] = useState<Record<string, string>>({});

  const totalLimit = statuses.reduce((s, b) => s + b.limit, 0);
  const totalSpent = statuses.reduce((s, b) => s + b.spent, 0);

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

  const commitInlineLimit = useCallback(
    (budgetCategory: string, raw: string) => {
      const numeric = Number.parseFloat(raw.trim());
      if (!Number.isFinite(numeric) || numeric < 0) return;
      onStateChange(setBudget(state, budgetCategory, numeric));
    },
    [onStateChange, state],
  );

  const getInlineLimitValue = (budgetId: string, fallback: number) => {
    if (inlineLimits[budgetId] !== undefined) return inlineLimits[budgetId];
    return String(fallback);
  };

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={styles.header}>
        <View style={{ flex: 1, minWidth: 240 }}>
          <Text style={[styles.title, { color: palette.text }]}>Budgets</Text>
          <Text style={[styles.subtitle, { color: palette.textMuted }]}>
            {now.toLocaleString('default', { month: 'long', year: 'numeric' })} ·{' '}
            {budgetViewMode === 'envelope' ? (
              <>
                {formatCurrency(totalSpent)} spent · envelopes use rollover into available
              </>
            ) : (
              <>
                {formatCurrency(totalSpent)} spent of {formatCurrency(totalLimit)} budgeted
              </>
            )}
          </Text>
        </View>
        <Button label="New budget" onPress={openAdd} />
      </View>

      <Card title="Budget style" eyebrow="View">
        <Select
          value={budgetViewMode}
          onChange={(v) => onStateChange(setBudgetViewMode(state, v))}
          options={[
            { value: 'flow', label: 'Flow (limit vs spent)' },
            { value: 'envelope', label: 'Envelope (rollover & available)' },
          ]}
        />
        {budgetViewMode === 'envelope' ? (
          <View
            style={[
              styles.readyBanner,
              { backgroundColor: palette.primarySoft, borderColor: palette.primary },
            ]}
          >
            <Text style={[styles.readyLabel, { color: palette.text }]}>Ready to assign</Text>
            <Text style={[styles.readyAmount, { color: palette.primary }]}>
              {formatCurrency(readyToAssign)}
            </Text>
            <Text style={[styles.readyHint, { color: palette.textMuted }]}>
              This month’s income ({formatCurrency(summary.monthIncome)}) minus assigned limits (
              {formatCurrency(totalAssignedThisMonth)}). Assign it to categories below.
            </Text>
          </View>
        ) : null}
      </Card>

      {statuses.length === 0 ? (
        <Card title="Start with a budget" eyebrow="Recommended">
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
      ) : (
        <View style={{ gap: spacing.md }}>
          {statuses.map((status) => {
            const budget = state.budgets.find((b) => b.category === status.category);
            const env = budget ? envelopeById[budget.id] : undefined;
            const pct = Math.min(1, status.pct);
            const flowColor =
              status.status === 'over'
                ? palette.danger
                : status.status === 'warning'
                  ? palette.warning
                  : palette.success;

            const envelopeColor =
              env && env.available < 0
                ? palette.danger
                : env?.status === 'warning'
                  ? palette.warning
                  : palette.success;

            const barColor = budgetViewMode === 'envelope' ? envelopeColor : flowColor;
            const cap = env ? env.assigned + env.carriedIn : 0;
            const barPct =
              budgetViewMode === 'envelope' && env
                ? cap > 0
                  ? Math.min(1, env.spent / cap)
                  : env.spent > 0
                    ? 1
                    : 0
                : pct;

            return (
              <Pressable
                key={status.category}
                onPress={() => {
                  if (budgetViewMode !== 'envelope') openEdit(status.category, status.limit);
                }}
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
                      {budgetViewMode === 'envelope' && env ? (
                        <Text style={[styles.catMeta, { color: palette.textMuted }]}>
                          Carried in {formatCurrency(env.carriedIn)} · Assigned {formatCurrency(env.assigned)} · Spent{' '}
                          {formatCurrency(env.spent)}
                        </Text>
                      ) : (
                        <Text style={[styles.catMeta, { color: palette.textMuted }]}>
                          {formatCurrency(status.spent)} of {formatCurrency(status.limit)} ·{' '}
                          {Math.round(status.pct * 100)}%
                        </Text>
                      )}
                    </View>
                  </View>
                  <Badge
                    label={
                      budgetViewMode === 'envelope' && env
                        ? env.available < 0
                          ? 'Over available'
                          : env.status === 'warning'
                            ? 'Getting close'
                            : 'On track'
                        : status.status === 'over'
                          ? 'Over budget'
                          : status.status === 'warning'
                            ? 'Getting close'
                            : 'On track'
                    }
                    tone={
                      budgetViewMode === 'envelope' && env
                        ? env.available < 0
                          ? 'danger'
                          : env.status === 'warning'
                            ? 'warning'
                            : 'success'
                        : status.status === 'over'
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
                      { width: `${Math.min(1, barPct) * 100}%`, backgroundColor: barColor },
                    ]}
                  />
                </View>
                {budgetViewMode === 'envelope' && env ? (
                  <Text style={[styles.remaining, { color: env.available < 0 ? palette.danger : palette.textSubtle }]}>
                    Available {formatCurrency(env.available)}
                  </Text>
                ) : (
                  <Text style={[styles.remaining, { color: palette.textSubtle }]}>
                    {status.limit - status.spent > 0
                      ? `${formatCurrency(status.limit - status.spent)} remaining`
                      : `${formatCurrency(status.spent - status.limit)} over`}
                  </Text>
                )}

                {budgetViewMode === 'envelope' && budget ? (
                  <View style={styles.envelopeRow}>
                    <View style={{ flex: 1, minWidth: 120 }}>
                      <Text style={[styles.inlineLabel, { color: palette.textMuted }]}>Monthly limit</Text>
                      <TextInput
                        value={getInlineLimitValue(budget.id, budget.monthlyLimit)}
                        onChangeText={(t) => setInlineLimits((prev) => ({ ...prev, [budget.id]: t }))}
                        onBlur={() => {
                          const raw = inlineLimits[budget.id];
                          if (raw === undefined) return;
                          commitInlineLimit(budget.category, raw);
                          setInlineLimits((prev) => {
                            const next = { ...prev };
                            delete next[budget.id];
                            return next;
                          });
                        }}
                        keyboardType="decimal-pad"
                        placeholder="0"
                        placeholderTextColor={palette.textSubtle}
                        style={[
                          styles.inlineInput,
                          {
                            borderColor: palette.border,
                            backgroundColor: palette.surfaceSunken,
                            color: palette.text,
                          },
                        ]}
                      />
                    </View>
                    <Pressable
                      onPress={() => onStateChange(setBudgetRollover(state, budget.id, !budget.rollover))}
                      style={[styles.rolloverChip, { borderColor: palette.border }]}
                    >
                      <Text style={{ color: palette.text, fontSize: typography.small, fontWeight: '700' }}>
                        Rollover {budget.rollover !== false ? 'on' : 'off'}
                      </Text>
                      <Text style={{ color: palette.textMuted, fontSize: typography.micro, marginTop: 2 }}>
                        {budget.rollover !== false ? 'Surplus rolls forward' : 'Surplus dropped; debt still rolls'}
                      </Text>
                    </Pressable>
                    <Button label="Edit" size="sm" variant="secondary" onPress={() => openEdit(status.category, status.limit)} />
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
                  <Text>{getCategoryIcon(b.category)} </Text>
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
  readyBanner: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
  },
  readyLabel: { fontSize: typography.micro, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  readyAmount: { fontSize: typography.title, fontWeight: '800' },
  readyHint: { fontSize: typography.micro, lineHeight: 17, marginTop: 4 },
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
  envelopeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    alignItems: 'flex-end',
    marginTop: spacing.sm,
  },
  inlineLabel: { fontSize: typography.micro, marginBottom: 4 },
  inlineInput: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: typography.body,
    fontWeight: '600',
  },
  rolloverChip: {
    flex: 1,
    minWidth: 160,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
