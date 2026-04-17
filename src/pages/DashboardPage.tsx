import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { StatTile } from '../components/ui/StatTile';
import { IncomeSpendBars } from '../components/charts/BarChart';
import { CategoryBreakdownList } from '../components/charts/CategoryBreakdownList';
import {
  detectSubscriptions,
  generateInsights,
  getAccountsWithBalances,
  getBudgetStatus,
  getCategoryBreakdown,
  getCategoryIcon,
  getFinanceSummary,
  getFinancialHealthScore,
  getLatestTransactions,
  getMonthlyTrend,
  getSafeToSpend,
  getSavingsRate,
  getTopMerchants,
} from '../finance/ledger';
import type { FinanceState } from '../finance/types';
import { useTheme } from '../theme/ThemeContext';
import { elevation, radius, spacing, typography } from '../theme/tokens';
import { formatCurrency } from '../utils/format';

interface DashboardPageProps {
  state: FinanceState;
}

export function DashboardPage({ state }: DashboardPageProps) {
  const { palette, mode } = useTheme();
  const summary = useMemo(() => getFinanceSummary(state), [state]);
  const savingsRate = useMemo(() => getSavingsRate(state), [state]);
  const trend = useMemo(() => getMonthlyTrend(state.transactions, 6), [state.transactions]);

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
  const subs = useMemo(() => detectSubscriptions(state.transactions), [state.transactions]);
  const insights = useMemo(() => generateInsights(state), [state]);

  const budgetedByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const b of state.budgets) map[b.category] = b.monthlyLimit;
    return map;
  }, [state.budgets]);

  const monthLabel = now.toLocaleString('default', { month: 'long', year: 'numeric' });
  const monthName = now.toLocaleString('default', { month: 'long' });
  const net = summary.monthIncome - summary.monthSpend;
  const overBudget = budgetStatuses.filter((b) => b.status === 'over').length;
  const subsMonthly = subs.filter((s) => s.frequency === 'monthly').reduce((s, c) => s + c.amount, 0);
  const safeToSpend = useMemo(() => getSafeToSpend(state), [state]);
  const health = useMemo(() => getFinancialHealthScore(state), [state]);

  const healthColor =
    health.score >= 85
      ? palette.success
      : health.score >= 70
        ? palette.success
        : health.score >= 50
          ? palette.warning
          : palette.danger;

  return (
    <View style={{ gap: spacing.lg }}>
      <View
        style={[
          styles.hero,
          elevation(3, mode),
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
            <Text style={styles.heroHeadline}>Good to see you.</Text>
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
          <View style={styles.heroSplitDivider} />
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
          <View style={styles.heroSplitDivider} />
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
});
