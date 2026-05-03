'use client';
// Fantasy v2 sub-nav — sticky horizontal scroll on mobile, top-aligned
// on desktop. Active tab is highlighted via usePathname.
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS: { label: string; href: string; match: (p: string) => boolean }[] = [
  { label: 'Lobby',   href: '/fantasy',          match: (p) => p === '/fantasy' },
  { label: 'Team',    href: '/fantasy/team',     match: (p) => p.startsWith('/fantasy/team') },
  { label: 'Draft',   href: '/fantasy/draft',    match: (p) => p.startsWith('/fantasy/draft') },
  { label: 'Waiver',  href: '/fantasy/waiver',   match: (p) => p.startsWith('/fantasy/waiver') },
  { label: 'Trades',  href: '/fantasy/trades',   match: (p) => p.startsWith('/fantasy/trades') },
  { label: 'Scoring', href: '/fantasy/scoring',  match: (p) => p.startsWith('/fantasy/scoring') },
];

export function FantasySubNav() {
  const pathname = usePathname() || '/fantasy';
  return (
    <nav className="fv2-subnav" aria-label="Fantasy sections">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`fv2-subnav__tab${t.match(pathname) ? ' is-active' : ''}`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
