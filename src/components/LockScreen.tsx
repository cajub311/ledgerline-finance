import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from './ui/Button';
import { useTheme } from '../theme/ThemeContext';
import {
  elevation,
  glassSurface,
  neonGlow,
  radius,
  spacing,
  typography,
} from '../theme/tokens';

const SESSION_KEY = 'ledgerline/session-unlocked';
const PASSWORD = '11';

/**
 * Read whether the current browser tab has already been unlocked.
 * Uses sessionStorage so a refresh in the same tab does NOT re-prompt
 * (annoying), but a brand-new tab / window does. On native we always
 * start locked — the screen-lock UX matters less there because the OS
 * handles app re-entry.
 */
function readUnlocked(): boolean {
  if (Platform.OS !== 'web') return false;
  try {
    return window.sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

function writeUnlocked() {
  if (Platform.OS !== 'web') return;
  try {
    window.sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    // sessionStorage can throw in private mode — caller falls through
    // and the app stays unlocked for this render anyway.
  }
}

export function useLock() {
  const [unlocked, setUnlocked] = useState<boolean>(() => readUnlocked());
  useEffect(() => {
    if (unlocked) writeUnlocked();
  }, [unlocked]);
  return { unlocked, unlock: () => setUnlocked(true) };
}

interface LockScreenProps {
  onUnlock: () => void;
}

export function LockScreen({ onUnlock }: LockScreenProps) {
  const { palette, mode } = useTheme();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  const submit = () => {
    if (value.trim() === PASSWORD) {
      setError(null);
      onUnlock();
      return;
    }
    setError('Incorrect passphrase. Try again.');
    setValue('');
  };

  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: palette.surface,
            borderColor: palette.borderSoft,
          },
          glassSurface(mode),
          elevation(3, mode),
        ]}
      >
        <View
          style={[
            styles.crest,
            { backgroundColor: palette.primary },
            mode === 'dark'
              ? ({ boxShadow: neonGlow.ringStrong } as unknown as Record<string, string>)
              : null,
          ]}
        >
          <Text
            style={[
              styles.crestGlyph,
              { color: palette.primaryText, fontFamily: typography.fontFamilyRuneic },
            ]}
          >
            L
          </Text>
        </View>

        <Text
          style={[
            styles.brand,
            { color: palette.text, fontFamily: typography.fontFamilyDisplay },
            mode === 'dark'
              ? ({ textShadow: neonGlow.textStrong } as unknown as Record<string, string>)
              : null,
          ]}
        >
          Ledgerline
        </Text>
        <Text style={[styles.tagline, { color: palette.textSubtle }]}>
          Sealed
        </Text>

        <Text style={[styles.copy, { color: palette.textMuted }]}>
          Enter the passphrase to unseal the ledger.
        </Text>

        <Text style={[styles.label, { color: palette.textSubtle }]}>Passphrase</Text>
        <TextInput
          value={value}
          onChangeText={(next) => {
            setValue(next);
            if (error) setError(null);
          }}
          onSubmitEditing={submit}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          secureTextEntry
          autoFocus
          placeholder="••"
          placeholderTextColor={palette.textSubtle}
          style={[
            styles.input,
            {
              color: palette.text,
              backgroundColor: palette.surfaceSunken,
              borderColor: focused ? palette.primary : palette.border,
              fontFamily: typography.fontFamilyMono,
            },
            Platform.OS === 'web' && focused
              ? ({
                  outlineColor: palette.primary,
                  outlineStyle: 'solid',
                  outlineWidth: 2,
                  outlineOffset: 2,
                } as unknown as Record<string, string>)
              : null,
          ]}
          accessibilityLabel="Passphrase"
        />

        {error ? (
          <Text style={[styles.error, { color: palette.danger }]}>{error}</Text>
        ) : null}

        <Button label="Unseal the ledger" fullWidth onPress={submit} />

        <Text style={[styles.footnote, { color: palette.textSubtle }]}>
          Local-only · the passphrase never leaves this device.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.xxl,
    gap: spacing.md,
    alignItems: 'stretch',
  },
  crest: {
    width: 64,
    height: 64,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  crestGlyph: {
    fontSize: 32,
    fontWeight: '600',
  },
  brand: {
    fontSize: typography.displayLg,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 4,
    textAlign: 'center',
  },
  tagline: {
    fontSize: typography.micro,
    textTransform: 'uppercase',
    letterSpacing: 4,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  copy: {
    fontSize: typography.body,
    textAlign: 'center',
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  label: {
    fontSize: typography.micro,
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    fontWeight: '700',
    marginBottom: -spacing.xs,
  },
  input: {
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: typography.subtitle,
    letterSpacing: 4,
    textAlign: 'center',
  },
  error: {
    fontSize: typography.small,
    textAlign: 'center',
    marginTop: -spacing.xs,
  },
  footnote: {
    fontSize: typography.micro,
    textAlign: 'center',
    marginTop: spacing.sm,
    letterSpacing: 0.4,
  },
});
