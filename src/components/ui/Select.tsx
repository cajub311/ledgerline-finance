import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { useTheme } from '../../theme/ThemeContext';
import { radius, spacing, typography } from '../../theme/tokens';

interface SelectOption<T extends string> {
  value: T;
  label: string;
  icon?: string;
}

interface SelectProps<T extends string> {
  label?: string;
  value: T;
  options: ReadonlyArray<SelectOption<T>>;
  onChange: (value: T) => void;
  style?: ViewStyle;
}

export function Select<T extends string>({ label, value, options, onChange, style }: SelectProps<T>) {
  const { palette } = useTheme();
  return (
    <View style={[styles.wrap, style]}>
      {label ? <Text style={[styles.label, { color: palette.textMuted }]}>{label}</Text> : null}
      <View style={styles.chips}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              style={({ hovered }) => [
                styles.chip,
                {
                  backgroundColor: selected ? palette.primary : palette.surfaceSunken,
                  borderColor: selected ? palette.primary : palette.border,
                  opacity: hovered && !selected ? 0.9 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: selected ? palette.primaryText : palette.text },
                ]}
              >
                {option.icon ? `${option.icon}  ` : ''}
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  label: {
    fontSize: typography.small,
    fontWeight: '600',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipText: {
    fontSize: typography.small,
    fontWeight: '600',
  },
});
