import { Appearance } from 'react-native';

// Foundry has two palettes: "Nightshift" (warm industrial dark) and "Daybook"
// (warm paper light). Both expose the SAME token keys so every screen adopts
// whichever is active without per-screen changes. The active palette is chosen
// from the device color scheme at launch (see `colors` below).

type Palette = {
  background: string;
  surface: string;
  surface2: string;
  card: string;
  cardHover: string;
  raised: string;
  accent: string;
  accentInk: string;
  accentMuted: string;
  accentLine: string;
  copper: string;
  teal: string;
  moss: string;
  rust: string;
  gold: string;
  danger: string;
  warning: string;
  success: string;
  white: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  border: string;
  borderSubtle: string;
  borderStrong: string;
  chip: string;
  inputBackground: string;
  overlay: string;
  shadow: string;
};

// "Nightshift" — warm industrial dark.
export const darkColors: Palette = {
  background: '#15130f',
  surface: '#201d17',
  surface2: '#1b1813',
  card: '#201d17',
  cardHover: '#262219',
  raised: '#262219',
  // Copper accent
  accent: '#b3592f',
  accentInk: '#ffffff',
  accentMuted: 'rgba(179, 89, 47, 0.14)',
  accentLine: 'rgba(179, 89, 47, 0.32)',
  copper: '#b3592f',
  // Semantic / domain tones
  teal: '#3f7d82', // sold / out
  moss: '#5d7a4e', // profit / positive
  rust: '#b5462f', // restricted / flag
  gold: '#b08a32', // hold / warning
  danger: '#b5462f',
  warning: '#b08a32',
  success: '#5d7a4e',
  white: '#ffffff',
  // Ink
  textPrimary: '#f1ebdd',
  textSecondary: '#a89e8c',
  textTertiary: '#6f6657',
  // Lines & fills
  border: '#3c372c',
  borderSubtle: '#322d24',
  borderStrong: '#4a4435',
  chip: '#2b261d',
  inputBackground: '#1b1813',
  overlay: 'rgba(0, 0, 0, 0.62)',
  shadow: 'rgba(0, 0, 0, 0.45)',
};

// "Daybook" — warm paper light. Accent + domain tones are kept identical so
// chips, metal dots and deltas read the same; surfaces and ink invert.
export const lightColors: Palette = {
  background: '#f3efe8',
  surface: '#ffffff',
  surface2: '#faf7f1',
  card: '#ffffff',
  cardHover: '#f6f2ea',
  raised: '#ffffff',
  accent: '#b3592f',
  accentInk: '#ffffff',
  accentMuted: 'rgba(179, 89, 47, 0.12)',
  accentLine: 'rgba(179, 89, 47, 0.28)',
  copper: '#b3592f',
  teal: '#3f7d82',
  moss: '#5d7a4e',
  rust: '#b5462f',
  gold: '#a07c2c',
  danger: '#b5462f',
  warning: '#a07c2c',
  success: '#5d7a4e',
  white: '#ffffff',
  textPrimary: '#1b1813',
  textSecondary: '#6a6258',
  textTertiary: '#a39b8e',
  border: '#d7d0c2',
  borderSubtle: '#e6e0d5',
  borderStrong: '#c8c0b0',
  chip: '#f0ebe2',
  inputBackground: '#faf7f1',
  overlay: 'rgba(40, 33, 22, 0.32)',
  shadow: 'rgba(40, 33, 22, 0.12)',
};

// Resolved once at module load from the device color scheme. A live in-app
// toggle would require threading a theme context through every screen's
// StyleSheet (those snapshot `colors` at module-eval time), so the supported
// behaviour is: the app follows the OS light/dark setting.
export const isLightTheme = Appearance.getColorScheme() === 'light';
export const colors: Palette = isLightTheme ? lightColors : darkColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const fontSize = {
  xs: 13,
  sm: 14,
  md: 15,
  lg: 17,
  xl: 19,
  xxl: 24,
  title: 32,
} as const;

export const borderRadius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 20,
  pill: 100,
} as const;

// Foundry type system. Archivo for UI, Spline Sans Mono for numerals
// (weights, prices, receipt #s). Loaded in App.tsx via @expo-google-fonts.
export const fonts = {
  sans: 'Archivo_400Regular',
  sansMedium: 'Archivo_500Medium',
  sansSemiBold: 'Archivo_600SemiBold',
  sansBold: 'Archivo_700Bold',
  display: 'Archivo_800ExtraBold',
  mono: 'SplineSansMono_400Regular',
  monoMedium: 'SplineSansMono_500Medium',
  monoSemiBold: 'SplineSansMono_600SemiBold',
} as const;
