'use client';
// src/app/fighters/[slug]/FighterHero.tsx
// Profile hero with a Full Season / Regular / Playoffs toggle. The name stays
// fixed; the team, the 6-stat block, and the record rescope with the toggle.
// The toggle only appears once the fighter has playoff bouts.

import { useState } from 'react';
import Link from 'next/link';
import type { FighterStat } from '@/types';
import { getTeamLogoPathByName, getFullTeamName } from '@/lib/teams';

type Phase = 'all' | 'regular' | 'playoffs';

const PHASE_LABELS: Record<Phase, string> = {
  all: 'Full Season',
  regular: 'Regular Season',
  playoffs: 'Playoffs',
};

function teamSlugOf(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
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
  const [phase, setPhase] = useState<Phase>('all');
  const hasPlayoffs = !!playoffs;

  const active =
    phase === 'regular' ? regular ?? season : phase === 'playoffs' ? playoffs ?? season : season;

  const teamSlug = teamSlugOf(active.team);
  const fullTeamName = getFullTeamName(teamSlug);
  const teamLogo = getTeamLogoPathByName(active.team);
  const isWStreak = streak.startsWith('W');
  const instagram = active.instagram ?? season.instagram;

  const heroStats: { l: string; v: string; accent?: boolean }[] = [
    { l: 'Record', v: active.record },
    { l: 'WAR', v: active.war.toFixed(2), accent: true },
    { l: 'NPPR', v: active.nppr.toFixed(2) },
    { l: 'Net Pts', v: `${active.netPts >= 0 ? '+' : ''}${active.netPts.toFixed(0)}` },
    { l: 'Win%', v: `${(active.winPct * 100).toFixed(0)}%` },
    { l: 'Rounds', v: String(active.rounds) },
  ];

  return (
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
          {warRank > 0 && <> · #{warRank} WAR</>}
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
              {(['all', 'regular', 'playoffs'] as Phase[]).map((p) => (
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
          {heroStats.map((s) => (
            <div key={s.l}>
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
                {s.l}
              </div>
              <div
                className="tbl-display"
                style={{ fontSize: 30, lineHeight: 1, marginTop: 4, color: s.accent ? 'var(--tbl-accent)' : 'var(--tbl-ink)' }}
              >
                {s.v}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
