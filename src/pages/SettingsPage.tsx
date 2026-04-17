import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Select } from '../components/ui/Select';
import {
  createFinanceState,
  getCategoryOptions,
  reapplyRulesToAllTransactions,
} from '../finance/ledger';
import {
  addRule,
  countRuleMatches,
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

export function SettingsPage({ state, onStateChange }: SettingsPageProps) {
  const { palette, mode, setMode } = useTheme();
  const [householdDraft, setHouseholdDraft] = useState(state.householdName);
  const [confirm, setConfirm] = useState(false);
  const [ruleEditorOpen, setRuleEditorOpen] = useState(false);
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
    rules: state.rules.length,
  };

  const categoryOptions = useMemo(() => getCategoryOptions(), []);

  const openNewRule = () => {
    setEditingRuleId(null);
    setRuleDraft(emptyRuleDraft());
    setRuleEditorOpen(true);
  };

  const openEditRule = (rule: FinanceRule) => {
    setEditingRuleId(rule.id);
    setRuleDraft({
      name: rule.name ?? '',
      payeePattern: rule.payeePattern,
      accountId: rule.accountId ?? '',
      amountMinStr:
        rule.amountMin !== undefined && Number.isFinite(rule.amountMin) ? String(rule.amountMin) : '',
      amountMaxStr:
        rule.amountMax !== undefined && Number.isFinite(rule.amountMax) ? String(rule.amountMax) : '',
      assignCategory: rule.assignCategory,
    });
    setRuleEditorOpen(true);
  };

  const previewMatchCount = useMemo(() => {
    const min = parseOptionalAmount(ruleDraft.amountMinStr);
    const max = parseOptionalAmount(ruleDraft.amountMaxStr);
    return countRuleMatches(state, {
      payeePattern: ruleDraft.payeePattern,
      accountId: ruleDraft.accountId.trim() || undefined,
      amountMin: min,
      amountMax: max,
    });
  }, [state, ruleDraft]);

  const saveRule = () => {
    const assignCategory = ruleDraft.assignCategory.trim();
    if (!assignCategory) return;

    const min = parseOptionalAmount(ruleDraft.amountMinStr);
    const max = parseOptionalAmount(ruleDraft.amountMaxStr);
    const accountId = ruleDraft.accountId.trim() || undefined;

    const payload: FinanceRule = {
      id: editingRuleId ?? `rule-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`,
      name: ruleDraft.name.trim() || undefined,
      payeePattern: ruleDraft.payeePattern,
      accountId,
      amountMin: min,
      amountMax: max,
      assignCategory,
    };

    if (editingRuleId) {
      onStateChange(updateRule(state, editingRuleId, { ...payload, id: editingRuleId }));
    } else {
      onStateChange(addRule(state, payload));
    }
    setRuleEditorOpen(false);
  };

  const removeRule = (id: string) => {
    onStateChange(deleteRule(state, id));
  };

  const shiftRule = (id: string, delta: number) => {
    const idx = state.rules.findIndex((r) => r.id === id);
    if (idx < 0) return;
    const next = idx + delta;
    if (next < 0 || next >= state.rules.length) return;
    onStateChange(moveRule(state, id, next));
  };

  const reapplyAll = () => {
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

      <Card title="Auto-categorization rules" eyebrow="Rules engine">
        <Text style={[styles.ruleLead, { color: palette.textMuted }]}>
          First matching rule wins. New imports are categorized after deduplication. Regex runs in
          case-insensitive mode; invalid patterns never crash the app — they simply match nothing.
        </Text>
        <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
          {state.rules.length === 0 ? (
            <Text style={{ color: palette.textSubtle, fontSize: typography.small }}>
              No rules yet. Add one to auto-label payees (for example <Text style={{ fontWeight: '800' }}>netflix</Text>{' '}
              → Subscriptions).
            </Text>
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
                  <Text style={{ color: palette.text, fontWeight: '800', fontSize: typography.small }}>
                    {index + 1}. {rule.name?.trim() || rule.payeePattern || '(any payee)'}
                  </Text>
                  <Text style={{ color: palette.textMuted, fontSize: typography.micro }} numberOfLines={2}>
                    {rule.payeePattern ? `/${rule.payeePattern}/i` : 'Any payee'}
                    {rule.accountId
                      ? ` · ${state.accounts.find((a) => a.id === rule.accountId)?.name ?? rule.accountId}`
                      : ''}
                    {rule.amountMin !== undefined || rule.amountMax !== undefined
                      ? ` · amount ${rule.amountMin ?? '…'}–${rule.amountMax ?? '…'}`
                      : ''}
                    {' → '}
                    {rule.assignCategory}
                  </Text>
                </View>
                <View style={styles.ruleActions}>
                  <Pressable
                    onPress={() => shiftRule(rule.id, -1)}
                    disabled={index === 0}
                    style={({ pressed }) => [styles.iconBtn, { opacity: index === 0 ? 0.35 : pressed ? 0.7 : 1 }]}
                  >
                    <Text style={{ color: palette.text }}>↑</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => shiftRule(rule.id, 1)}
                    disabled={index === state.rules.length - 1}
                    style={({ pressed }) => [
                      styles.iconBtn,
                      { opacity: index === state.rules.length - 1 ? 0.35 : pressed ? 0.7 : 1 },
                    ]}
                  >
                    <Text style={{ color: palette.text }}>↓</Text>
                  </Pressable>
                  <Button label="Edit" size="sm" variant="secondary" onPress={() => openEditRule(rule)} />
                  <Button label="Delete" size="sm" variant="ghost" onPress={() => removeRule(rule.id)} />
                </View>
              </View>
            ))
          )}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md }}>
          <Button label="Add rule" variant="primary" onPress={openNewRule} />
          <Button
            label={reapplyConfirm ? 'Tap again to overwrite categories' : 'Re-apply rules to all transactions'}
            variant={reapplyConfirm ? 'danger' : 'secondary'}
            onPress={reapplyAll}
            disabled={state.rules.length === 0}
          />
        </View>
        {reapplyConfirm ? (
          <Text style={[styles.warn, { color: palette.danger }]}>
            This overwrites categories on every transaction where a rule matches (manual categories included).
          </Text>
        ) : null}
      </Card>

      <Modal
        visible={ruleEditorOpen}
        onClose={() => setRuleEditorOpen(false)}
        title={editingRuleId ? 'Edit rule' : 'New rule'}
        subtitle="Would match transactions in your current ledger"
        footer={
          <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
            <Button label="Cancel" variant="ghost" onPress={() => setRuleEditorOpen(false)} />
            <Button
              label="Save rule"
              onPress={saveRule}
              disabled={!ruleDraft.assignCategory.trim()}
            />
          </View>
        }
      >
        <Text style={{ color: palette.textMuted, fontSize: typography.small }}>
          Would match <Text style={{ fontWeight: '800', color: palette.text }}>{previewMatchCount}</Text>{' '}
          transaction{previewMatchCount === 1 ? '' : 's'}.
        </Text>
        <Input label="Name (optional)" value={ruleDraft.name} onChangeText={(t) => setRuleDraft((d) => ({ ...d, name: t }))} />
        <Input
          label="Payee regex"
          value={ruleDraft.payeePattern}
          onChangeText={(t) => setRuleDraft((d) => ({ ...d, payeePattern: t }))}
          hint="JavaScript regex, case-insensitive. Leave empty to match any payee."
        />
        <Select
          label="Account scope"
          value={ruleDraft.accountId || '__all__'}
          onChange={(v) => setRuleDraft((d) => ({ ...d, accountId: v === '__all__' ? '' : v }))}
          options={[
            { value: '__all__', label: 'All accounts' },
            ...state.accounts.map((a) => ({ value: a.id, label: a.name })),
          ]}
        />
        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
          <View style={{ flex: 1, minWidth: 120 }}>
            <Input
              label="Amount min (optional)"
              value={ruleDraft.amountMinStr}
              onChangeText={(t) => setRuleDraft((d) => ({ ...d, amountMinStr: t }))}
              keyboardType="numeric"
            />
          </View>
          <View style={{ flex: 1, minWidth: 120 }}>
            <Input
              label="Amount max (optional)"
              value={ruleDraft.amountMaxStr}
              onChangeText={(t) => setRuleDraft((d) => ({ ...d, amountMaxStr: t }))}
              keyboardType="numeric"
            />
          </View>
        </View>
        <Select
          label="Assign category"
          value={
            categoryOptions.some((c) => c === ruleDraft.assignCategory)
              ? ruleDraft.assignCategory
              : categoryOptions[0]!
          }
          onChange={(v) => setRuleDraft((d) => ({ ...d, assignCategory: v }))}
          options={categoryOptions.map((c) => ({ value: c, label: c }))}
        />
      </Modal>

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

interface RuleDraft {
  name: string;
  payeePattern: string;
  accountId: string;
  amountMinStr: string;
  amountMaxStr: string;
  assignCategory: string;
}

function emptyRuleDraft(): RuleDraft {
  return {
    name: '',
    payeePattern: '',
    accountId: '',
    amountMinStr: '',
    amountMaxStr: '',
    assignCategory: 'Other',
  };
}

function parseOptionalAmount(raw: string): number | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n : undefined;
}

const styles = StyleSheet.create({
  title: { fontSize: typography.display, fontWeight: '800' },
  subtitle: { fontSize: typography.small, marginTop: 4 },
  ruleLead: { fontSize: typography.small, lineHeight: 20 },
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
    alignItems: 'center',
    gap: spacing.xs,
  },
  iconBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  warn: { fontSize: typography.micro, marginTop: spacing.sm, lineHeight: 18 },
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
