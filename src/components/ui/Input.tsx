import { StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';

import { useTheme } from '../../theme/ThemeContext';
import { radius, spacing, typography } from '../../theme/tokens';

interface InputProps extends TextInputProps {
  label?: string;
  hint?: string;
  containerStyle?: ViewStyle;
}

export function Input({ label, hint, containerStyle, style, ...props }: InputProps) {
  const { palette } = useTheme();
  return (
    <View style={[styles.wrap, containerStyle]}>
      {label ? <Text style={[styles.label, { color: palette.textMuted }]}>{label}</Text> : null}
      <TextInput
        {...props}
        placeholderTextColor={palette.textSubtle}
        style={[
          styles.field,
          {
            backgroundColor: palette.surfaceSunken,
            borderColor: palette.border,
            color: palette.text,
          },
          style,
        ]}
      />
      {hint ? <Text style={[styles.hint, { color: palette.textSubtle }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
  },
  label: {
    fontSize: typography.small,
    fontWeight: '600',
  },
  field: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: typography.body,
  },
  hint: {
    fontSize: typography.micro,
  },
});
