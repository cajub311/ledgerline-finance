import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { FinanceCard } from './components/finance/FinanceCard';
import { ImportHubSection } from './components/finance/ImportHubSection';
import { InsightBadge } from './components/finance/InsightBadge';
import { SpendingBar } from './components/finance/SpendingBar';
import { SummaryTile } from './components/finance/SummaryTile';
import { TransactionRow } from './components/finance/TransactionRow';
import {
  addGoal,
  applyImportedBatch,
  addManualTransaction,
  createFinanceState,
  detectSubscriptions,
  generateInsights,
  getAccountsWithBalances,
  getBudgetHealthScore,
  getBudgetPills,
  getBudgetStatus,
  getCategoryBreakdown,
  getCategoryIcon,
  getCategoryOptions,
  getFinanceSummary,
  getGuidanceSnapshot,
  getGoalStats,
  getLatestTransactions,
  getMonthlyTrend,
  getSavingsRate,
  getTopMerchants,
  hasUnreviewedTransactions,
  loadSummaryWidgetPrefs,
  rehydrateFinanceState,
  removeGoal,
  rotateTransactionCategory,
  saveSummaryWidgetPrefs,
  setBudget,
  removeBudget,
  SUMMARY_WIDGET_IDS,
  SUMMARY_WIDGET_LABELS,
  toggleTransactionReview,
  updateGoalProgress,
  updateTransactionCategory,
  type GuidanceCta,
  type FinanceState,
  type SummaryWidgetId,
  parseFinanceBackupJson,
  serializeFinanceState,
} from './finance';
import { buildTransactionsCsv } from './finance/export';
import { parseStatementBlob } from './finance/import';
import { parseStatementText } from './finance/import.shared';
import { clearFinanceState as clearFinanceStorage, loadFinanceState } from './finance/storage';
import { useDebouncedFinancePersistence } from './hooks/useDebouncedFinancePersistence';
import { formatCurrency, formatIsoDate, getErrorMessage } from './utils/format';
import { pickWebStatementFiles } from './utils/webFilePicker';

const palette = {
  bg: '#071218',
  shell: '#0f1b21',
  panel: '#14232a',
  panelRaised: '#183038',
  border: '#27444f',
  borderSoft: '#20353d',
  text: '#eff7f4',
  muted: '#b9ccd0',
  accent: '#d4e37d',
  accentSoft: '#94bdc4',
  warning: '#f0bd82',
  danger: '#d97e68',
  positive: '#8fd3b4',
};

