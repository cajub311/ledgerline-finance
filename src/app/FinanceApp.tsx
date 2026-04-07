import { StatusBar } from 'expo-status-bar';
import * as DocumentPicker from 'expo-document-picker';
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

import { FinanceCard } from '../components/finance/FinanceCard';
import { InsightBadge } from '../components/finance/InsightBadge';
import { SpendingBar } from '../components/finance/SpendingBar';
import { SummaryTile } from '../components/finance/SummaryTile';
import { TransactionRow } from '../components/finance/TransactionRow';
import {
  addGoal,
  applyImportedBatch,
  addManualTransaction,
  createFinanceState,
  detectSubscriptions,
  generateInsights,
  getAccountsWithBalances,
  getBudgetPills,
  getBudgetStatus,
  getCategoryBreakdown,
  getCategoryOptions,
  getFinanceSummary,
  getGoalStats,
  getLatestTransactions,
  getMonthlyTrend,
  getTopMerchants,
  hasUnreviewedTransactions,
  rehydrateFinanceState,
  removeGoal,
  rotateTransactionCategory,
  setBudget,
  removeBudget,
  toggleTransactionReview,
  updateGoalProgress,
  updateTransactionCategory,
  type FinanceState,
} from '../finance';
import { parseStatementBlob } from '../finance/import';
import { parseStatementText } from '../finance/import.shared';
import { clearFinanceState as clearFinanceStorage, loadFinanceState, saveFinanceState } from '../finance/storage';

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

  useEffect(() => {
    if (loading) {
      return;
    }

    void saveFinanceState(state);
  }, [loading, state]);

  const summary = useMemo(() => getFinanceSummary(state), [state]);
  const accounts = useMemo(() => getAccountsWithBalances(state), [state]);
  const latestTransactions = useMemo(() => getLatestTransactions(state, 8), [state]);
  const budgetPills = useMemo(() => getBudgetPills(state), [state]);
  const categoryOptions = useMemo(() => getCategoryOptions(), []);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const categoryBreakdown = useMemo(
    () => getCategoryBreakdown(state.transactions, currentYear, currentMonth),
    [state.transactions, currentYear, currentMonth],
  );
  const monthlyTrend = useMemo(
    () => getMonthlyTrend(state.transactions, 6),
    [state.transactions],
  );
  const topMerchants = useMemo(
    () => getTopMerchants(state.transactions, currentYear, currentMonth, 5),
    [state.transactions, currentYear, currentMonth],
  );
  const detectedSubscriptions = useMemo(
    () => detectSubscriptions(state.transactions),
    [state.transactions],
  );
  const insights = useMemo(() => generateInsights(state), [state]);
  const budgetStatuses = useMemo(
    () => getBudgetStatus(state, currentYear, currentMonth),
    [state, currentYear, currentMonth],
  );

  const maxMonthlySpend = useMemo(
    () => Math.max(...monthlyTrend.map((m) => m.spend), 1),
    [monthlyTrend],
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
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
        type: [
          'application/pdf',
          'text/csv',
          'application/csv',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ],
      });

      if (result.canceled || !result.assets.length) {
        setImportMessage('Import cancelled.');
        return;
      }

      const batches: Awaited<ReturnType<typeof parseStatementBlob>>[] = [];

      for (const asset of result.assets) {
        const file = await assetToFile(asset);
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
        `Imported ${result.assets.length} file${result.assets.length === 1 ? '' : 's'} and ${importedRows} row${importedRows === 1 ? '' : 's'} into ${selectedAccount?.name ?? 'the selected account'}.${warnings > 0 ? ` ${warnings} parsing note${warnings === 1 ? '' : 's'} were added.` : ''}`,
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
              A local-first workspace for Wells Fargo PDFs, spreadsheets, and quick review of
              imported transactions.
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
          <SummaryTile label="Liquid cash" value={formatCurrency(summary.liquidCash)} detail="Checking, savings, and cash accounts" tone="positive" />
          <SummaryTile label="Month income" value={formatCurrency(summary.monthIncome)} detail="Income recognized in the current month" tone="positive" />
          <SummaryTile label="Month spend" value={formatCurrency(summary.monthSpend)} detail="Outflow tracked from imported transactions" tone="alert" />
          <SummaryTile label="Unreviewed" value={`${summary.unreviewedCount}`} detail="Transactions still needing attention" tone="alert" />
          <SummaryTile label="Imported rows" value={`${summary.importedRows}`} detail="Rows ingested from statements" />
          <SummaryTile label="Imports" value={`${summary.importedFiles}`} detail="PDF, CSV, and spreadsheet files" />
        </View>

        {/* ── Spending Insights ─────────────────────────────────────── */}
        {insights.length > 0 && (
          <FinanceCard title="Spending insights" eyebrow="Smart analysis">
            {insights.map((insight, i) => (
              <InsightBadge key={i} text={insight} index={i} />
            ))}
          </FinanceCard>
        )}

        {/* ── Spending Analytics ────────────────────────────────────── */}
        <FinanceCard title="Spending analytics" eyebrow="This month">
          {categoryBreakdown.length > 0 ? (
            <View style={styles.analyticsSection}>
              <Text style={styles.analyticsSectionTitle}>Category breakdown</Text>
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

        <FinanceCard title="Import hub" eyebrow="Statements" tone="accent">
          <Text style={styles.bodyText}>
            Upload Wells Fargo statements as PDF, CSV, XLS, or XLSX on web. Paste statement text on
            any device to keep the review loop moving. Add a manual transaction below when a cash
            purchase or a missing line needs to enter the same ledger.
          </Text>
          <View style={styles.importControls}>
            <View style={styles.importButtonRow}>
              <Pressable
                style={[styles.primaryButton, importing && styles.buttonDisabled]}
                disabled={importing}
                onPress={() => void importStatementFiles()}
              >
                <Text style={styles.primaryButtonText}>
                  {importing ? 'Importing...' : Platform.OS === 'web' ? 'Upload statements' : 'Web uploads'}
                </Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={resetWorkspace}>
                <Text style={styles.secondaryButtonText}>Reset demo</Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.textArea}
              multiline
              placeholder="Paste Wells Fargo statement text or CSV rows here."
              placeholderTextColor="#7d9aa0"
              value={pastedStatement}
              onChangeText={setPastedStatement}
            />
            <View style={styles.importButtonRow}>
              <Pressable style={styles.secondaryButton} onPress={importPastedStatement}>
                <Text style={styles.secondaryButtonText}>Import pasted text</Text>
              </Pressable>
              <Pressable
                style={styles.secondaryButton}
                onPress={() =>
                  setImportMessage(
                    'Tip: if you only have a PDF, copy the statement text or use the web build to upload the file directly.',
                  )
                }
              >
                <Text style={styles.secondaryButtonText}>How to import</Text>
              </Pressable>
            </View>
          </View>
          <Text style={styles.importMessage}>{importMessage}</Text>
          <View style={styles.importList}>
            {state.imports.length ? (
              state.imports.slice(0, 6).map((record) => (
                <View key={record.id} style={styles.importRow}>
                  <View style={styles.importCopy}>
                    <Text style={styles.importFile}>{record.fileName}</Text>
                    <Text style={styles.importMeta}>
                      {record.format.toUpperCase()} | {record.rows} rows | {record.note}
                    </Text>
                  </View>
                  <Text style={styles.importStatus}>{record.format}</Text>
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No files imported yet</Text>
                <Text style={styles.emptyBody}>
                  Start with a Wells Fargo PDF or a spreadsheet export. The importer will map rows
                  into the selected account.
                </Text>
              </View>
            )}
          </View>
        </FinanceCard>

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
                Category: {analyticsCategoryFilter} — tap to clear ×
              </Text>
            </Pressable>
          ) : null}
          <TextInput
            style={styles.searchInput}
            placeholder="Search transactions by merchant, category, or note"
            placeholderTextColor="#7d9aa0"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
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

async function assetToFile(asset: DocumentPicker.DocumentPickerAsset) {
  const typedAsset = asset as DocumentPicker.DocumentPickerAsset & { file?: File };

  if (typedAsset.file) {
    return typedAsset.file;
  }

  const response = await fetch(asset.uri);
  const blob = await response.blob();

  return new File([blob], asset.name ?? 'statement', {
    type: asset.mimeType ?? blob.type ?? 'application/octet-stream',
  });
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown error';
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

