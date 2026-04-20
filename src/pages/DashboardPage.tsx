import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { StatTile } from '../components/ui/StatTile';
import { IncomeSpendBars } from '../components/charts/BarChart';
import { CategoryBreakdownList } from '../components/charts/CategoryBreakdownList';
import { NetWorthLineChart } from '../components/charts/NetWorthLineChart';
import {
  createEmptyFinanceState,
  detectSubscriptions,
  generateInsights,
  getAccountsWithBalances,
  getBudgetEnvelopes,
  getBudgetStatus,
  getCategoryBreakdown,
  getCategoryIcon,
  getFinanceSummary,
  getFinancialHealthScore,
  getLatestTransactions,
  getMonthlyTrend,
  getNetWorthSeries,
  getSafeToSpend,
  getSavingsRate,
  getTopMerchants,
  isSeedState,
  projectRecurring,
} from '../finance/ledger';
import { clearFinanceState } from '../finance/storage';
import type { FinanceState, ProjectedRecurringItem } from '../finance/types';
import { useTheme } from '../theme/ThemeContext';
import { elevation, radius, spacing, typography } from '../theme/tokens';
import { formatCurrency } from '../utils/format';

interface DashboardPageProps {
  state: FinanceState;
  onStateChange?: (next: FinanceState) => void;
}

type NetWorthHorizon = 3 | 6 | 12 | 0;

