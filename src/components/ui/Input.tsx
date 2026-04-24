import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';

import { useTheme } from '../../theme/ThemeContext';
import { radius, spacing, typography } from '../../theme/tokens';

interface InputProps extends TextInputProps {
  label?: string;
  hint?: string;
  containerStyle?: ViewStyle;
}

export function Input({ label, hint, containerStyle, style, onFocus, onBlur, keyboardType, ...props }: InputProps) {
  const { palette } = useTheme();
  const [focused, setFocused] = useState(false);

  const isNumeric = keyboardType === 'numeric' || keyboardType === 'decimal-pad';

  return (
    <View style={[styles.wrap, containerStyle]}>
      {label ? <Text style={[styles.label, { color: palette.textSubtle }]}>{label}</Text> : null}
      <TextInput
        {...props}
        keyboardType={keyboardType}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        placeholderTextColor={palette.textSubtle}
        style={[
          styles.field,
          {
            backgroundColor: palette.surfaceSunken,
            borderColor: focused ? palette.primary : palette.border,
            color: palette.text,
            fontFamily: isNumeric ? typography.fontFamilyMono : undefined,
            ...(focused
              ? ({ outlineColor: palette.primary, outlineWidth: 2, outlineStyle: 'solid' } as unknown as object)
              : null),
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
    fontSize: typography.micro,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  field: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: typography.body,
  },
  hint: {
    fontSize: typography.micro,
  },
});
