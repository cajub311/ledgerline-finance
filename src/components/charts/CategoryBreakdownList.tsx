import { StyleSheet, Text, View } from 'react-native';

import type { CategoryBreakdownItem } from '../../finance/types';
import { useTheme } from '../../theme/ThemeContext';
import { categoryColors, radius, spacing, typography } from '../../theme/tokens';
import { formatCurrency } from '../../utils/format';

interface CategoryBreakdownListProps {
  items: CategoryBreakdownItem[];
  icons: Record<string, string>;
  budgetedByCategory?: Record<string, number>;
}

export function CategoryBreakdownList({
  items,
  icons,
  budgetedByCategory = {},
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
});
