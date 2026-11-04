"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { storage } from '@/lib/platformStorage';

type Theme = 'dark';
export type Accent = 'gold' | 'monochrome';
export type Density = 'comfortable' | 'compact';

interface ThemeContextType {
  theme: Theme;
  accent: Accent;
  density: Density;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  setAccent: (accent: Accent) => void;
  setDensity: (density: Density) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const ACCENT_KEY = 'vanta_accent';
const DENSITY_KEY = 'vanta_density';

function applyThemeAttributes(accent: Accent, density: Density) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove('light');
  root.classList.add('dark');
  root.dataset.theme = 'dark';
  delete root.dataset.themeMode;
  root.dataset.accent = accent;
  root.dataset.density = density;
}

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [accent, setAccentState] = useState<Accent>('monochrome');
  const [density, setDensityState] = useState<Density>('comfortable');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const hydrate = async () => {
      const [accentValue, densityValue] = await Promise.all([
        storage.getItem(ACCENT_KEY),
        storage.getItem(DENSITY_KEY),
      ]);
      const nextAccent: Accent = accentValue === 'monochrome' ? 'monochrome' : 'gold';
      const nextDensity: Density = densityValue === 'compact' ? 'compact' : 'comfortable';
      setAccentState(nextAccent);
      setDensityState(nextDensity);
      applyThemeAttributes(nextAccent, nextDensity);
    };
    void hydrate();
  }, []);

  useEffect(() => {
    if (mounted) applyThemeAttributes(accent, density);
  }, [accent, density, mounted]);

  const setTheme = useCallback((_newTheme: Theme) => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
      document.documentElement.dataset.theme = 'dark';
    }
  }, []);

  const setAccent = useCallback((nextAccent: Accent) => {
    setAccentState(nextAccent);
    void storage.setItem(ACCENT_KEY, nextAccent);
  }, []);

  const setDensity = useCallback((nextDensity: Density) => {
    setDensityState(nextDensity);
    void storage.setItem(DENSITY_KEY, nextDensity);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: 'dark', accent, density, toggleTheme: () => {}, setTheme, setAccent, setDensity }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};