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
  getMonthIncome,
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
  const breakdown = useMemo(
    () => getCategoryBreakdown(state.transactions, year, month),
    [state.transactions, year, month],
  );
  const categoryOptions = useMemo(() => getCategoryOptions(), []);

  const [showAdd, setShowAdd] = useState(false);
  const [editCategory, setEditCategory] = useState<string | null>(null);
  const [category, setCategory] = useState('Groceries');
  const [limit, setLimit] = useState('');
  const [limitDraftByBudgetId, setLimitDraftByBudgetId] = useState<Record<string, string>>({});

  const monthIncome = useMemo(() => getMonthIncome(state.transactions, year, month), [state.transactions, year, month]);
  const totalAssigned = useMemo(() => envelopes.reduce((s, e) => s + e.assigned, 0), [envelopes]);
  const readyToAssign = Number((monthIncome - totalAssigned).toFixed(2));

  useEffect(() => {
    if (!envelopeMode) return;
    setLimitDraftByBudgetId((prev) => {
      const next = { ...prev };
      for (const e of envelopes) {
        if (next[e.id] === undefined) next[e.id] = String(e.assigned);
      }
      for (const id of Object.keys(next)) {
        if (!envelopes.some((e) => e.id === id)) delete next[id];
      }
      return next;
    });
  }, [envelopeMode, envelopes]);

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
        <View style={styles.headerActions}>
          <View style={[styles.modeToggle, { borderColor: palette.borderSoft, backgroundColor: palette.surfaceSunken }]}>
            <Pressable
              onPress={() => onStateChange(setBudgetViewMode(state, 'flow'))}
              style={({ pressed }) => [
                styles.modePill,
                !envelopeMode && { backgroundColor: palette.primary },
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text
                style={[
                  styles.modePillText,
                  { color: !envelopeMode ? palette.primaryText : palette.textMuted },
                ]}
              >
                Flow
              </Text>
            </Pressable>
            <Pressable
              onPress={() => onStateChange(setBudgetViewMode(state, 'envelope'))}
              style={({ pressed }) => [
                styles.modePill,
                envelopeMode && { backgroundColor: palette.primary },
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text
                style={[
                  styles.modePillText,
                  { color: envelopeMode ? palette.primaryText : palette.textMuted },
                ]}
              >
                Envelope
              </Text>
            </Pressable>
          </View>
          <Button label="New budget" onPress={openAdd} />
        </View>
      </View>

      {envelopeMode ? (
        <View
          style={[
            styles.readyBanner,
            {
              backgroundColor: readyToAssign >= 0 ? palette.successSoft : palette.dangerSoft,
              borderColor: readyToAssign >= 0 ? palette.success : palette.danger,
            },
          ]}
        >
          <Text style={[styles.readyTitle, { color: palette.text }]}>Ready to assign</Text>
          <Text style={[styles.readyAmount, { color: readyToAssign >= 0 ? palette.success : palette.danger }]}>
            {formatCurrency(readyToAssign)}
          </Text>
          <Text style={[styles.readySub, { color: palette.textMuted }]}>
            {`This month's income (${formatCurrency(monthIncome)}) minus assigned to envelopes (${formatCurrency(totalAssigned)}).`}
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
      ) : envelopeMode ? (
        <View style={{ gap: spacing.md }}>
          {envelopes.map((env) => {
            const budgetRow = state.budgets.find((b) => b.id === env.id);
            const rolloverOn = budgetRow?.rollover !== false;
            const denom = env.assigned > 0 ? env.assigned : 0;
            const pct = denom > 0 ? Math.min(1, env.spent / denom) : env.spent > 0 ? 1 : 0;
            const color =
              env.status === 'over'
                ? palette.danger
                : env.status === 'warning'
                  ? palette.warning
                  : palette.success;
            const draft = limitDraftByBudgetId[env.id] ?? String(env.assigned);
            return (
              <View
                key={env.id}
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
                    <View style={{ flex: 1, minWidth: 160 }}>
                      <Text style={[styles.cat, { color: palette.text }]}>{env.category}</Text>
                      <Text style={[styles.catMeta, { color: palette.textMuted }]}>
                        Carried in {formatCurrency(env.carriedIn)} · Spent {formatCurrency(env.spent)}
                      </Text>
                    </View>
                  </View>
                  <Badge
                    label={
                      env.available < 0
                        ? 'Over assigned'
                        : env.status === 'warning'
                          ? 'Getting close'
                          : 'On track'
                    }
                    tone={
                      env.available < 0 ? 'danger' : env.status === 'warning' ? 'warning' : 'success'
                    }
                  />
                </View>
                <View style={styles.envelopeRow}>
                  <View style={{ flex: 1, minWidth: 140 }}>
                    <Text style={[styles.inlineLabel, { color: palette.textSubtle }]}>Monthly limit</Text>
                    <Input
                      label=""
                      value={draft}
                      onChangeText={(t) =>
                        setLimitDraftByBudgetId((prev) => ({ ...prev, [env.id]: t }))
                      }
                      onBlur={() => {
                        const n = Number.parseFloat(limitDraftByBudgetId[env.id] ?? draft);
                        if (!Number.isFinite(n) || n < 0) {
                          setLimitDraftByBudgetId((prev) => ({ ...prev, [env.id]: String(env.assigned) }));
                          return;
                        }
                        onStateChange(setBudget(state, env.category, n));
                      }}
                      placeholder="0"
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={{ flex: 1, minWidth: 120, justifyContent: 'center' }}>
                    <Text style={[styles.inlineLabel, { color: palette.textSubtle }]}>Available</Text>
                    <Text
                      style={[
                        styles.availableAmt,
                        { color: env.available < 0 ? palette.danger : palette.text },
                      ]}
                    >
                      {formatCurrency(env.available)}
                    </Text>
                  </View>
                  <View style={styles.rolloverCol}>
                    <Text style={[styles.inlineLabel, { color: palette.textSubtle }]}>Rollover</Text>
                    <Pressable
                      onPress={() =>
                        onStateChange(setBudgetRollover(state, env.id, !rolloverOn))
                      }
                      style={[
                        styles.toggle,
                        {
                          backgroundColor: rolloverOn ? palette.primarySoft : palette.surfaceSunken,
                          borderColor: rolloverOn ? palette.primary : palette.borderSoft,
                        },
                      ]}
                    >
                      <Text style={{ color: palette.text, fontWeight: '700', fontSize: typography.small }}>
                        {rolloverOn ? 'On' : 'Off'}
                      </Text>
                    </Pressable>
                  </View>
                  <View style={{ justifyContent: 'flex-end' }}>
                    <Button
                      label="Edit"
                      size="sm"
                      variant="secondary"
                      onPress={() => openEdit(env.category, env.assigned)}
                    />
                  </View>
                </View>
                <View style={[styles.track, { backgroundColor: palette.surfaceSunken }]}>
                  <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: color }]} />
                </View>
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  modeToggle: { flexDirection: 'row', borderRadius: radius.pill, borderWidth: 1, padding: 3 },
  modePill: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: radius.pill },
  modePillText: { fontSize: typography.small, fontWeight: '700' },
  readyBanner: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, gap: 4 },
  readyTitle: { fontSize: typography.micro, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700' },
  readyAmount: { fontSize: typography.title, fontWeight: '800' },
  readySub: { fontSize: typography.small, marginTop: 4, lineHeight: 20 },
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
  envelopeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    alignItems: 'flex-end',
    marginTop: spacing.sm,
  },
  inlineLabel: { fontSize: typography.micro, fontWeight: '600', marginBottom: 4 },
  availableAmt: { fontSize: typography.subtitle, fontWeight: '800' },
  rolloverCol: { minWidth: 88, alignItems: 'flex-start' },
  toggle: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
});
