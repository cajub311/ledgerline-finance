import { useEffect, useRef } from 'react';
import { Platform, StyleSheet, Text, TextInput, View, type ViewStyle } from 'react-native';

import { useTheme } from '../../theme/ThemeContext';
import { radius, spacing, typography } from '../../theme/tokens';

interface DateInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  containerStyle?: ViewStyle;
  hint?: string;
}

export function DateInput({ label, value, onChange, containerStyle, hint }: DateInputProps) {
  const { palette, mode } = useTheme();
  const ref = useRef<HTMLInputElement | null>(null);
  const lastValue = useRef(value);

  useEffect(() => {
    if (ref.current && lastValue.current !== value) {
      ref.current.value = value || '';
      lastValue.current = value;
    }
  }, [value]);

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.wrap, containerStyle]}>
        {label ? <Text style={[styles.label, { color: palette.textMuted }]}>{label}</Text> : null}
        {/* eslint-disable-next-line react/forbid-elements */}
        <input
          ref={(el) => {
            ref.current = el;
          }}
          type="date"
          defaultValue={value}
          onChange={(event) => {
            const next = event.currentTarget.value;
            lastValue.current = next;
            onChange(next);
          }}
          style={{
            backgroundColor: palette.surfaceSunken,
            border: `1px solid ${palette.border}`,
            borderRadius: radius.md,
            color: palette.text,
            padding: '10px 12px',
            fontSize: typography.body,
            fontFamily: 'inherit',
            colorScheme: mode === 'dark' ? 'dark' : 'light',
            outline: 'none',
            width: '100%',
            boxSizing: 'border-box',
          }}
        />
        {hint ? <Text style={[styles.hint, { color: palette.textSubtle }]}>{hint}</Text> : null}
      </View>
    );
  }

  return (
    <View style={[styles.wrap, containerStyle]}>
      {label ? <Text style={[styles.label, { color: palette.textMuted }]}>{label}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={palette.textSubtle}
        style={[
          styles.field,
          {
            backgroundColor: palette.surfaceSunken,
            borderColor: palette.border,
            color: palette.text,
          },
        ]}
      />
      {hint ? <Text style={[styles.hint, { color: palette.textSubtle }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: typography.small, fontWeight: '600' },
  field: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: typography.body,
  },
  hint: { fontSize: typography.micro },
});
