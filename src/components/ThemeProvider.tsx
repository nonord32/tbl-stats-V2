'use client';
// src/components/ThemeProvider.tsx

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

const ThemeContext = createContext<{
  theme: Theme;
  toggle: () => void;
}>({ theme: 'light', toggle: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let stored: Theme | null = null;
    try { stored = localStorage.getItem('tbl-theme') as Theme | null; } catch {}
    const initial = stored || 'light'; // Default: light
    setTheme(initial);
    document.documentElement.setAttribute('data-theme', initial);
    setMounted(true);
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('tbl-theme', next); } catch {}
  };

  // Avoid flash: render invisible until mounted
  if (!mounted) {
    return (
      <div style={{ visibility: 'hidden' }}>
        <ThemeContext.Provider value={{ theme, toggle }}>
          {children}
        </ThemeContext.Provider>
      </div>
    );
  }

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
