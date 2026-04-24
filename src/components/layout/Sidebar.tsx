import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme/ThemeContext';
import { radius, spacing, typography } from '../../theme/tokens';

export interface NavItem<T extends string> {
  value: T;
  label: string;
  icon: string;
  badge?: number;
  /** Optional grouping header that appears above this item. */
  section?: string;
}

export interface SidebarSummary {
  netWorth: string;
  liquidCash: string;
  trendLabel: string;
  trendPositive: boolean;
}

interface SidebarProps<T extends string> {
  items: ReadonlyArray<NavItem<T>>;
  activeValue: T;
  onSelect: (value: T) => void;
  householdName: string;
  compact?: boolean;
  summary?: SidebarSummary;
}

export function Sidebar<T extends string>({
  items,
  activeValue,
  onSelect,
  householdName,
  compact,
  summary,
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
        <View style={styles.topbarBrandRow}>
          <View style={[styles.brandMark, { backgroundColor: palette.primary }]}>
            <Text style={[styles.brandMarkText, { color: palette.primaryText }]}>L</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.brandName, { color: palette.text }]}>Ledgerline</Text>
            <Text style={[styles.brandTagline, { color: palette.textSubtle }]}>
              A PRIVATE LEDGER
            </Text>
            <Text style={[styles.brandSub, { color: palette.textSubtle }]} numberOfLines={1}>
              {householdName}
            </Text>
          </View>
          {summary ? (
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.topbarNet, { color: palette.text }]}>{summary.netWorth}</Text>
              <Text style={[styles.topbarLabel, { color: palette.textSubtle }]}>Net worth</Text>
            </View>
          ) : null}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.topbarScroll}
        >
          {items.map((item) => {
            const active = item.value === activeValue;
            return (
              <Pressable
                key={item.value}
                onPress={() => onSelect(item.value)}
                style={({ hovered }) => [
                  styles.pill,
                  {
                    backgroundColor: active ? palette.primary : palette.surfaceSunken,
                    borderColor: active ? palette.primary : palette.borderSoft,
                    opacity: hovered && !active ? 0.9 : 1,
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
        </ScrollView>
      </View>
    );
  }

  const grouped = groupBySection(items);

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
        <View style={{ flex: 1 }}>
          <Text style={[styles.brandName, { color: palette.text }]}>Ledgerline</Text>
          <Text style={[styles.brandTagline, { color: palette.textSubtle }]}>
            A PRIVATE LEDGER
          </Text>
          <Text style={[styles.brandSub, { color: palette.textSubtle }]} numberOfLines={1}>
            {householdName}
          </Text>
        </View>
      </View>

      {summary ? (
        <View
          style={[
            styles.summaryCard,
            {
              backgroundColor: palette.surfaceSunken,
              borderColor: palette.borderSoft,
            },
          ]}
        >
          <Text style={[styles.summaryLabel, { color: palette.textSubtle }]}>Net worth</Text>
          <Text style={[styles.summaryValue, { color: palette.text }]}>{summary.netWorth}</Text>
          <View style={styles.summarySplit}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.summaryMini, { color: palette.textSubtle }]}>Liquid cash</Text>
              <Text style={[styles.summaryMiniValue, { color: palette.text }]}>
                {summary.liquidCash}
              </Text>
            </View>
            <View
              style={[
                styles.trendChip,
                {
                  backgroundColor: summary.trendPositive
                    ? palette.successSoft
                    : palette.dangerSoft,
                },
              ]}
            >
              <Text
                style={{
                  color: summary.trendPositive ? palette.success : palette.danger,
                  fontWeight: '800',
                  fontSize: typography.micro,
                }}
              >
                {summary.trendLabel}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        {grouped.map(({ section, items: sectionItems }, sectionIndex) => (
          <View key={section || 'root'} style={{ gap: 4 }}>
            {section ? (
              <View style={{ gap: 4, marginTop: sectionIndex > 0 ? spacing.sm : 0 }}>
                {sectionIndex > 0 ? (
                  <View
                    style={{
                      height: 1,
                      backgroundColor: palette.borderSoft,
                      opacity: 0.5,
                      marginBottom: spacing.sm,
                    }}
                  />
                ) : null}
                <Text style={[styles.sectionHeader, { color: palette.textSubtle }]}>
                  {section}
                </Text>
              </View>
            ) : null}
            {sectionItems.map((item) => {
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
                  {active ? (
                    <View style={[styles.activeRail, { backgroundColor: palette.primary }]} />
                  ) : null}
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
        ))}
      </ScrollView>

      <View style={[styles.footerNote, { borderTopColor: palette.borderSoft }]}>
        <View style={styles.footerRow}>
          <Text style={[styles.footerTitle, { color: palette.text }]}>Local-first</Text>
          <View
            style={[
              styles.kbdChip,
              { backgroundColor: palette.surfaceSunken, borderColor: palette.borderSoft },
            ]}
          >
            <Text style={[styles.kbdText, { color: palette.textMuted }]}>⌘K</Text>
          </View>
        </View>
        <Text style={[styles.footerText, { color: palette.textSubtle }]}>
          Your ledger lives on this device. Press{' '}
          <Text style={{ fontFamily: typography.fontFamilyMono }}>⌘K</Text> (
          <Text style={{ fontFamily: typography.fontFamilyMono }}>Ctrl+K</Text> on
          Windows/Linux) to search commands.
        </Text>
      </View>
    </View>
  );
}

function groupBySection<T extends string>(
  items: ReadonlyArray<NavItem<T>>,
): Array<{ section: string | undefined; items: Array<NavItem<T>> }> {
  const out: Array<{ section: string | undefined; items: Array<NavItem<T>> }> = [];
  for (const item of items) {
    const last = out[out.length - 1];
    if (last && last.section === item.section) {
      last.items.push(item);
    } else {
      out.push({ section: item.section, items: [item] });
    }
  }
  return out;
}

const styles = StyleSheet.create({
  shell: {
    width: 260,
    padding: spacing.lg,
    gap: spacing.lg,
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
    fontWeight: '600',
    fontFamily: typography.fontFamilyDisplay,
  },
  brandName: {
    fontSize: typography.subtitle,
    fontWeight: '800',
    fontFamily: typography.fontFamilyDisplay,
    textTransform: 'uppercase',
    letterSpacing: 0.18 * typography.subtitle,
  },
  brandTagline: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.28 * 10,
    marginTop: 2,
  },
  brandSub: {
    fontSize: typography.micro,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  summaryCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: 4,
  },
  summaryLabel: {
    fontSize: typography.micro,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '700',
  },
  summaryValue: {
    fontSize: typography.title,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginTop: 2,
  },
  summarySplit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  summaryMini: {
    fontSize: typography.micro,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  summaryMiniValue: {
    fontSize: typography.body,
    fontWeight: '700',
    marginTop: 2,
  },
  trendChip: {
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sectionHeader: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.22 * 10,
    textTransform: 'uppercase',
    paddingHorizontal: spacing.sm,
    marginBottom: 4,
    marginTop: spacing.sm,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
    position: 'relative',
  },
  activeRail: {
    position: 'absolute',
    left: 2,
    top: 10,
    bottom: 10,
    width: 3,
    borderRadius: 2,
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
    paddingTop: spacing.md,
    borderTopWidth: 1,
    gap: 4,
  },
  footerTitle: {
    fontSize: typography.small,
    fontWeight: '800',
  },
  footerText: {
    fontSize: typography.micro,
    lineHeight: 16,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  kbdChip: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 'auto',
  },
  kbdText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
    fontFamily: typography.fontFamilyMono,
  },
  topbar: {
    borderBottomWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  topbarBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  topbarScroll: {
    gap: 6,
    paddingVertical: 2,
  },
  topbarNet: {
    fontSize: typography.body,
    fontWeight: '800',
  },
  topbarLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  pillIcon: {
    fontSize: 14,
  },
  pillLabel: {
    fontSize: typography.small,
    fontWeight: '700',
  },
});
