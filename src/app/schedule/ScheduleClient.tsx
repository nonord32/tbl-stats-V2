'use client';
// Schedule page body: Gazette-styled week sections + Week / Club filter row.
// Default view shows the current week on top and the previous week below —
// pick Week=All to see the full season.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { ScheduleEntry } from '@/types';
import { PageHeader } from '@/components/chrome/PageHeader';
import { getTeamLogoPathByName, getCityName } from '@/lib/teams';

type ScoreInfo = {
  score1: number;
  score2: number;
  result: 'W' | 'L' | 'D';
  /** Team that the result/score1 are reported from. */
  team1: string;
};

interface Props {
  schedule: ScheduleEntry[];
  currentWeek: number | null;
  scores: Record<number, ScoreInfo>;
}

function short(team: string): string {
  const city = getCityName(team).toUpperCase();
  // Keep common 3–4-letter abbreviations compact for the hero cards.
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

// Parse date strings that may or may not include a year ("4/24", "4/24/2026",
// "2026-04-24"). new Date("4/24") is Invalid in V8, so we fall back to a
// manual parser before giving up.
function parseScheduleDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const direct = new Date(dateStr);
  if (!isNaN(direct.getTime())) return direct;
  const us = dateStr.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
  if (us) {
    const year = us[3] ? parseInt(us[3]) : 2026;
    const d = new Date(year, parseInt(us[1]) - 1, parseInt(us[2]));
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function formatWhen(e: ScheduleEntry): string {
  const d = parseScheduleDate(e.date);
  if (!d) return e.time ? `${e.date} · ${e.time}` : e.date;
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
  const md = `${d.getMonth() + 1}/${d.getDate()}`;
  return e.time ? `${weekday} ${md} · ${e.time}` : `${weekday} ${md}`;
}

// Just the kickoff time (e.g. "7:00 PM"), with the noisy "Local" suffix
// stripped — used in the compact mobile schedule cards.
function formatTimeOnly(time: string | undefined): string {
  if (!time) return '';
  return time.replace(/\s*local\s*$/i, '').trim();
}

interface GameCardProps {
  entry: ScheduleEntry;
  score?: ScoreInfo;
}
function GameCard({ entry, score }: GameCardProps) {
  const isCompleted = entry.status.toLowerCase() === 'completed';
  const isCancelled = entry.status.toLowerCase() === 'cancelled';
  const live = false; // Supabase/schedule doesn't expose live state; preview treats all non-final as upcoming.

  const bg = live ? 'var(--tbl-ink)' : 'var(--tbl-paper)';
  const fg = live ? 'var(--tbl-bg)' : 'var(--tbl-ink)';
  const accent = live ? 'var(--tbl-accent-bright)' : 'var(--tbl-accent)';
  const mutedFg = live ? 'rgba(244,237,224,0.55)' : 'var(--tbl-ink-soft)';

  const statusLabel = isCompleted ? 'Final' : isCancelled ? 'Cancelled' : 'Preview';
  const logo1 = getTeamLogoPathByName(entry.team1);
  const logo2 = getTeamLogoPathByName(entry.team2);
  const showScore = isCompleted && score;

  // The score record may have its team1/team2 (and result) reported from
  // the opposite side of the schedule entry — extractUniqueMatches walks
  // teamMatches in object-key order. Detect that and flip so score1 is
  // always entry.team1's points and the W/L badge tracks the correct side.
  const scoreFlipped = !!score && getCityName(score.team1) !== getCityName(entry.team1);
  const s1 = score ? (scoreFlipped ? score.score2 : score.score1) : 0;
  const s2 = score ? (scoreFlipped ? score.score1 : score.score2) : 0;
  const resultForTeam1: 'W' | 'L' | 'D' | undefined = score
    ? scoreFlipped
      ? score.result === 'W'
        ? 'L'
        : score.result === 'L'
        ? 'W'
        : 'D'
      : score.result
    : undefined;
  const team1Won = resultForTeam1 === 'W';
  const team2Won = resultForTeam1 === 'L';

  const body = (
    <div
      className="gz-game-card"
      style={{
        background: bg,
        color: fg,
        border: '1.5px solid var(--tbl-ink)',
        padding: '14px 18px',
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        gap: 16,
        opacity: isCancelled ? 0.5 : 1,
      }}
    >
      {/* team A */}
      <div className="gz-game-card__team" style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }}>
        <div
          className="tbl-display gz-game-card__abbr"
          style={{ fontSize: 22, textAlign: 'right' }}
        >
          {short(entry.team1)}
        </div>
        {logo1 && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo1} alt="" className="gz-game-card__logo" style={{ width: 36, height: 36, objectFit: 'contain' }} />
        )}
      </div>

      {/* center: VS / score + status */}
      <div className="gz-game-card__center" style={{ textAlign: 'center', minWidth: 90, fontFamily: 'var(--tbl-font-mono)' }}>
        {showScore ? (
          <div className="tbl-display gz-game-card__score" style={{ fontSize: 22, fontWeight: 900, whiteSpace: 'nowrap' }}>
            <span style={{ color: team1Won ? 'var(--tbl-accent)' : 'var(--tbl-ink)' }}>
              {s1.toFixed(0)}
            </span>
            <span style={{ color: 'var(--tbl-ink-mute)', margin: '0 6px', fontStyle: 'italic', fontWeight: 400 }}>—</span>
            <span style={{ color: team2Won ? 'var(--tbl-accent)' : 'var(--tbl-ink)' }}>
              {s2.toFixed(0)}
            </span>
          </div>
        ) : (
          <div
            className="tbl-display"
            style={{ fontSize: 20, fontStyle: 'italic', fontWeight: 700, opacity: 0.6 }}
          >
            vs
          </div>
        )}
        <div
          style={{
            fontSize: 9,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            marginTop: 6,
            color: accent,
            fontWeight: 700,
          }}
        >
          {statusLabel}
        </div>
        {entry.time && !isCompleted && !isCancelled && (
          <div
            className="gz-game-card__when"
            style={{
              fontSize: 9,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              marginTop: 3,
              color: mutedFg,
            }}
          >
            <span className="gz-game-card__when-full">{formatWhen(entry)}</span>
            <span className="gz-game-card__when-short">{formatTimeOnly(entry.time)}</span>
          </div>
        )}
      </div>

      {/* team B */}
      <div className="gz-game-card__team" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {logo2 && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo2} alt="" className="gz-game-card__logo" style={{ width: 36, height: 36, objectFit: 'contain' }} />
        )}
        <div className="tbl-display gz-game-card__abbr" style={{ fontSize: 22 }}>
          {short(entry.team2)}
        </div>
      </div>
    </div>
  );

  if (isCompleted && entry.matchIndex != null) {
    return (
      <Link
        href={`/matches/${entry.matchIndex}`}
        style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
      >
        {body}
      </Link>
    );
  }
  return body;
}

