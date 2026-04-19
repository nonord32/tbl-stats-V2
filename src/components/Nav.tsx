'use client';
// src/components/Nav.tsx

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from './ThemeProvider';
import { Suspense } from 'react';
import { AuthButton } from './AuthButton';

const NAV_STYLE: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  zIndex: 9999,
  height: 64,
  background: '#13111a',
  borderBottom: '1px solid rgba(255,60,0,0.2)',
  display: 'flex',
  alignItems: 'center',
};

const BOTTOM_NAV_ITEMS = [
  {
    href: '/',
    label: 'Home',
    exact: true,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    href: '/fighters',
    label: 'Fighters',
    exact: false,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="8" r="4"/>
        <path d="M6 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
      </svg>
    ),
  },
  {
    href: '/teams',
    label: 'Standings',
    exact: false,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
  },
  {
    href: '/rankings',
    label: 'Rankings',
    exact: false,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M8 6l4-4 4 4"/>
        <path d="M12 2v10.3"/>
        <path d="M4 20h16"/>
        <path d="M4 16l4-4 4 4 4-4 4 4"/>
      </svg>
    ),
  },
  {
    href: '/results',
    label: 'Results',
    exact: false,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="8" r="6"/>
        <path d="M8 14v7M16 14v7M8 21h8"/>
        <path d="M9 2v4M15 2v4"/>
      </svg>
    ),
  },
];

export function Nav() {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();

  const isActive = (path: string, exact = false) =>
    exact ? pathname === path : (path === '/' ? pathname === '/' : pathname.startsWith(path));

  return (
    <>
      <nav style={NAV_STYLE}>
        <div className="nav-inner">
          <Link href="/" className="nav-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/tbl-logo.png" alt="TBL" />
            <span className="nav-brand-text">
              TBL<span>Stats</span>
            </span>
          </Link>

          <div className="nav-links">
            <Link href="/" className={`nav-link ${isActive('/') && pathname === '/' ? 'active' : ''}`}>
              Home
            </Link>
            <Link href="/fighters" className={`nav-link ${isActive('/fighters') ? 'active' : ''}`}>
              Fighters
            </Link>
            <Link href="/teams" className={`nav-link ${isActive('/teams') ? 'active' : ''}`}>
              Standings
            </Link>
            <Link href="/results" className={`nav-link ${isActive('/results') ? 'active' : ''}`}>
              Results
            </Link>
            <Link href="/rankings" className={`nav-link ${isActive('/rankings') ? 'active' : ''}`}>
              Rankings
            </Link>
            <Link href="/schedule" className={`nav-link ${isActive('/schedule') ? 'active' : ''}`}>
              Schedule
            </Link>
            <Link href="/picks" className={`nav-link ${isActive('/picks') ? 'active' : ''}`}>
              Picks
            </Link>
            <Link href="/leaderboard" className={`nav-link ${isActive('/leaderboard') ? 'active' : ''}`}>
              Leaderboard
            </Link>
          </div>

          <div className="nav-actions">
            <Suspense fallback={null}>
              <AuthButton />
            </Suspense>
            <a
              href="https://www.instagram.com/teamboxingleague/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="TBL on Instagram"
              className="nav-social-link nav-social-link--instagram"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                <circle cx="12" cy="12" r="4"/>
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
              </svg>
            </a>
            <a
              href="https://www.youtube.com/@teamboxingleague"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="TBL on YouTube"
              className="nav-social-link nav-social-link--youtube"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/>
                <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="currentColor" stroke="none"/>
              </svg>
            </a>
            <button className="theme-toggle" onClick={toggle} aria-label="Toggle theme">
              {theme === 'light' ? '☽' : '☀'}
            </button>
          </div>
        </div>
      </nav>

      {/* ── Bottom Tab Bar (mobile only) ── */}
      <nav className="bottom-nav" aria-label="Mobile navigation">
        {BOTTOM_NAV_ITEMS.map(({ href, label, exact, icon }) => (
          <Link
            key={href}
            href={href}
            className={`bottom-nav-item${isActive(href, exact) ? ' active' : ''}`}
            aria-label={label}
          >
            {icon}
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
