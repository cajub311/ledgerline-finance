import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme/ThemeContext';
import { radius, spacing, typography } from '../../theme/tokens';
import { formatCurrency } from '../../utils/format';

export interface NetWorthPoint {
  label: string;
  netWorth: number;
}

interface NetWorthTrendChartProps {
  series: NetWorthPoint[];
  height?: number;
}

export function NetWorthTrendChart({ series, height = 160 }: NetWorthTrendChartProps) {
  const { palette } = useTheme();

  if (series.length === 0) {
    return (
      <Text style={{ color: palette.textSubtle, fontSize: typography.small }}>
        No history yet.
      </Text>
    );
  }

  const values = series.map((s) => s.netWorth);
  const minV = Math.min(0, ...values);
  const maxV = Math.max(0, ...values);
  const span = Math.max(1, maxV - minV);
  const zeroRatio = maxV / span;
  const zeroLinePx = zeroRatio * height;
  const latest = series[series.length - 1];
  const earliest = series[0];
  const delta = latest.netWorth - earliest.netWorth;
  const deltaColor = delta >= 0 ? palette.success : palette.danger;

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={[styles.plot, { height }]}>
        <View
          style={[
            styles.zeroLine,
            {
              top: zeroLinePx,
              backgroundColor: palette.borderSoft,
            },
          ]}
        />
        <View style={styles.row}>
          {series.map((point, index) => {
            const isPos = point.netWorth >= 0;
            const barHeight = Math.max(2, (Math.abs(point.netWorth) / span) * height);
            const barTop = isPos ? zeroLinePx - barHeight : zeroLinePx;
            const color = isPos ? palette.primary : palette.danger;
            const isLast = index === series.length - 1;
            return (
              <View key={`${point.label}-${index}`} style={styles.column}>
                <View
                  style={[
                    styles.bar,
                    {
                      top: barTop,
                      height: barHeight,
                      backgroundColor: color,
                      opacity: isLast ? 1 : 0.7,
                    },
                  ]}
                />
              </View>
            );
          })}
        </View>
      </View>
      <View style={styles.labelsRow}>
        {series.map((point, index) => (
          <Text
            key={`${point.label}-lbl-${index}`}
            style={[styles.label, { color: palette.textSubtle }]}
          >
            {point.label}
          </Text>
        ))}
      </View>
      <View style={styles.legend}>
        <Text style={[styles.meta, { color: palette.textMuted }]}>
          Now {formatCurrency(latest.netWorth)}
        </Text>
        <Text style={[styles.meta, { color: deltaColor, fontWeight: '700' }]}>
          {delta >= 0 ? '+' : ''}
          {formatCurrency(delta)} over {series.length} mo
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  plot: {
    position: 'relative',
    overflow: 'hidden',
  },
  zeroLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
  },
  row: {
    flexDirection: 'row',
    flex: 1,
    gap: 4,
  },
  column: {
    flex: 1,
    position: 'relative',
  },
  bar: {
    position: 'absolute',
    left: '15%',
    right: '15%',
    borderTopLeftRadius: radius.sm,
    borderTopRightRadius: radius.sm,
    borderBottomLeftRadius: radius.sm,
    borderBottomRightRadius: radius.sm,
  },
  labelsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  label: {
    flex: 1,
    fontSize: typography.micro,
    fontWeight: '600',
    textAlign: 'center',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  meta: {
    fontSize: typography.micro,
  },
});
