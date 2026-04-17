import { StyleSheet, View } from 'react-native';

import { useTheme } from '../../theme/ThemeContext';
import { radius } from '../../theme/tokens';

interface SparklineProps {
  values: number[];
  color?: string;
  height?: number;
}

export function Sparkline({ values, color, height = 36 }: SparklineProps) {
  const { palette } = useTheme();
  const barColor = color ?? palette.primary;

  if (values.length === 0) {
    return <View style={{ height }} />;
  }

  const max = Math.max(1, ...values);
  return (
    <View style={[styles.row, { height }]}>
      {values.map((value, index) => (
        <View
          key={index}
          style={[
            styles.bar,
            {
              height: Math.max(2, (value / max) * height),
              backgroundColor: barColor,
              opacity: 0.3 + 0.7 * (value / max),
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },
  bar: {
    flex: 1,
    borderTopLeftRadius: radius.sm,
    borderTopRightRadius: radius.sm,
  },
});
