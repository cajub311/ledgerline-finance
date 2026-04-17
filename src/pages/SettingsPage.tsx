import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { createFinanceState, getCategoryOptions, reapplyRulesToAllTransactions } from '../finance/ledger';
import {
  addRule,
  countTransactionsMatchingRule,
  deleteRule,
  moveRule,
  updateRule,
} from '../finance/rules';
import type { FinanceRule, FinanceState } from '../finance/types';
import { clearFinanceState } from '../finance/storage';
import { useTheme } from '../theme/ThemeContext';
import { spacing, typography, type ThemePalette } from '../theme/tokens';
import { formatCurrency } from '../utils/format';

interface SettingsPageProps {
  state: FinanceState;
  onStateChange: (next: FinanceState) => void;
}

export function SettingsPage({ state, onStateChange }: SettingsPageProps) {
  const { palette, mode, setMode } = useTheme();
  const [householdDraft, setHouseholdDraft] = useState(state.householdName);
  const [confirm, setConfirm] = useState(false);
  const [reapplyConfirm, setReapplyConfirm] = useState(false);
  const categoryOptions = useMemo(() => getCategoryOptions(), []);
  const [rulesFormOpen, setRulesFormOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [draftCategory, setDraftCategory] = useState(categoryOptions[0] ?? 'Other');
  const [draftPattern, setDraftPattern] = useState('');
  const [draftAccountId, setDraftAccountId] = useState('');
  const [draftMin, setDraftMin] = useState('');
  const [draftMax, setDraftMax] = useState('');

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

  const previewCount = countTransactionsMatchingRule(state.transactions, {
    payeePattern: draftPattern,
    accountId: draftAccountId || undefined,
    amountMin: parseOptionalAmount(draftMin),
    amountMax: parseOptionalAmount(draftMax),
  });

  const openNewRuleForm = () => {
    setEditingRuleId(null);
    setDraftCategory(categoryOptions[0] ?? 'Other');
    setDraftPattern('');
    setDraftAccountId('');
    setDraftMin('');
    setDraftMax('');
    setRulesFormOpen(true);
  };

  const openEditRule = (rule: FinanceRule) => {
    setEditingRuleId(rule.id);
    setDraftCategory(rule.category);
    setDraftPattern(rule.payeePattern ?? '');
    setDraftAccountId(rule.accountId ?? '');
    setDraftMin(rule.amountMin !== undefined ? String(rule.amountMin) : '');
    setDraftMax(rule.amountMax !== undefined ? String(rule.amountMax) : '');
    setRulesFormOpen(true);
  };

  const saveRule = () => {
    const cat = draftCategory.trim();
    if (!cat) return;
    const patch: Omit<FinanceRule, 'id'> = {
      category: cat,
      payeePattern: draftPattern.trim() || undefined,
      accountId: draftAccountId.trim() || undefined,
      amountMin: parseOptionalAmount(draftMin),
      amountMax: parseOptionalAmount(draftMax),
    };
    if (editingRuleId) {
      onStateChange({
        ...state,
        rules: updateRule(state.rules, editingRuleId, patch),
      });
    } else {
      onStateChange({
        ...state,
        rules: addRule(state.rules, patch),
      });
    }
    setRulesFormOpen(false);
    setEditingRuleId(null);
  };

  const cancelRuleForm = () => {
    setRulesFormOpen(false);
    setEditingRuleId(null);
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

      <Card title="Auto-categorization rules" eyebrow="Local-first rules engine">
        <Text style={{ color: palette.textMuted, fontSize: typography.small, lineHeight: 19, marginBottom: spacing.md }}>
          Rules run in order: the first match sets the category for imports and when you re-apply. Leave payee pattern
          empty to match only by account and amount. Regex uses JavaScript syntax (case-insensitive).
        </Text>

        <View style={{ gap: spacing.sm }}>
          {state.rules.map((rule, index) => (
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
                  {rule.payeePattern ? ` — /${rule.payeePattern}/` : ''}
                </Text>
                <Text style={{ color: palette.textMuted, fontSize: typography.micro }}>
                  {rule.accountId
                    ? `Account: ${state.accounts.find((a) => a.id === rule.accountId)?.name ?? rule.accountId}`
                    : 'Any account'}
                  {rule.amountMin !== undefined || rule.amountMax !== undefined
                    ? ` · amount ${rule.amountMin ?? '…'} … ${rule.amountMax ?? '…'}`
                    : ''}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center' }}>
                <Button
                  size="sm"
                  variant="ghost"
                  label="↑"
                  disabled={index === 0}
                  onPress={() =>
                    onStateChange({ ...state, rules: moveRule(state.rules, index, index - 1) })
                  }
                />
                <Button
                  size="sm"
                  variant="ghost"
                  label="↓"
                  disabled={index >= state.rules.length - 1}
                  onPress={() =>
                    onStateChange({ ...state, rules: moveRule(state.rules, index, index + 1) })
                  }
                />
                <Button size="sm" variant="secondary" label="Edit" onPress={() => openEditRule(rule)} />
                <Button
                  size="sm"
                  variant="danger"
                  label="Delete"
                  onPress={() => onStateChange({ ...state, rules: deleteRule(state.rules, rule.id) })}
                />
              </View>
            </View>
          ))}
        </View>

        {!rulesFormOpen ? (
          <View style={{ marginTop: spacing.md }}>
            <Button label="Add rule" variant="secondary" onPress={openNewRuleForm} />
          </View>
        ) : (
          <View style={[styles.ruleEditor, { borderColor: palette.border, marginTop: spacing.md }]}>
            <Text style={{ color: palette.text, fontWeight: '800', fontSize: typography.small }}>
              {editingRuleId ? 'Edit rule' : 'New rule'}
            </Text>
            <Select
              label="Category"
              value={draftCategory}
              onChange={setDraftCategory}
              options={categoryOptions.map((c) => ({ value: c, label: c }))}
            />
            <Input
              label="Payee regex (optional)"
              value={draftPattern}
              onChangeText={setDraftPattern}
              placeholder="e.g. netflix|spotify"
            />
            <Text style={{ color: palette.textSubtle, fontSize: typography.micro, marginTop: -4 }}>
              Would match {previewCount} transaction{previewCount === 1 ? '' : 's'} with current filters.
            </Text>
            <Text style={[styles.fieldLabel, { color: palette.textMuted }]}>Account scope</Text>
            <View style={styles.accountChips}>
              <AccountChip
                label="Any account"
                selected={draftAccountId === ''}
                onPress={() => setDraftAccountId('')}
                palette={palette}
              />
              {state.accounts.map((account) => (
                <AccountChip
                  key={account.id}
                  label={account.name}
                  selected={draftAccountId === account.id}
                  onPress={() => setDraftAccountId(account.id)}
                  palette={palette}
                />
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Input label="Min amount (optional)" value={draftMin} onChangeText={setDraftMin} placeholder="-999" />
              </View>
              <View style={{ flex: 1 }}>
                <Input label="Max amount (optional)" value={draftMax} onChangeText={setDraftMax} placeholder="0" />
              </View>
            </View>
            <Text style={{ color: palette.textMuted, fontSize: typography.micro, lineHeight: 17 }}>
              Amounts use the same signed values as your ledger (spending is negative).
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginTop: spacing.sm }}>
              <Button label="Save rule" onPress={saveRule} />
              <Button label="Cancel" variant="ghost" onPress={cancelRuleForm} />
            </View>
          </View>
        )}

        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          <Text style={{ color: palette.textMuted, fontSize: typography.small, lineHeight: 19 }}>
            Re-applying runs every rule in order and overwrites categories wherever a rule matches — including
            transactions you categorized manually.
          </Text>
          <Button
            variant={reapplyConfirm ? 'danger' : 'secondary'}
            label={
              reapplyConfirm
                ? 'Tap again to overwrite categories from rules'
                : 'Re-apply rules to all transactions'
            }
            onPress={() => {
              if (state.rules.length === 0) return;
              if (!reapplyConfirm) {
                setReapplyConfirm(true);
                return;
              }
              onStateChange(reapplyRulesToAllTransactions(state));
              setReapplyConfirm(false);
            }}
            disabled={state.rules.length === 0}
          />
        </View>
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

function parseOptionalAmount(raw: string): number | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n : undefined;
}

function AccountChip({
  label,
  selected,
  onPress,
  palette,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  palette: ThemePalette;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }) => [
        styles.accountChip,
        {
          backgroundColor: selected ? palette.primary : palette.surfaceSunken,
          borderColor: selected ? palette.primary : palette.border,
          opacity: hovered && !selected ? 0.92 : 1,
        },
      ]}
    >
      <Text
        style={{
          color: selected ? palette.primaryText : palette.text,
          fontSize: typography.micro,
          fontWeight: '600',
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  ruleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  ruleEditor: {
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    gap: spacing.sm,
  },
  fieldLabel: {
    fontSize: typography.micro,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  accountChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  accountChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: 200,
  },
});
