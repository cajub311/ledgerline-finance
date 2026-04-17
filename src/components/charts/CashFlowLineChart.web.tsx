import { Platform, StyleSheet, View } from 'react-native';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useTheme } from '../../theme/ThemeContext';
import { radius } from '../../theme/tokens';
import { formatCurrency } from '../../utils/format';

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

export function CashFlowLineChart({ data, threshold, height = 300 }: CashFlowLineChartProps) {
  const { palette } = useTheme();

  if (Platform.OS !== 'web') {
    return null;
  }

  return (
    <View style={[styles.wrap, { height }]}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={palette.borderSoft} strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fill: palette.textSubtle, fontSize: 11 }} interval="preserveStartEnd" />
          <YAxis
            tick={{ fill: palette.textSubtle, fontSize: 11 }}
            tickFormatter={(v) => `$${Number(v).toFixed(0)}`}
            width={56}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: palette.surface,
              borderColor: palette.borderSoft,
              borderRadius: radius.md,
            }}
            labelStyle={{ color: palette.text }}
            formatter={(value: number) => [formatCurrency(value), 'Balance']}
            labelFormatter={(_, payload) => (payload?.[0]?.payload?.date as string) ?? ''}
          />
          {threshold > 0 ? (
            <ReferenceLine
              y={threshold}
              stroke={palette.warning}
              strokeDasharray="4 4"
              label={{ value: 'Threshold', fill: palette.warning, fontSize: 11 }}
            />
          ) : null}
          <Line
            type="monotone"
            dataKey="balance"
            stroke={palette.primary}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
});
