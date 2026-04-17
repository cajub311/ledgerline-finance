import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme/ThemeContext';
import { spacing, typography } from '../../theme/tokens';

export interface CashFlowLineChartPoint {
  date: string;
  label: string;
  balance: number;
}

interface CashFlowLineChartProps {
  data: CashFlowLineChartPoint[];
  threshold: number;
  height?: number;
}

/** Native stub — full chart lives in `CashFlowLineChart.web.tsx`. */
export function CashFlowLineChart({ data, threshold, height = 300 }: CashFlowLineChartProps) {
  const { palette } = useTheme();
  const last = data[data.length - 1]?.balance ?? 0;

  return (
    <View style={[styles.wrap, { height }]}>
      <Text style={{ color: palette.textMuted, fontSize: typography.small, marginBottom: spacing.sm }}>
        Interactive balance chart is available in the web build ({data.length} points, ends at{' '}
        {last.toFixed(0)}).
      </Text>
      {threshold > 0 ? (
        <Text style={{ color: palette.textSubtle, fontSize: typography.micro }}>
          Threshold line at {threshold.toFixed(0)} is shown on web.
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
