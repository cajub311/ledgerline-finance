import { StyleSheet, Text, View } from 'react-native';

import type { CategoryBreakdownItem } from '../../finance/types';
import { useTheme } from '../../theme/ThemeContext';
import { categoryColors, radius, spacing, typography } from '../../theme/tokens';
import { formatCurrency } from '../../utils/format';

interface CategoryBreakdownListProps {
  items: CategoryBreakdownItem[];
  icons: Record<string, string>;
  budgetedByCategory?: Record<string, number>;
  /** Prior-period total per category; when present, each row shows an MoM delta. */
  priorByCategory?: Record<string, number>;
  /** Short label for the comparison period, e.g. "Mar". Shown as "↑ $80 vs Mar". */
  priorLabel?: string;
}

export function CategoryBreakdownList({
  items,
  icons,
  budgetedByCategory = {},
  priorByCategory,
  priorLabel,
}: CategoryBreakdownListProps) {
  const { palette } = useTheme();
  const max = Math.max(1, ...items.map((i) => i.total));

  if (items.length === 0) {
    return (
      <Text style={{ color: palette.textSubtle, fontSize: typography.small }}>
        No expenses in this period yet.
      </Text>
    );
  }

  return (
    <View style={{ gap: spacing.md }}>
      {items.map((item) => {
        const budget = budgetedByCategory[item.category];
        const color = categoryColors[item.category] ?? palette.primary;
        const widthPct = (item.total / max) * 100;
        return (
          <View key={item.category} style={{ gap: 6 }}>
            <View style={styles.row}>
              <Text style={[styles.label, { color: palette.text }]}>
                <Text>{icons[item.category] ?? '📋'}  </Text>
                {item.category}
              </Text>
              <Text style={[styles.amount, { color: palette.text }]}>
                {formatCurrency(item.total)}
              </Text>
            </View>
            <View style={[styles.track, { backgroundColor: palette.surfaceSunken }]}>
              <View
                style={[
                  styles.fill,
                  { width: `${Math.min(100, widthPct)}%`, backgroundColor: color },
                ]}
              />
            </View>
            <View style={styles.row}>
              <Text style={[styles.meta, { color: palette.textSubtle }]}>
                {Math.round(item.pct * 100)}% of spend
              </Text>
              <View style={styles.metaRight}>
                {priorByCategory ? (() => {
                  const prior = priorByCategory[item.category] ?? 0;
                  const delta = item.total - prior;
                  if (prior === 0 && delta === 0) return null;
                  const newCat = prior === 0 && delta > 0;
                  const arrow = delta > 0 ? '▲' : delta < 0 ? '▼' : '•';
                  const label = newCat
                    ? `New${priorLabel ? ` vs ${priorLabel}` : ''}`
                    : `${arrow} ${formatCurrency(Math.abs(delta))}${priorLabel ? ` vs ${priorLabel}` : ''}`;
                  // For spending, up is bad, down is good.
                  const color =
                    delta > 0 ? palette.danger : delta < 0 ? palette.success : palette.textSubtle;
                  return (
                    <Text style={[styles.meta, { color }]}>{label}</Text>
                  );
                })() : null}
                {budget !== undefined ? (
                  <Text
                    style={[
                      styles.meta,
                      {
                        color:
                          item.total > budget
                            ? palette.danger
                            : item.total > budget * 0.7
                              ? palette.warning
                              : palette.success,
                      },
                    ]}
                  >
                    Budget {formatCurrency(budget)}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: typography.body,
    fontWeight: '600',
  },
  amount: {
    fontSize: typography.body,
    fontWeight: '700',
  },
  track: {
    height: 8,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  meta: {
    fontSize: typography.micro,
    fontWeight: '600',
  },
  metaRight: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
});
