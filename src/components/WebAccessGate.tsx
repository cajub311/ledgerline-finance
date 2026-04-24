import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Input } from './ui/Input';
import { useTheme } from '../theme/ThemeContext';
import { radius, spacing, typography } from '../theme/tokens';

/** Site unlock for static web hosting (e.g. Vercel). Cleared when the browser tab closes. */
const WEB_ACCESS_PASSWORD = '1188';
const WEB_ACCESS_SESSION_KEY = 'ledgerline/web-unlocked';

function readInitialUnlocked(): boolean {
  if (Platform.OS !== 'web') return true;
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(WEB_ACCESS_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function WebAccessGate({ children }: { children: ReactNode }) {
  const { palette } = useTheme();
  const [unlocked, setUnlocked] = useState(readInitialUnlocked);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(() => {
    if (password === WEB_ACCESS_PASSWORD) {
      try {
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(WEB_ACCESS_SESSION_KEY, '1');
        }
      } catch {
        // still unlock for this session in memory
      }
      setError(null);
      setPassword('');
      setUnlocked(true);
      return;
    }
    setError('Incorrect password.');
    setPassword('');
  }, [password]);

  if (Platform.OS !== 'web' || unlocked) {
    return <>{children}</>;
  }

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: palette.surface,
            borderColor: palette.border,
          },
        ]}
      >
        <Text style={[styles.title, { color: palette.text }]}>Ledger Line</Text>
        <Text style={[styles.subtitle, { color: palette.textMuted }]}>
          Enter the site password to continue.
        </Text>
        <Input
          label="Password"
          value={password}
          onChangeText={(t) => {
            setPassword(t);
            if (error) setError(null);
          }}
          onSubmitEditing={submit}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          textContentType="password"
          returnKeyType="go"
          accessibilityLabel="Site password"
        />
        {error ? (
          <Text style={[styles.error, { color: palette.danger }]} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
        <Pressable
          onPress={submit}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: palette.primary, opacity: pressed ? 0.88 : 1 },
          ]}
        >
          <Text style={[styles.buttonLabel, { color: palette.primaryText }]}>Unlock</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: {
    fontSize: typography.title,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: typography.small,
    marginBottom: spacing.sm,
  },
  error: {
    fontSize: typography.small,
    fontWeight: '600',
  },
  button: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonLabel: {
    fontSize: typography.body,
    fontWeight: '700',
  },
});
