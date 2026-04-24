import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { useTheme } from '../../theme/ThemeContext';
import { radius, spacing, typography } from '../../theme/tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  style?: ViewStyle;
  fullWidth?: boolean;
  /** Overrides the default accessibilityLabel (which is the visible label). */
  accessibilityLabel?: string;
  /** Optional longer description for screen readers. */
  accessibilityHint?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  leading,
  trailing,
  style,
  fullWidth,
  accessibilityLabel,
  accessibilityHint,
}: ButtonProps) {
  const { palette } = useTheme();

  const bg =
    variant === 'primary'
      ? palette.primary
      : variant === 'danger'
        ? palette.danger
        : variant === 'success'
          ? palette.success
          : variant === 'secondary'
            ? palette.surfaceRaised
            : 'transparent';

  const color =
    variant === 'primary'
      ? palette.primaryText
      : variant === 'danger' || variant === 'success'
        ? '#fff'
        : variant === 'ghost'
          ? palette.textMuted
          : palette.text;

  const borderColor =
    variant === 'primary'
      ? palette.primaryStrong
      : variant === 'secondary'
        ? palette.border
        : variant === 'ghost'
          ? 'transparent'
          : variant === 'danger'
            ? palette.danger
            : variant === 'success'
              ? palette.success
              : bg;

  const hoverBorderColor =
    variant === 'ghost' || variant === 'secondary' ? palette.border : borderColor;

  const paddingV = size === 'sm' ? 6 : size === 'lg' ? 14 : 10;
  const paddingH = size === 'sm' ? 12 : size === 'lg' ? 22 : 16;
  const fontSize = size === 'sm' ? typography.small : typography.body;

  const shadow =
    Platform.OS === 'web' && (variant === 'primary' || variant === 'danger' || variant === 'success')
      ? ({
          boxShadow:
            '0 1px 0 rgba(255,220,150,0.25) inset, 0 2px 8px rgba(0,0,0,0.4)',
        } as unknown as ViewStyle)
      : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(disabled) }}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed, hovered }) => [
        styles.shell,
        {
          backgroundColor: bg,
          borderColor: hovered ? hoverBorderColor : borderColor,
          paddingVertical: paddingV,
          paddingHorizontal: paddingH,
          opacity: disabled ? 0.5 : pressed ? 0.85 : hovered ? 0.92 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          width: fullWidth ? '100%' : undefined,
        },
        shadow,
        style,
      ]}
    >
      {leading ? <View>{leading}</View> : null}
      <Text
        style={[
          styles.label,
          {
            color,
            fontSize,
            fontFamily: typography.fontFamilyUi,
          },
        ]}
      >
        {label}
      </Text>
      {trailing ? <View>{trailing}</View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  label: {
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
});
