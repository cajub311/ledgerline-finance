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
      {/* Top accent strip for accent tone */}
      {tone === 'accent' ? <View style={styles.topAccentStrip} /> : null}

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
    backgroundColor: '#14232a',
    borderWidth: 1,
    borderColor: '#27444f',
    borderRadius: 28,
    padding: 20,
    gap: 14,
    overflow: 'hidden',
  },
  cardAccent: {
    backgroundColor: '#0e2028',
    borderColor: '#305a66',
  },
  cardWarning: {
    backgroundColor: '#1e1a14',
    borderColor: '#6b5239',
  },
  topAccentStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#4d8390',
  },
  header: {
    gap: 4,
  },
  eyebrow: {
    color: '#94bdc4',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  title: {
    color: '#eff7f4',
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 25,
  },
});
