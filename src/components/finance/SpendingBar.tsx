import { StyleSheet, Text, View } from 'react-native';

const CATEGORY_COLORS: Record<string, string> = {
  Housing: '#d97e68',
  Groceries: '#8fd3b4',
  Dining: '#f0bd82',
  Utilities: '#94bdc4',
  Fuel: '#d4e37d',
  Travel: '#b39ddb',
  Subscriptions: '#80cbc4',
  Shopping: '#ffab91',
  Health: '#a5d6a7',
  Fees: '#ef9a9a',
  Savings: '#81d4fa',
  Income: '#8fd3b4',
  Transfer: '#b0bec5',
  Other: '#78909c',
};

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? '#78909c';
}

export function SpendingBar({
  category,
  amount,
  pct,
}: {
  category: string;
  amount: number;
  pct: number;
}) {
  const color = getCategoryColor(category);
  const barWidth = `${Math.max(2, Math.round(pct * 100))}%` as `${number}%`;

  return (
    <View style={styles.row}>
      <Text style={styles.label} numberOfLines={1}>
        {category}
      </Text>
      <View style={styles.track}>
        <View style={[styles.bar, { width: barWidth, backgroundColor: color }]} />
      </View>
      <Text style={styles.amount}>${amount.toFixed(0)}</Text>
      <Text style={styles.pct}>{Math.round(pct * 100)}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 28,
  },
  label: {
    color: '#eff7f4',
    fontSize: 12,
    fontWeight: '700',
    width: 82,
    flexShrink: 0,
  },
  track: {
    flex: 1,
    height: 10,
    backgroundColor: '#1a3540',
    borderRadius: 6,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: 6,
  },
  amount: {
    color: '#eff7f4',
    fontSize: 12,
    fontWeight: '700',
    width: 44,
    textAlign: 'right',
    flexShrink: 0,
  },
  pct: {
    color: '#94bdc4',
    fontSize: 11,
    width: 30,
    textAlign: 'right',
    flexShrink: 0,
  },
});