export default function FinanceApp() {
  const [state, setState] = useState<FinanceState>(() => createFinanceState());
  const [loading, setLoading] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedTransactionId, setSelectedTransactionId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [pastedStatement, setPastedStatement] = useState('');
  const [manualDate, setManualDate] = useState(() => formatIsoDate());
  const [manualPayee, setManualPayee] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [manualCategory, setManualCategory] = useState('Other');
  const [manualNotes, setManualNotes] = useState('');
  const [importMessage, setImportMessage] = useState('Ready to import Wells Fargo statements.');
  const [importing, setImporting] = useState(false);

  // Analytics state
  const [analyticsCategoryFilter, setAnalyticsCategoryFilter] = useState<string | null>(null);
  const [analyticsMonthOffset, setAnalyticsMonthOffset] = useState(0); // 0 = current, -1 = prev, etc.

  // Budget UI state
  const [budgetEditCategory, setBudgetEditCategory] = useState<string | null>(null);
  const [budgetEditValue, setBudgetEditValue] = useState('');
  const [newBudgetCategory, setNewBudgetCategory] = useState('Groceries');
  const [newBudgetLimit, setNewBudgetLimit] = useState('');
  const [showAddBudget, setShowAddBudget] = useState(false);

  // Goals UI state
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalCurrent, setGoalCurrent] = useState('');
  const [goalDate, setGoalDate] = useState('');
  const [goalEditId, setGoalEditId] = useState<string | null>(null);
  const [goalEditValue, setGoalEditValue] = useState('');

  useEffect(() => {
    let mounted = true;

    void (async () => {
      try {
        const saved = await loadFinanceState();

        if (!mounted) {
          return;
        }

        setState(rehydrateFinanceState(saved));
      } catch (error) {
        if (mounted) {
          setImportMessage(`Could not load saved data (${getErrorMessage(error)}). Using a fresh ledger.`);
        }
        if (mounted) {
          setState(createFinanceState());
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useDebouncedFinancePersistence(state, loading);

  const summary = useMemo(() => getFinanceSummary(state), [state]);
  const accounts = useMemo(() => getAccountsWithBalances(state), [state]);
  const latestTransactions = useMemo(() => getLatestTransactions(state, 8), [state]);
  const budgetPills = useMemo(() => getBudgetPills(state), [state]);
  const categoryOptions = useMemo(() => getCategoryOptions(), []);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // Analytics month (can browse backwards with offset)
  const analyticsDate = useMemo(() => {
    const d = new Date(now.getFullYear(), now.getMonth() + analyticsMonthOffset, 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }, [analyticsMonthOffset, now.getFullYear(), now.getMonth()]);

  const analyticsMonthLabel = useMemo(() => {
    const d = new Date(analyticsDate.year, analyticsDate.month - 1, 1);
    return d.toLocaleString('default', { month: 'long', year: 'numeric' });
  }, [analyticsDate]);

  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const isCurrentMonth = analyticsMonthOffset === 0;

  const categoryBreakdown = useMemo(
    () => getCategoryBreakdown(state.transactions, analyticsDate.year, analyticsDate.month),
    [state.transactions, analyticsDate],
  );
  const monthlyTrend = useMemo(
    () => getMonthlyTrend(state.transactions, 6),
    [state.transactions],
  );
  const topMerchants = useMemo(
    () => getTopMerchants(state.transactions, analyticsDate.year, analyticsDate.month, 5),
    [state.transactions, analyticsDate],
  );
  const savingsRate = useMemo(() => getSavingsRate(state), [state]);
  const budgetHealthScore = useMemo(() => getBudgetHealthScore(state), [state]);
  const detectedSubscriptions = useMemo(
    () => detectSubscriptions(state.transactions),
    [state.transactions],
  );
  const insights = useMemo(() => generateInsights(state), [state]);
  const budgetStatuses = useMemo(
    () => getBudgetStatus(state, currentYear, currentMonth),
    [state, currentYear, currentMonth],
  );
  const guidance = useMemo(() => getGuidanceSnapshot(state), [state]);
  const previousMonth = useMemo(() => {
    const d = new Date(currentYear, currentMonth - 2, 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }, [currentMonth, currentYear]);
  const previousMonthBreakdown = useMemo(
    () => getCategoryBreakdown(state.transactions, previousMonth.year, previousMonth.month),
    [previousMonth.month, previousMonth.year, state.transactions],
  );
  const previousMonthSpend = useMemo(
    () => Number(previousMonthBreakdown.reduce((sum, item) => sum + item.total, 0).toFixed(2)),
    [previousMonthBreakdown],
  );
  const monthDeltaPct = useMemo(() => {
    if (previousMonthSpend <= 0) {
      return 0;
    }
    return Number((((summary.monthSpend - previousMonthSpend) / previousMonthSpend) * 100).toFixed(1));
  }, [previousMonthSpend, summary.monthSpend]);
  const topCategoryNow = categoryBreakdown[0] ?? null;
  const monthReviewRows = useMemo(() => {
    const previousMap = new Map(previousMonthBreakdown.map((item) => [item.category, item.total] as const));
    const categories = new Set<string>([
      ...categoryBreakdown.slice(0, 4).map((item) => item.category),
      ...previousMonthBreakdown.slice(0, 4).map((item) => item.category),
    ]);

    return [...categories]
      .map((category) => {
        const current = categoryBreakdown.find((item) => item.category === category)?.total ?? 0;
        const previous = previousMap.get(category) ?? 0;
        const deltaPct =
          previous > 0 ? Number((((current - previous) / previous) * 100).toFixed(1)) : current > 0 ? 100 : 0;
        return { category, current, previous, deltaPct };
      })
      .sort((left, right) => Math.abs(right.deltaPct) - Math.abs(left.deltaPct))
      .slice(0, 5);
  }, [categoryBreakdown, previousMonthBreakdown]);

  const maxMonthlySpend = useMemo(
    () => Math.max(...monthlyTrend.map((m) => m.spend), 1),
    [monthlyTrend],
  );

  const [summaryWidgetOrder, setSummaryWidgetOrder] = useState<SummaryWidgetId[]>(() => [
    ...SUMMARY_WIDGET_IDS,
  ]);
  const [hiddenSummaryWidgets, setHiddenSummaryWidgets] = useState<SummaryWidgetId[]>([]);

  useEffect(() => {
    const prefs = loadSummaryWidgetPrefs();
    setSummaryWidgetOrder(prefs.order);
    setHiddenSummaryWidgets(prefs.hidden);
  }, []);

  useEffect(() => {
    saveSummaryWidgetPrefs(summaryWidgetOrder, hiddenSummaryWidgets);
  }, [hiddenSummaryWidgets, summaryWidgetOrder]);

  const hiddenSummaryWidgetSet = useMemo(
    () => new Set<SummaryWidgetId>(hiddenSummaryWidgets),
    [hiddenSummaryWidgets],
  );
  const widgetOrderIndexMap = useMemo(
    () =>
      new Map(
        summaryWidgetOrder.map((widgetId, index) => [widgetId, index] as const),
      ),
    [summaryWidgetOrder],
  );
  const visibleSummaryWidgets = useMemo(
    () => summaryWidgetOrder.filter((widgetId) => !hiddenSummaryWidgetSet.has(widgetId)),
    [hiddenSummaryWidgetSet, summaryWidgetOrder],
  );

  const selectedAccount =
    accounts.find((account) => account.id === selectedAccountId) ?? accounts[0] ?? null;

  const accountTransactions = useMemo(() => {
    if (!selectedAccount) {
      return [];
    }

    return state.transactions
      .filter((transaction) => transaction.accountId === selectedAccount.id)
      .filter((transaction) => {
        if (analyticsCategoryFilter && transaction.category !== analyticsCategoryFilter) {
          return false;
        }
        const query = searchQuery.trim().toLowerCase();

        if (!query) {
          return true;
        }

        return [transaction.payee, transaction.category, transaction.notes ?? '']
          .join(' ')
          .toLowerCase()
          .includes(query);
      })
      .sort((left, right) => right.date.localeCompare(left.date));
  }, [analyticsCategoryFilter, searchQuery, selectedAccount, state.transactions]);

  const selectedTransaction =
    accountTransactions.find((transaction) => transaction.id === selectedTransactionId) ??
    accountTransactions[0] ??
    null;

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!selectedAccount && accounts[0]) {
      setSelectedAccountId(accounts[0].id);
      return;
    }

    if (selectedAccount && selectedAccount.id !== selectedAccountId) {
      setSelectedAccountId(selectedAccount.id);
    }
  }, [accounts, loading, selectedAccount, selectedAccountId]);

  useEffect(() => {
    if (loading || accountTransactions.length === 0) {
      return;
    }

    if (!selectedTransaction || selectedTransaction.id !== selectedTransactionId) {
      setSelectedTransactionId(accountTransactions[0].id);
    }
  }, [accountTransactions, loading, selectedTransaction, selectedTransactionId]);

  function updateState(recipe: (current: FinanceState) => FinanceState) {
    setState((current) => recipe(current));
  }

  function resetWorkspace() {
    void clearFinanceStorage();
    const next = createFinanceState();
    setState(next);
    setSelectedAccountId(next.accounts[0]?.id ?? '');
    setSelectedTransactionId(next.transactions[0]?.id ?? '');
    setManualDate(formatIsoDate());
    setManualPayee('');
    setManualAmount('');
    setManualCategory('Other');
    setManualNotes('');
    setImportMessage('Demo ledger restored.');
    setSearchQuery('');
    setPastedStatement('');
  }

  function exportCsv() {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return;
    }

    const csv = buildTransactionsCsv(state);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `ledgerline-export-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportBackup() {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return;
    }

    const json = serializeFinanceState(state);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `ledgerline-backup-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setImportMessage('Backup downloaded. Store it somewhere safe — it contains your full ledger.');
  }

  function importBackupFromFileList(files: FileList | null | undefined) {
    const file = files?.[0];
    if (!file) {
      return;
    }

    void (async () => {
      try {
        const text = await file.text();
        const next = parseFinanceBackupJson(text);
        setState(next);
        setSelectedAccountId(next.accounts[0]?.id ?? '');
        setSelectedTransactionId(next.transactions[0]?.id ?? '');
        setPastedStatement('');
        setImportMessage(`Restored ledger from ${file.name}.`);
      } catch (error) {
        setImportMessage(`Backup import failed: ${getErrorMessage(error)}`);
      }
    })();
  }

  function addManualEntry() {
    const targetAccountId = selectedAccount?.id ?? accounts[0]?.id ?? state.accounts[0]?.id;

    if (!targetAccountId) {
      setImportMessage('No account is available yet.');
      return;
    }

    const nextState = addManualTransaction(state, {
      accountId: targetAccountId,
      date: manualDate,
      payee: manualPayee,
      amount: manualAmount,
      category: manualCategory,
      notes: manualNotes,
    });

    if (nextState === state) {
      setImportMessage('Add a date, merchant, amount, and category first.');
      return;
    }

    const targetAccount = accounts.find((account) => account.id === targetAccountId) ?? null;
    const createdTransactionId = nextState.transactions[0]?.id ?? '';

    setState(nextState);
    setSelectedAccountId(targetAccountId);
    setSelectedTransactionId(createdTransactionId);
    setManualPayee('');
    setManualAmount('');
    setManualNotes('');
    setImportMessage(
      `Added a manual transaction to ${targetAccount?.name ?? 'the selected account'}.`,
    );
  }

  async function importStatementFiles() {
    if (Platform.OS !== 'web') {
      setImportMessage('On Android, paste statement text below to import. File uploads are wired for the web build.');
      return;
    }

    setImporting(true);

    try {
      const webFiles = await pickWebStatementFiles();

      if (!webFiles.length) {
        setImportMessage('Import cancelled.');
        return;
      }

      const batches: Awaited<ReturnType<typeof parseStatementBlob>>[] = [];

      for (const file of webFiles) {
        const batch = await parseStatementBlob(file);
        batches.push(batch);
      }

      const targetAccountId = selectedAccount?.id ?? accounts[0]?.id ?? state.accounts[0]?.id;

      if (!targetAccountId) {
        setImportMessage('No account is available yet.');
        return;
      }

      updateState((current) =>
        batches.reduce((next, batch) => applyImportedBatch(next, targetAccountId, batch), current),
      );

      const importedRows = batches.reduce((sum, batch) => sum + batch.rows.length, 0);
      const warnings = batches.reduce((sum, batch) => sum + batch.notes.length, 0);
      setImportMessage(
        `Imported ${webFiles.length} file${webFiles.length === 1 ? '' : 's'} and ${importedRows} row${importedRows === 1 ? '' : 's'} into ${selectedAccount?.name ?? 'the selected account'}.${warnings > 0 ? ` ${warnings} parsing note${warnings === 1 ? '' : 's'} were added.` : ''}`,
      );
    } catch (error) {
      setImportMessage(`Import failed: ${getErrorMessage(error)}`);
    } finally {
      setImporting(false);
    }
  }

  function importPastedStatement() {
    if (!pastedStatement.trim()) {
      setImportMessage('Paste Wells Fargo statement text or CSV rows first.');
      return;
    }

    const targetAccountId = selectedAccount?.id ?? accounts[0]?.id ?? state.accounts[0]?.id;

    if (!targetAccountId) {
      setImportMessage('No account is available yet.');
      return;
    }

    const batch = parseStatementText(pastedStatement);

    if (batch.rows.length === 0) {
      setImportMessage('No statement rows matched the pasted text.');
      return;
    }

    updateState((current) => applyImportedBatch(current, targetAccountId, batch));
    setImportMessage(`Imported ${batch.rows.length} row${batch.rows.length === 1 ? '' : 's'} from pasted text.`);
    setPastedStatement('');
  }

  function jumpToTransactionsView(filter: 'all' | 'unreviewed' | 'other' = 'all') {
    const base = selectedAccount?.id ?? accounts[0]?.id;

    if (base) {
      setSelectedAccountId(base);
    }

    if (filter === 'all') {
      setAnalyticsCategoryFilter(null);
      return;
    }

    const scoped = state.transactions
      .filter((transaction) => transaction.accountId === base)
      .filter((transaction) =>
        filter === 'unreviewed' ? !transaction.reviewed : transaction.category === 'Other',
      )
      .sort((left, right) => right.date.localeCompare(left.date));

    const fallback = state.transactions
      .filter((transaction) =>
        filter === 'unreviewed' ? !transaction.reviewed : transaction.category === 'Other',
      )
      .sort((left, right) => right.date.localeCompare(left.date));

    const match = scoped[0] ?? fallback[0];
    if (match) {
      setSelectedAccountId(match.accountId);
      setSelectedTransactionId(match.id);
    }
  }

  function getGuidanceCtaLabel(cta: GuidanceCta) {
    switch (cta) {
      case 'review':
        return 'Open review';
      case 'categorize':
        return 'Fix categories';
      case 'budgets':
        return 'Check budgets';
      case 'subscriptions':
        return 'Review subscriptions';
      case 'goals':
        return 'Update goals';
      default:
        return 'Done';
    }
  }

  function handleGuidanceCta(cta: GuidanceCta) {
    if (cta === 'review') {
      jumpToTransactionsView('unreviewed');
      setImportMessage('Action plan: review unreviewed rows in Transaction review.');
      return;
    }

    if (cta === 'categorize') {
      jumpToTransactionsView('other');
      setImportMessage('Action plan: recategorize rows in "Other" for better analytics.');
      return;
    }

    if (cta === 'budgets') {
      setImportMessage('Action plan: adjust Monthly budgets based on your pace and risk.');
      return;
    }

    if (cta === 'subscriptions') {
      setImportMessage('Action plan: inspect Subscriptions and decide what to pause or cancel.');
      return;
    }

    if (cta === 'goals') {
      setImportMessage('Action plan: update Financial goals so monthly targets stay realistic.');
      return;
    }

    setImportMessage('Action plan complete. Keep importing and reviewing weekly.');
  }

  function moveSummaryWidget(widgetId: SummaryWidgetId, direction: -1 | 1) {
    setSummaryWidgetOrder((currentOrder) => {
      const currentIndex = currentOrder.indexOf(widgetId);
      if (currentIndex < 0) {
        return currentOrder;
      }
      const nextIndex = currentIndex + direction;
      if (nextIndex < 0 || nextIndex >= currentOrder.length) {
        return currentOrder;
      }
      const nextOrder = [...currentOrder];
      const [moved] = nextOrder.splice(currentIndex, 1);
      nextOrder.splice(nextIndex, 0, moved);
      return nextOrder;
    });
  }

  function toggleSummaryWidget(widgetId: SummaryWidgetId) {
    setHiddenSummaryWidgets((currentHidden) =>
      currentHidden.includes(widgetId)
        ? currentHidden.filter((id) => id !== widgetId)
        : [...currentHidden, widgetId],
    );
  }

  function renderSummaryTile(widgetId: SummaryWidgetId) {
    switch (widgetId) {
      case 'liquid-cash':
        return (
          <SummaryTile
            key={widgetId}
            label="Liquid cash"
            value={formatCurrency(summary.liquidCash)}
            detail="Checking, savings & cash"
            tone="positive"
          />
        );
      case 'month-income':
        return (
          <SummaryTile
            key={widgetId}
            label="Month income"
            value={formatCurrency(summary.monthIncome)}
            detail="Income this month"
            tone="positive"
          />
        );
      case 'month-spend':
        return (
          <SummaryTile
            key={widgetId}
            label="Month spend"
            value={formatCurrency(summary.monthSpend)}
            detail="Expenses this month"
            tone="alert"
          />
        );
      case 'savings-rate':
        return (
          <SummaryTile
            key={widgetId}
            label="Savings rate"
            value={savingsRate > 0 ? `${savingsRate}%` : '—'}
            detail={savingsRate > 0 ? 'Of income kept this month' : 'Import income to calculate'}
            tone={savingsRate >= 20 ? 'positive' : 'neutral'}
          />
        );
      case 'budget-health':
        return (
          <SummaryTile
            key={widgetId}
            label="Budget health"
            value={budgetHealthScore != null ? `${budgetHealthScore}%` : '—'}
            detail={budgetHealthScore != null ? 'Budgets on track this month' : 'Set budgets below to track'}
            tone={
              budgetHealthScore != null && budgetHealthScore >= 70
                ? 'positive'
                : budgetHealthScore != null
                  ? 'alert'
                  : 'neutral'
            }
          />
        );
      case 'unreviewed':
        return (
          <SummaryTile
            key={widgetId}
            label="Unreviewed"
            value={`${summary.unreviewedCount}`}
            detail="Transactions to review"
            tone={summary.unreviewedCount > 0 ? 'alert' : 'neutral'}
          />
        );
      case 'safe-to-spend':
        return (
          <SummaryTile
            key={widgetId}
            label="Safe to spend"
            value={formatCurrency(guidance.safeToSpend)}
            detail="After 20% savings target"
            tone={guidance.safeToSpend >= 0 ? 'positive' : 'alert'}
          />
        );
      case 'projected-month-end':
        return (
          <SummaryTile
            key={widgetId}
            label="Projected month-end"
            value={formatCurrency(guidance.projectedMonthEndNet)}
            detail={`Pace ${formatCurrency(guidance.averageDailySpend)}/day`}
            tone={guidance.projectedMonthEndNet >= 0 ? 'positive' : 'alert'}
          />
        );
      case 'recurring-burn':
        return (
          <SummaryTile
            key={widgetId}
            label="Recurring burn"
            value={formatCurrency(guidance.monthlySubscriptionBurn)}
            detail="Estimated subscription spend"
            tone="neutral"
          />
        );
      case 'review-completion':
        return (
          <SummaryTile
            key={widgetId}
            label="Review completion"
            value={`${guidance.reviewCompletionPct}%`}
            detail="Transactions reviewed this month"
            tone={guidance.reviewCompletionPct >= 80 ? 'positive' : 'neutral'}
          />
        );
      default:
        return null;
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingShell}>
        <StatusBar style="light" />
        <ActivityIndicator color={palette.accent} size="large" />
        <Text style={styles.loadingText}>Loading Ledgerline...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroCopy}>
            <Text style={styles.kicker}>{state.householdName}</Text>
            <Text style={styles.title}>Ledgerline Finance</Text>
            <Text style={styles.subtitle}>
              Your personal finance command center — import statements, track spending habits,
              set budgets, and hit your savings goals. Everything stays on your device.
            </Text>
            <View style={styles.pillRow}>
              {budgetPills.map((pill) => (
                <View key={pill} style={styles.pill}>
                  <Text style={styles.pillText}>{pill}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeLabel}>Net worth</Text>
            <Text style={styles.heroBadgeValue}>{formatCurrency(summary.netWorth)}</Text>
            <Text style={styles.heroBadgeNote}>
              {summary.importedFiles} imports | {summary.unreviewedCount} pending review
            </Text>
          </View>
        </View>

        <View style={styles.summaryGrid}>
          {visibleSummaryWidgets.map((widgetId) => renderSummaryTile(widgetId))}
        </View>

        <FinanceCard title="Dashboard layout" eyebrow="Customize cards">
          <Text style={styles.bodyText}>
            Show or hide summary cards and reorder them so the top of your dashboard reflects what
            you watch most.
          </Text>
          <View style={styles.layoutList}>
            {summaryWidgetOrder.map((widgetId) => {
              const index = widgetOrderIndexMap.get(widgetId) ?? 0;
              const canMoveUp = index > 0;
              const canMoveDown = index < summaryWidgetOrder.length - 1;
              const isVisible = !hiddenSummaryWidgetSet.has(widgetId);
              return (
                <View key={widgetId} style={styles.layoutRow}>
                  <View style={styles.layoutCopy}>
                    <Text style={styles.layoutName}>{SUMMARY_WIDGET_LABELS[widgetId]}</Text>
                    <Text style={styles.layoutMeta}>
                      {isVisible ? 'Visible on dashboard' : 'Hidden from dashboard'}
                    </Text>
                  </View>
                  <View style={styles.layoutActions}>
                    <Pressable
                      style={[
                        styles.layoutActionButton,
                        !canMoveUp && styles.layoutActionButtonDisabled,
                      ]}
                      onPress={() => moveSummaryWidget(widgetId, -1)}
                      disabled={!canMoveUp}
                    >
                      <Text style={styles.layoutActionButtonText}>↑</Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.layoutActionButton,
                        !canMoveDown && styles.layoutActionButtonDisabled,
                      ]}
                      onPress={() => moveSummaryWidget(widgetId, 1)}
                      disabled={!canMoveDown}
                    >
                      <Text style={styles.layoutActionButtonText}>↓</Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.layoutToggleButton,
                        isVisible && styles.layoutToggleButtonActive,
                      ]}
                      onPress={() => toggleSummaryWidget(widgetId)}
                    >
                      <Text style={styles.layoutToggleButtonText}>
                        {isVisible ? 'Visible' : 'Hidden'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        </FinanceCard>

        <FinanceCard title="Action plan" eyebrow="What to do next" tone="accent">
          <Text style={styles.bodyText}>
            This turns statement imports into concrete next actions so you can improve outcomes, not
            just view transactions.
          </Text>
          <View style={styles.actionKpiRow}>
            <View style={styles.actionKpiCard}>
              <Text style={styles.actionKpiLabel}>Safe to spend</Text>
              <Text
                style={[
                  styles.actionKpiValue,
                  guidance.safeToSpend > 0 ? styles.actionKpiValuePositive : styles.actionKpiValueDanger,
                ]}
              >
                {formatCurrency(guidance.safeToSpend)}
              </Text>
              <Text style={styles.actionKpiDetail}>After aiming to save 20% of this month&apos;s income.</Text>
            </View>
            <View style={styles.actionKpiCard}>
              <Text style={styles.actionKpiLabel}>Projected month-end</Text>
              <Text
                style={[
                  styles.actionKpiValue,
                  guidance.projectedMonthEndNet >= 0
                    ? styles.actionKpiValuePositive
                    : styles.actionKpiValueDanger,
                ]}
              >
                {formatCurrency(guidance.projectedMonthEndNet)}
              </Text>
              <Text style={styles.actionKpiDetail}>
                Pace: {formatCurrency(guidance.averageDailySpend)}/day with {guidance.daysRemainingInMonth}{' '}
                day{guidance.daysRemainingInMonth === 1 ? '' : 's'} left.
              </Text>
            </View>
            <View style={styles.actionKpiCard}>
              <Text style={styles.actionKpiLabel}>Recurring burn</Text>
              <Text style={styles.actionKpiValue}>
                {formatCurrency(guidance.monthlySubscriptionBurn)}
              </Text>
              <Text style={styles.actionKpiDetail}>Estimated monthly subscription total.</Text>
            </View>
            <View style={styles.actionKpiCard}>
              <Text style={styles.actionKpiLabel}>Review completion</Text>
              <Text style={styles.actionKpiValue}>{guidance.reviewCompletionPct}%</Text>
              <Text style={styles.actionKpiDetail}>Transactions reviewed this month.</Text>
            </View>
          </View>
          <View style={styles.actionStepList}>
            {guidance.steps.map((step) => {
              const dotColor =
                step.priority === 'high'
                  ? palette.danger
                  : step.priority === 'medium'
                    ? palette.warning
                    : palette.positive;
              return (
                <View key={step.id} style={styles.actionStepRow}>
                  <View style={[styles.priorityDot, { backgroundColor: dotColor }]} />
                  <View style={styles.actionStepCopy}>
                    <Text style={styles.actionStepTitle}>{step.title}</Text>
                    <Text style={styles.actionStepDetail}>{step.detail}</Text>
                    <Pressable
                      style={styles.actionStepButton}
                      onPress={() => handleGuidanceCta(step.cta)}
                    >
                      <Text style={styles.actionStepButtonText}>
                        {getGuidanceCtaLabel(step.cta)}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        </FinanceCard>

        <FinanceCard title="Month review" eyebrow="Compared to last month">
          <Text style={styles.bodyText}>
            Catch trend changes early so you can adjust now instead of waiting for month-end.
          </Text>
          <View style={styles.reviewGrid}>
            <View style={styles.reviewMetric}>
              <Text style={styles.reviewMetricLabel}>Spend vs last month</Text>
              <Text
                style={[
                  styles.reviewMetricValue,
                  monthDeltaPct > 0 ? styles.reviewMetricValueDanger : styles.reviewMetricValuePositive,
                ]}
              >
                {monthDeltaPct >= 0 ? '+' : ''}
                {monthDeltaPct}%
              </Text>
              <Text style={styles.reviewMetricDetail}>
                {formatCurrency(summary.monthSpend)} now vs {formatCurrency(previousMonthSpend)} prior
                month
              </Text>
            </View>
            <View style={styles.reviewMetric}>
              <Text style={styles.reviewMetricLabel}>Top spend category</Text>
              <Text style={styles.reviewMetricValue}>{topCategoryNow?.category ?? '—'}</Text>
              <Text style={styles.reviewMetricDetail}>
                {topCategoryNow
                  ? formatCurrency(topCategoryNow.total)
                  : 'Import more data to compare category trends'}
              </Text>
            </View>
          </View>
          <View style={styles.reviewList}>
            {monthReviewRows.length ? (
              monthReviewRows.map((row) => (
                <View key={row.category} style={styles.reviewRow}>
                  <View style={styles.reviewRowCopy}>
                    <Text style={styles.reviewRowCategory}>
                      {getCategoryIcon(row.category)} {row.category}
                    </Text>
                    <Text style={styles.reviewRowDetail}>
                      {formatCurrency(row.current)} this month · {formatCurrency(row.previous)} last
                      month
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.reviewRowChange,
                      row.deltaPct > 0 ? styles.reviewRowChangeDanger : styles.reviewRowChangePositive,
                    ]}
                  >
                    {row.deltaPct >= 0 ? '+' : ''}
                    {row.deltaPct}%
                  </Text>
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Not enough history yet</Text>
                <Text style={styles.emptyBody}>
                  Import at least two months of transactions to unlock month-over-month review.
                </Text>
              </View>
            )}
          </View>
        </FinanceCard>

        {/* ── Spending Insights ─────────────────────────────────────── */}
        {insights.length > 0 && (
          <FinanceCard title="Spending insights" eyebrow="Smart analysis">
            {insights.map((insight, i) => (
              <InsightBadge key={i} text={insight} index={i} />
            ))}
          </FinanceCard>
        )}

        {/* ── Spending Analytics ────────────────────────────────────── */}
        <FinanceCard title="Spending analytics" eyebrow="Analytics">
          {/* Month picker */}
          <View style={styles.monthPicker}>
            <Pressable
              style={styles.monthNavBtn}
              onPress={() => {
                setAnalyticsMonthOffset((o) => o - 1);
                setAnalyticsCategoryFilter(null);
              }}
            >
              <Text style={styles.monthNavBtnText}>‹ Prev</Text>
            </Pressable>
            <Text style={styles.monthLabel}>{analyticsMonthLabel}</Text>
            <Pressable
              style={[styles.monthNavBtn, analyticsMonthOffset >= 0 && styles.monthNavBtnDisabled]}
              onPress={() => {
                if (analyticsMonthOffset < 0) {
                  setAnalyticsMonthOffset((o) => o + 1);
                  setAnalyticsCategoryFilter(null);
                }
              }}
            >
              <Text style={[styles.monthNavBtnText, analyticsMonthOffset >= 0 && styles.monthNavBtnDisabledText]}>
                Next ›
              </Text>
            </Pressable>
          </View>

          {categoryBreakdown.length > 0 ? (
            <View style={styles.analyticsSection}>
              <Text style={styles.analyticsSectionTitle}>
                Category breakdown{isCurrentMonth ? ` · day ${dayOfMonth} of ${daysInMonth}` : ''}
              </Text>
              {analyticsCategoryFilter ? (
                <Pressable
                  style={styles.filterChip}
                  onPress={() => setAnalyticsCategoryFilter(null)}
                >
                  <Text style={styles.filterChipText}>
                    Filtered: {analyticsCategoryFilter} ×
                  </Text>
                </Pressable>
              ) : null}
              {categoryBreakdown.map((item) => (
                <Pressable
                  key={item.category}
                  onPress={() =>
                    setAnalyticsCategoryFilter(
                      analyticsCategoryFilter === item.category ? null : item.category,
                    )
                  }
                >
                  <SpendingBar
                    category={item.category}
                    amount={item.total}
                    pct={item.pct}
                    icon={getCategoryIcon(item.category)}
                    pace={
                      isCurrentMonth && dayOfMonth > 0
                        ? (item.total / dayOfMonth) * daysInMonth
                        : undefined
                    }
                  />
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No spending data yet</Text>
              <Text style={styles.emptyBody}>Import a statement to see your spending breakdown.</Text>
            </View>
          )}

          {topMerchants.length > 0 && (
            <View style={styles.analyticsSection}>
              <Text style={styles.analyticsSectionTitle}>Top merchants this month</Text>
              {topMerchants.map((merchant, i) => (
                <View key={merchant.payee} style={styles.merchantRow}>
                  <Text style={styles.merchantRank}>#{i + 1}</Text>
                  <Text style={styles.merchantName} numberOfLines={1}>{merchant.payee}</Text>
                  <Text style={styles.merchantAmount}>${merchant.total.toFixed(0)}</Text>
                  <Text style={styles.merchantCount}>{merchant.count}×</Text>
                </View>
              ))}
            </View>
          )}

          {monthlyTrend.length > 0 && (
            <View style={styles.analyticsSection}>
              <Text style={styles.analyticsSectionTitle}>6-month spending trend</Text>
              <View style={styles.trendChart}>
                {monthlyTrend.map((m) => {
                  const barHeightPct = maxMonthlySpend > 0 ? m.spend / maxMonthlySpend : 0;
                  const barHeight = Math.max(4, Math.round(barHeightPct * 80));
                  return (
                    <View key={m.monthKey} style={styles.trendColumn}>
                      <Text style={styles.trendAmount}>${(m.spend / 1000).toFixed(1)}k</Text>
                      <View style={styles.trendBarWrap}>
                        <View style={[styles.trendBar, { height: barHeight }]} />
                      </View>
                      <Text style={styles.trendLabel}>{m.label}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </FinanceCard>

        {/* ── Subscriptions ─────────────────────────────────────────── */}
        <FinanceCard title="Subscriptions" eyebrow="Recurring charges">
          {detectedSubscriptions.length > 0 ? (
            <View style={styles.subStack}>
              {detectedSubscriptions.map((sub) => (
                <View key={sub.payee} style={styles.subRow}>
                  <View style={styles.subCopy}>
                    <Text style={styles.subName}>{sub.payee}</Text>
                    <Text style={styles.subMeta}>
                      {sub.frequency} · last {sub.lastCharged} · {sub.occurrences} charges found
                    </Text>
                  </View>
                  <View style={styles.subAmounts}>
                    <Text style={styles.subMonthly}>${sub.amount.toFixed(2)}/mo</Text>
                    <Text style={styles.subAnnual}>${sub.annualCost.toFixed(0)}/yr</Text>
                  </View>
                </View>
              ))}
              <View style={styles.subTotalRow}>
                <Text style={styles.subTotalLabel}>
                  {detectedSubscriptions.length} subscriptions detected
                </Text>
                <Text style={styles.subTotalValue}>
                  ${detectedSubscriptions
                    .filter((s) => s.frequency === 'monthly')
                    .reduce((sum, s) => sum + s.amount, 0)
                    .toFixed(2)}
                  /mo
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No recurring charges detected</Text>
              <Text style={styles.emptyBody}>
                Import a few months of statements and recurring charges will appear here automatically.
              </Text>
            </View>
          )}
        </FinanceCard>

        {/* ── Monthly Budgets ───────────────────────────────────────── */}
        <FinanceCard title="Monthly budgets" eyebrow="Spending limits">
          {budgetStatuses.length > 0 ? (
            <View style={styles.budgetStack}>
              {budgetStatuses.map((bs) => {
                const barColor =
                  bs.status === 'over'
                    ? palette.danger
                    : bs.status === 'warning'
                      ? palette.warning
                      : palette.positive;
                const barWidth = `${Math.min(100, Math.round(bs.pct * 100))}%` as `${number}%`;
                const isEditing = budgetEditCategory === bs.category;

                return (
                  <View key={bs.category} style={styles.budgetRow}>
                    <View style={styles.budgetHeader}>
                      <Text style={styles.budgetCategory}>{bs.category}</Text>
                      <View style={styles.budgetHeaderRight}>
                        <Text style={[styles.budgetStatus, { color: barColor }]}>
                          ${bs.spent.toFixed(0)} / ${bs.limit.toFixed(0)}
                        </Text>
                        <Pressable
                          onPress={() => {
                            if (isEditing) {
                              const val = Number.parseFloat(budgetEditValue);
                              if (Number.isFinite(val) && val > 0) {
                                updateState((s) => setBudget(s, bs.category, val));
                              }
                              setBudgetEditCategory(null);
                            } else {
                              setBudgetEditCategory(bs.category);
                              setBudgetEditValue(String(bs.limit));
                            }
                          }}
                        >
                          <Text style={styles.budgetEditBtn}>{isEditing ? 'Save' : 'Edit'}</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => updateState((s) => removeBudget(s, bs.category))}
                        >
                          <Text style={styles.budgetRemoveBtn}>×</Text>
                        </Pressable>
                      </View>
                    </View>
                    {isEditing ? (
                      <TextInput
                        style={styles.budgetInput}
                        value={budgetEditValue}
                        onChangeText={setBudgetEditValue}
                        keyboardType="decimal-pad"
                        placeholder="Monthly limit"
                        placeholderTextColor="#7d9aa0"
                        autoFocus
                      />
                    ) : (
                      <View style={styles.budgetTrack}>
                        <View style={[styles.budgetBar, { width: barWidth, backgroundColor: barColor }]} />
                      </View>
                    )}
                    <Text style={styles.budgetPct}>
                      {Math.round(bs.pct * 100)}% used
                      {bs.status === 'over' ? ' — Over budget!' : bs.status === 'warning' ? ' — Almost there' : ''}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : null}

          {showAddBudget ? (
            <View style={styles.addBudgetForm}>
              <Text style={styles.addBudgetTitle}>Add budget</Text>
              <View style={styles.categoryWrap}>
                {categoryOptions
                  .filter((c) => c !== 'Income' && c !== 'Transfer')
                  .map((cat) => {
                    const active = newBudgetCategory === cat;
                    return (
                      <Pressable
                        key={`budget-cat-${cat}`}
                        style={[styles.categoryChip, active && styles.categoryChipActive]}
                        onPress={() => setNewBudgetCategory(cat)}
                      >
                        <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>
                          {cat}
                        </Text>
                      </Pressable>
                    );
                  })}
              </View>
              <TextInput
                style={styles.manualInput}
                placeholder="Monthly limit (e.g. 300)"
                placeholderTextColor="#7d9aa0"
                value={newBudgetLimit}
                onChangeText={setNewBudgetLimit}
                keyboardType="decimal-pad"
              />
              <View style={styles.importButtonRow}>
                <Pressable
                  style={styles.primaryButton}
                  onPress={() => {
                    const val = Number.parseFloat(newBudgetLimit);
                    if (Number.isFinite(val) && val > 0) {
                      updateState((s) => setBudget(s, newBudgetCategory, val));
                      setNewBudgetLimit('');
                      setShowAddBudget(false);
                    }
                  }}
                >
                  <Text style={styles.primaryButtonText}>Save budget</Text>
                </Pressable>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => setShowAddBudget(false)}
                >
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable style={styles.secondaryButton} onPress={() => setShowAddBudget(true)}>
              <Text style={styles.secondaryButtonText}>+ Add budget</Text>
            </Pressable>
          )}
        </FinanceCard>

        {/* ── Financial Goals ───────────────────────────────────────── */}
        <FinanceCard title="Financial goals" eyebrow="Savings targets">
          {state.goals.length > 0 ? (
            <View style={styles.goalsStack}>
              {state.goals.map((goal) => {
                const stats = getGoalStats(goal);
                const barWidth = `${Math.min(100, Math.round(stats.pct * 100))}%` as `${number}%`;
                const isEditing = goalEditId === goal.id;

                return (
                  <View key={goal.id} style={styles.goalCard}>
                    <View style={styles.goalHeader}>
                      <Text style={styles.goalName}>{goal.name}</Text>
                      <View style={styles.goalHeaderRight}>
                        <Pressable
                          onPress={() => {
                            if (isEditing) {
                              const val = Number.parseFloat(goalEditValue);
                              if (Number.isFinite(val) && val >= 0) {
                                updateState((s) => updateGoalProgress(s, goal.id, val));
                              }
                              setGoalEditId(null);
                            } else {
                              setGoalEditId(goal.id);
                              setGoalEditValue(String(goal.currentAmount));
                            }
                          }}
                        >
                          <Text style={styles.goalEditBtn}>{isEditing ? 'Save' : 'Update'}</Text>
                        </Pressable>
                        <Pressable onPress={() => updateState((s) => removeGoal(s, goal.id))}>
                          <Text style={styles.goalRemoveBtn}>×</Text>
                        </Pressable>
                      </View>
                    </View>
                    <View style={styles.goalAmounts}>
                      <Text style={styles.goalProgress}>
                        ${goal.currentAmount.toLocaleString()} of ${goal.targetAmount.toLocaleString()}
                      </Text>
                      <Text style={styles.goalPct}>{Math.round(stats.pct * 100)}%</Text>
                    </View>
                    {isEditing ? (
                      <TextInput
                        style={styles.budgetInput}
                        value={goalEditValue}
                        onChangeText={setGoalEditValue}
                        keyboardType="decimal-pad"
                        placeholder="Current saved amount"
                        placeholderTextColor="#7d9aa0"
                        autoFocus
                      />
                    ) : (
                      <View style={styles.goalTrack}>
                        <View style={[styles.goalBar, { width: barWidth }]} />
                      </View>
                    )}
                    <Text style={styles.goalMeta}>
                      {stats.daysLeft} days left · save ${stats.monthlyRequired.toFixed(0)}/mo ·
                      target {goal.targetDate}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : null}

          {showAddGoal ? (
            <View style={styles.addBudgetForm}>
              <Text style={styles.addBudgetTitle}>New goal</Text>
              <TextInput
                style={styles.manualInput}
                placeholder="Goal name (e.g. Emergency Fund)"
                placeholderTextColor="#7d9aa0"
                value={goalName}
                onChangeText={setGoalName}
              />
              <View style={styles.manualRow}>
                <TextInput
                  style={[styles.manualInput, styles.manualInputHalf]}
                  placeholder="Target amount"
                  placeholderTextColor="#7d9aa0"
                  value={goalTarget}
                  onChangeText={setGoalTarget}
                  keyboardType="decimal-pad"
                />
                <TextInput
                  style={[styles.manualInput, styles.manualInputHalf]}
                  placeholder="Already saved"
                  placeholderTextColor="#7d9aa0"
                  value={goalCurrent}
                  onChangeText={setGoalCurrent}
                  keyboardType="decimal-pad"
                />
              </View>
              <TextInput
                style={styles.manualInput}
                placeholder="Target date (YYYY-MM-DD)"
                placeholderTextColor="#7d9aa0"
                value={goalDate}
                onChangeText={setGoalDate}
              />
              <View style={styles.importButtonRow}>
                <Pressable
                  style={styles.primaryButton}
                  onPress={() => {
                    const target = Number.parseFloat(goalTarget);
                    const current = Number.parseFloat(goalCurrent) || 0;
                    if (!goalName.trim() || !Number.isFinite(target) || !goalDate.trim()) return;
                    updateState((s) =>
                      addGoal(s, {
                        name: goalName.trim(),
                        targetAmount: target,
                        currentAmount: current,
                        targetDate: goalDate.trim(),
                      }),
                    );
                    setGoalName('');
                    setGoalTarget('');
                    setGoalCurrent('');
                    setGoalDate('');
                    setShowAddGoal(false);
                  }}
                >
                  <Text style={styles.primaryButtonText}>Save goal</Text>
                </Pressable>
                <Pressable style={styles.secondaryButton} onPress={() => setShowAddGoal(false)}>
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable style={styles.secondaryButton} onPress={() => setShowAddGoal(true)}>
              <Text style={styles.secondaryButtonText}>+ Add goal</Text>
            </Pressable>
          )}
        </FinanceCard>

        <ImportHubSection
          styles={styles}
          importing={importing}
          importMessage={importMessage}
          pastedStatement={pastedStatement}
          onPastedStatementChange={setPastedStatement}
          onUploadStatements={importStatementFiles}
          onResetDemo={resetWorkspace}
          onExportCsv={exportCsv}
          onExportBackup={exportBackup}
          onImportBackupFileSelected={(e) => importBackupFromFileList(e.target.files)}
          onImportPastedText={importPastedStatement}
          onImportTip={() =>
            setImportMessage(
              'Tip: if you only have a PDF, copy the statement text or use the web build to upload the file directly.',
            )
          }
          imports={state.imports}
          hasTransactions={state.transactions.length > 0}
        />

        <FinanceCard title="Quick add" eyebrow="Manual entry" tone="warning">
          <Text style={styles.bodyText}>
            Keep the ledger complete by logging cash spending, transfers, or any item that should
            live beside the imported Wells Fargo rows.
          </Text>
          <Text style={styles.manualHint}>
            Current account: {selectedAccount?.name ?? 'Pick an account above to begin'}.
          </Text>
          <View style={styles.manualRow}>
            <TextInput
              style={[styles.manualInput, styles.manualInputHalf]}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#7d9aa0"
              value={manualDate}
              onChangeText={setManualDate}
            />
            <TextInput
              style={[styles.manualInput, styles.manualInputHalf]}
              placeholder="Amount, e.g. -12.34"
              placeholderTextColor="#7d9aa0"
              value={manualAmount}
              onChangeText={setManualAmount}
              keyboardType="decimal-pad"
            />
          </View>
          <TextInput
            style={styles.manualInput}
            placeholder="Merchant or payee"
            placeholderTextColor="#7d9aa0"
            value={manualPayee}
            onChangeText={setManualPayee}
          />
          <TextInput
            style={styles.manualInput}
            placeholder="Category"
            placeholderTextColor="#7d9aa0"
            value={manualCategory}
            onChangeText={setManualCategory}
          />
          <View style={styles.categoryWrap}>
            {categoryOptions.map((category) => {
              const active = category === manualCategory;
              return (
                <Pressable
                  key={`manual-${category}`}
                  style={[styles.categoryChip, active && styles.categoryChipActive]}
                  onPress={() => setManualCategory(category)}
                >
                  <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>
                    {category}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            style={styles.textArea}
            multiline
            placeholder="Optional notes"
            placeholderTextColor="#7d9aa0"
            value={manualNotes}
            onChangeText={setManualNotes}
          />
          <View style={styles.manualActionRow}>
            <Pressable style={styles.primaryButton} onPress={addManualEntry}>
              <Text style={styles.primaryButtonText}>Add manual transaction</Text>
            </Pressable>
          </View>
        </FinanceCard>

        <FinanceCard title="Accounts" eyebrow="Balances">
          <View style={styles.accountStack}>
            {accounts.map((account) => {
              const selected = account.id === selectedAccount?.id;
              return (
                <Pressable
                  key={account.id}
                  style={[styles.accountRow, selected && styles.accountRowSelected]}
                  onPress={() => {
                    setSelectedAccountId(account.id);
                    const nextTransaction = state.transactions.find(
                      (transaction) => transaction.accountId === account.id,
                    );
                    setSelectedTransactionId(nextTransaction?.id ?? '');
                  }}
                >
                  <View style={styles.accountCopy}>
                    <Text style={styles.accountName}>{account.name}</Text>
                    <Text style={styles.accountMeta}>
                      {account.institution} | {account.kindLabel} | {account.lastSynced}
                    </Text>
                  </View>
                  <View style={styles.accountAmountWrap}>
                    <Text style={styles.accountAmount}>{formatCurrency(account.currentBalance)}</Text>
                    <Text style={styles.accountAvailable}>
                      {account.type === 'credit' || account.type === 'loan'
                        ? 'Liability account'
                        : 'Liquid account'}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </FinanceCard>

        <FinanceCard title="Transaction review" eyebrow="Ledger">
          <Text style={styles.bodyText}>
            Transactions stay reviewable: change a category, mark something reviewed, and keep the
            ledger moving without leaving the workspace.
          </Text>
          {analyticsCategoryFilter ? (
            <Pressable
              style={styles.filterChip}
              onPress={() => setAnalyticsCategoryFilter(null)}
            >
              <Text style={styles.filterChipText}>
                {getCategoryIcon(analyticsCategoryFilter)} {analyticsCategoryFilter} — tap to clear ×
              </Text>
            </Pressable>
          ) : null}
          <View style={styles.searchRow}>
            <TextInput
              style={[styles.searchInput, styles.searchInputFlex]}
              placeholder="Search by merchant, category, or note"
              placeholderTextColor="#7d9aa0"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 ? (
              <Pressable style={styles.searchClear} onPress={() => setSearchQuery('')}>
                <Text style={styles.searchClearText}>×</Text>
              </Pressable>
            ) : null}
          </View>
          {accountTransactions.length ? (
            <View>
              {accountTransactions.map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  merchant={transaction.payee}
                  amount={formatCurrency(transaction.amount)}
                  amountValue={transaction.amount}
                  date={transaction.date}
                  account={selectedAccount?.name ?? transaction.accountId}
                  category={transaction.category}
                  categoryIcon={getCategoryIcon(transaction.category)}
                  flagged={!transaction.reviewed || transaction.category === 'Other'}
                  selected={transaction.id === selectedTransaction?.id}
                  onPress={() => setSelectedTransactionId(transaction.id)}
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No transactions match this view</Text>
              <Text style={styles.emptyBody}>
                Pick another account or clear the search field to see the imported ledger.
              </Text>
            </View>
          )}

          {selectedTransaction ? (
            <View style={styles.detailPanel}>
              <Text style={styles.detailLabel}>Selected transaction</Text>
              <Text style={styles.detailTitle}>{selectedTransaction.payee}</Text>
              <Text style={styles.detailBody}>
                {selectedTransaction.date} | {selectedTransaction.category} |{' '}
                {formatCurrency(selectedTransaction.amount)}
              </Text>
              <Text style={styles.detailBody}>
                {selectedTransaction.notes ?? 'No notes on this transaction yet.'}
              </Text>
              <View style={styles.detailActionRow}>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() =>
                    updateState((current) => toggleTransactionReview(current, selectedTransaction.id))
                  }
                >
                  <Text style={styles.secondaryButtonText}>
                    {selectedTransaction.reviewed ? 'Mark unreviewed' : 'Mark reviewed'}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() =>
                    updateState((current) => rotateTransactionCategory(current, selectedTransaction.id))
                  }
                >
                  <Text style={styles.secondaryButtonText}>Next category</Text>
                </Pressable>
              </View>
              <View style={styles.categoryWrap}>
                {categoryOptions.map((category) => {
                  const active = category === selectedTransaction.category;
                  return (
                    <Pressable
                      key={category}
                      style={[styles.categoryChip, active && styles.categoryChipActive]}
                      onPress={() =>
                        updateState((current) =>
                          updateTransactionCategory(current, selectedTransaction.id, category),
                        )
                      }
                    >
                      <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>
                        {category}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
        </FinanceCard>

        <FinanceCard title="Latest activity" eyebrow="Imports">
          <Text style={styles.bodyText}>
            This is the review trail. It keeps the imported files visible so it is obvious what was
            parsed and what still needs a human check.
          </Text>
          {latestTransactions.length ? (
            <View style={styles.activityStack}>
              {latestTransactions.map((transaction) => (
                <View key={transaction.id} style={styles.activityRow}>
                  <Text style={styles.activityPayee}>{transaction.payee}</Text>
                  <Text style={styles.activityMeta}>
                    {transaction.date} | {transaction.category} | {transaction.source}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
          {hasUnreviewedTransactions(state) ? (
            <Text style={styles.reviewNote}>
              There are still unreviewed transactions in the ledger. Use the transaction review card
              above to clear them out.
            </Text>
          ) : null}
        </FinanceCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  loadingShell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: palette.bg,
  },
  loadingText: {
    color: palette.text,
    fontSize: 16,
  },
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 28,
    gap: 14,
    backgroundColor: palette.bg,
  },
  hero: {
    borderRadius: 30,
    padding: 18,
    gap: 18,
    backgroundColor: palette.shell,
    borderWidth: 1,
    borderColor: palette.border,
  },
  heroCopy: {
    gap: 8,
  },
  kicker: {
    color: palette.accentSoft,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  title: {
    color: palette.text,
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '900',
  },
  subtitle: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 680,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  pill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#0b171c',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pillText: {
    color: palette.text,
    fontSize: 12,
    fontWeight: '700',
  },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#0b171c',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  heroBadgeLabel: {
    color: palette.accentSoft,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroBadgeValue: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '800',
  },
  heroBadgeNote: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 16,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  bodyText: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  importControls: {
    gap: 10,
  },
  importButtonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    flexGrow: 1,
  },
  primaryButtonText: {
    color: '#182015',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  secondaryButton: {
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#355963',
    backgroundColor: '#0d1d23',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    flexGrow: 1,
  },
  secondaryButtonText: {
    color: '#dce9e5',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  textArea: {
    minHeight: 128,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: '#0b171c',
    color: palette.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    lineHeight: 18,
  },
  importMessage: {
    color: '#94bdc4',
    fontSize: 12,
    lineHeight: 17,
  },
  manualHint: {
    color: palette.accentSoft,
    fontSize: 12,
    lineHeight: 16,
  },
  manualRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  manualInput: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: '#0b171c',
    color: palette.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
  },
  manualInputHalf: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 140,
  },
  manualActionRow: {
    marginTop: 2,
  },
  importList: {
    gap: 10,
  },
  importRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#24404a',
    paddingTop: 10,
  },
  importCopy: {
    flex: 1,
    gap: 3,
  },
  importFile: {
    color: '#edf6f2',
    fontSize: 14,
    fontWeight: '700',
  },
  importMeta: {
    color: '#a8bec3',
    fontSize: 12,
    lineHeight: 16,
  },
  importStatus: {
    color: palette.accent,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  emptyState: {
    gap: 6,
    borderWidth: 1,
    borderColor: '#284651',
    borderStyle: 'dashed',
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#0b171c',
  },
  emptyTitle: {
    color: '#e8f0ee',
    fontSize: 15,
    fontWeight: '700',
  },
  emptyBody: {
    color: '#aec2c7',
    fontSize: 13,
    lineHeight: 18,
  },
  accountStack: {
    gap: 10,
  },
  accountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 18,
    padding: 12,
    backgroundColor: '#0b171c',
    borderWidth: 1,
    borderColor: '#223a43',
  },
  accountRowSelected: {
    backgroundColor: '#143038',
    borderColor: '#4d8b98',
  },
  accountCopy: {
    flex: 1,
    gap: 4,
  },
  accountName: {
    color: '#f0f6f3',
    fontSize: 15,
    fontWeight: '800',
  },
  accountMeta: {
    color: '#a2bbc1',
    fontSize: 12,
    lineHeight: 16,
  },
  accountAmountWrap: {
    alignItems: 'flex-end',
    gap: 4,
  },
  accountAmount: {
    color: '#f0f6f3',
    fontSize: 16,
    fontWeight: '800',
  },
  accountAvailable: {
    color: '#91b4bd',
    fontSize: 11,
    lineHeight: 15,
  },
  searchInput: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: '#0b171c',
    color: palette.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    marginTop: 8,
    marginBottom: 4,
  },
  detailPanel: {
    marginTop: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: '#0b171c',
    padding: 14,
    gap: 8,
  },
  detailLabel: {
    color: palette.accentSoft,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  detailTitle: {
    color: palette.text,
    fontSize: 20,
    fontWeight: '800',
  },
  detailBody: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  detailActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 2,
  },
  categoryWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  categoryChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: '#12242b',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  categoryChipActive: {
    borderColor: palette.accent,
    backgroundColor: '#1a2d1d',
  },
  categoryChipText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  categoryChipTextActive: {
    color: palette.text,
  },
  activityStack: {
    gap: 10,
    marginTop: 8,
  },
  activityRow: {
    borderTopWidth: 1,
    borderTopColor: '#243840',
    paddingTop: 10,
    gap: 2,
  },
  activityPayee: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '700',
  },
  activityMeta: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 16,
  },
  reviewNote: {
    marginTop: 12,
    color: palette.warning,
    fontSize: 12,
    lineHeight: 17,
  },

  // ── Month picker ───────────────────────────────────────────────────────────
  monthPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0d1e26',
    borderRadius: 14,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  monthNavBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  monthNavBtnDisabled: {
    opacity: 0.3,
  },
  monthNavBtnText: {
    color: palette.accentSoft,
    fontSize: 13,
    fontWeight: '700',
  },
  monthNavBtnDisabledText: {
    color: palette.muted,
  },
  monthLabel: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '800',
  },

  // ── Search ─────────────────────────────────────────────────────────────────
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  searchInputFlex: {
    flex: 1,
    marginTop: 0,
    marginBottom: 0,
  },
  searchClear: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#1a3540',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  searchClearText: {
    color: palette.muted,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
  },

  // ── Action plan ────────────────────────────────────────────────────────────
  actionKpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionKpiCard: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 150,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2b454f',
    backgroundColor: '#0d1f26',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  actionKpiLabel: {
    color: palette.accentSoft,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  actionKpiValue: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '800',
  },
  actionKpiValuePositive: {
    color: palette.positive,
  },
  actionKpiValueDanger: {
    color: palette.danger,
  },
  actionKpiDetail: {
    color: palette.muted,
    fontSize: 11,
    lineHeight: 15,
  },
  actionStepList: {
    gap: 8,
  },
  actionStepRow: {
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#1f3841',
    paddingTop: 10,
    alignItems: 'flex-start',
  },
  priorityDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    marginTop: 5,
    flexShrink: 0,
  },
  actionStepCopy: {
    flex: 1,
    gap: 4,
  },
  actionStepTitle: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '800',
  },
  actionStepDetail: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  actionStepButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3f6570',
    backgroundColor: '#152a31',
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  actionStepButtonText: {
    color: '#dce9e5',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  reviewMetric: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 180,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2b454f',
    backgroundColor: '#0d1f26',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  reviewMetricLabel: {
    color: palette.accentSoft,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  reviewMetricValue: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '800',
  },
  reviewMetricValuePositive: {
    color: palette.positive,
  },
  reviewMetricValueDanger: {
    color: palette.danger,
  },
  reviewMetricDetail: {
    color: palette.muted,
    fontSize: 11,
    lineHeight: 15,
  },
  reviewList: {
    gap: 8,
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#1f3841',
    paddingTop: 10,
  },
  reviewRowCopy: {
    flex: 1,
    gap: 2,
  },
  reviewRowCategory: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '700',
  },
  reviewRowDetail: {
    color: palette.muted,
    fontSize: 11,
    lineHeight: 15,
  },
  reviewRowChange: {
    fontSize: 12,
    fontWeight: '800',
    flexShrink: 0,
  },
  reviewRowChangePositive: {
    color: palette.positive,
  },
  reviewRowChangeDanger: {
    color: palette.danger,
  },
  layoutList: {
    gap: 10,
  },
  layoutRow: {
    borderTopWidth: 1,
    borderTopColor: '#1f3841',
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  layoutCopy: {
    flex: 1,
    gap: 2,
  },
  layoutName: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '700',
  },
  layoutMeta: {
    color: palette.muted,
    fontSize: 11,
  },
  layoutActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  layoutActionButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#436972',
    backgroundColor: '#12313a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  layoutActionButtonDisabled: {
    opacity: 0.35,
  },
  layoutActionButtonText: {
    color: '#dce9e5',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 16,
  },
  layoutToggleButton: {
    minHeight: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3a5e67',
    backgroundColor: '#10242b',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  layoutToggleButtonActive: {
    borderColor: '#5b8d7b',
    backgroundColor: '#163328',
  },
  layoutToggleButtonText: {
    color: '#dce9e5',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  // ── Analytics ──────────────────────────────────────────────────────────────
  analyticsSection: {
    gap: 8,
  },
  analyticsSectionTitle: {
    color: palette.accentSoft,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    marginBottom: 2,
  },
  filterChip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.accent,
    backgroundColor: '#1a2d1d',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 4,
  },
  filterChipText: {
    color: palette.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  merchantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 5,
    borderTopWidth: 1,
    borderTopColor: '#1e3840',
  },
  merchantRank: {
    color: palette.accentSoft,
    fontSize: 11,
    fontWeight: '800',
    width: 22,
    flexShrink: 0,
  },
  merchantName: {
    flex: 1,
    color: palette.text,
    fontSize: 13,
    fontWeight: '700',
  },
  merchantAmount: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '800',
    flexShrink: 0,
  },
  merchantCount: {
    color: palette.muted,
    fontSize: 11,
    width: 22,
    textAlign: 'right',
    flexShrink: 0,
  },
  trendChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    height: 110,
    paddingTop: 8,
  },
  trendColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  trendAmount: {
    color: palette.muted,
    fontSize: 9,
    textAlign: 'center',
  },
  trendBarWrap: {
    flex: 1,
    justifyContent: 'flex-end',
    width: '100%',
    alignItems: 'center',
  },
  trendBar: {
    width: '80%',
    backgroundColor: '#3d7a8a',
    borderRadius: 4,
    minHeight: 4,
  },
  trendLabel: {
    color: palette.muted,
    fontSize: 9,
    textAlign: 'center',
  },

  // ── Subscriptions ──────────────────────────────────────────────────────────
  subStack: {
    gap: 0,
  },
  subRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#1e3840',
  },
  subCopy: {
    flex: 1,
    gap: 2,
  },
  subName: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '700',
  },
  subMeta: {
    color: palette.muted,
    fontSize: 11,
    lineHeight: 15,
  },
  subAmounts: {
    alignItems: 'flex-end',
    gap: 2,
    flexShrink: 0,
  },
  subMonthly: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '800',
  },
  subAnnual: {
    color: palette.muted,
    fontSize: 11,
  },
  subTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#355963',
  },
  subTotalLabel: {
    color: palette.accentSoft,
    fontSize: 12,
    fontWeight: '700',
  },
  subTotalValue: {
    color: palette.accent,
    fontSize: 14,
    fontWeight: '800',
  },

  // ── Budgets ────────────────────────────────────────────────────────────────
  budgetStack: {
    gap: 14,
  },
  budgetRow: {
    gap: 6,
  },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  budgetHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  budgetCategory: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '800',
  },
  budgetStatus: {
    fontSize: 13,
    fontWeight: '700',
  },
  budgetEditBtn: {
    color: palette.accentSoft,
    fontSize: 12,
    fontWeight: '700',
  },
  budgetRemoveBtn: {
    color: palette.danger,
    fontSize: 16,
    fontWeight: '800',
  },
  budgetTrack: {
    height: 10,
    backgroundColor: '#1a3540',
    borderRadius: 6,
    overflow: 'hidden',
  },
  budgetBar: {
    height: '100%',
    borderRadius: 6,
  },
  budgetPct: {
    color: palette.muted,
    fontSize: 11,
  },
  budgetInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: '#0b171c',
    color: palette.text,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  addBudgetForm: {
    gap: 10,
    backgroundColor: '#0d1e26',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  addBudgetTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '800',
  },

  // ── Goals ──────────────────────────────────────────────────────────────────
  goalsStack: {
    gap: 14,
  },
  goalCard: {
    backgroundColor: '#0d1e26',
    borderRadius: 18,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  goalName: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
  },
  goalEditBtn: {
    color: palette.accentSoft,
    fontSize: 12,
    fontWeight: '700',
  },
  goalRemoveBtn: {
    color: palette.danger,
    fontSize: 16,
    fontWeight: '800',
  },
  goalAmounts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalProgress: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '700',
  },
  goalPct: {
    color: palette.accent,
    fontSize: 15,
    fontWeight: '900',
  },
  goalTrack: {
    height: 12,
    backgroundColor: '#1a3540',
    borderRadius: 6,
    overflow: 'hidden',
  },
  goalBar: {
    height: '100%',
    backgroundColor: palette.accent,
    borderRadius: 6,
  },
  goalMeta: {
    color: palette.muted,
    fontSize: 11,
    lineHeight: 15,
  },
});

