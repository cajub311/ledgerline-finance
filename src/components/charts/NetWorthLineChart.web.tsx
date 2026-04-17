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

export function NetWorthLineChart({ data, height = 280 }: NetWorthLineChartProps) {
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
            formatter={(value: number) => [formatCurrency(value), 'Net worth']}
            labelFormatter={(_, payload) => (payload?.[0]?.payload?.monthKey as string) ?? ''}
          />
          <ReferenceLine y={0} stroke={palette.textSubtle} strokeDasharray="2 4" />
          <Line
            type="monotone"
            dataKey="netWorth"
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
