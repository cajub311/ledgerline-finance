import { StyleSheet, Text, View } from 'react-native';

import type { NetWorthSeriesPoint } from '../../finance/types';
import { useTheme } from '../../theme/ThemeContext';
import { spacing, typography } from '../../theme/tokens';
import { formatCurrency } from '../../utils/format';

interface NetWorthLineChartProps {
  data: NetWorthSeriesPoint[];
  height?: number;
}

/** Native stub — full chart lives in `NetWorthLineChart.web.tsx`. */
export function NetWorthLineChart({ data, height = 260 }: NetWorthLineChartProps) {
  const { palette } = useTheme();
  const last = data[data.length - 1];

  return (
    <View style={[styles.wrap, { height }]}>
      <Text style={{ color: palette.textMuted, fontSize: typography.small, marginBottom: spacing.sm }}>
        Net worth chart is available in the web build.
      </Text>
      {last ? (
        <Text style={{ color: palette.text, fontSize: typography.body, fontWeight: '700' }}>
          Latest: {formatCurrency(last.netWorth)} net · {formatCurrency(last.assets)} assets ·{' '}
          {formatCurrency(last.liabilities)} liabilities ({last.monthKey})
        </Text>
      ) : (
        <Text style={{ color: palette.textSubtle, fontSize: typography.small }}>No series data.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    justifyContent: 'center',
  },
});
