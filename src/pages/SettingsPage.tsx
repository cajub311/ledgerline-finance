import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { CATEGORY_OPTIONS } from '../finance/categories';
import { createFinanceState, reapplyRulesToAllTransactions } from '../finance/ledger';
import {
  addRule,
  countMatchingTransactions,
  deleteRule,
  moveRule,
  updateRule,
} from '../finance/rules';
import type { FinanceRule, FinanceState } from '../finance/types';
import { clearFinanceState } from '../finance/storage';
import { useTheme } from '../theme/ThemeContext';
import { spacing, typography } from '../theme/tokens';
import { formatCurrency } from '../utils/format';

interface SettingsPageProps {
  state: FinanceState;
  onStateChange: (next: FinanceState) => void;
}

function newRuleId(): string {
  return `rule-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

function emptyDraft(): FinanceRule {
  return {
    id: newRuleId(),
    category: 'Other',
    payeeRegex: '',
    minAmount: undefined,
    maxAmount: undefined,
    accountIds: undefined,
  };
}

function parseOptionalAmount(raw: string): number | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n : undefined;
}

export function SettingsPage({ state, onStateChange }: SettingsPageProps) {
  const { palette, mode, setMode } = useTheme();
  const [householdDraft, setHouseholdDraft] = useState(state.householdName);
  const [confirm, setConfirm] = useState(false);
  const [ruleDraft, setRuleDraft] = useState<FinanceRule | null>(null);
  const [ruleDraftIsNew, setRuleDraftIsNew] = useState(false);
  const [reapplyConfirm, setReapplyConfirm] = useState(false);

  const save = () => {
    const name = householdDraft.trim();
    if (!name || name === state.householdName) return;
    onStateChange({ ...state, householdName: name });
  };

  const reset = async () => {
    if (!confirm) {
      setConfirm(true);
      return;
    }
    try {
      await clearFinanceState();
    } catch {
      // ignore
    }
    onStateChange(createFinanceState());
    setConfirm(false);
  };

  const totals = {
    accounts: state.accounts.length,
    transactions: state.transactions.length,
    budgets: state.budgets.length,
    goals: state.goals.length,
    imports: state.imports.length,
    rules: state.rules.length,
  };

  const higherPrecedenceForDraft = useMemo(() => {
    if (!ruleDraft) return [];
    if (ruleDraftIsNew) return state.rules;
    const idx = state.rules.findIndex((r) => r.id === ruleDraft.id);
    if (idx < 0) return state.rules;
    return state.rules.slice(0, idx);
  }, [ruleDraft, ruleDraftIsNew, state.rules]);

  const matchPreviewCount = useMemo(() => {
    if (!ruleDraft) return 0;
    return countMatchingTransactions(state.transactions, ruleDraft, higherPrecedenceForDraft);
  }, [ruleDraft, state.transactions, higherPrecedenceForDraft]);

  const startAddRule = () => {
    setRuleDraft(emptyDraft());
    setRuleDraftIsNew(true);
  };

  const startEditRule = (rule: FinanceRule) => {
    setRuleDraft({ ...rule, accountIds: rule.accountIds ? [...rule.accountIds] : undefined });
    setRuleDraftIsNew(false);
  };

  const cancelRuleEditor = () => {
    setRuleDraft(null);
    setRuleDraftIsNew(false);
  };

  const saveRuleDraft = () => {
    if (!ruleDraft) return;
    const cleaned: FinanceRule = {
      ...ruleDraft,
      payeeRegex: ruleDraft.payeeRegex?.trim() || undefined,
      minAmount: ruleDraft.minAmount,
      maxAmount: ruleDraft.maxAmount,
      accountIds:
        ruleDraft.accountIds && ruleDraft.accountIds.length > 0 ? [...ruleDraft.accountIds] : undefined,
    };
    if (ruleDraftIsNew) {
      onStateChange({ ...state, rules: addRule(state.rules, cleaned) });
    } else {
      onStateChange({ ...state, rules: updateRule(state.rules, cleaned.id, cleaned) });
    }
    cancelRuleEditor();
  };

  const removeRule = (id: string) => {
    onStateChange({ ...state, rules: deleteRule(state.rules, id) });
    if (ruleDraft?.id === id) cancelRuleEditor();
  };

  const shiftRule = (id: string, delta: -1 | 1) => {
    const idx = state.rules.findIndex((r) => r.id === id);
    if (idx < 0) return;
    const next = moveRule(state.rules, id, idx + delta);
    onStateChange({ ...state, rules: next });
  };

  const toggleAccountOnDraft = (accountId: string) => {
    if (!ruleDraft) return;
    const cur = ruleDraft.accountIds ?? [];
    const has = cur.includes(accountId);
    const nextIds = has ? cur.filter((a) => a !== accountId) : [...cur, accountId];
    setRuleDraft({
      ...ruleDraft,
      accountIds: nextIds.length === 0 ? undefined : nextIds,
    });
  };

  const runReapplyRules = () => {
    if (!reapplyConfirm) {
      setReapplyConfirm(true);
      return;
    }
    onStateChange(reapplyRulesToAllTransactions(state));
    setReapplyConfirm(false);
  };

  return (
    <View style={{ gap: spacing.lg }}>
      <View>
        <Text style={[styles.title, { color: palette.text }]}>Settings</Text>
        <Text style={[styles.subtitle, { color: palette.textMuted }]}>
          Customize how Ledgerline looks and manage your data.
        </Text>
      </View>

      <Card title="Appearance" eyebrow="Theme">
        <Select
          value={mode}
          onChange={setMode}
          options={[
            { value: 'dark', label: '🌙 Dark' },
            { value: 'light', label: '☀️ Light' },
          ]}
        />
      </Card>

      <Card title="Privacy & security" eyebrow="How Ledgerline handles your data">
        <Text style={[styles.securityLead, { color: palette.text }]}>
          Your data never leaves your device. No accounts. No servers. No subscriptions.
        </Text>
        <View style={{ gap: spacing.md, marginTop: spacing.md }}>
          <SecurityBlock
            title="Local persistence"
            body="Your ledger is saved in this browser (localStorage on web, AsyncStorage on native). We do not sync to a cloud database you do not control."
          />
          <SecurityBlock
            title="Optional backup / restore"
            body="Use Import → Export JSON backup to keep an offline copy. Restoring replaces the current ledger — export before restoring if you need both versions."
          />
          <SecurityBlock
            title="Zero in-app telemetry"
            body="This build does not ship product analytics or crash reporting hooks. Third-party APIs (for example PDF text extraction) may load assets from their CDN when you use those features."
          />
        </View>
      </Card>

      <Card title="Auto-categorization rules" eyebrow="Rules engine">
        <Text style={[styles.ruleLead, { color: palette.textMuted }]}>
          First matching rule wins. Payee pattern uses JavaScript regex (case-insensitive). Leave pattern empty to
          match only on amount and account filters.
        </Text>
        <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
          {state.rules.length === 0 ? (
            <Text style={{ color: palette.textSubtle, fontSize: typography.small }}>No rules yet.</Text>
          ) : (
            state.rules.map((rule, index) => (
              <View
                key={rule.id}
                style={[
                  styles.ruleRow,
                  { borderColor: palette.border, backgroundColor: palette.surfaceSunken },
                ]}
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ color: palette.text, fontWeight: '700', fontSize: typography.small }}>
                    {index + 1}. {rule.category}
                    {rule.payeeRegex ? ` · /${rule.payeeRegex}/` : ''}
                  </Text>
                  <Text style={{ color: palette.textMuted, fontSize: typography.micro }} numberOfLines={2}>
                    {rule.accountIds?.length
                      ? `Accounts: ${rule.accountIds.map((id) => state.accounts.find((a) => a.id === id)?.name ?? id).join(', ')}`
                      : 'All accounts'}
                    {rule.minAmount !== undefined || rule.maxAmount !== undefined
                      ? ` · amount ${rule.minAmount ?? '…'} … ${rule.maxAmount ?? '…'}`
                      : ''}
                  </Text>
                </View>
                <View style={styles.ruleActions}>
                  <Button label="↑" size="sm" variant="ghost" onPress={() => shiftRule(rule.id, -1)} disabled={index === 0} />
                  <Button
                    label="↓"
                    size="sm"
                    variant="ghost"
                    onPress={() => shiftRule(rule.id, 1)}
                    disabled={index === state.rules.length - 1}
                  />
                  <Button label="Edit" size="sm" variant="secondary" onPress={() => startEditRule(rule)} />
                  <Button label="Delete" size="sm" variant="danger" onPress={() => removeRule(rule.id)} />
                </View>
              </View>
            ))
          )}
        </View>
        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          <Button label="Add rule" variant="secondary" onPress={startAddRule} />
          <Button
            label={
              reapplyConfirm
                ? 'Tap again to overwrite categories from rules'
                : 'Re-apply rules to all transactions'
            }
            variant={reapplyConfirm ? 'danger' : 'secondary'}
            onPress={runReapplyRules}
          />
          {reapplyConfirm ? (
            <Text style={{ color: palette.danger, fontSize: typography.micro, lineHeight: 17 }}>
              This overwrites categories on every transaction where a rule matches. Manual categories on those rows
              are lost unless no rule matches.
            </Text>
          ) : null}
        </View>

        {ruleDraft ? (
          <View style={[styles.editor, { borderColor: palette.border, marginTop: spacing.lg }]}>
            <Text style={[styles.editorTitle, { color: palette.text }]}>
              {ruleDraftIsNew ? 'New rule' : 'Edit rule'}
            </Text>
            <Select
              label="Category"
              value={ruleDraft.category}
              onChange={(category) => setRuleDraft({ ...ruleDraft, category })}
              options={CATEGORY_OPTIONS.map((c) => ({ value: c, label: c }))}
            />
            <Input
              label="Payee regex (optional)"
              value={ruleDraft.payeeRegex ?? ''}
              onChangeText={(payeeRegex) => setRuleDraft({ ...ruleDraft, payeeRegex })}
              placeholder="e.g. starbucks"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Min amount (optional)"
                  value={ruleDraft.minAmount === undefined ? '' : String(ruleDraft.minAmount)}
                  onChangeText={(t) =>
                    setRuleDraft({ ...ruleDraft, minAmount: parseOptionalAmount(t) })
                  }
                  keyboardType="numbers-and-punctuation"
                  placeholder="e.g. -100"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="Max amount (optional)"
                  value={ruleDraft.maxAmount === undefined ? '' : String(ruleDraft.maxAmount)}
                  onChangeText={(t) =>
                    setRuleDraft({ ...ruleDraft, maxAmount: parseOptionalAmount(t) })
                  }
                  keyboardType="numbers-and-punctuation"
                  placeholder="e.g. -1"
                />
              </View>
            </View>
            <Text style={[styles.labelMuted, { color: palette.textMuted }]}>Limit to accounts (optional)</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {state.accounts.map((acct) => {
                const on = ruleDraft.accountIds?.includes(acct.id) ?? false;
                return (
                  <Pressable
                    key={acct.id}
                    onPress={() => toggleAccountOnDraft(acct.id)}
                    style={[
                      styles.acctChip,
                      {
                        borderColor: on ? palette.primary : palette.border,
                        backgroundColor: on ? palette.primary : palette.surfaceSunken,
                      },
                    ]}
                  >
                    <Text style={{ color: on ? palette.primaryText : palette.text, fontSize: typography.micro }}>
                      {acct.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={{ color: palette.textMuted, fontSize: typography.small, marginTop: spacing.sm }}>
              Would match <Text style={{ fontWeight: '800', color: palette.text }}>{matchPreviewCount}</Text>{' '}
              transactions (given current rule order).
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
              <Button label="Save rule" onPress={saveRuleDraft} />
              <Button label="Cancel" variant="ghost" onPress={cancelRuleEditor} />
            </View>
          </View>
        ) : null}
      </Card>

      <Card title="Household" eyebrow="Name">
        <Input
          label="Household or workspace name"
          value={householdDraft}
          onChangeText={setHouseholdDraft}
        />
        <Button
          label="Save name"
          onPress={save}
          disabled={householdDraft.trim() === state.householdName}
        />
      </Card>

      <Card title="Your data" eyebrow="Local-first">
        <View style={{ gap: spacing.sm }}>
          <Line label="Accounts" value={`${totals.accounts}`} />
          <Line label="Transactions" value={`${totals.transactions}`} />
          <Line label="Budgets" value={`${totals.budgets}`} />
          <Line label="Goals" value={`${totals.goals}`} />
          <Line label="Imports recorded" value={`${totals.imports}`} />
          <Line label="Auto rules" value={`${totals.rules}`} />
          <Line label="Currency" value={state.currency} />
          <Line
            label="Estimated monthly net"
            value={formatCurrency(
              state.transactions
                .filter((tx) => tx.date.startsWith(new Date().toISOString().slice(0, 7)))
                .reduce((sum, tx) => sum + tx.amount, 0),
            )}
          />
        </View>
        <Text style={{ color: palette.textSubtle, fontSize: typography.micro, lineHeight: 17 }}>
          Everything you see lives in this browser (IndexedDB / localStorage). Clearing site data
          wipes your ledger, so export a backup from the Import tab before clearing browser data.
        </Text>
      </Card>

      <Card title="Danger zone" eyebrow="Reset">
        <Text style={{ color: palette.textMuted, fontSize: typography.small, lineHeight: 19 }}>
          Clear all accounts, transactions, budgets, and goals. This returns the app to the seeded
          demo data. Export a backup first if you want to keep your records.
        </Text>
        <Button
          label={confirm ? 'Click again to confirm reset' : 'Reset ledger to demo data'}
          variant="danger"
          onPress={reset}
        />
      </Card>
    </View>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  const { palette } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={{ color: palette.textMuted, fontSize: typography.small }}>{label}</Text>
      <Text style={{ color: palette.text, fontSize: typography.small, fontWeight: '700' }}>{value}</Text>
    </View>
  );
}

function SecurityBlock({ title, body }: { title: string; body: string }) {
  const { palette } = useTheme();
  return (
    <View>
      <Text style={{ color: palette.text, fontSize: typography.small, fontWeight: '800' }}>{title}</Text>
      <Text style={{ color: palette.textMuted, fontSize: typography.micro, marginTop: 4, lineHeight: 17 }}>
        {body}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: typography.display, fontWeight: '800' },
  subtitle: { fontSize: typography.small, marginTop: 4 },
  securityLead: {
    fontSize: typography.small,
    fontWeight: '800',
    lineHeight: 20,
  },
  ruleLead: { fontSize: typography.small, lineHeight: 20 },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
  },
  ruleActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, maxWidth: 200, justifyContent: 'flex-end' },
  editor: { borderWidth: 1, borderRadius: 12, padding: spacing.md, gap: spacing.sm },
  editorTitle: { fontSize: typography.body, fontWeight: '800', marginBottom: spacing.xs },
  labelMuted: { fontSize: typography.small, fontWeight: '600', marginBottom: 4 },
  acctChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
