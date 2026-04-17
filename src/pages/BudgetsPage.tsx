import { useEffect, useMemo, useState } from 'react';
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
  getFinanceSummary,
  patchBudget,
  removeBudget,
  setBudget,
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

export function BudgetsPage({ state, onStateChange }: BudgetsPageProps) {
  const { palette } = useTheme();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const envelopeMode = state.preferences.budgetViewMode === 'envelope';

  const statuses = useMemo(() => getBudgetStatus(state, year, month), [state, year, month]);
  const envelopes = useMemo(
    () => getBudgetEnvelopes(state, year, month),
    [state.budgets, state.transactions, year, month],
  );
  const envelopeByBudgetId = useMemo(() => {
    const m: Record<string, (typeof envelopes)[0]> = {};
    for (const row of envelopes) m[row.budgetId] = row;
    return m;
  }, [envelopes]);

  const breakdown = useMemo(
    () => getCategoryBreakdown(state.transactions, year, month),
    [state.transactions, year, month],
  );
  const categoryOptions = useMemo(() => getCategoryOptions(), []);
  const summary = useMemo(() => getFinanceSummary(state), [state]);

  const [showAdd, setShowAdd] = useState(false);
  const [limitDrafts, setLimitDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    setLimitDrafts((prev) => {
      const next = { ...prev };
      for (const b of state.budgets) {
        if (next[b.id] === undefined) next[b.id] = String(b.monthlyLimit);
      }
      return next;
    });
  }, [state.budgets]);
  const [editCategory, setEditCategory] = useState<string | null>(null);
  const [category, setCategory] = useState('Groceries');
  const [limit, setLimit] = useState('');

  const totalLimit = statuses.reduce((s, b) => s + b.limit, 0);
  const totalSpent = statuses.reduce((s, b) => s + b.spent, 0);
  const totalAssigned = envelopes.reduce((s, e) => s + e.assigned, 0);
  const readyToAssign = Number((summary.monthIncome - totalAssigned).toFixed(2));

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
              ? `${formatCurrency(totalSpent)} spent · ${formatCurrency(totalAssigned)} assigned this month`
              : `${formatCurrency(totalSpent)} spent of ${formatCurrency(totalLimit)} budgeted`}
          </Text>
        </View>
        <Button label="New budget" onPress={openAdd} />
      </View>

      <Select
        label="View"
        value={envelopeMode ? 'envelope' : 'flow'}
        onChange={(v) => onStateChange(setBudgetViewMode(state, v === 'envelope' ? 'envelope' : 'flow'))}
        options={[
          { value: 'flow', label: 'Flow (limit vs spent)' },
          { value: 'envelope', label: 'Envelope (assign + rollover)' },
        ]}
      />

      {envelopeMode ? (
        <View
          style={[
            styles.readyBanner,
            { backgroundColor: palette.primarySoft, borderColor: palette.primary },
          ]}
        >
          <Text style={[styles.readyTitle, { color: palette.primary }]}>Ready to assign</Text>
          <Text style={[styles.readyAmount, { color: palette.text }]}>{formatCurrency(readyToAssign)}</Text>
          <Text style={[styles.readyHint, { color: palette.textMuted }]}>
            This month’s income ({formatCurrency(summary.monthIncome)}) minus assigned amounts in your envelopes.
            Assign the rest to categories below.
          </Text>
        </View>
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
      ) : (
        <View style={{ gap: spacing.md }}>
          {statuses.map((status) => {
            const budgetMeta = state.budgets.find((b) => b.category === status.category);
            const budgetId = budgetMeta?.id ?? status.category;
            const env = envelopeByBudgetId[budgetId];
            const displayStatus = envelopeMode && env ? env.status : status.status;
            const pct = Math.min(1, envelopeMode && env ? env.pct : status.pct);
            const color =
              displayStatus === 'over'
                ? palette.danger
                : displayStatus === 'warning'
                  ? palette.warning
                  : palette.success;

            const commitInlineLimit = () => {
              const raw = limitDrafts[budgetId] ?? String(status.limit);
              const n = Number.parseFloat(raw);
              if (!Number.isFinite(n) || n < 0 || !budgetMeta) return;
              onStateChange(patchBudget(state, budgetMeta.id, { monthlyLimit: n }));
              setLimitDrafts((prev) => {
                const next = { ...prev };
                delete next[budgetId];
                return next;
              });
            };

            return (
              <Pressable
                key={status.category}
                onPress={() => !envelopeMode && openEdit(status.category, status.limit)}
                style={({ hovered }) => [
                  styles.budget,
                  {
                    backgroundColor: palette.surface,
                    borderColor: hovered && !envelopeMode ? palette.primary : palette.borderSoft,
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
                      {envelopeMode && env ? (
                        <Text style={[styles.catMeta, { color: palette.textMuted }]}>
                          Carried in {formatCurrency(env.carriedIn)} · Assigned{' '}
                          <Text style={{ fontWeight: '800' }}>{formatCurrency(env.assigned)}</Text> · Spent{' '}
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
                      displayStatus === 'over'
                        ? envelopeMode
                          ? 'Negative available'
                          : 'Over budget'
                        : displayStatus === 'warning'
                          ? 'Getting close'
                          : 'On track'
                    }
                    tone={
                      displayStatus === 'over'
                        ? 'danger'
                        : displayStatus === 'warning'
                          ? 'warning'
                          : 'success'
                    }
                  />
                </View>
                {envelopeMode && env && budgetMeta ? (
                  <View style={{ gap: spacing.sm }}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, alignItems: 'center' }}>
                      <View style={{ minWidth: 120, flex: 1 }}>
                        <Text style={[styles.inlineLabel, { color: palette.textMuted }]}>Assigned (monthly)</Text>
                        <Input
                          value={limitDrafts[budgetId] ?? String(budgetMeta.monthlyLimit)}
                          onChangeText={(t) => setLimitDrafts((prev) => ({ ...prev, [budgetId]: t }))}
                          onBlur={commitInlineLimit}
                          keyboardType="decimal-pad"
                          containerStyle={{ marginTop: 4 }}
                        />
                      </View>
                      <Button
                        label={budgetMeta.rollover ? 'Rollover: on' : 'Rollover: off'}
                        size="sm"
                        variant="secondary"
                        onPress={() =>
                          onStateChange(
                            patchBudget(state, budgetMeta.id, { rollover: !budgetMeta.rollover }),
                          )
                        }
                      />
                      <Button label="Details" size="sm" variant="ghost" onPress={() => openEdit(status.category, status.limit)} />
                    </View>
                    <Text style={[styles.remaining, { color: palette.text }]}>
                      Available: {formatCurrency(env.available)}
                    </Text>
                  </View>
                ) : null}
                <View style={[styles.track, { backgroundColor: palette.surfaceSunken }]}>
                  <View
                    style={[
                      styles.fill,
                      { width: `${pct * 100}%`, backgroundColor: color },
                    ]}
                  />
                </View>
                {!envelopeMode ? (
                  <Text style={[styles.remaining, { color: palette.textSubtle }]}>
                    {status.limit - status.spent > 0
                      ? `${formatCurrency(status.limit - status.spent)} remaining`
                      : `${formatCurrency(status.spent - status.limit)} over`}
                </Text>
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
  readyBanner: {
    borderRadius: 12,
    borderWidth: 1,
    padding: spacing.md,
    gap: 6,
  },
  readyTitle: { fontSize: typography.micro, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  readyAmount: { fontSize: 28, fontWeight: '800' },
  readyHint: { fontSize: typography.small, lineHeight: 20 },
  inlineLabel: { fontSize: typography.micro, fontWeight: '600' },
});
