'use client';
// src/app/fighters/[slug]/FighterHero.tsx
// Fighter profile stat panel: identity hero + phase toggle, then the stats
// organized into sections — Overview, Scoring, Finishing / Results, and a
// de-emphasized Advanced block (WAR now; room for WPA later). The name stays
// fixed; the team and every stat rescope with the toggle. The toggle only
// appears once the fighter has playoff bouts.

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
}

// One labelled statistic.
function Stat({ cell, size = 30 }: { cell: StatCell; size?: number }) {
  return (
    <div>
      <div
        style={{
          fontFamily: 'var(--tbl-font-mono)',
          fontSize: 9,
          letterSpacing: '0.24em',
          color: 'var(--tbl-ink-soft)',
          fontWeight: 700,
          textTransform: 'uppercase',
        }}
      >
        {cell.l}
      </div>
      <div
        className="tbl-display"
        style={{
          fontSize: size,
          lineHeight: 1,
          marginTop: 4,
          color: cell.color ?? (cell.accent ? 'var(--tbl-accent)' : 'var(--tbl-ink)'),
        }}
      >
        {cell.v}
      </div>
    </div>
  );
}

// A titled section strip with a responsive grid of stats.
function StatSection({
  title,
  note,
  cells,
  size,
}: {
  title: string;
  note?: string;
  cells: StatCell[];
  size?: number;
}) {
  return (
    <div style={{ padding: '18px 32px', borderBottom: '1px solid rgba(20,17,11,0.18)' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 14,
        }}
      >
        <div className="tbl-eyebrow">{title}</div>
        {note && (
          <div
            style={{
              fontFamily: 'var(--tbl-font-mono)',
              fontSize: 10,
              letterSpacing: '0.08em',
              color: 'var(--tbl-ink-soft)',
            }}
          >
            {note}
          </div>
        )}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: '18px 24px',
        }}
      >
        {cells.map((c) => (
          <Stat key={c.l} cell={c} size={size} />
        ))}
      </div>
    </div>
  );
}

export function FighterHero({
  season,
  regular,
  playoffs,
  streak,
  warRank,
}: {
  season: FighterStat;
  regular: FighterStat | null;
  playoffs: FighterStat | null;
  streak: string;
  warRank: number;
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

  // ── Overview (shown prominently in the hero) ──
  const overview: StatCell[] = [
    { l: 'Record', v: active.record },
    { l: 'Win%', v: `${(active.winPct * 100).toFixed(0)}%` },
    { l: 'Rounds', v: String(active.rounds) },
    { l: 'Net Pts', v: signed(active.netPts), accent: true },
    { l: 'NP/R', v: active.nppr.toFixed(2) },
  ];

  // ── Scoring ──
  const scoring: StatCell[] = [
    { l: 'Points For', v: fmt(active.pointsFor) },
    { l: 'Points Against', v: fmt(active.pointsAgainst) },
    { l: 'Extra Points', v: String(active.extraPoints) },
    { l: 'Extra Pts Allowed', v: String(active.extraPointsAllowed) },
  ];

  // ── Finishing / Results ──
  const finishing: StatCell[] = [
    { l: 'Knockdowns', v: String(active.knockdowns) },
    { l: 'Double KDs', v: String(active.doubleKnockdowns) },
    { l: 'KO/TKO', v: String(active.koTko) },
    { l: 'KO%', v: active.wins > 0 ? `${(active.koPct * 100).toFixed(0)}%` : '—' },
  ];

  return (
    <>
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
          className="gz-fighter-hero"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            alignItems: 'flex-end',
            gap: 32,
            marginTop: 10,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              className="tbl-display gz-fighter-name"
              style={{ fontSize: 96, lineHeight: 0.88, letterSpacing: '-0.02em' }}
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

          {/* Overview stat block */}
          <div
            className="gz-hero-stats"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, auto)',
              gap: '16px 28px',
              borderLeft: '2px solid var(--tbl-ink)',
              paddingLeft: 28,
            }}
          >
            {overview.map((c) => (
              <Stat key={c.l} cell={c} size={30} />
            ))}
          </div>
        </div>
      </div>

      <StatSection title="Scoring" cells={scoring} size={26} />
      <StatSection title="Finishing / Results" cells={finishing} size={26} />

      {/* Advanced — kept but intentionally low-key. Structured so WPA (Win
          Probability Added) can drop in beside WAR later with no redesign. */}
      <div style={{ padding: '16px 32px 22px', borderBottom: '3px double var(--tbl-ink)' }}>
        <div className="tbl-eyebrow" style={{ marginBottom: 12 }}>
          Advanced
        </div>
        <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <div
              style={{
                fontFamily: 'var(--tbl-font-mono)',
                fontSize: 9,
                letterSpacing: '0.24em',
                color: 'var(--tbl-ink-soft)',
                fontWeight: 700,
                textTransform: 'uppercase',
              }}
            >
              WAR{warRank > 0 && phase === 'all' ? ` · #${warRank}` : ''}
            </div>
            <div className="tbl-display" style={{ fontSize: 22, lineHeight: 1, marginTop: 4 }}>
              {active.war.toFixed(2)}
            </div>
          </div>
          <div>
            <div
              style={{
                fontFamily: 'var(--tbl-font-mono)',
                fontSize: 9,
                letterSpacing: '0.24em',
                color: 'var(--tbl-ink-soft)',
                fontWeight: 700,
                textTransform: 'uppercase',
              }}
            >
              WPA
            </div>
            <div
              className="tbl-display"
              style={{ fontSize: 22, lineHeight: 1, marginTop: 4, color: 'var(--tbl-ink-soft)' }}
            >
              —
            </div>
            <div
              style={{
                fontFamily: 'var(--tbl-font-mono)',
                fontSize: 9,
                letterSpacing: '0.06em',
                color: 'var(--tbl-ink-soft)',
                marginTop: 3,
              }}
            >
              coming soon
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
