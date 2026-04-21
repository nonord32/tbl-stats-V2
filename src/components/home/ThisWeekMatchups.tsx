// src/components/home/ThisWeekMatchups.tsx
// Card showing every matchup for the active pick'em week.

import Link from 'next/link';
import { toSlug } from '@/lib/data';
import { getFullTeamName } from '@/lib/teams';
import { isPickOpen } from '@/lib/gameTime';
import type { ScheduleEntry } from '@/types';

interface Props {
  week: number;
  matches: ScheduleEntry[];
  /** match_index → true when the logged-in user has already picked it */
  pickedMatchIndexes?: Set<number>;
}

function formatMatchDate(dateStr: string): string {
  if (!dateStr) return 'TBD';
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

function MatchupRow({
  match,
  picked,
}: {
  match: ScheduleEntry;
  picked: boolean;
}) {
  const team1Slug = toSlug(match.team1);
  const team2Slug = toSlug(match.team2);
  const team1Name = getFullTeamName(team1Slug);
  const team2Name = getFullTeamName(team2Slug);
  const open = isPickOpen(match.date, match.time, match.venueCity);
  const hasMatchLink = match.matchIndex !== null;

  const status: 'picked' | 'open' | 'locked' =
    picked ? 'picked' : open ? 'open' : 'locked';

  const statusStyles: Record<typeof status, React.CSSProperties> = {
    picked: { color: 'var(--result-w)' },
    open: { color: 'var(--accent)' },
    locked: { color: 'var(--text-muted)' },
  };
  const statusLabel: Record<typeof status, string> = {
    picked: '✓ Picked',
    open: 'Pick →',
    locked: 'Locked',
  };

  const inner = (
    <>
      <div className="home-week-match-teams">
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
        <span className="home-week-match-vs">vs</span>
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
      <div className="home-week-match-meta">
        <span>
          {formatMatchDate(match.date)}
          {match.time ? ` · ${match.time}` : ''}
        </span>
        {match.venueCity && (
          <span className="home-week-match-venue">{match.venueCity}</span>
        )}
      </div>
      <span className="home-week-match-status" style={statusStyles[status]}>
        {statusLabel[status]}
      </span>
    </>
  );

  if (hasMatchLink && status === 'open') {
    return (
      <Link href="/picks" className="home-week-match-row home-week-match-row--link">
        {inner}
      </Link>
    );
  }
  if (hasMatchLink && status === 'picked' && match.matchIndex) {
    return (
      <Link
        href={`/matches/${match.matchIndex}`}
        className="home-week-match-row home-week-match-row--link"
      >
        {inner}
      </Link>
    );
  }
  return <div className="home-week-match-row">{inner}</div>;
}

export function ThisWeekMatchups({ week, matches, pickedMatchIndexes }: Props) {
  if (matches.length === 0) return null;

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card-header">
        <span className="card-title">Week {week} · This Week&apos;s Matchups</span>
        <Link
          href="/schedule"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--accent)',
            letterSpacing: '0.04em',
          }}
        >
          Full schedule →
        </Link>
      </div>
      <div className="home-week-match-list">
        {matches.map((m, i) => (
          <MatchupRow
            key={`${m.matchIndex ?? 'sched'}-${i}`}
            match={m}
            picked={!!(m.matchIndex && pickedMatchIndexes?.has(m.matchIndex))}
          />
        ))}
      </div>
    </div>
  );
}
