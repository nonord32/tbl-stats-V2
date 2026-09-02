'use client';
// src/app/fighters/[slug]/FighterHero.tsx
// Fighter profile: a compact identity hero (name + team meta on the left, form
// strip + record on the right) over a dense stat sheet — one bordered table
// whose rows are labelled down the left edge (Overview / Scoring / Finishing /
// Advanced) with label-value pairs reading across. The name stays fixed; every
// stat rescopes with the View toggle, which only appears once the fighter has
// playoff bouts.

import { useState } from 'react';
import Link from 'next/link';
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

// One label-value pair. Label left, value right, sharing a baseline.
function Cell({ cell }: { cell: StatCell }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 10,
        padding: '9px 14px',
        borderLeft: `1px solid ${HAIRLINE}`,
        minWidth: 0,
      }}
    >
      <span style={labelStyle}>
        {cell.l}
        {cell.hint && (
          <span style={{ color: 'var(--tbl-ink-mute)', letterSpacing: '0.08em' }}> {cell.hint}</span>
        )}
      </span>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 6, whiteSpace: 'nowrap' }}>
        {cell.pre && (
          <span
            style={{
              fontFamily: 'var(--tbl-font-mono)',
              fontSize: 10,
              color: 'var(--tbl-ink-soft)',
            }}
          >
            {cell.pre}
          </span>
        )}
        <span
          className="tbl-display"
          style={{ fontSize: 21, lineHeight: 1, color: cell.color ?? 'var(--tbl-ink)' }}
        >
          {cell.v}
        </span>
      </span>
    </div>
  );
}

// A labelled row of the stat sheet: title down the left edge, cells across.
function Row({
  title,
  cells,
  children,
  last = false,
}: {
  title: string;
  cells: StatCell[];
  children?: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className="gz-sheet-row"
      style={{
        display: 'grid',
        gridTemplateColumns: '112px 1fr',
        borderBottom: last ? 'none' : `1px solid ${HAIRLINE}`,
      }}
    >
      <div
        style={{
          ...labelStyle,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          padding: '9px 14px',
          background: 'rgba(20,17,11,0.03)',
        }}
      >
        {title}
      </div>
      <div
        className="gz-sheet-cells"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}
      >
        {cells.map((c) => (
          <Cell key={c.l} cell={c} />
        ))}
        {children}
      </div>
    </div>
  );
}

export interface WpaScope {
  total: number;
  perRound: number;
  avgLi: number;
  liRounds: number;
  clutch: number;
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

  const overview: StatCell[] = [
    { l: 'Win%', v: `${(active.winPct * 100).toFixed(0)}%` },
    { l: 'Rounds', v: String(active.rounds) },
    { l: 'Net Pts', v: signed(active.netPts), color: 'var(--tbl-accent)' },
    { l: 'NP/R', v: active.nppr.toFixed(2) },
    { l: 'KO%', v: active.wins > 0 ? `${(active.koPct * 100).toFixed(0)}%` : '—' },
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
    { l: 'KO/TKO', v: String(active.koTko) },
    { l: 'KO%', hint: 'KO/TKO ÷ W', v: active.wins > 0 ? `${(active.koPct * 100).toFixed(0)}%` : '—' },
  ];
  // Ratings ignore the phase toggle, so flag that on the labels the moment the
  // reader is looking at anything narrower than the whole season.
  const seasonHint = phase === 'all' ? undefined : 'full season';
  const adjusted: StatCell[] = [
    rating && rating.sos !== null
      ? {
          l: 'SOS',
          hint: seasonHint,
          v: signed3(rating.sos),
          color: rating.sos >= 0 ? 'var(--tbl-green)' : 'var(--tbl-red)',
        }
      : { l: 'SOS', hint: seasonHint, v: '—', color: 'var(--tbl-ink-soft)' },
    rating
      ? {
          l: 'aNPPR',
          hint: seasonHint,
          pre: `±${rating.bootSd.toFixed(2)}`,
          v: signed3(rating.anppr),
          color: rating.anppr >= 0 ? 'var(--tbl-green)' : 'var(--tbl-red)',
        }
      : { l: 'aNPPR', hint: seasonHint, v: '—', color: 'var(--tbl-ink-soft)' },
    // The gap is the point of the stat: it is what the schedule was worth.
    rating
      ? {
          l: 'Δ vs NPPR',
          v: signed3(rating.delta),
          color: 'var(--tbl-ink-soft)',
        }
      : { l: 'Δ vs NPPR', v: '—', color: 'var(--tbl-ink-soft)' },
  ];

