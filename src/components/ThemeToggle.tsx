'use client';
// Tiny button that flips the site theme via the existing ThemeProvider.
// Reads the current theme from context, shows ☀ / ☾ accordingly.
import { useTheme } from './ThemeProvider';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      className="tbl-theme-toggle"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <span className="tbl-theme-toggle__icon" aria-hidden="true">
        {isDark ? '☀' : '☾'}
      </span>
      <span>{isDark ? 'Light' : 'Dark'}</span>
    </button>
  );
}
