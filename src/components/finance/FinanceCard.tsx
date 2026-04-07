import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Tone = 'default' | 'accent' | 'warning';

export function FinanceCard({
  title,
  eyebrow,
  tone = 'default',
  children,
}: {
  title: string;
  eyebrow?: string;
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <View
      style={[
        styles.card,
        tone === 'accent' && styles.cardAccent,
        tone === 'warning' && styles.cardWarning,
      ]}
    >
      <View style={styles.header}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#10222a',
    borderWidth: 1,
    borderColor: '#27444f',
    borderRadius: 24,
    padding: 16,
    gap: 14,
  },
  cardAccent: {
    backgroundColor: '#14343d',
    borderColor: '#4d8390',
  },
  cardWarning: {
    backgroundColor: '#33281f',
    borderColor: '#8f674b',
  },
  header: {
    gap: 4,
  },
  eyebrow: {
    color: '#8db8c3',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  title: {
    color: '#edf5f2',
    fontSize: 22,
    fontWeight: '800',
  },
});
