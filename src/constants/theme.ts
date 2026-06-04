// Foundry "Nightshift" palette (warm industrial). Existing token keys are
// preserved so every screen adopts the new look; new tokens (copper/moss/
// rust/gold/chip…) are added for the reskinned components.
export const colors = {
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
} as const;

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
