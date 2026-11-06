import React, { createContext, useContext, useEffect } from 'react';

// The site is black-only: theme switching was removed. The provider still
// exists so the root carries `theme-dark` and any `useTheme` caller keeps
// working, but the theme can no longer change.
export type ThemeName = 'dark';

interface ThemeContextType {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Older builds persisted a picked theme here; clear it so nobody is stuck on one.
const LEGACY_THEME_STORAGE_KEY = 'app-theme';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-light', 'theme-red', 'theme-blue', 'theme-green');
    root.classList.add('theme-dark');
    try {
      localStorage.removeItem(LEGACY_THEME_STORAGE_KEY);
    } catch {
      // storage unavailable — nothing to clear
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: 'dark', setTheme: () => {} }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
