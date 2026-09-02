// src/components/home/AdvancedLinks.tsx
// The front door to the two advanced-stat pages. This used to be two cards
// with a heading and a paragraph each; the pages behind it explain themselves,
// so it is a line of links.

import Link from 'next/link';

const LINKS = [
  { label: 'Biggest rounds', href: '/advanced' },
  { label: 'Fighter leaderboard', href: '/advanced?view=fighters' },
  { label: 'Biggest comebacks', href: '/advanced?view=matches' },
  { label: 'How the stats work', href: '/stats' },
];

export function AdvancedLinks() {
  return (
    <div style={{ padding: '0 32px 40px' }}>
      <div className="tbl-section-rule">
        <span>Beyond the Box Score</span>
      </div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px 22px',
          fontFamily: 'var(--tbl-font-mono)',
          fontSize: 12,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          fontWeight: 700,
        }}
      >
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            style={{ color: 'var(--tbl-accent)', textDecoration: 'none' }}
          >
            {l.label} →
          </Link>
        ))}
      </div>
    </div>
  );
}