export function ScheduleClient({ schedule, currentWeek, scores }: Props) {
  // Default: show current week + last week only. Flip to "All" via the filter.
  const defaultWeek = currentWeek != null ? String(currentWeek) : 'All';
  const [weekFilter, setWeekFilter] = useState<string>(defaultWeek);
  const [clubFilter, setClubFilter] = useState<string>('All');

  const allWeeks = useMemo(() => {
    const set = new Set<number>();
    schedule.forEach((s) => {
      if (s.week > 0) set.add(s.week);
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [schedule]);

  const allClubs = useMemo(() => {
    const set = new Set<string>();
    schedule.forEach((s) => {
      const c1 = getCityName(s.team1);
      const c2 = getCityName(s.team2);
      if (c1) set.add(c1);
      if (c2) set.add(c2);
    });
    return Array.from(set).sort();
  }, [schedule]);

  const shown = useMemo(() => {
    const byWeek = new Map<number, ScheduleEntry[]>();
    for (const e of schedule) {
      const wk = e.week || 0;
      if (wk <= 0) continue;
      if (
        clubFilter !== 'All' &&
        getCityName(e.team1) !== clubFilter &&
        getCityName(e.team2) !== clubFilter
      ) {
        continue;
      }
      if (!byWeek.has(wk)) byWeek.set(wk, []);
      byWeek.get(wk)!.push(e);
    }

    // Which weeks to show:
    //  - explicit week selected → just that one
    //  - "All" → all weeks
    //  - default (no selection, current week known) → current + previous
    let weeks: number[];
    if (weekFilter === 'All') {
      weeks = Array.from(byWeek.keys());
    } else {
      const w = parseInt(weekFilter, 10);
      weeks = isNaN(w) ? [] : [w];
      // When defaulting to current, also include previous week.
      if (!isNaN(w) && weekFilter === defaultWeek && byWeek.has(w - 1)) {
        weeks.push(w - 1);
      }
    }
    // Newest week first so "this week" sits on top.
    weeks.sort((a, b) => b - a);
    return weeks.map((n) => [n, byWeek.get(n) ?? []] as const);
  }, [schedule, weekFilter, clubFilter, defaultWeek]);

  const filterSlot = (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <label className="gz-filter">
        <span className="gz-filter__label">Week</span>
        <select
          className="gz-filter__select"
          value={weekFilter}
          onChange={(e) => setWeekFilter(e.target.value)}
        >
          <option value="All">All</option>
          {allWeeks.map((w) => (
            <option key={w} value={String(w)}>
              {w}
            </option>
          ))}
        </select>
      </label>
      <label className="gz-filter">
        <span className="gz-filter__label">Club</span>
        <select
          className="gz-filter__select"
          value={clubFilter}
          onChange={(e) => setClubFilter(e.target.value)}
        >
          <option value="All">All</option>
          {allClubs.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
    </div>
  );

  return (
    <>
      <PageHeader
        eyebrow="Fight Card"
        title="Schedule"
        subtitle={`${weekFilter === 'All' ? 'All Weeks' : `Week ${weekFilter}`} · ${clubFilter === 'All' ? 'All Clubs' : clubFilter}`}
        right={filterSlot}
      />
      <div className="tbl-page-body">
        {shown.length === 0 ? (
          <div
            style={{
              padding: 24,
              border: '1.5px solid var(--tbl-ink)',
              background: 'var(--tbl-paper)',
              fontFamily: 'var(--tbl-font-mono)',
              fontSize: 12,
              color: 'var(--tbl-ink-soft)',
              textAlign: 'center',
            }}
          >
            No matches for this filter.
          </div>
        ) : (
          shown.map(([wk, entries]) => {
            const label =
              wk === currentWeek
                ? 'This Week'
                : currentWeek != null && wk === currentWeek - 1
                ? 'Last Week'
                : wk > (currentWeek ?? 0)
                ? 'Upcoming'
                : 'Past';
            const labelColor =
              wk === currentWeek ? 'var(--tbl-accent)' : 'var(--tbl-ink-soft)';
            return (
              <div key={wk} style={{ marginBottom: 28 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 14,
                    marginBottom: 10,
                    borderBottom: '1.5px solid var(--tbl-ink)',
                    paddingBottom: 6,
                    flexWrap: 'wrap',
                  }}
                >
                  <div
                    className="tbl-display"
                    style={{ fontSize: 30 }}
                  >
                    Week {wk}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--tbl-font-mono)',
                      fontSize: 10,
                      letterSpacing: '0.22em',
                      textTransform: 'uppercase',
                      fontWeight: 700,
                      color: labelColor,
                    }}
                  >
                    {label}
                  </div>
                </div>
                <div
                  className="gz-schedule-grid"
                  style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}
                >
                  {entries.map((e, i) => (
                    <GameCard
                      key={`${wk}-${i}-${e.team1}-${e.team2}`}
                      entry={e}
                      score={e.matchIndex != null ? scores[e.matchIndex] : undefined}
                    />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
