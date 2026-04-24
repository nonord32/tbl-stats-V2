// src/components/home/PickemPromo.tsx
// Home-page promo card for /picks. Renders only when getCurrentWeek() returns
// a week with open pick windows (callers gate visibility on that signal).

import Link from 'next/link';
import { SectionRule } from '@/components/chrome/SectionRule';
import { getCityName } from '@/lib/teams';
import type { ScheduleEntry } from '@/types';

// City → compact abbreviation used on the Schedule cards. Duplicated here
// to keep the promo self-contained; extract to @/lib/teams if a third caller
// ever appears.
function short(team: string): string {
  const city = getCityName(team).toUpperCase();
  const map: Record<string, string> = {
    'NEW YORK': 'NYC',
    NYC: 'NYC',
    'LOS ANGELES': 'LA',
    'LAS VEGAS': 'LV',
    'SAN ANTONIO': 'SA',
    ATLANTA: 'ATL',
    BOSTON: 'BOS',
    DALLAS: 'DAL',
    HOUSTON: 'HOU',
    MIAMI: 'MIA',
    NASHVILLE: 'NSH',
    PHILADELPHIA: 'PHI',
    PHOENIX: 'PHX',
  };
  return map[city] ?? city.slice(0, 3);
}

interface Props {
  week: number;
  matches: ScheduleEntry[];
}

export function PickemPromo({ week, matches }: Props) {
  const matchupLabel = `${matches.length} matchup${matches.length === 1 ? '' : 's'}`;
  return (
    <div style={{ padding: '30px 32px 28px', borderBottom: '3px double var(--tbl-ink)' }}>
      <SectionRule left="Pick'em" right={`Week ${week} · ${matchupLabel}`} />
      <div
        className="gz-pickem-card"
        style={{
          background: 'var(--tbl-paper)',
          border: '1.5px solid var(--tbl-ink)',
          padding: '20px 22px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 20,
        }}
      >
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <div className="tbl-display" style={{ fontSize: 28, lineHeight: 1.1 }}>
            Pick the winner. Pick the margin.
          </div>
          <div
            style={{
              fontFamily: 'var(--tbl-font-mono)',
              fontSize: 11,
              letterSpacing: '0.14em',
              color: 'var(--tbl-ink-soft)',
              textTransform: 'uppercase',
              marginTop: 10,
            }}
          >
            Points for the right team and the right band · weekly leaderboard
          </div>
          {matches.length > 0 && (
            <div
              style={{
                marginTop: 14,
                display: 'flex',
                flexWrap: 'wrap',
                gap: 6,
              }}
            >
              {matches.map((m, i) => (
                <span
                  key={`${i}-${m.team1}-${m.team2}`}
                  style={{
                    display: 'inline-block',
                    padding: '4px 10px',
                    border: '1px solid var(--tbl-ink)',
                    fontFamily: 'var(--tbl-font-mono)',
                    fontSize: 11,
                    letterSpacing: '0.1em',
                    fontWeight: 700,
                    color: 'var(--tbl-ink)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {short(m.team1)} <span style={{ color: 'var(--tbl-ink-soft)', fontWeight: 400, fontStyle: 'italic', margin: '0 2px' }}>vs</span> {short(m.team2)}
                </span>
              ))}
            </div>
          )}
        </div>
        <Link
          href="/picks"
          style={{
            background: 'var(--tbl-accent)',
            color: '#fff',
            padding: '14px 22px',
            fontFamily: 'var(--tbl-font-serif)',
            fontWeight: 900,
            fontSize: 17,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
            border: '1.5px solid var(--tbl-ink)',
            flex: '0 0 auto',
          }}
        >
          Make Your Picks →
        </Link>
      </div>
    </div>
  );
}
