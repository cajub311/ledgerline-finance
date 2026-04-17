import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { useTheme } from '../../theme/ThemeContext';
import { elevation, radius, spacing, typography } from '../../theme/tokens';

interface CardProps {
  title?: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  padding?: number;
  style?: ViewStyle;
  /** Visual elevation 0..2 (0 = flat with border only). Defaults to 1. */
  elevation?: 0 | 1 | 2;
}

export function Card({
  title,
  eyebrow,
  action,
  children,
  padding = spacing.xl,
  style,
  elevation: level = 1,
}: CardProps) {
  const { palette, mode } = useTheme();
  return (
    <View
      style={[
        styles.shell,
        {
          backgroundColor: palette.surface,
          borderColor: palette.borderSoft,
          padding,
        },
        level === 0 ? undefined : elevation(level === 1 ? 1 : 2, mode),
        style,
      ]}
    >
      {(title || action || eyebrow) && (
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            {eyebrow ? (
              <Text style={[styles.eyebrow, { color: palette.textSubtle }]}>{eyebrow}</Text>
            ) : null}
            {title ? <Text style={[styles.title, { color: palette.text }]}>{title}</Text> : null}
          </View>
          {action}
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  eyebrow: {
    fontSize: typography.micro,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    fontWeight: '700',
    marginBottom: 4,
  },
  title: {
    fontSize: typography.subtitle,
    fontWeight: '700',
  },
});
