import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  type Palette,
  type ThemeMode,
  paletteFor,
  readThemeMode,
  saveThemeMode,
  setActivePalette,
} from '../constants/theme';

interface ThemeContextValue {
  mode: ThemeMode;
  colors: Palette;
  isLight: boolean;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** App-wide theme provider. Holds the active mode in state so a toggle swaps
 * the palette LIVE (no reload); persists the choice and keeps the module-level
 * activeColors in sync for non-hook consumers (toneColor, receipt HTML). */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => readThemeMode());
  const colors = paletteFor(mode);

  // Keep non-hook consumers reading the current palette. Runs before children
  // render, and is idempotent, so doing it in render is safe here.
  setActivePalette(colors);

  const value = useMemo<ThemeContextValue>(() => {
    const apply = (next: ThemeMode) => {
      saveThemeMode(next);
      setModeState(next);
    };
    return {
      mode,
      colors,
      isLight: mode === 'light',
      setMode: apply,
      toggle: () => apply(mode === 'light' ? 'dark' : 'light'),
    };
  }, [mode, colors]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}

/** Build a StyleSheet from the active palette, memoized per palette. Pass a
 * factory `(colors) => StyleSheet.create({...})`. */
export function useThemedStyles<T>(factory: (colors: Palette) => T): T {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [factory, colors]);
}