  const advanced: StatCell[] = [
    { l: warRank > 0 && phase === 'all' ? `WAR · #${warRank}` : 'WAR', v: active.war.toFixed(2) },
    activeWpa
      ? {
          l: 'WPA',
          pre: `${signed3(activeWpa.perRound)}/r`,
          v: signed3(activeWpa.total),
          color: activeWpa.total >= 0 ? 'var(--tbl-green)' : 'var(--tbl-red)',
        }
      : { l: 'WPA', v: '—', color: 'var(--tbl-ink-soft)' },
    // Average Leverage is a USAGE stat — how big the spots were, not how well
    // the fighter did in them. The hint keeps that explicit.
    activeWpa && activeWpa.liRounds > 0
      ? { l: 'Avg LI', hint: 'usage', v: activeWpa.avgLi.toFixed(2) }
      : { l: 'Avg LI', hint: 'usage', v: '—', color: 'var(--tbl-ink-soft)' },
    activeWpa && activeWpa.liRounds > 0
      ? {
          l: 'Clutch',
          v: signed3(activeWpa.clutch),
          color: activeWpa.clutch >= 0 ? 'var(--tbl-green)' : 'var(--tbl-red)',
        }
      : { l: 'Clutch', v: '—', color: 'var(--tbl-ink-soft)' },
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

      {/* Stat sheet */}
      <div style={{ padding: '0 32px 24px' }}>
        <div style={{ border: `1.5px solid var(--tbl-ink)` }}>
          <Row title="Overview" cells={overview} />
          <Row title="Scoring" cells={scoring} />
          <Row title="Finishing" cells={finishing} />
          <Row title="Schedule" cells={adjusted}>
            <div
              style={{
                gridColumn: '1 / -1',
                borderLeft: `1px solid ${HAIRLINE}`,
                borderTop: `1px solid ${HAIRLINE}`,
                padding: '8px 14px',
                fontFamily: 'var(--tbl-font-mono)',
                fontSize: 10,
                lineHeight: 1.6,
                color: 'var(--tbl-ink-soft)',
              }}
            >
              SOS = how good their opponents were, not counting rounds against this fighter ·
              aNPPR = net points per round once you account for who they fought.{' '}
              {rating ? (
                <>
                  The rating lands between {signed3(rating.lo)} and {signed3(rating.hi)} when we
                  rebuild the season
                  {rating.uncertain ? ' — a wide range, so treat it as soft' : ''}. Gaps under 0.20
                  do not mean anything.{' '}
                </>
              ) : null}
              Both cover the whole season and do not change with the view toggle above.{' '}
              <Link href="/stats#ratings" style={{ color: 'var(--tbl-accent)' }}>
                How it works →
              </Link>
              {'  ·  '}
              <Link href="/advanced?view=fighters&amp;stat=ratings" style={{ color: 'var(--tbl-accent)' }}>
                Leaderboard →
              </Link>
            </div>
          </Row>
          <Row title="Advanced" cells={advanced} last>
            <div
              style={{
                gridColumn: '1 / -1',
                borderLeft: `1px solid ${HAIRLINE}`,
                borderTop: `1px solid ${HAIRLINE}`,
                padding: '8px 14px',
                fontFamily: 'var(--tbl-font-mono)',
                fontSize: 10,
                lineHeight: 1.6,
                color: 'var(--tbl-ink-soft)',
              }}
            >
              WAR = wins this fighter added over an easily replaced one · WPA = how much their
              rounds moved the team&apos;s chance of winning · Avg LI = how big the moments were
              they were put in (not how they did) · Clutch = whether their wins came in the rounds
              that mattered. Disqualifications do not count toward Avg LI or Clutch.{' '}
              <Link href="/stats#war" style={{ color: 'var(--tbl-accent)' }}>
                WAR →
              </Link>
              {'  ·  '}
              <Link href="/stats#wpa" style={{ color: 'var(--tbl-accent)' }}>
                WPA →
              </Link>
              {'  ·  '}
              <Link href="/stats#leverage" style={{ color: 'var(--tbl-accent)' }}>
                Leverage &amp; Clutch →
              </Link>
            </div>
          </Row>
        </div>
      </div>
    </>
  );
}
