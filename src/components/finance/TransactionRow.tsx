import { Pressable, StyleSheet, Text, View } from 'react-native';

export function TransactionRow({
  merchant,
  amount,
  amountValue,
  date,
  account,
  category,
  categoryIcon,
  flagged,
  selected,
  onPress,
}: {
  merchant: string;
  amount: string;
  amountValue: number;
  date: string;
  account: string;
  category: string;
  categoryIcon?: string;
  flagged?: boolean;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      style={[styles.row, selected && styles.rowSelected, flagged && styles.rowFlagged]}
      onPress={onPress}
    >
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>{categoryIcon ?? '📋'}</Text>
      </View>
      <View style={styles.copy}>
        <Text style={styles.merchant} numberOfLines={1}>{merchant}</Text>
        <Text style={styles.meta}>
          {date} · {category} · {account}
        </Text>
      </View>
      <View style={styles.amountWrap}>
        {flagged ? <Text style={styles.flag}>Review</Text> : null}
        <Text
          style={[
            styles.amount,
            amountValue > 0 && styles.amountPositive,
            amountValue < 0 && styles.amountNegative,
          ]}
        >
          {amount}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#1f3740',
  },
  rowSelected: {
    backgroundColor: '#122b33',
    marginHorizontal: -8,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  rowFlagged: {
    borderTopColor: '#6d5540',
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#0e2028',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  icon: {
    fontSize: 16,
  },
  copy: {
    flex: 1,
    gap: 3,
  },
  merchant: {
    color: '#eff4f2',
    fontSize: 14,
    fontWeight: '700',
  },
  meta: {
    color: '#9fb8be',
    fontSize: 11,
    lineHeight: 15,
  },
  amountWrap: {
    alignItems: 'flex-end',
    gap: 3,
    flexShrink: 0,
  },
  flag: {
    color: '#d9b08c',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  amount: {
    color: '#eff4f2',
    fontSize: 14,
    fontWeight: '800',
  },
  amountPositive: {
    color: '#8fd3b4',
  },
  amountNegative: {
    color: '#f0bd82',
  },
});
