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
  const accentColor =
    tone === 'positive' ? '#8fd3b4' : tone === 'alert' ? '#d97e68' : '#4d8390';

  return (
    <View
      style={[
        styles.tile,
        tone === 'positive' && styles.tilePositive,
        tone === 'alert' && styles.tileAlert,
      ]}
    >
      {/* Colored left border accent */}
      <View style={[styles.leftAccent, { backgroundColor: accentColor }]} />

      <View style={styles.content}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: 132,
    backgroundColor: '#0f1d24',
    borderWidth: 1,
    borderColor: '#20353d',
    borderRadius: 20,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    overflow: 'hidden',
  },
  tilePositive: {
    borderColor: '#1e4d3d',
    backgroundColor: '#0a1e18',
  },
  tileAlert: {
    borderColor: '#4a2e1e',
    backgroundColor: '#160e09',
  },
  leftAccent: {
    width: 3,
    borderRadius: 2,
    alignSelf: 'stretch',
    flexShrink: 0,
  },
  content: {
    flex: 1,
    gap: 5,
  },
  label: {
    color: '#b9ccd0',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  value: {
    color: '#eff7f4',
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 28,
  },
  detail: {
    color: '#b9ccd0',
    fontSize: 11,
    fontStyle: 'italic',
    lineHeight: 15,
  },
});
