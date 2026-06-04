import { reloadAppAsync } from 'expo';
import { saveThemeMode, themeMode, type ThemeMode } from '../constants/theme';

/** Persist a theme mode and reload the app so it takes effect. The palette is
 * resolved synchronously at module load (see constants/theme), so a reload is
 * what swaps it — no per-screen theme context required. */
export async function setThemeMode(mode: ThemeMode): Promise<void> {
  saveThemeMode(mode);
  await reloadAppAsync('theme change');
}

/** Flip between light and dark and reload. */
export async function toggleThemeMode(): Promise<void> {
  await setThemeMode(themeMode === 'light' ? 'dark' : 'light');
}
