// src/components/home/HallOfChampions.tsx
// Horizontal strip showing the most recent season's award winners, with a
// muted sub-line of prior winners for any award that has historical data.

import type { AwardEntry } from '@/types';

interface Props {
  awards: AwardEntry[];
}

function TrophyIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 21h8M12 17v4" />
      <path d="M17 4h3v3a4 4 0 0 1-4 4M7 4H4v3a4 4 0 0 0 4 4" />
      <path d="M6 4h12v6a6 6 0 0 1-12 0V4z" />
    </svg>
  );
}

export function HallOfChampions({ awards }: Props) {
  if (awards.length === 0) return null;

  const latestSeason = Math.max(...awards.map((a) => a.season));
  const latestAwards = awards
    .filter((a) => a.season === latestSeason)
    .sort((a, b) => a.award.localeCompare(b.award));
  if (latestAwards.length === 0) return null;

  // For each award type shown in the headline, collect prior winners to
  // display as a subdued history line.
  const priorByAward = new Map<string, AwardEntry[]>();
  for (const a of latestAwards) {
    const prior = awards
      .filter((x) => x.award === a.award && x.season < latestSeason)
      .sort((x, y) => y.season - x.season);
    if (prior.length > 0) priorByAward.set(a.award, prior);
  }

  return (
    <section style={{ padding: '24px 0 0' }}>
      <div className="container">
        <div
          style={{
            background: 'linear-gradient(135deg, #120a00 0%, #2a1a00 60%, #120a00 100%)',
            border: '1px solid rgba(255,190,60,0.35)',
            borderRadius: 'var(--radius)',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: '#ffb84d',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            <TrophyIcon />
            Hall of Champions · {latestSeason}
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px 20px',
              alignItems: 'baseline',
            }}
          >
            {latestAwards.map((a) => (
              <div
                key={`${a.award}-${a.winner}`}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.55)',
                  }}
                >
                  {a.award}
                </span>
                <span style={{ fontWeight: 700, color: '#fff' }}>{a.winner}</span>
                {a.team && (
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
                    {a.team}
                  </span>
                )}
              </div>
            ))}
          </div>

          {priorByAward.size > 0 && (
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'rgba(255,255,255,0.45)',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              {[...priorByAward.entries()].map(([award, prior]) => (
                <div key={award}>
                  Past {award}s:{' '}
                  {prior
                    .map((p) => `${p.season} ${p.winner}${p.team ? ` (${p.team})` : ''}`)
                    .join(' · ')}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
