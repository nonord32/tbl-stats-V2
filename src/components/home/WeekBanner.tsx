// src/components/home/WeekBanner.tsx
// Dynamic pick'em banner shown on the homepage.
// Replaces the old hardcoded "Week 5" banner.

import Link from 'next/link';

interface Props {
  week: number | null;
  openMatchCount: number;
}

export function WeekBanner({ week, openMatchCount }: Props) {
  const hasOpenWeek = week !== null && openMatchCount > 0;

  const label = hasOpenWeek
    ? `Pick'em — Week ${week}`
    : "Pick'em";

  const headline = hasOpenWeek
    ? `${openMatchCount} ${openMatchCount === 1 ? 'match' : 'matches'} open — make your picks`
    : 'Season complete — check the leaderboard';

  const ctaText = hasOpenWeek ? 'Pick now →' : 'View leaderboard →';
  const href = hasOpenWeek ? '/picks' : '/leaderboard';

  return (
    <section style={{ padding: '16px 0 0' }}>
      <div className="container">
        <Link href={href} style={{ textDecoration: 'none', display: 'block' }}>
          <div
            style={{
              background: 'linear-gradient(135deg, #1a0a00 0%, #2d1200 60%, #1a0a00 100%)',
              border: '1px solid rgba(230,60,0,0.4)',
              borderRadius: 'var(--radius)',
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'var(--accent)',
                  }}
                >
                  {label}
                </span>
              </div>
              <p
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#fff',
                  margin: 0,
                }}
              >
                {headline}
              </p>
              <p
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.5)',
                  margin: '4px 0 0',
                }}
              >
                1pt for correct winner · 2pts for exact margin
              </p>
            </div>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--accent)',
                whiteSpace: 'nowrap',
              }}
            >
              {ctaText}
            </span>
          </div>
        </Link>
      </div>
    </section>
  );
}
