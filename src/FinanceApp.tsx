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

import { Sidebar, type NavItem } from './components/layout/Sidebar';
import { createFinanceState, getFinanceSummary, rehydrateFinanceState } from './finance/ledger';
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
import { getErrorMessage } from './utils/format';

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
  { value: 'dashboard', label: 'Dashboard', icon: '🏠' },
  { value: 'transactions', label: 'Transactions', icon: '🧾' },
  { value: 'budgets', label: 'Budgets', icon: '🎯' },
  { value: 'forecast', label: 'Forecast', icon: '📈' },
  { value: 'goals', label: 'Goals', icon: '🚀' },
  { value: 'accounts', label: 'Accounts', icon: '🏦' },
  { value: 'import', label: 'Import', icon: '📥' },
  { value: 'settings', label: 'Settings', icon: '⚙️' },
];

export default function FinanceApp() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}

function AppShell() {
  const { palette } = useTheme();
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
      {wide ? (
        <View style={styles.wideLayout}>
          <Sidebar
            items={navItems}
            activeValue={activeTab}
            onSelect={setActiveTab}
            householdName={state.householdName}
          />
          <PageContainer>
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
            compact
          />
          <PageContainer>
            {loadError ? <LoadErrorBanner message={loadError} /> : null}
            <PageBody tab={activeTab} state={state} onStateChange={setState} />
          </PageContainer>
        </View>
      )}
    </SafeAreaView>
  );
}

function PageContainer({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
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
      return <DashboardPage state={state} />;
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
  page: {
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center',
    gap: spacing.lg,
  },
});
