import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme/ThemeContext';
import { radius, spacing, typography } from '../../theme/tokens';

export interface NavItem<T extends string> {
  value: T;
  label: string;
  icon: string;
  badge?: number;
}

interface SidebarProps<T extends string> {
  items: ReadonlyArray<NavItem<T>>;
  activeValue: T;
  onSelect: (value: T) => void;
  householdName: string;
  compact?: boolean;
}

export function Sidebar<T extends string>({
  items,
  activeValue,
  onSelect,
  householdName,
  compact,
}: SidebarProps<T>) {
  const { palette } = useTheme();

  if (compact) {
    return (
      <View
        style={[
          styles.topbar,
          { backgroundColor: palette.surface, borderColor: palette.borderSoft },
        ]}
      >
        <View style={styles.topbarItems}>
          {items.map((item) => {
            const active = item.value === activeValue;
            return (
              <Pressable
                key={item.value}
                onPress={() => onSelect(item.value)}
                style={({ hovered }) => [
                  styles.pill,
                  {
                    backgroundColor: active ? palette.primary : 'transparent',
                    opacity: hovered && !active ? 0.8 : 1,
                  },
                ]}
              >
                <Text style={styles.pillIcon}>{item.icon}</Text>
                <Text
                  style={[
                    styles.pillLabel,
                    { color: active ? palette.primaryText : palette.textMuted },
                  ]}
                >
                  {item.label}
                </Text>
                {item.badge ? (
                  <View
                    style={[
                      styles.badge,
                      {
                        backgroundColor: active ? palette.primaryText : palette.primary,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        { color: active ? palette.primary : palette.primaryText },
                      ]}
                    >
                      {item.badge}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.shell,
        { backgroundColor: palette.surface, borderColor: palette.borderSoft },
      ]}
    >
      <View style={styles.brand}>
        <View style={[styles.brandMark, { backgroundColor: palette.primary }]}>
          <Text style={[styles.brandMarkText, { color: palette.primaryText }]}>L</Text>
        </View>
        <View>
          <Text style={[styles.brandName, { color: palette.text }]}>Ledgerline</Text>
          <Text style={[styles.brandSub, { color: palette.textSubtle }]}>{householdName}</Text>
        </View>
      </View>

      <View style={{ gap: 4 }}>
        {items.map((item) => {
          const active = item.value === activeValue;
          return (
            <Pressable
              key={item.value}
              onPress={() => onSelect(item.value)}
              style={({ hovered }) => [
                styles.item,
                {
                  backgroundColor: active
                    ? palette.primarySoft
                    : hovered
                      ? palette.surfaceSunken
                      : 'transparent',
                },
              ]}
            >
              <Text style={styles.icon}>{item.icon}</Text>
              <Text
                style={[
                  styles.label,
                  { color: active ? palette.primary : palette.textMuted },
                  active && { fontWeight: '800' },
                ]}
              >
                {item.label}
              </Text>
              {item.badge ? (
                <View style={[styles.badgeInline, { backgroundColor: palette.primary }]}>
                  <Text style={[styles.badgeText, { color: palette.primaryText }]}>
                    {item.badge}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.footerNote}>
        <Text style={[styles.footerTitle, { color: palette.text }]}>Local-first</Text>
        <Text style={[styles.footerText, { color: palette.textSubtle }]}>
          Your ledger lives in this browser. Export JSON or CSV from Import any time.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: 240,
    padding: spacing.lg,
    gap: spacing.xl,
    borderRightWidth: 1,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  brandMark: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMarkText: {
    fontSize: typography.subtitle,
    fontWeight: '800',
  },
  brandName: {
    fontSize: typography.subtitle,
    fontWeight: '800',
  },
  brandSub: {
    fontSize: typography.micro,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  icon: {
    fontSize: 18,
  },
  label: {
    fontSize: typography.body,
    fontWeight: '600',
    flex: 1,
  },
  badgeInline: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    minWidth: 18,
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill,
    minWidth: 16,
    alignItems: 'center',
    marginLeft: 2,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  footerNote: {
    marginTop: 'auto',
    paddingTop: spacing.lg,
    gap: 4,
  },
  footerTitle: {
    fontSize: typography.small,
    fontWeight: '700',
  },
  footerText: {
    fontSize: typography.micro,
    lineHeight: 16,
  },
  topbar: {
    borderBottomWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  topbarItems: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  pillIcon: {
    fontSize: 14,
  },
  pillLabel: {
    fontSize: typography.small,
    fontWeight: '700',
  },
});
