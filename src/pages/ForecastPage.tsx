import { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { CashFlowLineChart } from '../components/charts/CashFlowLineChart';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import {
  detectRecurringIncome,
  detectSubscriptions,
  projectCashFlow,
  projectRecurring,
  setForecastLowBalanceThreshold,
} from '../finance/ledger';
import type { ProjectedRecurringItem } from '../finance/types';
import type { FinanceState } from '../finance/types';
import { useTheme } from '../theme/ThemeContext';
import { radius, spacing, typography } from '../theme/tokens';
import { formatCurrency } from '../utils/format';

interface ForecastPageProps {
  state: FinanceState;
  onStateChange: (next: FinanceState) => void;
}

const HORIZONS = [30, 60, 90] as const;

export function ForecastPage({ state, onStateChange }: ForecastPageProps) {
  const { palette } = useTheme();
  const [horizon, setHorizon] = useState<(typeof HORIZONS)[number]>(90);
  const [thresholdDraft, setThresholdDraft] = useState(
    String(state.preferences.forecastLowBalanceThreshold),
  );

  const projection = useMemo(() => projectCashFlow(state, horizon), [state, horizon]);
  const subs = useMemo(() => detectSubscriptions(state.transactions), [state.transactions]);
  const incomes = useMemo(() => detectRecurringIncome(state.transactions), [state.transactions]);
  const calendarHorizonDays = 62;
  const projectedUpcoming = useMemo(
    () => projectRecurring(state, calendarHorizonDays),
    [state, calendarHorizonDays],
  );
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<string | null>(null);

  const chartData = useMemo(
    () =>
      projection.points.map((p) => ({
        ...p,
        label: p.date.slice(5),
        warn: projection.belowThresholdDates.includes(p.date),
      })),
    [projection],
  );

  const threshold = state.preferences.forecastLowBalanceThreshold;
  const web = Platform.OS === 'web';

  const saveThreshold = () => {
    const n = Number.parseFloat(thresholdDraft.replace(/,/g, ''));
    onStateChange(setForecastLowBalanceThreshold(state, n));
  };

  const uniqueWarnDays = useMemo(() => new Set(projection.belowThresholdDates).size, [projection]);
  const endBalance = projection.points[projection.points.length - 1]?.balance ?? 0;
  const endBalanceOk = threshold === 0 || endBalance >= threshold;

  const calendar = useMemo(() => {
    const anchor = new Date();
    const y = anchor.getFullYear();
    const m = anchor.getMonth();
    const monthLabel = anchor.toLocaleString('default', { month: 'long', year: 'numeric' });
    const firstDow = new Date(y, m, 1).getDay();
    const mondayIndex = (firstDow + 6) % 7;
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const pad = mondayIndex;
    const cells: Array<{ day: number | null; iso: string | null }> = [];
    for (let i = 0; i < pad; i++) cells.push({ day: null, iso: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${y}-${`${m + 1}`.padStart(2, '0')}-${`${d}`.padStart(2, '0')}`;
      cells.push({ day: d, iso });
    }
    while (cells.length % 7 !== 0) cells.push({ day: null, iso: null });
    while (cells.length < 42) cells.push({ day: null, iso: null });

    const byDate = new Map<string, ProjectedRecurringItem[]>();
    for (const row of projectedUpcoming) {
      if (!row.date.startsWith(`${y}-${`${m + 1}`.padStart(2, '0')}`)) continue;
      const list = byDate.get(row.date) ?? [];
      list.push(row);
      byDate.set(row.date, list);
    }
    for (const list of byDate.values()) {
      list.sort((a, b) => {
        const c = a.date.localeCompare(b.date);
        if (c !== 0) return c;
        if (a.kind !== b.kind) return a.kind === 'charge' ? -1 : 1;
        return a.payee.localeCompare(b.payee);
      });
    }
    return { y, m, monthLabel, cells, byDate };
  }, [projectedUpcoming]);

  const selectedItems =
    selectedCalendarDay && calendar.byDate.has(selectedCalendarDay)
      ? calendar.byDate.get(selectedCalendarDay)!
      : [];

  return (
    <View style={{ gap: spacing.lg }}>
      <View>
        <Text style={[styles.title, { color: palette.text }]}>Cash flow forecast</Text>
        <Text style={[styles.subtitle, { color: palette.textMuted }]}>
          Projects liquid balance using detected recurring income and subscription-like charges. Adjust
          the warning threshold to highlight risky dates.
        </Text>
      </View>

      <View style={styles.banner}>
        <Text style={[styles.bannerTitle, { color: palette.primary }]}>
          Your data never leaves this device.
        </Text>
        <Text style={[styles.bannerBody, { color: palette.textMuted }]}>
          Forecasts run entirely in your browser from your stored transactions — no server, no accounts.
        </Text>
      </View>

      <View style={styles.horizonRow}>
        {HORIZONS.map((d) => {
          const active = d === horizon;
          return (
            <Button
              key={d}
              label={`${d} days`}
              variant={active ? 'primary' : 'secondary'}
              onPress={() => setHorizon(d)}
            />
          );
        })}
      </View>

      <Card title="Warning threshold" eyebrow="Forecast">
        <Text style={{ color: palette.textMuted, fontSize: typography.small, marginBottom: spacing.sm }}>
          Highlight days when projected liquid cash falls below this amount (set to 0 to disable).
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', alignItems: 'center' }}>
          <Input
            label="Low balance threshold ($)"
            value={thresholdDraft}
            onChangeText={setThresholdDraft}
            keyboardType="decimal-pad"
            style={{ minWidth: 160, flex: 1 }}
          />
          <Button label="Apply" onPress={saveThreshold} />
        </View>
      </Card>

      <View style={styles.statsRow}>
        <Card title="Starting liquid" eyebrow="Today" style={styles.statCard}>
          <Text style={[styles.bigNum, { color: palette.text }]}>
            {formatCurrency(projection.startBalance)}
          </Text>
        </Card>
        <Card title="Projected end" eyebrow={`Day ${horizon}`} style={styles.statCard}>
          <Text
            style={[
              styles.bigNum,
              {
                color: endBalanceOk ? palette.text : palette.warning,
              },
            ]}
          >
            {formatCurrency(endBalance)}
          </Text>
        </Card>
        <Card title="Days below threshold" eyebrow={threshold > 0 ? 'In range' : 'Off'} style={styles.statCard}>
          <Text style={[styles.bigNum, { color: threshold > 0 && uniqueWarnDays ? palette.danger : palette.text }]}>
            {threshold > 0 ? uniqueWarnDays : '—'}
          </Text>
        </Card>
      </View>

      <Card title="Projected liquid balance" eyebrow={`Next ${horizon} days`}>
        {!web ? (
          <Text style={{ color: palette.textMuted, fontSize: typography.small }}>
            The interactive chart is available on the web build. Recurring signals: {incomes.length}{' '}
            income pattern(s), {subs.length} subscription-like charge(s).
          </Text>
        ) : (
          <CashFlowLineChart data={chartData} threshold={threshold} height={300} />
        )}
      </Card>

      <Card title="Upcoming calendar" eyebrow={calendar.monthLabel}>
        <Text style={{ color: palette.textMuted, fontSize: typography.small, marginBottom: spacing.md, lineHeight: 19 }}>
          Dots show projected charges (red) and income (green) from recurring patterns. Tap a day for details.
        </Text>
        <View style={styles.calWeekRow}>
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <Text key={d} style={[styles.calDow, { color: palette.textSubtle }]}>
              {d}
            </Text>
          ))}
        </View>
        <View style={styles.calGrid}>
          {calendar.cells.map((cell, idx) => {
            if (cell.day === null || !cell.iso) {
              return <View key={`e-${idx}`} style={styles.calCell} />;
            }
            const items = calendar.byDate.get(cell.iso) ?? [];
            const hasCharge = items.some((i) => i.kind === 'charge');
            const hasIncome = items.some((i) => i.kind === 'income');
            const active = selectedCalendarDay === cell.iso;
            return (
              <Pressable
                key={cell.iso}
                onPress={() => setSelectedCalendarDay(cell.iso)}
                style={({ hovered }) => [
                  styles.calCell,
                  {
                    borderColor: active ? palette.primary : hovered ? palette.border : palette.borderSoft,
                    backgroundColor: active ? palette.primarySoft : palette.surfaceSunken,
                  },
                ]}
              >
                <Text style={{ color: palette.text, fontWeight: '700', fontSize: typography.small }}>
                  {cell.day}
                </Text>
                <View style={styles.calDots}>
                  {hasCharge ? (
                    <View style={[styles.calDot, { backgroundColor: palette.danger }]} />
                  ) : (
                    <View style={[styles.calDot, { backgroundColor: 'transparent' }]} />
                  )}
                  {hasIncome ? (
                    <View style={[styles.calDot, { backgroundColor: palette.success }]} />
                  ) : (
                    <View style={[styles.calDot, { backgroundColor: 'transparent' }]} />
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          <Text style={{ color: palette.textMuted, fontSize: typography.micro, fontWeight: '700' }}>
            {selectedCalendarDay ? selectedCalendarDay : 'Select a day'}
          </Text>
          {selectedCalendarDay && selectedItems.length === 0 ? (
            <Text style={{ color: palette.textSubtle, fontSize: typography.small }}>No projected items.</Text>
          ) : null}
          {selectedItems.map((row, i) => (
            <View
              key={`${row.payee}-${row.kind}-${i}`}
              style={[
                styles.calDetailRow,
                { borderColor: palette.borderSoft, backgroundColor: palette.surfaceSunken },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: palette.text, fontWeight: '700', fontSize: typography.small }}>
                  {row.payee}
                </Text>
                <Text style={{ color: palette.textMuted, fontSize: typography.micro }}>
                  {row.frequency} · {row.kind === 'charge' ? 'Charge' : 'Income'}
                </Text>
              </View>
              <Text
                style={{
                  fontWeight: '800',
                  color: row.kind === 'charge' ? palette.text : palette.success,
                }}
              >
                {row.amount < 0 ? '' : '+'}
                {formatCurrency(row.amount)}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <View style={styles.twoCol}>
        <Card title="Recurring income (detected)" eyebrow="Used in projection">
          {incomes.length === 0 ? (
            <Text style={{ color: palette.textSubtle, fontSize: typography.small }}>
              No stable income pattern yet — projection assumes flat balance from subscriptions only, or add
              more paycheck rows with similar amounts and spacing.
            </Text>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {incomes.slice(0, 6).map((i) => (
                <View key={i.payee} style={styles.rowBetween}>
                  <Text style={{ color: palette.text, fontWeight: '600' }}>{i.payee}</Text>
                  <Text style={{ color: palette.textMuted }}>
                    {formatCurrency(i.amount)}/{i.frequency === 'monthly' ? 'mo' : i.frequency === 'weekly' ? 'wk' : 'yr'}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </Card>
        <Card title="Recurring charges (detected)" eyebrow="Subscriptions-like">
          {subs.length === 0 ? (
            <Text style={{ color: palette.textSubtle, fontSize: typography.small }}>
              No recurring debits detected — forecast will be nearly flat unless income patterns exist.
            </Text>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {subs.slice(0, 6).map((s) => (
                <View key={s.payee} style={styles.rowBetween}>
                  <Text style={{ color: palette.text, fontWeight: '600' }}>{s.payee}</Text>
                  <Text style={{ color: palette.textMuted }}>
                    {formatCurrency(s.amount)}/{s.frequency === 'monthly' ? 'mo' : s.frequency === 'weekly' ? 'wk' : 'yr'}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </Card>
      </View>

      {threshold > 0 && projection.belowThresholdDates.length > 0 ? (
        <Card title="Dates below threshold" eyebrow="First in range">
          <Text style={{ color: palette.textMuted, fontSize: typography.small, marginBottom: spacing.sm }}>
            {projection.belowThresholdDates.slice(0, 12).join(', ')}
            {projection.belowThresholdDates.length > 12 ? '…' : ''}
          </Text>
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: typography.display, fontWeight: '800' },
  subtitle: { fontSize: typography.small, marginTop: 4, lineHeight: 20 },
  banner: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  bannerTitle: { fontSize: typography.body, fontWeight: '800', marginBottom: 4 },
  bannerBody: { fontSize: typography.small, lineHeight: 19 },
  horizonRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  statsRow: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  statCard: { flex: 1, minWidth: 160 },
  bigNum: { fontSize: typography.title, fontWeight: '800' },
  twoCol: { flexDirection: 'row', gap: spacing.lg, flexWrap: 'wrap' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  calWeekRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  calDow: {
    flex: 1,
    textAlign: 'center',
    fontSize: typography.micro,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    maxWidth: `${100 / 7}%`,
    paddingVertical: 4,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radius.sm,
  },
  calDots: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 2,
    minHeight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  calDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
});
