import { useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { CashFlowLineChart } from '../components/charts/CashFlowLineChart';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import {
  detectRecurringIncome,
  detectSubscriptions,
  projectCashFlow,
  setForecastLowBalanceThreshold,
} from '../finance/ledger';
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
});
