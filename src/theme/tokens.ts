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
  bg: '#0a0608',
  bgElevated: '#120c0e',
  surface: '#181113',
  surfaceRaised: '#221619',
  surfaceSunken: '#0d0809',
  border: '#3a2228',
  borderSoft: '#241418',
  text: '#f1e4cf',
  textMuted: '#a89074',
  textSubtle: '#6b5746',
  primary: '#c9a14a',
  primaryText: '#0a0608',
  primarySoft: 'rgba(201,161,74,0.14)',
  primaryStrong: '#e6bc5e',
  accent: '#7d2c2c',
  accentSoft: 'rgba(125,44,44,0.20)',
  success: '#5a9070',
  successSoft: 'rgba(90,144,112,0.16)',
  warning: '#c9a14a',
  warningSoft: 'rgba(201,161,74,0.18)',
  danger: '#9c3a3a',
  dangerSoft: 'rgba(156,58,58,0.18)',
  info: '#7e8a9c',
  infoSoft: 'rgba(126,138,156,0.18)',
  overlay: 'rgba(0,0,0,0.82)',
  heroGradientStart: '#1a0d10',
  heroGradientEnd: '#3a1a1f',
};

const light: ThemePalette = {
  bg: '#f1e8d4',
  bgElevated: '#f8f1de',
  surface: '#fbf4e0',
  surfaceRaised: '#ffffff',
  surfaceSunken: '#e7dcc4',
  border: '#b8a87f',
  borderSoft: '#d4c5a0',
  text: '#1a0d10',
  textMuted: '#5a4338',
  textSubtle: '#8a7460',
  primary: '#7d2c2c',
  primaryText: '#fbf4e0',
  primarySoft: 'rgba(125,44,44,0.10)',
  primaryStrong: '#5a1d1d',
  accent: '#a17a2a',
  accentSoft: 'rgba(161,122,42,0.14)',
  success: '#3d6b50',
  successSoft: 'rgba(61,107,80,0.10)',
  warning: '#9c6f1c',
  warningSoft: 'rgba(156,111,28,0.12)',
  danger: '#8a2828',
  dangerSoft: 'rgba(138,40,40,0.10)',
  info: '#4a566a',
  infoSoft: 'rgba(74,86,106,0.12)',
  overlay: 'rgba(26,13,16,0.50)',
  heroGradientStart: '#7d2c2c',
  heroGradientEnd: '#a17a2a',
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
  fontFamilyBody: '"Cormorant Garamond", "Iowan Old Style", Georgia, serif',
  fontFamilyUi: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  fontFamilyMono: '"IBM Plex Mono", "JetBrains Mono", ui-monospace, monospace',
} as const;

/** Elevation shadows. Web gets real box-shadow; native falls back to elevation. */
export function elevation(level: 1 | 2 | 3, mode: ThemeMode = 'dark') {
  if (Platform.OS === 'web') {
    if (mode === 'dark') {
      const blur = level === 1 ? 8 : level === 2 ? 22 : 44;
      const y = level === 1 ? 2 : level === 2 ? 12 : 26;
      const goldGlow = level === 3 ? ', 0 0 1px rgba(201,161,74,0.30)' : '';
      return {
        boxShadow: `0 ${y}px ${blur}px rgba(0,0,0,0.65)${goldGlow}` as unknown as undefined,
      };
    }
    const blur = level === 1 ? 6 : level === 2 ? 18 : 36;
    const y = level === 1 ? 2 : level === 2 ? 8 : 20;
    return {
      boxShadow: `0 ${y}px ${blur}px rgba(60,40,20,0.18)` as unknown as undefined,
    };
  }
  return { elevation: level * 2 };
}

export const categoryColors: Record<string, string> = {
  Income: '#5a9070',
  Housing: '#7d2c2c',
  Utilities: '#c9a14a',
  Groceries: '#5a7d8c',
  Dining: '#9c3a3a',
  Fuel: '#6b5a8c',
  Travel: '#3d6b6b',
  Subscriptions: '#8c4a7d',
  Shopping: '#c9743a',
  Health: '#a83a5a',
  Transfer: '#7e8a9c',
  Fees: '#7d2c2c',
  Savings: '#3d6b50',
  Other: '#8a7460',
};
