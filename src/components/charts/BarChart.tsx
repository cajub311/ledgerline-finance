import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme/ThemeContext';
import { radius, spacing, typography } from '../../theme/tokens';
import { formatCurrency } from '../../utils/format';

export interface BarSeries {
  label: string;
  income: number;
  spend: number;
}

interface BarChartProps {
  series: BarSeries[];
  height?: number;
}

export function IncomeSpendBars({ series, height = 180 }: BarChartProps) {
  const { palette } = useTheme();
  const max = Math.max(1, ...series.flatMap((s) => [s.income, s.spend]));

  return (
    <View style={{ gap: spacing.md }}>
      <View style={[styles.row, { height, alignItems: 'flex-end' }]}>
        {series.map((bar, index) => (
          <View key={`${bar.label}-${index}`} style={styles.column}>
            <View style={styles.pair}>
              <View
                style={[
                  styles.bar,
                  {
                    height: Math.max(2, (bar.income / max) * height),
                    backgroundColor: palette.success,
                  },
                ]}
              />
              <View
                style={[
                  styles.bar,
                  {
                    height: Math.max(2, (bar.spend / max) * height),
                    backgroundColor: palette.danger,
                  },
                ]}
              />
            </View>
            <Text style={[styles.label, { color: palette.textSubtle }]}>{bar.label}</Text>
          </View>
        ))}
      </View>
      <View style={styles.legend}>
        <LegendDot color={palette.success} label="Income" />
        <LegendDot color={palette.danger} label="Spend" />
        <Text style={[styles.legendMeta, { color: palette.textSubtle }]}>
          Peak {formatCurrency(max)}
        </Text>
      </View>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  const { palette } = useTheme();
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.legendText, { color: palette.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  column: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  pair: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    flex: 1,
  },
  bar: {
    width: 12,
    borderTopLeftRadius: radius.sm,
    borderTopRightRadius: radius.sm,
  },
  label: {
    fontSize: typography.micro,
    fontWeight: '600',
  },
  legend: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  legendText: {
    fontSize: typography.micro,
    fontWeight: '600',
  },
  legendMeta: {
    marginLeft: 'auto',
    fontSize: typography.micro,
  },
});
