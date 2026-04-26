'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS: { label: string; href: string }[] = [
  { label: 'Home', href: '/' },
  { label: 'Fighters', href: '/fighters' },
  { label: 'Rankings', href: '/rankings' },
  { label: 'Standings', href: '/teams' },
  { label: 'Schedule', href: '/schedule' },
  { label: "Pick'em", href: '/picks' },
  { label: 'Leaderboard', href: '/leaderboard' },
];

// Matches a nav link if the current path equals or starts with the link's href.
// For "/" we require an exact match so every page doesn't light up Home.
function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function TopNav() {
  const pathname = usePathname() || '/';
  return (
    <div className="tbl-top-nav">
      <Link href="/" className="tbl-top-nav__brand" aria-label="TBL Stats — home">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/tbl-logo.png" alt="" className="tbl-top-nav__logo" />
        <div>
          <div className="tbl-top-nav__wordmark">TBL Stats</div>
          <div className="tbl-top-nav__tagline">The Official Record · 2026</div>
        </div>
      </Link>
      <nav className="tbl-top-nav__links" aria-label="Primary">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`tbl-top-nav__link${isActive(pathname, l.href) ? ' is-active' : ''}`}
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
