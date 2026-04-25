import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { Sparkline } from '../charts/Sparkline';
import { useTheme } from '../../theme/ThemeContext';
import {
  elevation,
  glassSurface,
  neonGlow,
  radius,
  spacing,
  typography,
} from '../../theme/tokens';

export type StatTone = 'neutral' | 'positive' | 'warning' | 'danger' | 'primary';

interface StatTileProps {
  label: string;
  value: string;
  delta?: string;
  tone?: StatTone;
  footer?: string;
  style?: ViewStyle;
  /** Optional at-a-glance trend rendered at the bottom of the tile. */
  sparkline?: number[];
}

export function StatTile({
  label,
  value,
  delta,
  tone = 'neutral',
  footer,
  style,
  sparkline,
}: StatTileProps) {
  const { palette, mode } = useTheme();
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
        glassSurface(mode),
        elevation(1, mode),
        style,
      ]}
    >
      <Text style={[styles.label, { color: palette.textSubtle }]}>{label}</Text>
      <Text
        style={[
          styles.value,
          { color: toneColor, fontFamily: typography.fontFamilyMono },
          mode === 'dark' && tone !== 'neutral'
            ? ({ textShadow: neonGlow.textStrong } as unknown as ViewStyle)
            : mode === 'dark'
              ? ({ textShadow: neonGlow.textSoft } as unknown as ViewStyle)
              : null,
        ]}
      >
        {value}
      </Text>
      {delta ? (
        <Text
          style={[
            styles.delta,
            { color: palette.textMuted, fontFamily: typography.fontFamilyMono },
          ]}
        >
          {delta}
        </Text>
      ) : null}
      {footer ? <Text style={[styles.footer, { color: palette.textSubtle }]}>{footer}</Text> : null}
      {sparkline && sparkline.length > 1 ? (
        <View style={styles.spark}>
          <Sparkline values={sparkline} color={toneColor} height={26} />
        </View>
      ) : null}
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
    letterSpacing: 2.4,
    fontWeight: '700',
  },
  value: {
    fontSize: typography.display,
    fontWeight: '600',
    letterSpacing: -0.4,
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
  spark: {
    marginTop: spacing.sm,
  },
});
