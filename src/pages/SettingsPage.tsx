import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Select } from '../components/ui/Select';
import { createFinanceState, getCategoryOptions } from '../finance/ledger';
import {
  addRule,
  countRuleMatches,
  deleteRule,
  moveRule,
  reapplyRulesToAllTransactions,
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

export function SettingsPage({ state, onStateChange }: SettingsPageProps) {
  const { palette, mode, setMode } = useTheme();
  const [householdDraft, setHouseholdDraft] = useState(state.householdName);
  const [confirm, setConfirm] = useState(false);
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [ruleDraft, setRuleDraft] = useState<RuleDraft>(emptyRuleDraft());
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
  };

  const categoryOptions = getCategoryOptions().map((c) => ({ value: c, label: c }));
  const accountScopeOptions = [
    { value: '', label: 'All accounts' },
    ...state.accounts.map((a) => ({ value: a.id, label: a.name })),
  ];

  const liveMatchCount = useMemo(() => {
    if (!ruleModalOpen) return 0;
    const min = parseOptionalNumber(ruleDraft.amountMin);
    const max = parseOptionalNumber(ruleDraft.amountMax);
    return countRuleMatches(state.transactions, {
      enabled: ruleDraft.enabled,
      accountId: ruleDraft.accountId || undefined,
      payeePattern: ruleDraft.payeePattern,
      amountMin: min,
      amountMax: max,
      category: ruleDraft.category || 'Other',
    });
  }, [ruleModalOpen, ruleDraft, state.transactions]);

  const openNewRule = () => {
    setEditingRuleId(null);
    setRuleDraft(emptyRuleDraft());
    setRuleModalOpen(true);
  };

  const openEditRule = (rule: FinanceRule) => {
    setEditingRuleId(rule.id);
    setRuleDraft({
      name: rule.name,
      category: rule.category,
      payeePattern: rule.payeePattern,
      amountMin: rule.amountMin !== undefined ? String(rule.amountMin) : '',
      amountMax: rule.amountMax !== undefined ? String(rule.amountMax) : '',
      accountId: rule.accountId ?? '',
      enabled: rule.enabled !== false,
    });
    setRuleModalOpen(true);
  };

  const saveRule = () => {
    const name = ruleDraft.name.trim();
    const category = ruleDraft.category.trim() || 'Other';
    const payeePattern = ruleDraft.payeePattern;
    const amountMin = parseOptionalNumber(ruleDraft.amountMin);
    const amountMax = parseOptionalNumber(ruleDraft.amountMax);
    const accountId = ruleDraft.accountId.trim() || undefined;

    if (!name) return;

    if (editingRuleId) {
      onStateChange(
        updateRule(state, editingRuleId, {
          name,
          category,
          payeePattern,
          amountMin,
          amountMax,
          accountId,
          enabled: ruleDraft.enabled,
        }),
      );
    } else {
      onStateChange(
        addRule(state, {
          name,
          category,
          payeePattern,
          amountMin,
          amountMax,
          accountId,
          enabled: ruleDraft.enabled,
        }),
      );
    }
    setRuleModalOpen(false);
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

      <Card title="Auto-categorization rules" eyebrow="T-01">
        <Text style={{ color: palette.textMuted, fontSize: typography.small, lineHeight: 19 }}>
          Rules run in order; the first match sets the category on import and when you re-apply. Payee
          pattern is a JavaScript regular expression (without slashes).
        </Text>
        <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
          {state.rules.length === 0 ? (
            <Text style={{ color: palette.textSubtle, fontSize: typography.small }}>
              No rules yet. Add one to auto-label imported transactions.
            </Text>
          ) : (
            state.rules.map((rule, index) => (
              <View
                key={rule.id}
                style={[
                  styles.ruleRow,
                  {
                    borderColor: palette.border,
                    backgroundColor: palette.surfaceSunken,
                  },
                ]}
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ color: palette.text, fontWeight: '700', fontSize: typography.small }}>
                    {rule.enabled === false ? '(off) ' : ''}
                    {rule.name}
                  </Text>
                  <Text style={{ color: palette.textMuted, fontSize: typography.micro }} numberOfLines={2}>
                    → {rule.category}
                    {rule.payeePattern.trim() ? ` · /${rule.payeePattern}/` : ' · any payee'}
                    {rule.accountId ? ` · ${state.accounts.find((a) => a.id === rule.accountId)?.name ?? rule.accountId}` : ''}
                  </Text>
                </View>
                <View style={styles.ruleActions}>
                  <Button
                    label="↑"
                    size="sm"
                    variant="ghost"
                    disabled={index === 0}
                    onPress={() => onStateChange(moveRule(state, rule.id, index - 1))}
                  />
                  <Button
                    label="↓"
                    size="sm"
                    variant="ghost"
                    disabled={index >= state.rules.length - 1}
                    onPress={() => onStateChange(moveRule(state, rule.id, index + 1))}
                  />
                  <Button label="Edit" size="sm" variant="secondary" onPress={() => openEditRule(rule)} />
                  <Button
                    label="Delete"
                    size="sm"
                    variant="ghost"
                    onPress={() => onStateChange(deleteRule(state, rule.id))}
                  />
                </View>
              </View>
            ))
          )}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md }}>
          <Button label="New rule" onPress={openNewRule} />
          <Button
            label={
              reapplyConfirm
                ? 'Tap again to overwrite all categories'
                : 'Re-apply rules to all transactions'
            }
            variant={reapplyConfirm ? 'danger' : 'secondary'}
            onPress={() => {
              if (!reapplyConfirm) {
                setReapplyConfirm(true);
                return;
              }
              onStateChange(reapplyRulesToAllTransactions(state));
              setReapplyConfirm(false);
            }}
          />
        </View>
        {reapplyConfirm ? (
          <Text style={{ color: palette.danger, fontSize: typography.micro, marginTop: spacing.sm }}>
            This overwrites every transaction category using your current rules (first match wins). Manual
            tweaks will be replaced where a rule matches.
          </Text>
        ) : null}
      </Card>

      <Modal
        visible={ruleModalOpen}
        onClose={() => setRuleModalOpen(false)}
        title={editingRuleId ? 'Edit rule' : 'New rule'}
        subtitle="Would match count updates as you type."
        footer={
          <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
            <Button label="Cancel" variant="ghost" onPress={() => setRuleModalOpen(false)} />
            <Button label="Save" onPress={saveRule} disabled={!ruleDraft.name.trim()} />
          </View>
        }
      >
        <Text style={{ color: palette.textMuted, fontSize: typography.small }}>
          Would match <Text style={{ fontWeight: '800', color: palette.text }}>{liveMatchCount}</Text>{' '}
          transactions
        </Text>
        <Input label="Name" value={ruleDraft.name} onChangeText={(name) => setRuleDraft((d) => ({ ...d, name }))} />
        <Select
          label="Category"
          value={ruleDraft.category || 'Other'}
          options={categoryOptions}
          onChange={(category) => setRuleDraft((d) => ({ ...d, category }))}
        />
        <Input
          label="Payee regex"
          value={ruleDraft.payeePattern}
          onChangeText={(payeePattern) => setRuleDraft((d) => ({ ...d, payeePattern }))}
          hint="Empty = any payee. Invalid patterns are ignored (never crash)."
        />
        <Input
          label="Min amount (signed, optional)"
          value={ruleDraft.amountMin}
          onChangeText={(amountMin) => setRuleDraft((d) => ({ ...d, amountMin }))}
          keyboardType="numeric"
        />
        <Input
          label="Max amount (signed, optional)"
          value={ruleDraft.amountMax}
          onChangeText={(amountMax) => setRuleDraft((d) => ({ ...d, amountMax }))}
          keyboardType="numeric"
        />
        <Select
          label="Account scope"
          value={ruleDraft.accountId}
          options={accountScopeOptions}
          onChange={(accountId) => setRuleDraft((d) => ({ ...d, accountId }))}
        />
        <Pressable
          onPress={() => setRuleDraft((d) => ({ ...d, enabled: !d.enabled }))}
          style={styles.toggleRow}
        >
          <Text style={{ color: palette.text, fontSize: typography.small, fontWeight: '600' }}>Enabled</Text>
          <Text style={{ color: palette.textMuted }}>{ruleDraft.enabled ? 'Yes' : 'No'}</Text>
        </Pressable>
      </Modal>

      <Card title="Your data" eyebrow="Local-first">
        <View style={{ gap: spacing.sm }}>
          <Line label="Accounts" value={`${totals.accounts}`} />
          <Line label="Transactions" value={`${totals.transactions}`} />
          <Line label="Budgets" value={`${totals.budgets}`} />
          <Line label="Goals" value={`${totals.goals}`} />
          <Line label="Imports recorded" value={`${totals.imports}`} />
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

interface RuleDraft {
  name: string;
  category: string;
  payeePattern: string;
  amountMin: string;
  amountMax: string;
  accountId: string;
  enabled: boolean;
}

function emptyRuleDraft(): RuleDraft {
  return {
    name: '',
    category: 'Other',
    payeePattern: '',
    amountMin: '',
    amountMax: '',
    accountId: '',
    enabled: true,
  };
}

function parseOptionalNumber(raw: string): number | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n : undefined;
}

const styles = StyleSheet.create({
  title: { fontSize: typography.display, fontWeight: '800' },
  subtitle: { fontSize: typography.small, marginTop: 4 },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
  },
  ruleActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    maxWidth: 200,
    justifyContent: 'flex-end',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  securityLead: {
    fontSize: typography.small,
    fontWeight: '800',
    lineHeight: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
