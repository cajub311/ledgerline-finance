import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import {
  addGoal,
  getGoalStats,
  removeGoal,
  updateGoalProgress,
} from '../finance/ledger';
import type { FinancialGoal, FinanceState } from '../finance/types';
import { useTheme } from '../theme/ThemeContext';
import { radius, spacing, typography } from '../theme/tokens';
import { formatCurrency } from '../utils/format';

interface GoalsPageProps {
  state: FinanceState;
  onStateChange: (next: FinanceState) => void;
}

export function GoalsPage({ state, onStateChange }: GoalsPageProps) {
  const { palette } = useTheme();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<FinancialGoal | null>(null);

  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [current, setCurrent] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setTarget(String(editing.targetAmount));
      setCurrent(String(editing.currentAmount));
      setDate(editing.targetDate);
    }
  }, [editing]);

  const openNew = () => {
    setEditing(null);
    setName('');
    setTarget('');
    setCurrent('');
    setDate('');
    setShowAdd(true);
  };

  const saveNew = () => {
    const tAmt = Number.parseFloat(target);
    const cAmt = Number.parseFloat(current);
    if (!name.trim() || !Number.isFinite(tAmt) || tAmt <= 0) return;
    onStateChange(
      addGoal(state, {
        name: name.trim(),
        targetAmount: tAmt,
        currentAmount: Number.isFinite(cAmt) && cAmt >= 0 ? cAmt : 0,
        targetDate: date || new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().slice(0, 10),
      }),
    );
    setShowAdd(false);
  };

  const saveEdit = () => {
    if (!editing) return;
    const cAmt = Number.parseFloat(current);
    if (!Number.isFinite(cAmt) || cAmt < 0) return;
    onStateChange(updateGoalProgress(state, editing.id, cAmt));
    setEditing(null);
  };

  const totals = useMemo(() => {
    const saved = state.goals.reduce((s, g) => s + g.currentAmount, 0);
    const target = state.goals.reduce((s, g) => s + g.targetAmount, 0);
    return { saved, target, remaining: target - saved };
  }, [state.goals]);

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={styles.header}>
        <View style={{ flex: 1, minWidth: 240 }}>
          <Text style={[styles.title, { color: palette.text }]}>Goals</Text>
          <Text style={[styles.subtitle, { color: palette.textMuted }]}>
            {state.goals.length === 0
              ? 'Set a savings target and track progress toward what matters most.'
              : `${formatCurrency(totals.saved)} saved toward ${formatCurrency(totals.target)} across ${state.goals.length} goal${state.goals.length === 1 ? '' : 's'}`}
          </Text>
        </View>
        <Button label="New goal" onPress={openNew} />
      </View>

      {state.goals.length === 0 ? (
        <Card title="No goals yet" eyebrow="Getting started">
          <Text style={{ color: palette.textMuted, fontSize: typography.small, lineHeight: 20 }}>
            Goals help you target specific amounts by a date. Try "Emergency fund", "Europe trip", or
            "New laptop". You'll see the monthly savings needed to hit each goal on time.
          </Text>
        </Card>
      ) : (
        <View style={{ gap: spacing.md }}>
          {state.goals.map((goal) => {
            const stats = getGoalStats(goal);
            const pct = stats.pct;
            const color =
              pct >= 1
                ? palette.success
                : stats.daysLeft < 30 && pct < 0.9
                  ? palette.warning
                  : palette.primary;
            return (
              <Pressable
                key={goal.id}
                onPress={() => setEditing(goal)}
                style={({ hovered }) => [
                  styles.goal,
                  {
                    backgroundColor: palette.surface,
                    borderColor: hovered ? palette.primary : palette.borderSoft,
                  },
                ]}
              >
                <View style={styles.goalTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.goalName, { color: palette.text }]}>{goal.name}</Text>
                    <Text style={[styles.goalMeta, { color: palette.textMuted }]}>
                      Target {goal.targetDate}
                    </Text>
                  </View>
                  <Badge
                    label={pct >= 1 ? 'Complete 🎉' : `${Math.round(pct * 100)}%`}
                    tone={pct >= 1 ? 'success' : 'primary'}
                  />
                </View>
                <Text style={[styles.goalAmt, { color: palette.text }]}>
                  {formatCurrency(goal.currentAmount)}
                  <Text style={{ color: palette.textSubtle, fontWeight: '500', fontSize: typography.small }}>
                    {' '}/ {formatCurrency(goal.targetAmount)}
                  </Text>
                </Text>
                <View style={[styles.track, { backgroundColor: palette.surfaceSunken }]}>
                  <View style={[styles.fill, { width: `${Math.min(100, pct * 100)}%`, backgroundColor: color }]} />
                </View>
                <View style={styles.goalStatsRow}>
                  <Text style={[styles.statSmall, { color: palette.textSubtle }]}>
                    {stats.daysLeft} days left
                  </Text>
                  <Text style={[styles.statSmall, { color: palette.textSubtle }]}>
                    {formatCurrency(stats.remaining)} to go
                  </Text>
                  {stats.monthlyRequired > 0 ? (
                    <Text style={[styles.statSmall, { color: palette.primary }]}>
                      Save {formatCurrency(stats.monthlyRequired)}/mo
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      <Modal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        title="New goal"
        footer={
          <>
            <Button label="Cancel" variant="ghost" onPress={() => setShowAdd(false)} />
            <Button label="Create goal" onPress={saveNew} />
          </>
        }
      >
        <Input label="Name" value={name} onChangeText={setName} placeholder="Emergency fund" />
        <Input label="Target amount" value={target} onChangeText={setTarget} placeholder="15000" keyboardType="decimal-pad" />
        <Input label="Starting saved amount" value={current} onChangeText={setCurrent} placeholder="0" keyboardType="decimal-pad" />
        <Input label="Target date (YYYY-MM-DD)" value={date} onChangeText={setDate} placeholder="2026-12-31" />
      </Modal>

      <Modal
        visible={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Update goal"
        subtitle={editing?.name}
        footer={
          <>
            <Button
              label="Delete goal"
              variant="danger"
              onPress={() => {
                if (editing) {
                  onStateChange(removeGoal(state, editing.id));
                  setEditing(null);
                }
              }}
            />
            <View style={{ flex: 1 }} />
            <Button label="Cancel" variant="ghost" onPress={() => setEditing(null)} />
            <Button label="Save progress" onPress={saveEdit} />
          </>
        }
      >
        <Input
          label="Current amount saved"
          value={current}
          onChangeText={setCurrent}
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
  goal: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  goalTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  goalName: { fontSize: typography.subtitle, fontWeight: '800' },
  goalMeta: { fontSize: typography.small, marginTop: 2 },
  goalAmt: { fontSize: typography.title, fontWeight: '800' },
  track: { height: 8, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
  goalStatsRow: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  statSmall: { fontSize: typography.small, fontWeight: '600' },
});
