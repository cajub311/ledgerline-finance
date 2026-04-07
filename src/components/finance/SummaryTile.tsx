import { StyleSheet, Text, View } from 'react-native';

export function SummaryTile({
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: 'neutral' | 'positive' | 'alert';
}) {
  return (
    <View
      style={[
        styles.tile,
        tone === 'positive' && styles.tilePositive,
        tone === 'alert' && styles.tileAlert,
      ]}
    >
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: 132,
    backgroundColor: '#0b171c',
    borderWidth: 1,
    borderColor: '#20353d',
    borderRadius: 18,
    padding: 12,
    gap: 6,
  },
  tilePositive: {
    borderColor: '#2f7d68',
    backgroundColor: '#112920',
  },
  tileAlert: {
    borderColor: '#8b6247',
    backgroundColor: '#2a2019',
  },
  label: {
    color: '#90b4be',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  value: {
    color: '#eff6f3',
    fontSize: 22,
    fontWeight: '800',
  },
  detail: {
    color: '#b9cccf',
    fontSize: 12,
    lineHeight: 16,
  },
});
