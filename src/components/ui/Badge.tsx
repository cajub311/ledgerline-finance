import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme/ThemeContext';
import { radius, typography } from '../../theme/tokens';

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
}

export function Badge({ label, tone = 'neutral' }: BadgeProps) {
  const { palette } = useTheme();
  const { bg, fg } =
    tone === 'primary'
      ? { bg: palette.primarySoft, fg: palette.primary }
      : tone === 'success'
        ? { bg: palette.successSoft, fg: palette.success }
        : tone === 'warning'
          ? { bg: palette.warningSoft, fg: palette.warning }
          : tone === 'danger'
            ? { bg: palette.dangerSoft, fg: palette.danger }
            : tone === 'info'
              ? { bg: palette.primarySoft, fg: palette.info }
              : { bg: palette.surfaceSunken, fg: palette.textMuted };

  return (
    <View style={[styles.shell, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: typography.micro,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
