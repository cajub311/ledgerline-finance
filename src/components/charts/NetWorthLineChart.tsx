import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme/ThemeContext';
import { spacing, typography } from '../../theme/tokens';
import { formatCurrency } from '../../utils/format';

export interface NetWorthLineChartPoint {
  monthKey: string;
  label: string;
  netWorth: number;
  assets: number;
  liabilities: number;
}

interface NetWorthLineChartProps {
  data: NetWorthLineChartPoint[];
  height?: number;
}

/** Native stub — full chart lives in `NetWorthLineChart.web.tsx`. */
export function NetWorthLineChart({ data, height = 260 }: NetWorthLineChartProps) {
  const { palette } = useTheme();
  const last = data[data.length - 1];

  return (
    <View style={[styles.wrap, { height }]}>
      <Text style={{ color: palette.textMuted, fontSize: typography.small, marginBottom: spacing.sm }}>
        Net worth trend chart is available in the web build ({data.length} month{data.length === 1 ? '' : 's'}).
      </Text>
      {last ? (
        <Text style={{ color: palette.text, fontSize: typography.body, fontWeight: '700' }}>
          Latest: {formatCurrency(last.netWorth)} ({last.monthKey})
        </Text>
      ) : null}
      {last ? (
        <Text style={{ color: palette.textSubtle, fontSize: typography.micro, marginTop: 6 }}>
          Assets {formatCurrency(last.assets)} · Liabilities {formatCurrency(last.liabilities)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    justifyContent: 'center',
  },
});
