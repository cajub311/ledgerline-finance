import { Pressable, StyleSheet, Text, View } from 'react-native';

export function TransactionRow({
  merchant,
  amount,
  amountValue,
  date,
  account,
  category,
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
  flagged?: boolean;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      style={[styles.row, selected && styles.rowSelected, flagged && styles.rowFlagged]}
      onPress={onPress}
    >
      <View style={styles.copy}>
        <Text style={styles.merchant}>{merchant}</Text>
        <Text style={styles.meta}>
          {date}  {category}  {account}
        </Text>
      </View>
      <View style={styles.amountWrap}>
        {flagged ? <Text style={styles.flag}>Needs review</Text> : null}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
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
  copy: {
    flex: 1,
    gap: 4,
  },
  merchant: {
    color: '#eff4f2',
    fontSize: 15,
    fontWeight: '700',
  },
  meta: {
    color: '#9fb8be',
    fontSize: 12,
    lineHeight: 16,
  },
  amountWrap: {
    alignItems: 'flex-end',
    gap: 4,
  },
  flag: {
    color: '#d9b08c',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  amount: {
    color: '#eff4f2',
    fontSize: 15,
    fontWeight: '800',
  },
  amountPositive: {
    color: '#8fd3b4',
  },
  amountNegative: {
    color: '#f0bd82',
  },
});
