import { StyleSheet, Text, View } from 'react-native';

export function InsightBadge({ text, index }: { text: string; index: number }) {
  const colors = ['#d4e37d', '#8fd3b4', '#94bdc4', '#f0bd82', '#b39ddb', '#80cbc4'];
  const dotColor = colors[index % colors.length];

  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#1e3840',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
    flexShrink: 0,
  },
  text: {
    flex: 1,
    color: '#d5e9e5',
    fontSize: 13,
    lineHeight: 19,
  },
});
