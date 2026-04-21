// src/components/home/LastWeekRecap.tsx
// Card showing final scores for the last completed pick'em week.

import Link from 'next/link';
import { toSlug } from '@/lib/data';
import { getFullTeamName } from '@/lib/teams';
import type { MatchResult } from '@/types';

interface Props {
  week: number;
  matches: MatchResult[];
  /** true when this recap covers a week already in progress (mid-week view) */
  inProgress?: boolean;
}

function formatMatchDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return dateStr;
  }
}

function RecapRow({ match }: { match: MatchResult }) {
  const team1Slug = toSlug(match.team1);
  const team2Slug = toSlug(match.team2);
  const team1Name = getFullTeamName(team1Slug);
  const team2Name = getFullTeamName(team2Slug);
  const team1Won = match.result === 'W';
  const team2Won = match.result === 'L';

  return (
    <Link
      href={`/matches/${match.matchIndex}`}
      className="home-recap-row home-week-match-row--link"
    >
      <div
        className={`home-recap-team ${team1Won ? 'home-recap-team--winner' : team2Won ? 'home-recap-team--loser' : ''}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/logos/${team1Slug}.png`}
          alt={team1Name}
          className="home-week-match-logo"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
        <span className="home-week-match-name">{team1Name}</span>
      </div>
      <div className="home-recap-score">
        <span
          style={{
            color: team1Won
              ? 'var(--result-w)'
              : team2Won
                ? 'var(--result-l)'
                : 'var(--text)',
          }}
        >
          {match.score1.toFixed(1)}
        </span>
        <span className="home-recap-score-sep">–</span>
        <span
          style={{
            color: team2Won
              ? 'var(--result-w)'
              : team1Won
                ? 'var(--result-l)'
                : 'var(--text)',
          }}
        >
          {match.score2.toFixed(1)}
        </span>
      </div>
      <div
        className={`home-recap-team home-recap-team--right ${team2Won ? 'home-recap-team--winner' : team1Won ? 'home-recap-team--loser' : ''}`}
      >
        <span className="home-week-match-name">{team2Name}</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/logos/${team2Slug}.png`}
          alt={team2Name}
          className="home-week-match-logo"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      </div>
      <div className="home-recap-meta">{formatMatchDate(match.date)}</div>
    </Link>
  );
}

export function LastWeekRecap({ week, matches, inProgress = false }: Props) {
  if (matches.length === 0) return null;

  const title = inProgress
    ? `Week ${week} · Results so far`
    : `Week ${week} Recap · Last Week`;

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card-header">
        <span className="card-title">{title}</span>
        <Link
          href="/results"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--accent)',
            letterSpacing: '0.04em',
          }}
        >
          All results →
        </Link>
      </div>
      <div className="home-recap-list">
        {matches.map((m) => (
          <RecapRow key={m.matchIndex} match={m} />
        ))}
      </div>
    </div>
  );
}
