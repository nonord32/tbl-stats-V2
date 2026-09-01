'use client';
// src/app/fighters/[slug]/FighterHero.tsx
// Fighter profile stat panel: an identity hero + phase toggle, then the stats as
// a consistent stack of full-width rows — Overview, Scoring, Finishing / Results,
// and a de-emphasized Advanced row (WAR now; a WPA cell is reserved for later).
// The name stays fixed; the team and every stat rescope with the toggle. The
// toggle only appears once the fighter has playoff bouts.

import { useState } from 'react';
import Link from 'next/link';
import type { FighterStat } from '@/types';
import { getTeamLogoPathByName, getFullTeamName } from '@/lib/teams';
import { SectionRule } from '@/components/chrome/SectionRule';

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

// Whole number, or one decimal if not integral.
function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
function signed(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(0)}`;
}

interface StatCell {
  l: string;
  v: string;
  accent?: boolean;
  color?: string;
  sub?: string;
}

// A full-width, evenly-spaced row of stats: a SectionRule header over a crisp
// hairline grid (mirrors the home page "Fighter in Focus" strip). The hairline
// grid — container top/left borders + per-cell right/bottom borders — reads
// cleanly at any column count and wraps gracefully on mobile.
function StatStrip({
  title,
  note,
  cells,
  size = 28,
}: {
  title: string;
  note?: string;
  cells: StatCell[];
  size?: number;
}) {
  return (
    <div style={{ padding: '18px 32px 22px' }}>
      <SectionRule left={title} right={note} />
      <div
        className="gz-profile-strip"
        style={{
          display: 'grid',
          // auto-fit so each row fills evenly and wraps cleanly on mobile with no
          // orphaned cell (a lone last cell stretches to the full width).
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          borderTop: `1px solid ${HAIRLINE}`,
          borderLeft: `1px solid ${HAIRLINE}`,
        }}
      >
        {cells.map((c) => (
          <div
            key={c.l}
            style={{
              padding: '14px 10px',
              textAlign: 'center',
              borderRight: `1px solid ${HAIRLINE}`,
              borderBottom: `1px solid ${HAIRLINE}`,
            }}
          >
            <div
              style={{
                fontFamily: 'var(--tbl-font-mono)',
                fontSize: 9,
                letterSpacing: '0.22em',
                color: 'var(--tbl-ink-soft)',
                fontWeight: 700,
                textTransform: 'uppercase',
              }}
            >
              {c.l}
            </div>
            <div
              className="tbl-display"
              style={{
                fontSize: size,
                lineHeight: 1,
                marginTop: 6,
                color: c.color ?? (c.accent ? 'var(--tbl-accent)' : 'var(--tbl-ink)'),
              }}
            >
              {c.v}
            </div>
            {c.sub && (
              <div
                style={{
                  fontFamily: 'var(--tbl-font-mono)',
                  fontSize: 9,
                  letterSpacing: '0.06em',
                  color: 'var(--tbl-ink-soft)',
                  marginTop: 4,
                }}
              >
                {c.sub}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export interface WpaScopes {
  all: { total: number; perRound: number };
  regular: { total: number; perRound: number };
  playoffs: { total: number; perRound: number };
}

export function FighterHero({
  season,
  regular,
  playoffs,
  streak,
  warRank,
  wpa = null,
}: {
  season: FighterStat;
  regular: FighterStat | null;
  playoffs: FighterStat | null;
  streak: string;
  warRank: number;
  wpa?: WpaScopes | null;
}) {
  // Default to Regular Season; a playoff-only fighter (no regular bouts) opens
  // on Playoffs so the toggle's starting view matches the stats shown.
  const [phase, setPhase] = useState<Phase>(regular ? 'regular' : 'playoffs');
  const hasPlayoffs = !!playoffs;

  const active =
    phase === 'regular' ? regular ?? season : phase === 'playoffs' ? playoffs ?? season : season;

  const teamSlug = teamSlugOf(active.team);
  const fullTeamName = getFullTeamName(teamSlug);
  const teamLogo = getTeamLogoPathByName(active.team);
  const isWStreak = streak.startsWith('W');
  const instagram = active.instagram ?? season.instagram;

  const overview: StatCell[] = [
    { l: 'Record', v: active.record },
    { l: 'Win%', v: `${(active.winPct * 100).toFixed(0)}%` },
    { l: 'Rounds', v: String(active.rounds) },
    { l: 'Net Pts', v: signed(active.netPts), accent: true },
    { l: 'NP/R', v: active.nppr.toFixed(2) },
  ];

  const scoring: StatCell[] = [
    { l: 'Points For', v: fmt(active.pointsFor) },
    { l: 'Points Against', v: fmt(active.pointsAgainst) },
    { l: 'Extra Points', v: String(active.extraPoints) },
    { l: 'Extra Pts Allowed', v: String(active.extraPointsAllowed) },
  ];

  const finishing: StatCell[] = [
    { l: 'Knockdowns', v: String(active.knockdowns) },
    { l: 'Double KDs', v: String(active.doubleKnockdowns) },
    { l: 'KO/TKO', v: String(active.koTko) },
    { l: 'KO%', v: active.wins > 0 ? `${(active.koPct * 100).toFixed(0)}%` : '—' },
  ];

  // Advanced: kept but low-key. WAR rank is shown only in the Full Season view
  // (the rank is computed against the season leaderboard). WPA rescopes with
  // the toggle like everything else.
  const activeWpa = wpa ? wpa[phase] : null;
  const advanced: StatCell[] = [
    {
      l: warRank > 0 && phase === 'all' ? `WAR · #${warRank}` : 'WAR',
      v: active.war.toFixed(2),
    },
    activeWpa
      ? {
          l: 'WPA',
          v: `${activeWpa.total >= 0 ? '+' : ''}${activeWpa.total.toFixed(3)}`,
          color: activeWpa.total >= 0 ? 'var(--tbl-green)' : 'var(--tbl-red)',
          sub: `${activeWpa.perRound >= 0 ? '+' : ''}${activeWpa.perRound.toFixed(3)} per round`,
        }
      : { l: 'WPA', v: '—', color: 'var(--tbl-ink-soft)', sub: 'no rounds credited' },
  ];

  return (
    <>
      {/* Identity hero */}
      <div style={{ padding: '22px 32px 26px', borderBottom: '3px double var(--tbl-ink)' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div className="tbl-eyebrow">
            Fighter
            {streak && <> · Streak {streak}</>}
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

        <div
          className="tbl-display gz-fighter-name"
          style={{ fontSize: 96, lineHeight: 0.88, letterSpacing: '-0.02em', marginTop: 10 }}
        >
          {season.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
          {teamLogo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={teamLogo} alt="" style={{ width: 36, height: 36, objectFit: 'contain' }} />
          )}
          <Link
            href={`/teams/${teamSlug}`}
            className="tbl-display gz-fighter-team-link"
            style={{ fontSize: 18, fontWeight: 700, color: 'var(--tbl-accent)', textDecoration: 'none' }}
          >
            {fullTeamName}
          </Link>
          <span
            style={{
              fontFamily: 'var(--tbl-font-mono)',
              fontSize: 11,
              letterSpacing: '0.18em',
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
                width="20"
                height="20"
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

      <StatStrip title="Overview" cells={overview} size={30} />
      <StatStrip title="Scoring" cells={scoring} />
      <StatStrip title="Finishing / Results" cells={finishing} note="KO% = KO/TKO ÷ wins" />
      <div style={{ borderBottom: '3px double var(--tbl-ink)' }}>
        <StatStrip title="Advanced" cells={advanced} />
        <div
          style={{
            padding: '0 32px 16px',
            marginTop: -8,
            fontFamily: 'var(--tbl-font-mono)',
            fontSize: 10,
            letterSpacing: '0.08em',
            color: 'var(--tbl-ink-soft)',
          }}
        >
          WAR = wins added over a replacement-level fighter · WPA = how much each round moved
          the team&apos;s chance of winning.{' '}
          <Link href="/stats/war" style={{ color: 'var(--tbl-accent)' }}>
            How WAR works →
          </Link>
          {'  ·  '}
          <Link href="/stats/wpa" style={{ color: 'var(--tbl-accent)' }}>
            How WPA works →
          </Link>
        </div>
      </div>
    </>
  );
}
