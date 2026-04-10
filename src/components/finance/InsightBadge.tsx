import { StyleSheet, Text, View } from 'react-native';

export function InsightBadge({ text, index }: { text: string; index: number }) {
  const colors = ['#d4e37d', '#8fd3b4', '#94bdc4', '#f0bd82', '#b39ddb', '#80cbc4'];
  const accentColor = colors[index % colors.length];

  return (
    <View style={styles.card}>
      {/* Colored left accent line */}
      <View style={[styles.leftAccent, { backgroundColor: accentColor }]} />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    backgroundColor: '#0f1d24',
    borderWidth: 1,
    borderColor: '#1e3840',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  leftAccent: {
    width: 3,
    borderRadius: 2,
    flexShrink: 0,
  },
  text: {
    flex: 1,
    color: '#d5e9e5',
    fontSize: 13,
    lineHeight: 20,
  },
});
