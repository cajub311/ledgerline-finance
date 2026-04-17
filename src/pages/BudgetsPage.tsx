import { useCallback, useMemo, useState } from 'react';
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
  setBudgetRollover,
  setBudgetsViewMode,
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

  const envelopeMode = state.preferences.budgetsViewMode === 'envelope';

  const statuses = useMemo(() => getBudgetStatus(state, year, month), [state, year, month]);
  const envelopes = useMemo(() => getBudgetEnvelopes(state, year, month), [state, year, month]);
  const readyToAssign = useMemo(() => getReadyToAssign(state, year, month), [state, year, month]);

  const envelopeByCategory = useMemo(() => {
    const m: Record<string, (typeof envelopes)[0]> = {};
    for (const e of envelopes) m[e.category] = e;
    return m;
  }, [envelopes]);

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

  const unbudgeted = breakdown
    .filter((b) => !statuses.some((s) => s.category === b.category))
    .slice(0, 4);

  const setMode = useCallback(
    (envelope: boolean) => {
      onStateChange(setBudgetsViewMode(state, envelope ? 'envelope' : 'flow'));
    },
    [onStateChange, state],
  );

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

  const commitInlineLimit = (cat: string, raw: string) => {
    const numeric = Number.parseFloat(raw.trim());
    if (!Number.isFinite(numeric) || numeric < 0) return;
    onStateChange(setBudget(state, cat, numeric));
    setInlineLimits((prev) => {
      const next = { ...prev };
      delete next[cat];
      return next;
    });
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

      <View style={[styles.modeRow, { borderColor: palette.borderSoft }]}>
        <Text style={[styles.modeLabel, { color: palette.textMuted }]}>View</Text>
        <View style={styles.modePills}>
          <Pressable
            onPress={() => setMode(false)}
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
            onPress={() => setMode(true)}
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
        <Card title="Ready to assign" eyebrow="This month income minus total assigned">
          <Text style={[styles.rtaAmount, { color: readyToAssign < 0 ? palette.danger : palette.text }]}>
            {formatCurrency(readyToAssign)}
          </Text>
          <Text style={{ color: palette.textSubtle, fontSize: typography.small, marginTop: 6, lineHeight: 19 }}>
            Assign every dollar to a category envelope. Negative means you assigned more than recorded income this
            month.
          </Text>
        </Card>
      ) : null}

      {statuses.length === 0 ? (
        <Card title="Start with a budget" eyebrow="Recommended">
          <Text style={{ color: palette.textMuted, fontSize: typography.small, lineHeight: 20 }}>
            Cap discretionary categories like Dining, Groceries, or Shopping. Budgets update in real time as
            transactions come in.
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
            const env = envelopeByCategory[status.category];
            const barPct = envelopeMode && env
              ? (() => {
                  const denom =
                    Math.abs(env.carriedIn + env.assigned) > 0.0001
                      ? Math.abs(env.carriedIn + env.assigned)
                      : env.assigned;
                  return denom > 0 ? Math.min(1, env.spent / denom) : 0;
                })()
              : Math.min(1, status.pct);
            const displayStatus = envelopeMode && env ? env.status : status.status;
            const color =
              displayStatus === 'over'
                ? palette.danger
                : displayStatus === 'warning'
                  ? palette.warning
                  : palette.success;
            const budgetRow = state.budgets.find((b) => b.category === status.category);

            return (
              <View
                key={status.category}
                style={[
                  styles.budget,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.borderSoft,
                  },
                ]}
              >
                <Pressable
                  onPress={() => !envelopeMode && openEdit(status.category, status.limit)}
                  disabled={envelopeMode}
                  style={({ hovered, pressed }) => [
                    styles.budgetTop,
                    !envelopeMode && (hovered || pressed) ? { opacity: 0.92 } : null,
                  ]}
                >
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
                          Carried in {formatCurrency(env.carriedIn)} · Spent {formatCurrency(env.spent)} · Available{' '}
                          {formatCurrency(env.available)}
                        </Text>
                      ) : (
                        <Text style={[styles.catMeta, { color: palette.textMuted }]}>
                          {formatCurrency(status.spent)} of {formatCurrency(status.limit)} · {Math.round(status.pct * 100)}
                          %
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Badge
                      label={
                        displayStatus === 'over'
                          ? 'Over budget'
                          : displayStatus === 'warning'
                            ? 'Getting close'
                            : 'On track'
                      }
                      tone={
                        displayStatus === 'over' ? 'danger' : displayStatus === 'warning' ? 'warning' : 'success'
                      }
                    />
                    {envelopeMode ? (
                      <Button
                        label="Edit"
                        size="sm"
                        variant="ghost"
                        onPress={() => openEdit(status.category, status.limit)}
                      />
                    ) : null}
                  </View>
                </Pressable>
                {envelopeMode && budgetRow ? (
                  <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, alignItems: 'flex-end' }}>
                      <View style={{ flex: 1, minWidth: 160 }}>
                        <Input
                          label="Assigned (monthly)"
                          value={inlineLimits[status.category] ?? String(budgetRow.monthlyLimit)}
                          onChangeText={(t) => setInlineLimits((prev) => ({ ...prev, [status.category]: t }))}
                          onBlur={() => {
                            const raw = inlineLimits[status.category];
                            if (raw === undefined) return;
                            commitInlineLimit(status.category, raw);
                          }}
                          placeholder="0"
                          keyboardType="decimal-pad"
                        />
                      </View>
                      <Pressable
                        onPress={() => onStateChange(setBudgetRollover(state, budgetRow.id, !budgetRow.rollover))}
                        style={({ pressed }) => [
                          styles.rollToggle,
                          {
                            borderColor: palette.borderSoft,
                            backgroundColor: budgetRow.rollover ? palette.primarySoft : palette.surfaceSunken,
                            opacity: pressed ? 0.9 : 1,
                          },
                        ]}
                      >
                        <Text style={{ color: palette.text, fontSize: typography.small, fontWeight: '700' }}>
                          Rollover: {budgetRow.rollover !== false ? 'On' : 'Off'}
                        </Text>
                        <Text style={{ color: palette.textSubtle, fontSize: typography.micro, marginTop: 2 }}>
                          Surplus {budgetRow.rollover !== false ? 'carries' : 'resets'}; debt still carries
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}
                <View style={[styles.track, { backgroundColor: palette.surfaceSunken }]}>
                  <View style={[styles.fill, { width: `${barPct * 100}%`, backgroundColor: color }]} />
                </View>
                {!envelopeMode ? (
                  <Text style={[styles.remaining, { color: palette.textSubtle }]}>
                    {status.limit - status.spent > 0
                      ? `${formatCurrency(status.limit - status.spent)} remaining`
                      : `${formatCurrency(status.spent - status.limit)} over`}
                  </Text>
                ) : env ? (
                  <Text style={[styles.remaining, { color: palette.textSubtle }]}>
                    {env.available >= 0
                      ? `${formatCurrency(env.available)} left in envelope`
                      : `${formatCurrency(Math.abs(env.available))} over envelope`}
                  </Text>
                ) : null}
              </View>
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
            {editCategory ? <Button label="Remove" variant="danger" onPress={del} /> : null}
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
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flexWrap: 'wrap',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  modeLabel: { fontSize: typography.small, fontWeight: '700' },
  modePills: { flexDirection: 'row', gap: spacing.sm },
  modePill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  modePillText: { fontSize: typography.small, fontWeight: '700' },
  rtaAmount: { fontSize: typography.title, fontWeight: '800' },
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
  rollToggle: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    minWidth: 140,
  },
});