export function DashboardPage({ state, onStateChange }: DashboardPageProps) {
  const { palette, mode } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const narrow = windowWidth < 640;
  const [wipeConfirm, setWipeConfirm] = useState(false);
  const onDemoData = useMemo(() => isSeedState(state), [state]);

  const startFresh = async () => {
    if (!wipeConfirm) {
      setWipeConfirm(true);
      return;
    }
    try {
      await clearFinanceState();
    } catch {
      // ignore
    }
    onStateChange?.(createEmptyFinanceState({ householdName: state.householdName }));
    setWipeConfirm(false);
  };
  const summary = useMemo(() => getFinanceSummary(state), [state]);
  const savingsRate = useMemo(() => getSavingsRate(state), [state]);
  const trend = useMemo(() => getMonthlyTrend(state.transactions, 6), [state.transactions]);
  const [netWorthMonths, setNetWorthMonths] = useState<NetWorthHorizon>(6);
  const netWorthSeries = useMemo(
    () => getNetWorthSeries(state, netWorthMonths),
    [state, netWorthMonths],
  );

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const breakdown = useMemo(
    () => getCategoryBreakdown(state.transactions, year, month).slice(0, 6),
    [state.transactions, year, month],
  );
  const topMerchants = useMemo(
    () => getTopMerchants(state.transactions, year, month, 5),
    [state.transactions, year, month],
  );
  const latest = useMemo(() => getLatestTransactions(state, 6), [state]);
  const accounts = useMemo(() => getAccountsWithBalances(state), [state]);
  const budgetStatuses = useMemo(() => getBudgetStatus(state, year, month), [state, year, month]);
  const envelopeMode = state.preferences.budgetViewMode === 'envelope';
  const envelopeRows = useMemo(
    () => getBudgetEnvelopes(state, year, month),
    [state.budgets, state.transactions, year, month],
  );
  const subs = useMemo(() => detectSubscriptions(state.transactions), [state.transactions]);
  const insights = useMemo(() => generateInsights(state), [state]);
  const upcomingHorizonDays = 30;
  const upcoming = useMemo(() => projectRecurring(state, upcomingHorizonDays), [state]);

  const budgetedByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const b of state.budgets) map[b.category] = b.monthlyLimit;
    return map;
  }, [state.budgets]);

  const monthLabel = now.toLocaleString('default', { month: 'long', year: 'numeric' });
  const monthName = now.toLocaleString('default', { month: 'long' });
  const net = summary.monthIncome - summary.monthSpend;
  const overBudget = envelopeMode
    ? envelopeRows.filter((b) => b.status === 'over').length
    : budgetStatuses.filter((b) => b.status === 'over').length;
  const subsMonthly = subs.filter((s) => s.frequency === 'monthly').reduce((s, c) => s + c.amount, 0);
  const safeToSpend = useMemo(() => getSafeToSpend(state), [state]);
  const health = useMemo(() => getFinancialHealthScore(state), [state]);

  const upcomingByWeek = useMemo(() => {
    const mondayKey = (iso: string) => {
      const d = new Date(iso + 'T12:00:00');
      if (!Number.isFinite(d.getTime())) return iso;
      const dow = d.getDay();
      const offset = dow === 0 ? -6 : 1 - dow;
      const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset);
      return `${mon.getFullYear()}-${`${mon.getMonth() + 1}`.padStart(2, '0')}-${`${mon.getDate()}`.padStart(2, '0')}`;
    };
    const map = new Map<string, { items: ProjectedRecurringItem[]; out: number; inn: number; sort: string }>();
    for (const row of upcoming) {
      const key = mondayKey(row.date);
      if (!map.has(key)) {
        map.set(key, { items: [], out: 0, inn: 0, sort: key });
      }
      const g = map.get(key)!;
      g.items.push(row);
      if (row.kind === 'charge') g.out += Math.abs(row.amount);
      else g.inn += row.amount;
    }
    for (const g of map.values()) {
      g.items.sort((a, b) => {
        const c = a.date.localeCompare(b.date);
        if (c !== 0) return c;
        if (a.kind !== b.kind) return a.kind === 'charge' ? -1 : 1;
        return a.payee.localeCompare(b.payee);
      });
    }
    return [...map.values()].sort((a, b) => a.sort.localeCompare(b.sort));
  }, [upcoming]);

  return (
    <View style={{ gap: spacing.lg }}>
      <View
        style={[
          styles.demoBanner,
          onDemoData
            ? { backgroundColor: palette.warningSoft, borderColor: palette.warning }
            : { backgroundColor: palette.surface, borderColor: palette.borderSoft },
        ]}
      >
        <View style={{ flex: 1, minWidth: 220 }}>
          <Text
            style={[
              styles.demoBannerTitle,
              { color: onDemoData ? palette.warning : palette.success },
            ]}
          >
            {onDemoData ? "You're viewing demo data" : 'Your data'}
          </Text>
          <Text style={[styles.demoBannerBody, { color: palette.textMuted }]}>
            {onDemoData
              ? 'These accounts and transactions are examples shipped with the app. Wipe them any time to start fresh with your own data — importing on top keeps the demo mixed in.'
              : `Tracking ${state.transactions.length} transaction${state.transactions.length === 1 ? '' : 's'} across ${state.accounts.length} account${state.accounts.length === 1 ? '' : 's'}. Reset any time to wipe everything and begin again.`}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
          <Button
            label={wipeConfirm ? 'Tap again to confirm' : onDemoData ? 'Start fresh' : 'Reset all data'}
            variant={wipeConfirm ? 'danger' : onDemoData ? 'primary' : 'secondary'}
            onPress={startFresh}
            accessibilityHint="Wipes all data and leaves one empty checking account"
          />
          {wipeConfirm ? (
            <Button label="Cancel" variant="ghost" onPress={() => setWipeConfirm(false)} />
          ) : null}
        </View>
      </View>

      <View
        style={[
          styles.hero,
          elevation(3, mode),
          narrow && { padding: spacing.lg, gap: spacing.md },
          {
            borderColor: palette.borderSoft,
            // @ts-expect-error web-only linear-gradient via style prop
            backgroundImage: `linear-gradient(135deg, ${palette.heroGradientStart}, ${palette.heroGradientEnd})`,
            backgroundColor: palette.primary,
          },
        ]}
      >
        <View style={styles.heroTopRow}>
          <View style={{ flex: 1, minWidth: 220 }}>
            <Text style={styles.heroEyebrow}>{monthLabel}</Text>
            <Text style={[styles.heroHeadline, narrow && { fontSize: typography.display }]}>
              Good to see you.
            </Text>
            <Text style={styles.heroSubhead}>
              {summary.unreviewedCount > 0
                ? `${summary.unreviewedCount} transaction${summary.unreviewedCount === 1 ? '' : 's'} to review this month.`
                : 'All caught up — nice work.'}
            </Text>
          </View>
          <View style={styles.heroHealthChip}>
            <Text style={styles.heroHealthValue}>{health.score}</Text>
            <Text style={styles.heroHealthLabel}>{health.label}</Text>
          </View>
        </View>

        <View style={styles.heroSplitRow}>
          <View style={styles.heroSplitItem}>
            <Text style={styles.heroSplitLabel}>Safe to spend</Text>
            <Text style={styles.heroSplitValue}>{formatCurrency(safeToSpend)}</Text>
            <Text style={styles.heroSplitMeta}>
              Rest of {monthName} at your current pace
            </Text>
          </View>
          {narrow ? null : <View style={styles.heroSplitDivider} />}
          <View style={styles.heroSplitItem}>
            <Text style={styles.heroSplitLabel}>This month net</Text>
            <Text
              style={[
                styles.heroSplitValue,
                net < 0 ? { color: '#ffd4d4' } : undefined,
              ]}
            >
              {formatCurrency(net)}
            </Text>
            <Text style={styles.heroSplitMeta}>
              {formatCurrency(summary.monthIncome)} in · {formatCurrency(summary.monthSpend)} out
            </Text>
          </View>
          {narrow ? null : <View style={styles.heroSplitDivider} />}
          <View style={styles.heroSplitItem}>
            <Text style={styles.heroSplitLabel}>Savings rate</Text>
            <Text style={styles.heroSplitValue}>{savingsRate}%</Text>
            <Text style={styles.heroSplitMeta}>
              {savingsRate >= 20 ? 'Healthy' : savingsRate > 0 ? 'Keep building' : 'Starting point'}
            </Text>
          </View>
        </View>
      </View>

      <View
        style={[
          styles.privacyRibbon,
          { backgroundColor: palette.surface, borderColor: palette.borderSoft },
        ]}
      >
        <Text style={{ fontSize: 16 }}>🔒</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.privacyTitle, { color: palette.text }]}>
            Your data never leaves this device.
          </Text>
          <Text style={[styles.privacyBody, { color: palette.textSubtle }]}>
            No accounts. No servers. No subscriptions. Export a JSON or PDF backup from the Import
            tab any time.
          </Text>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <StatTile label="Net worth" value={formatCurrency(summary.netWorth)} tone="primary" />
        <StatTile
          label="Liquid cash"
          value={formatCurrency(summary.liquidCash)}
          footer={`${state.accounts.length} account${state.accounts.length === 1 ? '' : 's'}`}
        />
        <StatTile
          label="Unreviewed"
          value={`${summary.unreviewedCount}`}
          tone={summary.unreviewedCount === 0 ? 'positive' : 'warning'}
          footer={`${state.transactions.length} total transactions`}
        />
        <StatTile
          label="Over budget"
          value={`${overBudget}`}
          tone={overBudget === 0 ? 'positive' : 'danger'}
          footer={budgetStatuses.length ? `${budgetStatuses.length} budgets tracked` : 'Set a budget to track'}
        />
      </View>

      <Card
        title="Net worth trend"
        eyebrow="End of month"
        action={
          <View style={styles.pillRow}>
            {(
              [
                { value: 3 as const, label: '3M' },
                { value: 6 as const, label: '6M' },
                { value: 12 as const, label: '12M' },
                { value: 0 as const, label: 'ALL' },
              ] as const
            ).map((opt) => {
              const selected = netWorthMonths === opt.value;
              return (
                <Pressable
                  key={opt.label}
                  onPress={() => setNetWorthMonths(opt.value)}
                  style={[
                    styles.horizonPill,
                    {
                      backgroundColor: selected ? palette.primary : palette.surfaceSunken,
                      borderColor: selected ? palette.primary : palette.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: typography.micro,
                      fontWeight: '700',
                      color: selected ? palette.primaryText : palette.textMuted,
                    }}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        }
      >
        {netWorthSeries.length === 0 ? (
          <Text style={{ color: palette.textSubtle, fontSize: typography.small }}>No data yet.</Text>
        ) : (
          <NetWorthLineChart data={netWorthSeries} />
        )}
      </Card>

      <Card
        title="Upcoming in the next 30 days"
        eyebrow="From detected recurring charges & income"
        action={
          upcoming.length ? (
            <Badge label={`${upcoming.length} projected`} tone="primary" />
          ) : null
        }
      >
        {upcoming.length === 0 ? (
          <Text style={{ color: palette.textSubtle, fontSize: typography.small, lineHeight: 19 }}>
            Add a few more similar-dated paychecks or subscription charges to see projected dates here.
          </Text>
        ) : (
          <View style={{ gap: spacing.lg }}>
            {upcomingByWeek.map((week) => {
              const start = new Date(week.sort + 'T12:00:00');
              const end = new Date(start);
              end.setDate(start.getDate() + 6);
              const rangeLabel = `${start.toLocaleString('default', { month: 'short', day: 'numeric' })} – ${end.toLocaleString('default', { month: 'short', day: 'numeric', year: 'numeric' })}`;
              return (
                <View key={week.sort} style={{ gap: spacing.sm }}>
                  <Text style={{ color: palette.text, fontWeight: '800', fontSize: typography.small }}>
                    {rangeLabel}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
                    <Text style={{ color: palette.danger, fontSize: typography.small, fontWeight: '700' }}>
                      Out {formatCurrency(week.out)}
                    </Text>
                    <Text style={{ color: palette.success, fontSize: typography.small, fontWeight: '700' }}>
                      In {formatCurrency(week.inn)}
                    </Text>
                  </View>
                  <View style={{ gap: spacing.xs }}>
                    {week.items.map((row, idx) => (
                      <View
                        key={`${row.date}-${row.payee}-${row.kind}-${idx}`}
                        style={[
                          styles.upcomingRow,
                          { backgroundColor: palette.surfaceSunken, borderColor: palette.borderSoft },
                        ]}
                      >
                        <Text style={{ color: palette.textSubtle, fontSize: typography.micro, width: 88 }}>
                          {row.date}
                        </Text>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: palette.text, fontWeight: '600', fontSize: typography.small }}>
                            {row.payee}
                          </Text>
                          <Text style={{ color: palette.textMuted, fontSize: typography.micro }}>
                            {row.frequency} · {Math.round(row.confidence * 100)}% confidence
                          </Text>
                        </View>
                        <Text
                          style={{
                            fontWeight: '800',
                            fontSize: typography.small,
                            color: row.kind === 'charge' ? palette.text : palette.success,
                          }}
                        >
                          {row.amount < 0 ? '' : '+'}
                          {formatCurrency(row.amount)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </Card>

      <View style={styles.twoCol}>
        <Card title="Income vs spend" eyebrow="Last 6 months" style={styles.flex2}>
          <IncomeSpendBars series={trend} />
        </Card>

        <Card title="Spending by category" eyebrow={monthLabel} style={styles.flex1}>
          <CategoryBreakdownList
            items={breakdown}
            icons={Object.fromEntries(breakdown.map((b) => [b.category, getCategoryIcon(b.category)]))}
            budgetedByCategory={budgetedByCategory}
          />
        </Card>
      </View>

      <View style={styles.twoCol}>
        <Card title="Recent activity" eyebrow="Latest transactions" style={styles.flex2}>
          {latest.length === 0 ? (
            <Text style={{ color: palette.textSubtle }}>Import or add a transaction to start.</Text>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {latest.map((tx) => {
                const account = accounts.find((a) => a.id === tx.accountId);
                return (
                  <View
                    key={tx.id}
                    style={[
                      styles.txRow,
                      { backgroundColor: palette.surfaceSunken, borderColor: palette.borderSoft },
                    ]}
                  >
                    <View style={styles.txIconWrap}>
                      <Text style={styles.txIcon}>{getCategoryIcon(tx.category)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.txPayee, { color: palette.text }]}>{tx.payee}</Text>
                      <Text style={[styles.txMeta, { color: palette.textSubtle }]}>
                        {tx.date} · {tx.category} · {account?.name ?? '—'}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.txAmount,
                        {
                          color: tx.amount >= 0 ? palette.success : palette.text,
                        },
                      ]}
                    >
                      {tx.amount >= 0 ? '+' : ''}
                      {formatCurrency(tx.amount)}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </Card>

        <View style={[styles.flex1, { gap: spacing.lg }]}>
          <Card title="Top merchants" eyebrow={monthLabel}>
            {topMerchants.length === 0 ? (
              <Text style={{ color: palette.textSubtle }}>No merchant data yet.</Text>
            ) : (
              <View style={{ gap: spacing.sm }}>
                {topMerchants.map((m) => (
                  <View key={m.payee} style={styles.rowBetween}>
                    <View>
                      <Text style={[styles.mName, { color: palette.text }]}>{m.payee}</Text>
                      <Text style={[styles.mCount, { color: palette.textSubtle }]}>
                        {m.count} charge{m.count === 1 ? '' : 's'}
                      </Text>
                    </View>
                    <Text style={[styles.mAmt, { color: palette.text }]}>
                      {formatCurrency(m.total)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </Card>

          <Card
            title="Subscriptions"
            eyebrow="Detected recurring"
            action={
              subs.length ? (
                <Badge label={`${subs.length} active`} tone="primary" />
              ) : null
            }
          >
            {subs.length === 0 ? (
              <Text style={{ color: palette.textSubtle, fontSize: typography.small }}>
                No recurring charges yet — they appear after two matches.
              </Text>
            ) : (
              <View style={{ gap: spacing.sm }}>
                <Text style={[styles.subsTotal, { color: palette.text }]}>
                  {formatCurrency(subsMonthly)}
                  <Text style={{ color: palette.textSubtle, fontWeight: '500', fontSize: typography.small }}>
                    {' '}/mo across {subs.length}
                  </Text>
                </Text>
                {subs.slice(0, 4).map((s) => (
                  <View key={s.payee} style={styles.rowBetween}>
                    <Text style={[styles.mName, { color: palette.text }]}>{s.payee}</Text>
                    <Text style={[styles.mAmt, { color: palette.textMuted }]}>
                      {formatCurrency(s.amount)}/{s.frequency === 'monthly' ? 'mo' : s.frequency === 'weekly' ? 'wk' : 'yr'}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </Card>
        </View>
      </View>

      <Card
        title="Insights"
        eyebrow="What changed recently"
        action={
          overBudget > 0 ? (
            <Badge label={`${overBudget} over budget`} tone="danger" />
          ) : null
        }
      >
        {insights.length === 0 ? (
          <Text style={{ color: palette.textSubtle, fontSize: typography.small }}>
            Import a statement or add transactions to see personalized insights.
          </Text>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {insights.map((text, idx) => (
              <View
                key={idx}
                style={[
                  styles.insight,
                  { backgroundColor: palette.surfaceSunken, borderColor: palette.borderSoft },
                ]}
              >
                <Text style={{ color: palette.text, fontSize: typography.small, lineHeight: 19 }}>
                  {text}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  demoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    flexWrap: 'wrap',
  },
  demoBannerTitle: {
    fontSize: typography.small,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  demoBannerBody: {
    fontSize: typography.small,
    lineHeight: 19,
    marginTop: 4,
  },
  hero: {
    padding: spacing.xxl,
    borderRadius: radius.xl,
    gap: spacing.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
    flexWrap: 'wrap',
  },
  heroEyebrow: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: typography.micro,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  heroHeadline: {
    color: '#ffffff',
    fontSize: typography.displayLg,
    fontWeight: '800',
    letterSpacing: -0.6,
    marginTop: 4,
  },
  heroSubhead: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: typography.body,
    marginTop: 6,
  },
  heroHealthChip: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: radius.lg,
    paddingHorizontal: 18,
    paddingVertical: 12,
    minWidth: 110,
    alignItems: 'center',
  },
  heroHealthValue: {
    color: '#ffffff',
    fontSize: 36,
    fontWeight: '800',
    lineHeight: 38,
  },
  heroHealthLabel: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: typography.micro,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  heroSplitRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    flexWrap: 'wrap',
    marginTop: spacing.md,
  },
  heroSplitItem: {
    flex: 1,
    minWidth: 160,
  },
  heroSplitLabel: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: typography.micro,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heroSplitValue: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginTop: 4,
  },
  heroSplitMeta: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: typography.micro,
    marginTop: 4,
    lineHeight: 16,
  },
  heroSplitDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginHorizontal: spacing.xs,
  },
  privacyRibbon: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  privacyTitle: {
    fontSize: typography.small,
    fontWeight: '800',
    lineHeight: 20,
  },
  privacyBody: {
    fontSize: typography.micro,
    lineHeight: 17,
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  twoCol: {
    flexDirection: 'row',
    gap: spacing.lg,
    flexWrap: 'wrap',
  },
  flex1: { flex: 1, minWidth: 280 },
  flex2: { flex: 2, minWidth: 320 },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  txIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  txIcon: { fontSize: 18 },
  txPayee: { fontSize: typography.body, fontWeight: '700' },
  txMeta: { fontSize: typography.micro, marginTop: 2 },
  txAmount: { fontSize: typography.body, fontWeight: '700' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mName: { fontSize: typography.body, fontWeight: '600' },
  mCount: { fontSize: typography.micro, marginTop: 2 },
  mAmt: { fontSize: typography.body, fontWeight: '700' },
  subsTotal: { fontSize: typography.title, fontWeight: '800' },
  insight: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    alignItems: 'center',
  },
  horizonPill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
});
