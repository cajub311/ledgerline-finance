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
  icon,
  pace,
}: {
  category: string;
  amount: number;
  pct: number;
  icon?: string;
  pace?: number;
}) {
  const color = getCategoryColor(category);
  const barWidth = `${Math.max(2, Math.round(pct * 100))}%` as `${number}%`;

  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        {icon ? <Text style={styles.icon}>{icon}</Text> : null}
        <Text style={styles.label} numberOfLines={1}>
          {category}
        </Text>
        <View style={styles.track}>
          <View style={[styles.bar, { width: barWidth, backgroundColor: color }]} />
        </View>
        <Text style={styles.amount}>${amount.toFixed(0)}</Text>
        <View style={styles.pctChip}>
          <Text style={styles.pctText}>{Math.round(pct * 100)}%</Text>
        </View>
      </View>
      {pace != null && pace > 0 ? (
        <Text style={styles.pace}>On pace for ${Math.round(pace)}/mo</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 28,
  },
  icon: {
    fontSize: 15,
    width: 20,
    textAlign: 'center',
    flexShrink: 0,
  },
  label: {
    color: '#eff7f4',
    fontSize: 13,
    fontWeight: '700',
    width: 90,
    flexShrink: 0,
  },
  track: {
    flex: 1,
    height: 12,
    backgroundColor: '#0d1e26',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1a3540',
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: 8,
  },
  amount: {
    color: '#eff7f4',
    fontSize: 13,
    fontWeight: '700',
    width: 48,
    textAlign: 'right',
    flexShrink: 0,
  },
  pctChip: {
    backgroundColor: '#0d1e26',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexShrink: 0,
  },
  pctText: {
    color: '#94bdc4',
    fontSize: 11,
    fontWeight: '600',
  },
  pace: {
    color: '#4d8090',
    fontSize: 10,
    fontStyle: 'italic',
    marginLeft: 28,
  },
});
