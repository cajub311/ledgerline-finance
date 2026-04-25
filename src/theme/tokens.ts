import { Platform } from 'react-native';

export type ThemeMode = 'light' | 'dark';

export interface ThemePalette {
  bg: string;
  bgElevated: string;
  surface: string;
  surfaceRaised: string;
  surfaceSunken: string;
  border: string;
  borderSoft: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  primary: string;
  primaryText: string;
  primarySoft: string;
  primaryStrong: string;
  accent: string;
  accentSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  info: string;
  infoSoft: string;
  overlay: string;
  /** Gradient stops used for hero cards (web only) */
  heroGradientStart: string;
  heroGradientEnd: string;
}

const dark: ThemePalette = {
  bg: '#0a0214',
  bgElevated: '#140524',
  surface: 'rgba(29,11,50,0.78)',
  surfaceRaised: 'rgba(42,18,68,0.86)',
  surfaceSunken: '#0f0618',
  border: '#5a2d8a',
  borderSoft: 'rgba(185,131,255,0.22)',
  text: '#e5d9ff',
  textMuted: '#a78fd4',
  textSubtle: '#6d5a92',
  primary: '#a855f7',
  primaryText: '#0a0214',
  primarySoft: 'rgba(168,85,247,0.22)',
  primaryStrong: '#c084fc',
  accent: '#e879f9',
  accentSoft: 'rgba(232,121,249,0.22)',
  success: '#6ee7b7',
  successSoft: 'rgba(110,231,183,0.16)',
  warning: '#fbbf24',
  warningSoft: 'rgba(251,191,36,0.18)',
  danger: '#f472b6',
  dangerSoft: 'rgba(244,114,182,0.18)',
  info: '#818cf8',
  infoSoft: 'rgba(129,140,248,0.18)',
  overlay: 'rgba(5,0,15,0.82)',
  heroGradientStart: '#2a004d',
  heroGradientEnd: '#5a00a3',
};

const light: ThemePalette = {
  bg: '#f4efff',
  bgElevated: '#faf7ff',
  surface: '#ffffff',
  surfaceRaised: '#ffffff',
  surfaceSunken: '#ede5fc',
  border: '#c4a6eb',
  borderSoft: '#ddc8f5',
  text: '#1a0b2e',
  textMuted: '#4a2e7a',
  textSubtle: '#7d5ba8',
  primary: '#7c3aed',
  primaryText: '#ffffff',
  primarySoft: 'rgba(124,58,237,0.10)',
  primaryStrong: '#5b21b6',
  accent: '#a855f7',
  accentSoft: 'rgba(168,85,247,0.14)',
  success: '#10b981',
  successSoft: 'rgba(16,185,129,0.10)',
  warning: '#d97706',
  warningSoft: 'rgba(217,119,6,0.12)',
  danger: '#db2777',
  dangerSoft: 'rgba(219,39,119,0.10)',
  info: '#4f46e5',
  infoSoft: 'rgba(79,70,229,0.10)',
  overlay: 'rgba(26,11,46,0.45)',
  heroGradientStart: '#7c3aed',
  heroGradientEnd: '#a855f7',
};

export const palettes: Record<ThemeMode, ThemePalette> = { light, dark };

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

export const typography = {
  displayXl: 42,
  displayLg: 34,
  display: 26,
  title: 20,
  subtitle: 16,
  body: 14,
  small: 12,
  micro: 11,
  fontFamilyDisplay: '"Cinzel", "Cormorant Garamond", Georgia, serif',
  fontFamilyRuneic: '"Uncial Antiqua", "Cinzel", Georgia, serif',
  fontFamilyBody: '"Cormorant Garamond", "Iowan Old Style", Georgia, serif',
  fontFamilyUi: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  fontFamilyMono: '"IBM Plex Mono", "JetBrains Mono", ui-monospace, monospace',
} as const;

/**
 * Violet neon glow strings. Use as `textShadow` / `boxShadow` values —
 * layered bloom gives display glyphs an illuminated-reliquary feel
 * against the deep-purple body gradient.
 */
export const neonGlow = {
  textSoft:
    '0 0 8px rgba(185,131,255,0.45), 0 0 18px rgba(122,0,255,0.30)',
  textStrong:
    '0 0 10px rgba(232,190,255,0.70), 0 0 22px rgba(168,85,247,0.55), 0 0 40px rgba(122,0,255,0.35)',
  ring: '0 0 28px rgba(168,85,247,0.35)',
  ringStrong:
    '0 0 44px rgba(168,85,247,0.55), 0 0 0 1px rgba(185,131,255,0.35) inset',
} as const;

/** Elevation shadows. Web gets real box-shadow; native falls back to elevation. */
export function elevation(level: 1 | 2 | 3, mode: ThemeMode = 'dark') {
  if (Platform.OS === 'web') {
    if (mode === 'dark') {
      const base =
        level === 1
          ? '0 2px 10px rgba(0,0,0,0.55), 0 0 16px rgba(168,85,247,0.08)'
          : level === 2
            ? '0 12px 28px rgba(0,0,0,0.60), 0 0 28px rgba(168,85,247,0.22)'
            : '0 24px 56px rgba(0,0,0,0.70), 0 0 48px rgba(168,85,247,0.32)';
      return {
        boxShadow: base as unknown as undefined,
      };
    }
    const blur = level === 1 ? 6 : level === 2 ? 18 : 36;
    const y = level === 1 ? 2 : level === 2 ? 8 : 20;
    return {
      boxShadow: `0 ${y}px ${blur}px rgba(60,30,90,0.18)` as unknown as undefined,
    };
  }
  return { elevation: level * 2 };
}

/**
 * Glassmorphism panel style — semi-transparent surface + web
 * `backdropFilter` blur. Whatever sits behind the panel (the radial
 * purple body gradient, the raven/cathedral illustrations) bleeds
 * through softly. No-op on native.
 */
export function glassSurface(mode: ThemeMode = 'dark') {
  if (Platform.OS === 'web' && mode === 'dark') {
    return {
      backdropFilter: 'blur(14px) saturate(140%)',
      WebkitBackdropFilter: 'blur(14px) saturate(140%)',
    } as unknown as Record<string, string>;
  }
  return {} as Record<string, string>;
}

export const categoryColors: Record<string, string> = {
  Income: '#6ee7b7',
  Housing: '#a855f7',
  Utilities: '#fbbf24',
  Groceries: '#38bdf8',
  Dining: '#f472b6',
  Fuel: '#fb7185',
  Travel: '#2dd4bf',
  Subscriptions: '#e879f9',
  Shopping: '#fb923c',
  Health: '#f472b6',
  Transfer: '#a78fd4',
  Fees: '#f87171',
  Savings: '#34d399',
  Other: '#9ca3af',
};
