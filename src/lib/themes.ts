import { ThemeName } from '../contexts/ThemeContext';

export interface ThemeConfig {
  name: string;
  displayName: string;
  colors: {
    background: string;
    foreground: string;
    card: string;
    cardForeground: string;
    popover: string;
    popoverForeground: string;
    primary: string;
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
    muted: string;
    mutedForeground: string;
    accent: string;
    accentForeground: string;
    destructive: string;
    destructiveForeground: string;
    border: string;
    input: string;
    ring: string;
  };
}

export const themes: Record<ThemeName, ThemeConfig> = {
  dark: {
    name: 'dark',
    displayName: 'Dark',
    colors: {
      background: '250 24% 9%',
      foreground: '0 0% 98%',
      card: '250 20% 12%',
      cardForeground: '0 0% 98%',
      popover: '250 20% 12%',
      popoverForeground: '0 0% 98%',
      primary: '6 78% 67%',
      primaryForeground: '0 0% 100%',
      secondary: '186 80% 45%',
      secondaryForeground: '0 0% 100%',
      muted: '250 15% 20%',
      mutedForeground: '240 5% 65%',
      accent: '6 78% 67%',
      accentForeground: '0 0% 100%',
      destructive: '0 84% 60%',
      destructiveForeground: '0 0% 100%',
      border: '250 15% 20%',
      input: '250 15% 20%',
      ring: '6 78% 67%',
    },
  },
  light: {
    name: 'light',
    displayName: 'Light',
    colors: {
      background: '0 0% 100%',
      foreground: '0 0% 5%',
      card: '0 0% 98%',
      cardForeground: '0 0% 5%',
      popover: '0 0% 100%',
      popoverForeground: '0 0% 5%',
      primary: '6 78% 55%',
      primaryForeground: '0 0% 100%',
      secondary: '186 80% 40%',
      secondaryForeground: '0 0% 100%',
      muted: '0 0% 96%',
      mutedForeground: '0 0% 40%',
      accent: '6 78% 55%',
      accentForeground: '0 0% 100%',
      destructive: '0 84% 50%',
      destructiveForeground: '0 0% 100%',
      border: '0 0% 90%',
      input: '0 0% 90%',
      ring: '6 78% 55%',
    },
  },
  red: {
    name: 'red',
    displayName: 'Red',
    colors: {
      background: '0 20% 10%',
      foreground: '0 0% 98%',
      card: '0 15% 14%',
      cardForeground: '0 0% 98%',
      popover: '0 15% 14%',
      popoverForeground: '0 0% 98%',
      primary: '0 84% 60%',
      primaryForeground: '0 0% 100%',
      secondary: '0 60% 50%',
      secondaryForeground: '0 0% 100%',
      muted: '0 12% 22%',
      mutedForeground: '0 5% 65%',
      accent: '0 84% 60%',
      accentForeground: '0 0% 100%',
      destructive: '0 84% 60%',
      destructiveForeground: '0 0% 100%',
      border: '0 12% 25%',
      input: '0 12% 25%',
      ring: '0 84% 60%',
    },
  },
  blue: {
    name: 'blue',
    displayName: 'Blue',
    colors: {
      background: '220 30% 10%',
      foreground: '0 0% 98%',
      card: '220 25% 14%',
      cardForeground: '0 0% 98%',
      popover: '220 25% 14%',
      popoverForeground: '0 0% 98%',
      primary: '210 100% 60%',
      primaryForeground: '0 0% 100%',
      secondary: '200 90% 50%',
      secondaryForeground: '0 0% 100%',
      muted: '220 20% 22%',
      mutedForeground: '220 10% 65%',
      accent: '210 100% 60%',
      accentForeground: '0 0% 100%',
      destructive: '0 84% 60%',
      destructiveForeground: '0 0% 100%',
      border: '220 20% 25%',
      input: '220 20% 25%',
      ring: '210 100% 60%',
    },
  },
  green: {
    name: 'green',
    displayName: 'Green',
    colors: {
      background: '140 25% 10%',
      foreground: '0 0% 98%',
      card: '140 20% 14%',
      cardForeground: '0 0% 98%',
      popover: '140 20% 14%',
      popoverForeground: '0 0% 98%',
      primary: '142 76% 45%',
      primaryForeground: '0 0% 100%',
      secondary: '160 70% 40%',
      secondaryForeground: '0 0% 100%',
      muted: '140 15% 22%',
      mutedForeground: '140 10% 65%',
      accent: '142 76% 45%',
      accentForeground: '0 0% 100%',
      destructive: '0 84% 60%',
      destructiveForeground: '0 0% 100%',
      border: '140 15% 25%',
      input: '140 15% 25%',
      ring: '142 76% 45%',
    },
  },
};

export const getThemeColors = (themeName: ThemeName) => {
  return themes[themeName].colors;
};
