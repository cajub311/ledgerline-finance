import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { CommandPalette, type CommandAction } from './components/CommandPalette';
import { LockScreen, useLock } from './components/LockScreen';
import { Sidebar, type NavItem, type SidebarSummary } from './components/layout/Sidebar';
import { buildTransactionsCsv } from './finance/export';
import { serializeFinanceState } from './finance/backup';
import {
  applyDetectedTransfers,
  createEmptyFinanceState,
  createFinanceState,
  detectTransfers,
  getFinanceSummary,
  getMonthlyTrend,
  rehydrateFinanceState,
} from './finance/ledger';
import { clearFinanceState } from './finance/storage';
import type { FinanceState } from './finance/types';
import { loadFinanceState } from './finance/storage';
import { useDebouncedFinancePersistence } from './hooks/useDebouncedFinancePersistence';
import { AccountsPage } from './pages/AccountsPage';
import { BudgetsPage } from './pages/BudgetsPage';
import { DashboardPage } from './pages/DashboardPage';
import { ForecastPage } from './pages/ForecastPage';
import { GoalsPage } from './pages/GoalsPage';
import { ImportPage } from './pages/ImportPage';
import { SettingsPage } from './pages/SettingsPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { ThemeProvider, useTheme } from './theme/ThemeContext';
import { spacing, typography } from './theme/tokens';
import { downloadText, formatCurrency, getErrorMessage } from './utils/format';

type Tab =
  | 'dashboard'
  | 'transactions'
  | 'budgets'
  | 'forecast'
  | 'goals'
  | 'accounts'
  | 'import'
  | 'settings';

const TAB_ROUTES: ReadonlyArray<NavItem<Tab>> = [
  { value: 'dashboard', label: 'Dashboard', icon: '🏠', section: 'Overview' },
  { value: 'transactions', label: 'Transactions', icon: '🧾', section: 'Overview' },
  { value: 'accounts', label: 'Accounts', icon: '🏦', section: 'Overview' },
  { value: 'budgets', label: 'Budgets', icon: '🎯', section: 'Plan' },
  { value: 'goals', label: 'Goals', icon: '🚀', section: 'Plan' },
  { value: 'forecast', label: 'Forecast', icon: '📈', section: 'Plan' },
  { value: 'import', label: 'Import & export', icon: '📥', section: 'Data' },
  { value: 'settings', label: 'Settings', icon: '⚙️', section: 'Data' },
];

export default function FinanceApp() {
  return (
    <ThemeProvider>
      <Gate />
    </ThemeProvider>
  );
}

/** Renders the lock screen when sealed; the full app once unlocked. */
function Gate() {
  const { unlocked, unlock } = useLock();
  if (!unlocked) return <LockScreen onUnlock={unlock} />;
  return <AppShell />;
}

