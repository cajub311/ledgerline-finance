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
  bg: '#07090f',
  bgElevated: '#0c111d',
  surface: '#111827',
  surfaceRaised: '#18223a',
  surfaceSunken: '#0a0f1c',
  border: '#27324d',
  borderSoft: '#1b2238',
  text: '#f4f6ff',
  textMuted: '#b9c1db',
  textSubtle: '#7a859f',
  primary: '#7c8cff',
  primaryText: '#0a0f1c',
  primarySoft: 'rgba(124,140,255,0.16)',
  primaryStrong: '#5467ff',
  accent: '#8d7dff',
  accentSoft: 'rgba(141,125,255,0.18)',
  success: '#34d399',
  successSoft: 'rgba(52,211,153,0.15)',
  warning: '#f5b44b',
  warningSoft: 'rgba(245,180,75,0.18)',
  danger: '#ff6e7f',
  dangerSoft: 'rgba(255,110,127,0.16)',
  info: '#58b7ff',
  infoSoft: 'rgba(88,183,255,0.16)',
  overlay: 'rgba(2,4,10,0.72)',
  heroGradientStart: '#5467ff',
  heroGradientEnd: '#8d7dff',
};

const light: ThemePalette = {
  bg: '#f4f5fb',
  bgElevated: '#ffffff',
  surface: '#ffffff',
  surfaceRaised: '#ffffff',
  surfaceSunken: '#eef1f8',
  border: '#dde3ee',
  borderSoft: '#ebeef6',
  text: '#0f1428',
  textMuted: '#454d69',
  textSubtle: '#7b849f',
  primary: '#4a5bf0',
  primaryText: '#ffffff',
  primarySoft: 'rgba(74,91,240,0.10)',
  primaryStrong: '#3345d4',
  accent: '#7b6dff',
  accentSoft: 'rgba(123,109,255,0.12)',
  success: '#12a26a',
  successSoft: 'rgba(18,162,106,0.10)',
  warning: '#c77512',
  warningSoft: 'rgba(199,117,18,0.12)',
  danger: '#c83a31',
  dangerSoft: 'rgba(200,58,49,0.10)',
  info: '#1f8fd1',
  infoSoft: 'rgba(31,143,209,0.12)',
  overlay: 'rgba(16,20,35,0.40)',
  heroGradientStart: '#4a5bf0',
  heroGradientEnd: '#7b6dff',
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
} as const;

/** Elevation shadows. Web gets real box-shadow; native falls back to elevation. */
export function elevation(level: 1 | 2 | 3, mode: ThemeMode = 'dark') {
  if (Platform.OS === 'web') {
    const alpha = mode === 'dark' ? 0.55 : 0.14;
    const blur = level === 1 ? 8 : level === 2 ? 20 : 40;
    const y = level === 1 ? 2 : level === 2 ? 10 : 24;
    return {
      boxShadow: `0 ${y}px ${blur}px rgba(5, 10, 30, ${alpha})` as unknown as undefined,
    };
  }
  return {
    elevation: level * 2,
  };
}

export const categoryColors: Record<string, string> = {
  Income: '#34d399',
  Housing: '#7c8cff',
  Utilities: '#f5b44b',
  Groceries: '#58b7ff',
  Dining: '#ff6e7f',
  Fuel: '#8d7dff',
  Travel: '#2ad1c3',
  Subscriptions: '#d26de6',
  Shopping: '#ff9f4a',
  Health: '#e05784',
  Transfer: '#7a859f',
  Fees: '#b85252',
  Savings: '#2fb8a0',
  Other: '#9099b5',
};
