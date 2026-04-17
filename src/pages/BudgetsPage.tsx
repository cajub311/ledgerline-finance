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
  getMonthIncome,
  removeBudget,
  setBudget,
  setBudgetViewMode,
  updateBudget,
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
  const envelopes = useMemo(() => {
    const list = getBudgetEnvelopes(state, year, month);
    const map = new Map(list.map((e) => [e.budgetId, e]));
    return { list, map };
  }, [state, year, month]);
  const breakdown = useMemo(
    () => getCategoryBreakdown(state.transactions, year, month),
    [state.transactions, year, month],
  );
  const categoryOptions = useMemo(() => getCategoryOptions(), []);
  const monthIncome = useMemo(() => getMonthIncome(state.transactions, year, month), [state.transactions, year, month]);

  const [showAdd, setShowAdd] = useState(false);
  const [editCategory, setEditCategory] = useState<string | null>(null);
  const [category, setCategory] = useState('Groceries');
  const [limit, setLimit] = useState('');
  const [inlineLimits, setInlineLimits] = useState<Record<string, string>>({});

  const totalLimit = statuses.reduce((s, b) => s + b.limit, 0);
  const totalSpent = statuses.reduce((s, b) => s + b.spent, 0);
  const totalAssigned = envelopeMode ? envelopes.list.reduce((s, e) => s + e.assigned, 0) : totalLimit;
  const readyToAssign = Number((monthIncome - totalAssigned).toFixed(2));

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

  const commitInlineLimit = (budgetId: string, raw: string) => {
    const numeric = Number.parseFloat(raw.trim());
    if (!Number.isFinite(numeric) || numeric < 0) return;
    const b = state.budgets.find((x) => x.id === budgetId);
    if (!b || b.monthlyLimit === numeric) return;
    onStateChange(updateBudget(state, budgetId, { monthlyLimit: numeric }));
    setInlineLimits((prev) => {
      const next = { ...prev };
      delete next[budgetId];
      return next;
    });
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
              ? `${formatCurrency(totalSpent)} spent · ${formatCurrency(totalAssigned)} assigned`
              : `${formatCurrency(totalSpent)} spent of ${formatCurrency(totalLimit)} budgeted`}
          </Text>
        </View>
        <Button label="New budget" onPress={openAdd} />
      </View>

      <View style={styles.modeRow}>
        <Text style={[styles.modeLabel, { color: palette.textMuted }]}>View</Text>
        <View style={styles.modeToggle}>
          <Pressable
            onPress={() => onStateChange(setBudgetViewMode(state, 'flow'))}
            style={({ pressed }) => [
              styles.modePill,
              {
                backgroundColor: !envelopeMode ? palette.primarySoft : palette.surfaceSunken,
                borderColor: !envelopeMode ? palette.primary : palette.borderSoft,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text style={[styles.modePillText, { color: !envelopeMode ? palette.primary : palette.textMuted }]}>
              Flow
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onStateChange(setBudgetViewMode(state, 'envelope'))}
            style={({ pressed }) => [
              styles.modePill,
              {
                backgroundColor: envelopeMode ? palette.primarySoft : palette.surfaceSunken,
                borderColor: envelopeMode ? palette.primary : palette.borderSoft,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text style={[styles.modePillText, { color: envelopeMode ? palette.primary : palette.textMuted }]}>
              Envelope
            </Text>
          </Pressable>
        </View>
      </View>

      {envelopeMode ? (
        <Card title="Ready to assign" eyebrow="This month">
          <Text style={[styles.rtaAmount, { color: readyToAssign >= 0 ? palette.success : palette.danger }]}>
            {formatCurrency(readyToAssign)}
          </Text>
          <Text style={{ color: palette.textMuted, fontSize: typography.small, marginTop: 6, lineHeight: 20 }}>
            {formatCurrency(monthIncome)} income this month minus {formatCurrency(totalAssigned)} assigned to envelopes.
            Assign every dollar, including $0 categories you want to track.
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
      ) : (
        <View style={{ gap: spacing.md }}>
          {statuses.map((status) => {
            const budgetRow = state.budgets.find((b) => b.category === status.category);
            const env = budgetRow ? envelopes.map.get(budgetRow.id) : undefined;
            const badgeStatus = envelopeMode && env ? env.status : status.status;
            const spentCap = envelopeMode && env ? env.carriedIn + env.assigned : status.limit;
            const pct = spentCap > 0 ? Math.min(1, status.spent / spentCap) : status.pct > 0 ? 1 : 0;
            const color =
              badgeStatus === 'over'
                ? palette.danger
                : badgeStatus === 'warning'
                  ? palette.warning
                  : palette.success;
            const envelopeMeta =
              env != null
                ? `${formatCurrency(env.carriedIn)} rolled in · ${formatCurrency(env.assigned)} assigned · ${formatCurrency(env.spent)} spent`
                : null;
            const limitDisplay =
              envelopeMode && budgetRow
                ? (inlineLimits[budgetRow.id] !== undefined
                    ? inlineLimits[budgetRow.id]
                    : String(budgetRow.monthlyLimit))
                : null;

            const rowInner = (
              <>
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
                      {envelopeMode && envelopeMeta ? (
                        <Text style={[styles.catMeta, { color: palette.textMuted }]}>{envelopeMeta}</Text>
                      ) : (
                        <Text style={[styles.catMeta, { color: palette.textMuted }]}>
                          {formatCurrency(status.spent)} of {formatCurrency(status.limit)} ·{' '}
                          {Math.round(status.pct * 100)}%
                        </Text>
                      )}
                    </View>
                  </View>
                  {envelopeMode && budgetRow ? (
                    <View style={styles.inlineLimit}>
                      <Text style={[styles.inlineLimitLabel, { color: palette.textSubtle }]}>Assigned</Text>
                      <Input
                        value={limitDisplay ?? String(budgetRow.monthlyLimit)}
                        onChangeText={(t) => setInlineLimits((prev) => ({ ...prev, [budgetRow.id]: t }))}
                        onBlur={() => {
                          const raw =
                            inlineLimits[budgetRow.id] !== undefined
                              ? inlineLimits[budgetRow.id]
                              : String(budgetRow.monthlyLimit);
                          commitInlineLimit(budgetRow.id, raw);
                        }}
                        keyboardType="decimal-pad"
                        placeholder="0"
                        containerStyle={styles.inlineLimitField}
                      />
                    </View>
                  ) : null}
                  <Pressable onPress={() => openEdit(status.category, status.limit)} hitSlop={8}>
                    <Badge
                      label={
                        badgeStatus === 'over'
                          ? 'Over budget'
                          : badgeStatus === 'warning'
                            ? 'Getting close'
                            : 'On track'
                      }
                      tone={
                        badgeStatus === 'over'
                          ? 'danger'
                          : badgeStatus === 'warning'
                            ? 'warning'
                            : 'success'
                      }
                    />
                  </Pressable>
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
              </>
            );

            if (envelopeMode) {
              return (
                <View
                  key={status.category}
                  style={[
                    styles.budget,
                    { backgroundColor: palette.surface, borderColor: palette.borderSoft },
                  ]}
                >
                  {rowInner}
                </View>
              );
            }

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
                {rowInner}
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
        {editCategory ? (
          <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
            <Text style={{ color: palette.textMuted, fontSize: typography.small, fontWeight: '600' }}>
              Rollover
            </Text>
            <Text style={{ color: palette.textSubtle, fontSize: typography.micro, lineHeight: 17 }}>
              When on, unused dollars carry to the next month. When off, surplus resets but overspending still carries
              as debt.
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
              <Button
                label="Rollover on"
                size="sm"
                variant={
                  state.budgets.find((b) => b.category === editCategory)?.rollover !== false
                    ? 'primary'
                    : 'secondary'
                }
                onPress={() => {
                  const b = state.budgets.find((x) => x.category === editCategory);
                  if (b) onStateChange(updateBudget(state, b.id, { rollover: true }));
                }}
              />
              <Button
                label="Rollover off"
                size="sm"
                variant={
                  state.budgets.find((b) => b.category === editCategory)?.rollover === false
                    ? 'primary'
                    : 'secondary'
                }
                onPress={() => {
                  const b = state.budgets.find((x) => x.category === editCategory);
                  if (b) onStateChange(updateBudget(state, b.id, { rollover: false }));
                }}
              />
            </View>
          </View>
        ) : null}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  modeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  modeLabel: { fontSize: typography.small, fontWeight: '700' },
  modeToggle: { flexDirection: 'row', gap: spacing.sm },
  modePill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  modePillText: { fontSize: typography.small, fontWeight: '700' },
  rtaAmount: { fontSize: typography.title, fontWeight: '800' },
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
  inlineLimit: { minWidth: 120, maxWidth: 160 },
  inlineLimitLabel: { fontSize: typography.micro, fontWeight: '600', marginBottom: 4 },
  inlineLimitField: { marginBottom: 0 },
});