function AppShell() {
  const { palette, mode, toggle } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 960;

  const [state, setState] = useState<FinanceState>(() => createFinanceState());
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const saved = await loadFinanceState();
        if (!mounted) return;
        setState(rehydrateFinanceState(saved));
      } catch (error) {
        if (mounted) {
          setLoadError(getErrorMessage(error));
          setState(createFinanceState());
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useDebouncedFinancePersistence(state, loading);

  const summary = useMemo(() => getFinanceSummary(state), [state]);

  const navItems = useMemo<ReadonlyArray<NavItem<Tab>>>(() => {
    return TAB_ROUTES.map((item) => {
      if (item.value === 'transactions' && summary.unreviewedCount > 0) {
        return { ...item, badge: Math.min(99, summary.unreviewedCount) };
      }
      return item;
    });
  }, [summary.unreviewedCount]);

  const commandActions = useMemo<CommandAction[]>(() => {
    const go = (tab: Tab) => () => setActiveTab(tab);
    const navActions: CommandAction[] = TAB_ROUTES.map((item) => ({
      id: `go-${item.value}`,
      label: `Go to ${item.label}`,
      hint: `${item.section ?? 'App'} · ${item.icon}`,
      icon: item.icon,
      section: 'Navigate',
      keywords: ['open', 'tab', item.value],
      run: go(item.value),
    }));

    const exportCsv = () => {
      const csv = buildTransactionsCsv(state);
      downloadText(
        csv,
        `ledgerline-transactions-${new Date().toISOString().slice(0, 10)}.csv`,
        'text/csv',
      );
    };
    const exportJson = () => {
      downloadText(
        serializeFinanceState(state),
        `ledgerline-backup-${new Date().toISOString().slice(0, 10)}.json`,
        'application/json',
      );
    };
    const exportPdf = async () => {
      try {
        const { buildStatementPdf } = await import('./finance/exportPdf');
        const blob = await buildStatementPdf(state);
        if (typeof document === 'undefined') return;
        const { downloadBlob } = await import('./utils/format');
        downloadBlob(
          blob,
          `ledgerline-statement-full-${new Date().toISOString().slice(0, 10)}.pdf`,
        );
      } catch {
        // Surfacing errors through the palette is out of scope; the Import
        // page already has a non-palette path with a proper banner.
      }
    };

    const startFresh = async () => {
      try {
        await clearFinanceState();
      } catch {
        // ignore
      }
      setState(createEmptyFinanceState({ householdName: state.householdName }));
      setActiveTab('dashboard');
    };

    const detectedTransferPairs = detectTransfers(state.transactions);
    const fixTransfers = () => {
      if (detectedTransferPairs.length === 0) return;
      setState(applyDetectedTransfers(state, detectedTransferPairs));
    };

    return [
      ...navActions,
      {
        id: 'fix-transfers',
        label:
          detectedTransferPairs.length > 0
            ? `Fix ${detectedTransferPairs.length} detected transfer${detectedTransferPairs.length === 1 ? '' : 's'}`
            : 'No transfers to fix',
        hint: 'Re-categorize matched account-to-account moves so they stop inflating spend/income totals',
        icon: '🔁',
        section: 'Tools',
        keywords: ['transfer', 'categorize', 'fix', 'match', 'move', 'clean'],
        run: fixTransfers,
      },
      {
        id: 'start-fresh',
        label: 'Start fresh (wipe all data)',
        hint: 'Replaces demo or current data with an empty ledger',
        icon: '🧹',
        section: 'Tools',
        keywords: ['reset', 'wipe', 'clear', 'blank', 'empty', 'fresh'],
        run: () => {
          void startFresh();
        },
      },
      {
        id: 'toggle-theme',
        label: mode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
        hint: 'Appearance',
        icon: mode === 'dark' ? '☀️' : '🌙',
        section: 'Tools',
        keywords: ['theme', 'dark', 'light', 'appearance'],
        run: () => toggle(),
      },
      {
        id: 'export-csv',
        label: 'Export transactions CSV',
        hint: `${state.transactions.length} transactions`,
        icon: '📄',
        section: 'Data',
        keywords: ['download', 'spreadsheet', 'csv', 'export'],
        run: exportCsv,
      },
      {
        id: 'export-pdf',
        label: 'Export PDF statement (full ledger)',
        hint: 'Print-ready',
        icon: '🧾',
        section: 'Data',
        keywords: ['print', 'pdf', 'statement', 'document'],
        run: exportPdf,
      },
      {
        id: 'export-json',
        label: 'Export JSON backup',
        hint: 'Full state snapshot',
        icon: '💾',
        section: 'Data',
        keywords: ['backup', 'save', 'restore', 'archive'],
        run: exportJson,
      },
    ];
  }, [mode, state, toggle]);

  const sidebarSummary = useMemo<SidebarSummary>(() => {
    const trend = getMonthlyTrend(state.transactions, 2);
    const prev = trend[0];
    const now = trend[1];
    const delta =
      prev && now ? (now.income - now.spend) - (prev.income - prev.spend) : summary.monthIncome - summary.monthSpend;
    const trendPositive = delta >= 0;
    const formattedDelta = formatCurrency(Math.abs(delta));
    return {
      netWorth: formatCurrency(summary.netWorth),
      liquidCash: formatCurrency(summary.liquidCash),
      trendLabel: `${trendPositive ? '▲' : '▼'} ${formattedDelta} MoM`,
      trendPositive,
    };
  }, [state.transactions, summary.monthIncome, summary.monthSpend, summary.netWorth, summary.liquidCash]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.loading, { backgroundColor: palette.bg }]}>
        <StatusBar style="auto" />
        <ActivityIndicator size="large" color={palette.primary} />
        <Text style={{ color: palette.textMuted, marginTop: spacing.md }}>
          Loading your ledger…
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: palette.bg }]}>
      <StatusBar style="auto" />
      <CommandPalette actions={commandActions} />
      {wide ? (
        <View style={styles.wideLayout}>
          <Sidebar
            items={navItems}
            activeValue={activeTab}
            onSelect={setActiveTab}
            householdName={state.householdName}
            summary={sidebarSummary}
          />
          <PageContainer narrow={false}>
            {loadError ? <LoadErrorBanner message={loadError} /> : null}
            <PageBody tab={activeTab} state={state} onStateChange={setState} />
          </PageContainer>
        </View>
      ) : (
        <View style={styles.narrowLayout}>
          <Sidebar
            items={navItems}
            activeValue={activeTab}
            onSelect={setActiveTab}
            householdName={state.householdName}
            summary={sidebarSummary}
            compact
          />
          <PageContainer narrow>
            {loadError ? <LoadErrorBanner message={loadError} /> : null}
            <PageBody tab={activeTab} state={state} onStateChange={setState} />
          </PageContainer>
        </View>
      )}
    </SafeAreaView>
  );
}

