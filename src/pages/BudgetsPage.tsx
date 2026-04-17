import { useMemo, useState } from 'react';
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
  getReadyToAssign,
  removeBudget,
  setBudget,
  setEnvelopeBudgetingMode,
  updateBudgetEnvelope,
} from '../finance/ledger';
import type { FinanceState } from '../finance/types';
import { useTheme } from '../theme/ThemeContext';
import { radius, spacing, typography, type ThemePalette } from '../theme/tokens';
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

  const envelopeMode = state.preferences.envelopeBudgeting === true;

  const envelopeByBudgetId = useMemo(() => {
    const list = getBudgetEnvelopes(state, year, month);
    return Object.fromEntries(list.map((e) => [e.budgetId, e]));
  }, [state.budgets, state.transactions, year, month]);

  const statuses = useMemo(() => getBudgetStatus(state, year, month), [state, year, month]);
  const breakdown = useMemo(
    () => getCategoryBreakdown(state.transactions, year, month),
    [state.transactions, year, month],
  );
  const categoryOptions = useMemo(() => getCategoryOptions(), []);

  const readyToAssign = useMemo(() => getReadyToAssign(state, year, month), [state.transactions, state.budgets, year, month]);

  const [showAdd, setShowAdd] = useState(false);
  const [editCategory, setEditCategory] = useState<string | null>(null);
  const [category, setCategory] = useState('Groceries');
  const [limit, setLimit] = useState('');

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
            {now.toLocaleString('default', { month: 'long', year: 'numeric' })} · {formatCurrency(totalSpent)} spent of {formatCurrency(totalLimit)} budgeted
          </Text>
        </View>
        <Button label="New budget" onPress={openAdd} />
      </View>

      <View style={styles.modeRow}>
        <Text style={{ color: palette.textMuted, fontSize: typography.small, fontWeight: '700' }}>View</Text>
        <View style={styles.modeChips}>
          <ModeChip
            label="Flow"
            selected={!envelopeMode}
            onPress={() => onStateChange(setEnvelopeBudgetingMode(state, false))}
            palette={palette}
          />
          <ModeChip
            label="Envelope"
            selected={envelopeMode}
            onPress={() => onStateChange(setEnvelopeBudgetingMode(state, true))}
            palette={palette}
          />
        </View>
      </View>

      {envelopeMode ? (
        <Card title="Ready to assign" eyebrow="This month income minus monthly limits">
          <Text style={[styles.rtaAmount, { color: readyToAssign >= 0 ? palette.success : palette.danger }]}>
            {formatCurrency(readyToAssign)}
          </Text>
          <Text style={{ color: palette.textMuted, fontSize: typography.small, marginTop: 6, lineHeight: 19 }}>
            Assign every dollar to a category envelope. Positive means income not yet allocated to limits; negative
            means limits exceed income.
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
          {statuses.map((status, idx) => {
            const budget = state.budgets[idx]!;
            const env = budget ? envelopeByBudgetId[budget.id] : undefined;
            const pct = Math.min(1, status.pct);
            const color =
              status.status === 'over'
                ? palette.danger
                : status.status === 'warning'
                  ? palette.warning
                  : palette.success;

            const metaLine = envelopeMode && env
              ? `${formatCurrency(status.spent)} spent · carried in ${formatCurrency(env.carriedIn)} · available ${formatCurrency(env.available)}`
              : `${formatCurrency(status.spent)} of ${formatCurrency(status.limit)} · ${Math.round(status.pct * 100)}%`;

            const remainingLine =
              envelopeMode && env
                ? env.available >= 0
                  ? `${formatCurrency(env.available)} available`
                  : `${formatCurrency(Math.abs(env.available))} over available`
                : status.limit - status.spent > 0
                  ? `${formatCurrency(status.limit - status.spent)} remaining`
                  : `${formatCurrency(status.spent - status.limit)} over`;

            return (
              <Pressable
                key={status.category}
                onPress={() => {
                  if (!envelopeMode) openEdit(status.category, status.limit);
                }}
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
                      <Text style={[styles.catMeta, { color: palette.textMuted }]}>{metaLine}</Text>
                    </View>
                  </View>
                  <Badge
                    label={
                      status.status === 'over'
                        ? envelopeMode
                          ? 'Over available'
                          : 'Over budget'
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
                {envelopeMode && budget ? (
                  <View style={styles.envelopeControls} onStartShouldSetResponder={() => true}>
                    <View style={{ flex: 1, minWidth: 120 }}>
                      <Text style={[styles.inlineLabel, { color: palette.textMuted }]}>Monthly limit</Text>
                      <TextInput
                        key={`${budget.id}-${budget.monthlyLimit}`}
                        defaultValue={String(budget.monthlyLimit)}
                        keyboardType="decimal-pad"
                        onEndEditing={(e) => {
                          const n = Number.parseFloat(e.nativeEvent.text);
                          if (!Number.isFinite(n) || n < 0) return;
                          onStateChange(updateBudgetEnvelope(state, budget.id, { monthlyLimit: n }));
                        }}
                        style={[
                          styles.inlineInput,
                          {
                            borderColor: palette.border,
                            backgroundColor: palette.surfaceSunken,
                            color: palette.text,
                          },
                        ]}
                        placeholderTextColor={palette.textSubtle}
                      />
                    </View>
                    <Button
                      size="sm"
                      variant="secondary"
                      label={`Rollover: ${budget.rollover !== false ? 'on' : 'off'}`}
                      onPress={() =>
                        onStateChange(
                          updateBudgetEnvelope(state, budget.id, { rollover: budget.rollover === false }),
                        )
                      }
                    />
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
                <Text style={[styles.remaining, { color: palette.textSubtle }]}>{remainingLine}</Text>
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

function ModeChip({
  label,
  selected,
  onPress,
  palette,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  palette: ThemePalette;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }) => [
        styles.modeChip,
        {
          backgroundColor: selected ? palette.primary : palette.surfaceSunken,
          borderColor: selected ? palette.primary : palette.border,
          opacity: hovered && !selected ? 0.9 : 1,
        },
      ]}
    >
      <Text
        style={{
          color: selected ? palette.primaryText : palette.text,
          fontSize: typography.small,
          fontWeight: '700',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  modeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  modeChips: { flexDirection: 'row', gap: spacing.xs },
  modeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  rtaAmount: { fontSize: 28, fontWeight: '800', marginTop: 4 },
  envelopeControls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    alignItems: 'flex-end',
    marginTop: spacing.sm,
  },
  inlineLabel: { fontSize: typography.micro, fontWeight: '600', marginBottom: 4 },
  inlineInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: typography.body,
    fontWeight: '600',
  },
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
});
