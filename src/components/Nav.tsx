'use client';
// src/components/Nav.tsx

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from './ThemeProvider';

export function Nav() {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();

  const isActive = (path: string) =>
    path === '/' ? pathname === '/' : pathname.startsWith(path);

  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link href="/" className="nav-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/tbl-logo.png" alt="TBL" />
          <span className="nav-brand-text">
            TBL<span>Stats</span>
          </span>
        </Link>

        <div className="nav-links">
          <Link
            href="/"
            className={`nav-link ${isActive('/') && pathname === '/' ? 'active' : ''}`}
          >
            Home
          </Link>
          <Link
            href="/fighters"
            className={`nav-link ${isActive('/fighters') ? 'active' : ''}`}
          >
            Fighter Stats
          </Link>
          <Link
            href="/teams"
            className={`nav-link ${isActive('/teams') ? 'active' : ''}`}
          >
            Team Standings
          </Link>
        </div>

        <div className="nav-actions">
          <button className="theme-toggle" onClick={toggle} aria-label="Toggle theme">
            {theme === 'light' ? '☽ DARK' : '☀ LIGHT'}
          </button>
        </div>
      </div>
    </nav>
  );
}
