import type { ReactNode } from 'react';
import { Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { useTheme } from '../../theme/ThemeContext';
import { radius, spacing, typography } from '../../theme/tokens';

interface CardProps {
  title?: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  padding?: number;
  style?: ViewStyle;
}

export function Card({ title, eyebrow, action, children, padding = spacing.xl, style }: CardProps) {
  const { palette } = useTheme();
  const webShadow =
    Platform.OS === 'web'
      ? ({
          boxShadow: `0 1px 0 ${palette.borderSoft}, 0 12px 28px -18px ${palette.overlay}`,
        } as ViewStyle)
      : null;

  return (
    <View
      style={[
        styles.shell,
        {
          backgroundColor: palette.surface,
          borderColor: palette.borderSoft,
          padding,
        },
        webShadow,
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
