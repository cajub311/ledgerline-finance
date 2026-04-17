export type ThemeMode = 'light' | 'dark';

export interface ThemePalette {
  bg: string;
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
  accent: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  info: string;
  overlay: string;
}

const dark: ThemePalette = {
  bg: '#0b1020',
  surface: '#131a2e',
  surfaceRaised: '#1a2340',
  surfaceSunken: '#0f1527',
  border: '#2a3556',
  borderSoft: '#1f2a46',
  text: '#f5f7ff',
  textMuted: '#b8c0d9',
  textSubtle: '#7d87a6',
  primary: '#6d7dff',
  primaryText: '#ffffff',
  primarySoft: 'rgba(109,125,255,0.18)',
  accent: '#8a7dff',
  success: '#3ecf8e',
  successSoft: 'rgba(62,207,142,0.18)',
  warning: '#f5a742',
  warningSoft: 'rgba(245,167,66,0.18)',
  danger: '#f06e6e',
  dangerSoft: 'rgba(240,110,110,0.18)',
  info: '#4fb6f5',
  overlay: 'rgba(5,8,20,0.7)',
};

const light: ThemePalette = {
  bg: '#f5f7fb',
  surface: '#ffffff',
  surfaceRaised: '#ffffff',
  surfaceSunken: '#eef1f8',
  border: '#dde3ee',
  borderSoft: '#e8ecf4',
  text: '#141829',
  textMuted: '#4d5570',
  textSubtle: '#8088a3',
  primary: '#4f5ff2',
  primaryText: '#ffffff',
  primarySoft: 'rgba(79,95,242,0.12)',
  accent: '#7b6dff',
  success: '#1faf6b',
  successSoft: 'rgba(31,175,107,0.12)',
  warning: '#d98211',
  warningSoft: 'rgba(217,130,17,0.14)',
  danger: '#d1453b',
  dangerSoft: 'rgba(209,69,59,0.12)',
  info: '#1f8fd1',
  overlay: 'rgba(15,20,35,0.45)',
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
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
} as const;

export const typography = {
  displayLg: 34,
  display: 26,
  title: 20,
  subtitle: 16,
  body: 14,
  small: 12,
  micro: 11,
} as const;

export const categoryColors: Record<string, string> = {
  Income: '#3ecf8e',
  Housing: '#6d7dff',
  Utilities: '#f5a742',
  Groceries: '#4fb6f5',
  Dining: '#f06e6e',
  Fuel: '#8a7dff',
  Travel: '#2dd1c8',
  Subscriptions: '#d26de6',
  Shopping: '#ff9f4a',
  Health: '#e05784',
  Transfer: '#7d87a6',
  Fees: '#b85252',
  Savings: '#2fb8a0',
  Other: '#8088a3',
};
