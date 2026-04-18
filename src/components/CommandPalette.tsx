import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useTheme } from '../theme/ThemeContext';
import { elevation, radius, spacing, typography } from '../theme/tokens';
import { useHotkeys } from '../hooks/useHotkeys';

export interface CommandAction {
  id: string;
  /** Primary label ("Go to Dashboard"). */
  label: string;
  /** Optional secondary line ("Overview · 🏠"). */
  hint?: string;
  /** Optional leading emoji/icon. */
  icon?: string;
  /** Shortcut chord to display ("⌘K", "G D", etc.). Visual only. */
  shortcut?: string;
  /** Search synonyms beyond label/hint. */
  keywords?: string[];
  /** Section header ("Navigate", "Data", "Tools"). */
  section: string;
  /** Runs when the user picks the command. */
  run: () => void;
}

interface CommandPaletteProps {
  actions: CommandAction[];
}

/**
 * Global ⌘K / Ctrl+K command palette. Rendered only on web.
 * Actions come from the hosting app so this component stays decoupled.
 */
export function CommandPalette({ actions }: CommandPaletteProps) {
  const isWeb = Platform.OS === 'web';
  const { palette, mode } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<TextInput>(null);

  useHotkeys(
    useMemo(
      () => [
        {
          key: 'k',
          mod: true,
          allowInInput: true,
          handler: () => {
            setOpen((v) => !v);
          },
        },
        {
          key: '?',
          shift: true,
          handler: () => {
            setOpen((v) => !v);
          },
        },
      ],
      [],
    ),
  );

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setCursor(0);
    const timer = setTimeout(() => inputRef.current?.focus(), 10);
    return () => clearTimeout(timer);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter((action) => {
      const hay = `${action.label} ${action.hint ?? ''} ${(action.keywords ?? []).join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [actions, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, CommandAction[]>();
    for (const action of filtered) {
      const list = map.get(action.section) ?? [];
      list.push(action);
      map.set(action.section, list);
    }
    return Array.from(map.entries());
  }, [filtered]);

  useEffect(() => {
    if (cursor >= filtered.length) setCursor(Math.max(0, filtered.length - 1));
  }, [cursor, filtered.length]);

  const runAt = (index: number) => {
    const action = filtered[index];
    if (!action) return;
    setOpen(false);
    setTimeout(() => action.run(), 0);
  };

  useHotkeys(
    useMemo(
      () =>
        open
          ? [
              {
                key: 'ArrowDown',
                allowInInput: true,
                handler: () => setCursor((c) => Math.min(filtered.length - 1, c + 1)),
              },
              {
                key: 'ArrowUp',
                allowInInput: true,
                handler: () => setCursor((c) => Math.max(0, c - 1)),
              },
              {
                key: 'Enter',
                allowInInput: true,
                handler: () => runAt(cursor),
              },
              {
                key: 'Escape',
                allowInInput: true,
                handler: () => setOpen(false),
              },
            ]
          : [],
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [open, filtered.length, cursor],
    ),
  );

  if (!isWeb || !open) return null;

  let runningIndex = -1;

  return (
    <View
      style={[styles.overlay, { backgroundColor: palette.overlay }]}
      accessibilityLabel="Command palette"
    >
      <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setOpen(false)} />
      <View
        style={[
          styles.panel,
          elevation(3, mode),
          {
            backgroundColor: palette.surface,
            borderColor: palette.borderSoft,
          },
        ]}
      >
        <View style={[styles.searchRow, { borderBottomColor: palette.borderSoft }]}>
          <Text style={{ color: palette.textSubtle, fontSize: 18, marginRight: 8 }}>⌘</Text>
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder="Type a command or search…"
            placeholderTextColor={palette.textSubtle}
            style={[
              styles.searchInput,
              { color: palette.text },
            ]}
            autoFocus
            accessibilityLabel="Command palette search"
          />
          <Text style={[styles.escHint, { color: palette.textSubtle, borderColor: palette.borderSoft }]}>
            Esc
          </Text>
        </View>
        <View style={styles.list}>
          {filtered.length === 0 ? (
            <View style={{ padding: spacing.lg }}>
              <Text style={{ color: palette.textSubtle, fontSize: typography.small }}>
                No commands match "{query}".
              </Text>
            </View>
          ) : (
            grouped.map(([section, items]) => (
              <View key={section} style={{ paddingVertical: 4 }}>
                <Text
                  style={[
                    styles.sectionLabel,
                    { color: palette.textSubtle },
                  ]}
                >
                  {section}
                </Text>
                {items.map((action) => {
                  runningIndex += 1;
                  const idx = runningIndex;
                  const active = idx === cursor;
                  return (
                    <Pressable
                      key={action.id}
                      onPress={() => runAt(idx)}
                      onHoverIn={() => setCursor(idx)}
                      accessibilityRole="button"
                      accessibilityLabel={action.label}
                      style={[
                        styles.item,
                        {
                          backgroundColor: active ? palette.primarySoft : 'transparent',
                        },
                      ]}
                    >
                      <Text style={styles.itemIcon}>{action.icon ?? '›'}</Text>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            color: active ? palette.primary : palette.text,
                            fontWeight: active ? '800' : '600',
                            fontSize: typography.body,
                          }}
                        >
                          {action.label}
                        </Text>
                        {action.hint ? (
                          <Text
                            style={{
                              color: palette.textSubtle,
                              fontSize: typography.micro,
                              marginTop: 2,
                            }}
                          >
                            {action.hint}
                          </Text>
                        ) : null}
                      </View>
                      {action.shortcut ? (
                        <Text
                          style={[
                            styles.shortcut,
                            { color: palette.textSubtle, borderColor: palette.borderSoft },
                          ]}
                        >
                          {action.shortcut}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ))
          )}
        </View>
        <View
          style={[
            styles.footer,
            { borderTopColor: palette.borderSoft },
          ]}
        >
          <Text style={{ color: palette.textSubtle, fontSize: typography.micro }}>
            ↑↓ navigate · ↵ run · Esc close
          </Text>
          <Text style={{ color: palette.textSubtle, fontSize: typography.micro }}>
            {filtered.length} / {actions.length}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 100,
    zIndex: 2000,
  },
  panel: {
    width: '100%',
    maxWidth: 620,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    paddingVertical: 4,
  },
  escHint: {
    fontSize: 11,
    fontWeight: '700',
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  list: {
    maxHeight: 420,
    paddingVertical: spacing.xs,
    overflow: 'scroll',
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: 4,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
  },
  itemIcon: {
    fontSize: 18,
    width: 24,
    textAlign: 'center',
  },
  shortcut: {
    fontSize: 11,
    fontWeight: '700',
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
});
