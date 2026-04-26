'use client';
// Fixed bottom tab bar shown only on mobile widths (<1024px via CSS).
// Route mapping follows the mobile handoff:
//   Home     → /
//   Fighters → /fighters, /fighters/[slug], /rankings
//   Standings → /teams, /teams/[slug]
//   Schedule → /schedule, /matches/[id]
//   Pick'em  → /picks, /leaderboard

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface TabDef {
  label: string;
  href: string;
  match: (path: string) => boolean;
  icon: (active: boolean) => React.ReactNode;
}

const ICON_STROKE = 1.8;

function iconProps(active: boolean): React.SVGProps<SVGSVGElement> {
  return {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: ICON_STROKE,
    'aria-hidden': true,
    style: active ? { color: 'var(--tbl-accent)' } : { color: 'var(--tbl-ink)' },
  };
}

const TABS: TabDef[] = [
  {
    label: 'Home',
    href: '/',
    match: (p) => p === '/',
    icon: (a) => (
      <svg {...iconProps(a)} fill={a ? 'var(--tbl-accent)' : 'none'}>
        <path d="M3 11l9-8 9 8v10a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2V11z" />
      </svg>
    ),
  },
  {
    label: 'Fighters',
    href: '/fighters',
    match: (p) => p.startsWith('/fighters') || p.startsWith('/rankings'),
    icon: (a) => (
      <svg {...iconProps(a)}>
        <circle cx="12" cy="7" r="3.5" />
        <path d="M5 21c0-4 3-7 7-7s7 3 7 7" />
      </svg>
    ),
  },
  {
    label: 'Standings',
    href: '/teams',
    match: (p) => p.startsWith('/teams'),
    icon: (a) => (
      <svg {...iconProps(a)}>
        <path d="M4 21V8l8-5 8 5v13M9 21v-7h6v7" />
      </svg>
    ),
  },
  {
    label: 'Schedule',
    href: '/schedule',
    match: (p) => p.startsWith('/schedule') || p.startsWith('/matches'),
    icon: (a) => (
      <svg {...iconProps(a)}>
        <rect x="3" y="5" width="18" height="16" rx="1" />
        <path d="M3 9h18M8 3v4M16 3v4" />
      </svg>
    ),
  },
  {
    label: "Pick'em",
    href: '/picks',
    match: (p) => p.startsWith('/picks') || p.startsWith('/leaderboard'),
    icon: (a) => (
      <svg {...iconProps(a)}>
        <path d="M4 6l5 12 4-10 3 6 4-8" />
      </svg>
    ),
  },
];

export function MobileTabBar() {
  const pathname = usePathname() || '/';
  return (
    <nav className="tbl-mobile-tab-bar" aria-label="Primary">
      {TABS.map((t) => {
        const active = t.match(pathname);
        return (
          <Link
            key={t.label}
            href={t.href}
            className={`tbl-mobile-tab-bar__tab${active ? ' is-active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            {t.icon(active)}
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
