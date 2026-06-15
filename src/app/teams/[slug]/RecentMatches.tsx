'use client';
// src/app/teams/[slug]/RecentMatches.tsx
// Phase-aware "Recent Matches" list for a team profile. When the team has
// playoff games, a Full Season / Regular Season / Playoffs toggle scopes the
// list and a small W-L summary; otherwise it renders as before.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { TeamMatch } from '@/types';
import { toSlug } from '@/lib/data';
import { type Phase } from '@/lib/phaseStats';
import { getFullTeamName } from '@/lib/teams';
import { SectionRule } from '@/components/chrome/SectionRule';

const PHASE_LABELS: Record<Phase, string> = {
  all: 'Full Season',
  regular: 'Regular Season',
  playoffs: 'Playoffs',
};

function MatchCard({ match }: { match: TeamMatch }) {
  const isDraw = match.result === 'D' || Math.abs(match.pf - match.pa) < 0.0001;
  const isWin = !isDraw && match.result === 'W';
  const isLoss = !isDraw && match.result === 'L';
  const badgeBg = isDraw
    ? 'var(--tbl-ink-soft)'
    : isWin
    ? 'var(--tbl-green)'
    : 'var(--tbl-red)';
  const badgeLetter = isDraw ? 'D' : match.result;
  const oppSlug = toSlug(match.opponent);
  const oppFull = getFullTeamName(oppSlug) || match.opponent;
  const oppLogo = `/logos/${oppSlug}.png`;

  const formattedDate = (() => {
    try {
      return new Date(match.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return match.date;
    }
  })();

  return (
    <Link
      href={`/matches/${match.matchIndex}`}
      style={{
        background: 'var(--tbl-paper)',
        border: '1.5px solid var(--tbl-ink)',
        padding: '10px 14px',
        display: 'grid',
        gridTemplateColumns: 'auto auto 1fr auto',
        alignItems: 'center',
        gap: 14,
        color: 'var(--tbl-ink)',
        textDecoration: 'none',
      }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: badgeBg,
          color: '#fff',
          fontFamily: 'var(--tbl-font-serif)',
          fontSize: 18,
          fontWeight: 900,
        }}
      >
        {badgeLetter}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={oppLogo} alt="" style={{ width: 30, height: 30, objectFit: 'contain' }} />
      <div style={{ minWidth: 0 }}>
        <div className="tbl-display" style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2 }}>
          vs {oppFull}
        </div>
        <div
          style={{
            fontFamily: 'var(--tbl-font-mono)',
            fontSize: 10,
            color: 'var(--tbl-ink-soft)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginTop: 2,
          }}
        >
          {formattedDate}
          {match.phase === 'playoffs' ? ' · Playoffs' : ''}
        </div>
      </div>
      <div className="tbl-display" style={{ fontSize: 22, fontWeight: 900, whiteSpace: 'nowrap' }}>
        <span style={{ color: isWin ? 'var(--tbl-accent)' : 'var(--tbl-ink)' }}>
          {match.pf.toFixed(0)}
        </span>
        <span style={{ color: 'var(--tbl-ink-mute)', margin: '0 4px', fontStyle: 'italic' }}>—</span>
        <span style={{ color: isLoss ? 'var(--tbl-accent)' : 'var(--tbl-ink)' }}>
          {match.pa.toFixed(0)}
        </span>
      </div>
    </Link>
  );
}

export function RecentMatches({ matches }: { matches: TeamMatch[] }) {
  const [phase, setPhase] = useState<Phase>('all');
  const hasPlayoffs = useMemo(() => matches.some((m) => m.phase === 'playoffs'), [matches]);

  const scoped = useMemo(
    () => (phase === 'all' ? matches : matches.filter((m) => m.phase === phase)),
    [matches, phase]
  );

  const summary = useMemo(() => {
    const w = scoped.filter((m) => m.result === 'W').length;
    const l = scoped.filter((m) => m.result === 'L').length;
    return `${w}-${l}`;
  }, [scoped]);

  const phaseToggle = hasPlayoffs ? (
    <label className="gz-filter" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span className="gz-filter__label">View</span>
      <select
        className="gz-filter__select"
        value={phase}
        onChange={(e) => setPhase(e.target.value as Phase)}
      >
        {(['all', 'regular', 'playoffs'] as Phase[]).map((p) => (
          <option key={p} value={p}>{PHASE_LABELS[p]}</option>
        ))}
      </select>
    </label>
  ) : null;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 160 }}>
          <SectionRule
            left={phase === 'all' ? 'Recent Matches' : `${PHASE_LABELS[phase]} · ${summary}`}
            right="Click for box score"
          />
        </div>
        {phaseToggle && <div style={{ paddingBottom: 12 }}>{phaseToggle}</div>}
      </div>
      {scoped.length === 0 ? (
        <p style={{ fontFamily: 'var(--tbl-font-mono)', fontSize: 12, color: 'var(--tbl-ink-soft)' }}>
          No match data available.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {scoped.slice(0, phase === 'all' ? 6 : scoped.length).map((m, i) => (
            <MatchCard key={i} match={m} />
          ))}
        </div>
      )}
    </>
  );
}