function PageContainer({ children, narrow }: { children: React.ReactNode; narrow: boolean }) {
  return (
    <ScrollView
      contentContainerStyle={narrow ? styles.scrollNarrow : styles.scroll}
      style={styles.scrollWrap}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.page}>{children}</View>
    </ScrollView>
  );
}

function PageBody({
  tab,
  state,
  onStateChange,
}: {
  tab: Tab;
  state: FinanceState;
  onStateChange: (next: FinanceState) => void;
}) {
  switch (tab) {
    case 'dashboard':
      return <DashboardPage state={state} onStateChange={onStateChange} />;
    case 'transactions':
      return <TransactionsPage state={state} onStateChange={onStateChange} />;
    case 'budgets':
      return <BudgetsPage state={state} onStateChange={onStateChange} />;
    case 'forecast':
      return <ForecastPage state={state} onStateChange={onStateChange} />;
    case 'goals':
      return <GoalsPage state={state} onStateChange={onStateChange} />;
    case 'accounts':
      return <AccountsPage state={state} onStateChange={onStateChange} />;
    case 'import':
      return <ImportPage state={state} onStateChange={onStateChange} />;
    case 'settings':
      return <SettingsPage state={state} onStateChange={onStateChange} />;
    default:
      return null;
  }
}

function LoadErrorBanner({ message }: { message: string }) {
  const { palette } = useTheme();
  return (
    <View
      style={{
        backgroundColor: palette.warningSoft,
        borderColor: palette.warning,
        borderWidth: 1,
        padding: spacing.md,
        borderRadius: 10,
      }}
    >
      <Text style={{ color: palette.warning, fontWeight: '700' }}>
        Loaded a fresh ledger — couldn't read stored data ({message}).
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wideLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  narrowLayout: {
    flex: 1,
    flexDirection: 'column',
  },
  scrollWrap: {
    flex: 1,
  },
  scroll: {
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  scrollNarrow: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  page: {
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center',
    gap: spacing.lg,
  },
});
