import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDateShort } from '../../utils/format';

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
      {/* Selected state: left border accent */}
      {selected ? <View style={styles.selectedAccent} /> : null}

      <View
        style={[
          styles.iconWrap,
          amountValue > 0 ? styles.iconWrapPositive : styles.iconWrapNegative,
        ]}
      >
        <Text style={styles.icon}>{categoryIcon ?? '📋'}</Text>
      </View>

      <View style={styles.copy}>
        <Text style={styles.merchant} numberOfLines={1}>{merchant}</Text>
        <Text style={styles.meta}>
          {formatDateShort(date)}
          {'  ·  '}
          {category}
        </Text>
        <Text style={styles.metaAccount}>{account}</Text>
      </View>

      <View style={styles.amountWrap}>
        {flagged ? (
          <View style={styles.flagPill}>
            <Text style={styles.flagText}>Review</Text>
          </View>
        ) : null}
        <Text
          style={[
            styles.amount,
            amountValue > 0 && styles.amountPositive,
          ]}
        >
          {amount}
        </Text>
        <Text style={styles.chevron}>{'›'}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: '#1f3740',
  },
  rowSelected: {
    backgroundColor: '#0e2830',
    marginHorizontal: -8,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderTopColor: 'transparent',
  },
  rowFlagged: {
    borderTopColor: '#6d5540',
  },
  selectedAccent: {
    position: 'absolute',
    left: 0,
    top: 6,
    bottom: 6,
    width: 3,
    borderRadius: 2,
    backgroundColor: '#d4e37d',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconWrapPositive: {
    backgroundColor: '#0f2920',
  },
  iconWrapNegative: {
    backgroundColor: '#1a2210',
  },
  icon: {
    fontSize: 18,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  merchant: {
    color: '#eff7f4',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 19,
  },
  meta: {
    color: '#b9ccd0',
    fontSize: 11,
    lineHeight: 15,
  },
  metaAccount: {
    color: '#7a9da6',
    fontSize: 11,
    lineHeight: 14,
  },
  amountWrap: {
    alignItems: 'flex-end',
    gap: 3,
    flexShrink: 0,
    flexDirection: 'column',
  },
  flagPill: {
    backgroundColor: '#2a1f0f',
    borderWidth: 1,
    borderColor: '#8b6040',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  flagText: {
    color: '#f0bd82',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  amount: {
    color: '#eff7f4',
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 20,
  },
  amountPositive: {
    color: '#8fd3b4',
  },
  chevron: {
    color: '#4d7a86',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 16,
  },
});
