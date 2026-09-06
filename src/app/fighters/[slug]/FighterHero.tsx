'use client';
// src/app/fighters/[slug]/FighterHero.tsx
// Fighter profile: a compact identity hero (name + team meta on the left, form
// strip + record on the right) over the stat sheet — four headline numbers,
// then the remaining stats as a grouped list, box-score groups on the left and
// model-derived groups on the right, with the definitions collapsed behind one
// line. The name stays fixed; every stat rescopes with the View toggle, which
// only appears once the fighter has playoff bouts. The exception is the
// Schedule group, which is always full-season and says so on its heading.

import { useState } from 'react';
import Link from 'next/link';
import { StatTile } from '@/components/ui';
import type { FighterStat } from '@/types';
import { getTeamLogoPathByName, getFullTeamName } from '@/lib/teams';

type Phase = 'regular' | 'playoffs' | 'all';

const PHASE_LABELS: Record<Phase, string> = {
  regular: 'Regular Season',
  playoffs: 'Playoffs',
  all: 'Full Season',
};

// Toggle order: Regular Season first (default), then Playoffs, then Full Season.
const PHASE_ORDER: Phase[] = ['regular', 'playoffs', 'all'];

const HAIRLINE = 'rgba(20,17,11,0.18)';

function teamSlugOf(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}
function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
function signed(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(0)}`;
}
function signed3(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(3)}`;
}
// Wins are published to 2dp — a third decimal implies a precision these numbers
// do not have, and reads as noise next to the word "wins".
function signed2(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}`;
}

interface StatCell {
  l: string;
  v: string;
  /** small muted note shown just left of the value (e.g. a per-round rate) */
  pre?: string;
  color?: string;
  /** parenthetical clarifier after the label */
  hint?: string;
}

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--tbl-font-mono)',
  fontSize: 10,
  letterSpacing: '0.14em',
  color: 'var(--tbl-ink-soft)',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
};

// One of the four headline numbers: label above, big value below, left aligned.
function Head({ cell, rank }: { cell: StatCell; rank?: number }) {
  return (
    <div className="gz-sheet-head">
      <StatTile
        label={cell.l}
        size="xl"
        orientation="stacked"
        align="left"
        color={cell.color}
        value={
          <>
            {cell.v}
            {rank ? <span className="gz-sheet-head__rank">#{rank}</span> : null}
          </>
        }
      />
    </div>
  );
}

// A group of the stat list: a heading rule, then label-value rows beneath it.
// The note rides on the heading rather than on every label — repeating "full
// season" on three labels is what used to make them long enough to collide.
function Group({ title, note, cells }: { title: string; note?: string; cells: StatCell[] }) {
  return (
    <div className="gz-sheet-grp">
      <div className="gz-sheet-grp__head">
        {title}
        {note && <span className="gz-sheet-grp__note"> · {note}</span>}
      </div>
      {cells.map((c) => (
        <div key={c.l} className="gz-sheet-grp__row">
          <StatTile label={c.l} value={c.v} pre={c.pre} hint={c.hint} color={c.color} />
        </div>
      ))}
    </div>
  );
}

export interface WpaScope {
  total: number;
  perRound: number;
  avgLi: number;
  liRounds: number;
  clutch: number;
  /** context-neutral WPA — what the same results were worth at average stakes */
  cnWpa: number;
}
export interface WpaScopes {
  all: WpaScope;
  regular: WpaScope;
  playoffs: WpaScope;
}

// Opponent-adjusted ratings. Unlike everything else on this sheet these are
// FULL SEASON regardless of the phase toggle — the ridge fit has no phase
// split, because a playoffs-only fit would rate most fighters off two or three
// rounds. The labels say so whenever the reader is looking at a phase view.
export interface RatingScope {
  sos: number | null;
  anppr: number;
  delta: number;
  bootSd: number;
  lo: number;
  hi: number;
  uncertain: boolean;
}

export function FighterHero({
  season,
  regular,
  playoffs,
  streak,
  warRank,
  wpa = null,
  rating = null,
  form = [],
}: {
  season: FighterStat;
  regular: FighterStat | null;
  playoffs: FighterStat | null;
  streak: string;
  warRank: number;
  wpa?: WpaScopes | null;
  /** full-season opponent-adjusted ratings; null when the fighter has no bouts */
  rating?: RatingScope | null;
  /** last 10 results, oldest → newest */
  form?: ('W' | 'L' | 'D')[];
}) {
  const [phase, setPhase] = useState<Phase>(regular ? 'regular' : 'playoffs');
  const hasPlayoffs = !!playoffs;

  const active =
    phase === 'regular' ? regular ?? season : phase === 'playoffs' ? playoffs ?? season : season;

  const teamSlug = teamSlugOf(active.team);
  const fullTeamName = getFullTeamName(teamSlug);
  const teamLogo = getTeamLogoPathByName(active.team);
  const isWStreak = streak.startsWith('W');
  const instagram = active.instagram ?? season.instagram;
  const activeWpa = wpa ? wpa[phase] : null;

  // The four headline numbers. All four rescope with the View toggle — which is
  // why the opponent-adjusted ratings are deliberately not among them; a tile
  // that ignored the toggle beside four that obey it reads as a bug.
  const heads: StatCell[] = [
    { l: 'Win %', v: `${(active.winPct * 100).toFixed(0)}%` },
    { l: 'Net Points', v: signed(active.netPts), color: 'var(--tbl-accent)' },
    { l: 'Net Pts / Round', v: active.nppr.toFixed(2) },
    { l: 'WAR', v: active.war.toFixed(2) },
  ];

  const overview: StatCell[] = [
    { l: 'Rounds', v: String(active.rounds) },
    { l: 'KO %', v: active.wins > 0 ? `${(active.koPct * 100).toFixed(0)}%` : '—' },
  ];
  const scoring: StatCell[] = [
    { l: 'Points For', v: fmt(active.pointsFor) },
    { l: 'Points Against', v: fmt(active.pointsAgainst) },
    { l: 'Extra Points', v: String(active.extraPoints) },
    { l: 'XP Allowed', v: String(active.extraPointsAllowed) },
  ];
  const finishing: StatCell[] = [
    { l: 'Knockdowns', v: String(active.knockdowns) },
    { l: 'Double KDs', v: String(active.doubleKnockdowns) },
    { l: 'KO / TKO', v: String(active.koTko) },
  ];
  // Ratings ignore the phase toggle. That is marked once, on the group heading
  // ("Schedule · full season"), rather than on each label.
  const adjusted: StatCell[] = [
    rating && rating.sos !== null
      ? {
          l: 'Strength of Schedule',
          v: signed3(rating.sos),
          color: rating.sos >= 0 ? 'var(--tbl-green)' : 'var(--tbl-red)',
        }
      : { l: 'Strength of Schedule', v: '—', color: 'var(--tbl-ink-soft)' },
    rating
      ? {
          l: 'Adjusted NP/R',
          pre: `±${rating.bootSd.toFixed(2)}`,
          v: signed3(rating.anppr),
          color: rating.anppr >= 0 ? 'var(--tbl-green)' : 'var(--tbl-red)',
        }
      : { l: 'Adjusted NP/R', v: '—', color: 'var(--tbl-ink-soft)' },
    // The gap is the point of the stat: it is what the schedule was worth.
    rating
      ? { l: 'vs. raw NP/R', v: signed3(rating.delta), color: 'var(--tbl-ink-soft)' }
      : { l: 'vs. raw NP/R', v: '—', color: 'var(--tbl-ink-soft)' },
  ];

  // All three are published in wins. WPA and Clutch already were, in everything
  // but name; showing the unit is most of what makes them readable.
  const advanced: StatCell[] = [
    activeWpa
      ? {
          l: 'WPA',
          pre: `${signed3(activeWpa.perRound)}/r`,
          v: `${signed2(activeWpa.total)} wins`,
          color: activeWpa.total >= 0 ? 'var(--tbl-green)' : 'var(--tbl-red)',
        }
      : { l: 'WPA', v: '—', color: 'var(--tbl-ink-soft)' },
    // Stakes Faced is a USAGE stat — how big the spots were, not how well the
    // fighter did in them. The hint keeps that explicit.
    activeWpa && activeWpa.liRounds > 0
      ? { l: 'Stakes Faced', hint: 'usage', v: `${activeWpa.avgLi.toFixed(2)}×` }
      : { l: 'Stakes Faced', hint: 'usage', v: '—', color: 'var(--tbl-ink-soft)' },
    activeWpa && activeWpa.liRounds > 0
      ? {
          l: 'Timing',
          v: `${signed2(activeWpa.clutch)} wins`,
          color: activeWpa.clutch >= 0 ? 'var(--tbl-green)' : 'var(--tbl-red)',
        }
      : { l: 'Timing', v: '—', color: 'var(--tbl-ink-soft)' },
  ];

  return (
    <>
      {/* Breadcrumb + View toggle share one band */}
      <div
        style={{
          padding: '14px 32px 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--tbl-font-mono)',
            fontSize: 11,
            letterSpacing: '0.12em',
            color: 'var(--tbl-ink-soft)',
            textTransform: 'uppercase',
          }}
        >
          <Link href="/" style={{ color: 'var(--tbl-ink-soft)', textDecoration: 'none' }}>
            Home
          </Link>
          {' / '}
          <Link href="/fighters" style={{ color: 'var(--tbl-ink-soft)', textDecoration: 'none' }}>
            Fighters
          </Link>
          {' / '}
          <span style={{ color: 'var(--tbl-ink)' }}>{season.name}</span>
        </div>
        {hasPlayoffs && (
          <label className="gz-filter" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span className="gz-filter__label">View</span>
            <select
              className="gz-filter__select"
              value={phase}
              onChange={(e) => setPhase(e.target.value as Phase)}
            >
              {PHASE_ORDER.map((p) => (
                <option key={p} value={p}>
                  {PHASE_LABELS[p]}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {/* Identity: name + team meta on the left, form + record on the right */}
      <div
        className="gz-fighter-id"
        style={{
          padding: '6px 32px 16px',
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          alignItems: 'flex-end',
          gap: 24,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            className="tbl-display gz-fighter-name"
            style={{ fontSize: 72, lineHeight: 0.9, letterSpacing: '-0.02em' }}
          >
            {season.name}
          </div>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}
          >
            {teamLogo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={teamLogo} alt="" style={{ width: 22, height: 22, objectFit: 'contain' }} />
            )}
            <Link
              href={`/teams/${teamSlug}`}
              className="tbl-display gz-fighter-team-link"
              style={{ fontSize: 17, fontWeight: 700, color: 'var(--tbl-accent)', textDecoration: 'none' }}
            >
              {fullTeamName}
            </Link>
            <span
              style={{
                fontFamily: 'var(--tbl-font-mono)',
                fontSize: 11,
                letterSpacing: '0.16em',
                color: 'var(--tbl-ink-soft)',
                textTransform: 'uppercase',
              }}
            >
              · {active.weightClass} · {active.gender}
              {streak && (
                <>
                  {' · '}
                  <span style={{ color: isWStreak ? 'var(--tbl-green)' : 'var(--tbl-red)', fontWeight: 700 }}>
                    Streak {streak}
                  </span>
                </>
              )}
            </span>
            {instagram && (
              <a
                href={instagram}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${season.name} on Instagram`}
                title="Instagram"
                style={{ lineHeight: 0 }}
                className="ig-link"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <defs>
                    <linearGradient id="ig-grad-profile" x1="0%" y1="100%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#f09433" />
                      <stop offset="25%" stopColor="#e6683c" />
                      <stop offset="50%" stopColor="#dc2743" />
                      <stop offset="75%" stopColor="#cc2366" />
                      <stop offset="100%" stopColor="#bc1888" />
                    </linearGradient>
                  </defs>
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" stroke="url(#ig-grad-profile)" />
                  <circle cx="12" cy="12" r="4" stroke="url(#ig-grad-profile)" />
                  <circle cx="17.5" cy="6.5" r="1" fill="url(#ig-grad-profile)" stroke="none" />
                </svg>
              </a>
            )}
          </div>
        </div>

        <div
          className="gz-fighter-form"
          style={{ display: 'flex', alignItems: 'flex-end', gap: 22, flexWrap: 'wrap' }}
        >
          {form.length > 0 && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ ...labelStyle, marginBottom: 6 }}>Form · Last {form.length}</div>
              <div style={{ display: 'flex', gap: 3 }}>
                {form.map((r, i) => (
                  <span
                    key={i}
                    title={r}
                    style={{
                      width: 22,
                      height: 10,
                      background:
                        r === 'W' ? 'var(--tbl-green)' : r === 'L' ? 'var(--tbl-red)' : 'var(--tbl-ink-mute)',
                    }}
                  />
                ))}
              </div>
            </div>
          )}
          <div style={{ textAlign: 'right', borderLeft: `1px solid ${HAIRLINE}`, paddingLeft: 22 }}>
            <div style={labelStyle}>Record</div>
            <div className="tbl-display" style={{ fontSize: 34, lineHeight: 1, marginTop: 2 }}>
              {active.record}
            </div>
          </div>
        </div>
      </div>

      {/* Stat sheet: four headline numbers, then the rest as a grouped list —
          box-score stats on the left, model-derived stats on the right. The
          explainer sits outside the grids rather than spanning one, which is
          what used to hold the auto-fit tracks open and collide the cells. */}
      <div style={{ padding: '0 32px 24px' }}>
        <div style={{ border: `1.5px solid var(--tbl-ink)`, background: 'var(--tbl-paper)' }}>
          <div className="gz-sheet-heads">
            {heads.map((c) => (
              <Head
                key={c.l}
                cell={c}
                rank={c.l === 'WAR' && warRank > 0 && phase === 'all' ? warRank : undefined}
              />
            ))}
          </div>

          <div className="gz-sheet-groups">
            <div className="gz-sheet-col">
              <Group title="Overview" cells={overview} />
              <Group title="Scoring" cells={scoring} />
              <Group title="Finishing" cells={finishing} />
            </div>
            <div className="gz-sheet-col">
              <Group title="Schedule" note="full season" cells={adjusted} />
              <Group title="Advanced" cells={advanced} />
            </div>
          </div>

          <details className="gz-sheet-exp">
            <summary className="gz-sheet-exp__head">What do these mean?</summary>
            <div className="gz-sheet-exp__body">
              <p>
                <b>Strength of Schedule</b> is how good this fighter&apos;s opponents were, not
                counting the rounds they fought against them. <b>Adjusted NP/R</b> is net points
                per round once you account for who they fought
                {rating ? (
                  <>
                    {' '}
                    — theirs lands between {signed3(rating.lo)} and {signed3(rating.hi)} when we
                    rebuild the season
                    {rating.uncertain ? ', a wide range, so treat it as soft' : ''}. Gaps under
                    0.20 do not mean anything
                  </>
                ) : null}
                . Both cover the whole season and do not change with the view toggle above.{' '}
                <Link href="/stats#ratings">How it works →</Link>
                {'  ·  '}
                <Link href="/advanced?view=fighters&stat=ratings">Leaderboard →</Link>
              </p>
              <p>
                <b>WAR</b> is the wins this fighter added over an easily replaced one.{' '}
                <b>Win Probability Added</b> is how much their rounds actually moved the team&apos;s chance of
                winning. <b>Stakes Faced</b> is how big the moments were that they were put in —
                not how they did in them; 1.00× is an ordinary round.{' '}
                <b>Timing</b> is the part of their WPA that came from <i>when</i> those
                results landed.
                {activeWpa && activeWpa.liRounds > 0 ? (
                  <>
                    {' '}
                    Here: their rounds moved {fullTeamName}&apos;s chances by{' '}
                    <b>{signed2(activeWpa.total)} wins</b>; the same wins and losses at average
                    stakes would have been worth <b>{signed2(activeWpa.cnWpa)}</b>; timing added{' '}
                    <b>{signed2(activeWpa.clutch)}</b>.
                  </>
                ) : null}{' '}
                Disqualifications count toward neither Stakes Faced nor Timing.{' '}
                <Link href="/stats#war">WAR →</Link>
                {'  ·  '}
                <Link href="/stats#wpa">WPA →</Link>
                {'  ·  '}
                <Link href="/stats#leverage">Stakes &amp; Timing →</Link>
              </p>
            </div>
          </details>
        </div>
      </div>
    </>
  );
}
