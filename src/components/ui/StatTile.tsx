import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { useTheme } from '../../theme/ThemeContext';
import { radius, spacing, typography } from '../../theme/tokens';

export type StatTone = 'neutral' | 'positive' | 'warning' | 'danger' | 'primary';

interface StatTileProps {
  label: string;
  value: string;
  delta?: string;
  tone?: StatTone;
  footer?: string;
  style?: ViewStyle;
}

export function StatTile({ label, value, delta, tone = 'neutral', footer, style }: StatTileProps) {
  const { palette } = useTheme();
  const toneColor =
    tone === 'positive'
      ? palette.success
      : tone === 'warning'
        ? palette.warning
        : tone === 'danger'
          ? palette.danger
          : tone === 'primary'
            ? palette.primary
            : palette.text;

  return (
    <View
      style={[
        styles.tile,
        { backgroundColor: palette.surface, borderColor: palette.borderSoft },
        style,
      ]}
    >
      <Text style={[styles.label, { color: palette.textSubtle }]}>{label}</Text>
      <Text style={[styles.value, { color: toneColor }]}>{value}</Text>
      {delta ? <Text style={[styles.delta, { color: palette.textMuted }]}>{delta}</Text> : null}
      {footer ? <Text style={[styles.footer, { color: palette.textSubtle }]}>{footer}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: 4,
    minWidth: 160,
    flex: 1,
  },
  label: {
    fontSize: typography.micro,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    fontWeight: '700',
  },
  value: {
    fontSize: typography.display,
    fontWeight: '800',
    marginTop: 4,
  },
  delta: {
    fontSize: typography.small,
    fontWeight: '600',
  },
  footer: {
    fontSize: typography.micro,
    marginTop: 2,
  },
});
