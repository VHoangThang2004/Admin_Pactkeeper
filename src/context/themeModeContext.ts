import { createContext } from 'react';

export type ThemeMode = 'light' | 'dark';

export interface ThemeModeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
}

export const THEME_MODE_STORAGE_KEY = 'pactkeeper_theme_mode';

export const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);
