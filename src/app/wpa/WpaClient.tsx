'use client';
// src/app/wpa/WpaClient.tsx
// Sortable advanced leaderboard (gazette styling), filterable by season phase.
// Defaults to a rounds minimum to qualify — small samples post wild values —
// with a toggle to show everyone. The minimum is scope-aware: a playoff run is
// only a handful of rounds, so a 10-round bar would empty that view.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { getTeamLogoPathByName, getCityName } from '@/lib/teams';
import { SectionRule } from '@/components/chrome/SectionRule';

export interface WpaScopeRow {
  matches: number;
  rounds: number;
  roundWins: number;
  wpa: number;
  wpaPerRound: number;
  avgLi: number;
  liRounds: number; // rounds counted toward LI/Clutch — excludes DQ rounds
  clutch: number;
}

export interface WpaRow {
  slug: string;
  name: string;
  team: string;
  all: WpaScopeRow;
  regular: WpaScopeRow;
  playoffs: WpaScopeRow;
}

type Phase = 'regular' | 'playoffs' | 'all';

const PHASE_LABELS: Record<Phase, string> = {
  regular: 'Regular Season',
  playoffs: 'Playoffs',
  all: 'Full Season',
};
const PHASE_ORDER: Phase[] = ['regular', 'playoffs', 'all'];

// A playoff run is only a few rounds, so the qualifier scales with the scope.
const MIN_ROUNDS: Record<Phase, number> = { regular: 10, playoffs: 3, all: 10 };

type SortKey =
  | 'wpa'
  | 'wpaPerRound'
  | 'avgLi'
  | 'clutch'
  | 'rounds'
  | 'roundWins'
  | 'matches'
  | 'name';

// A row flattened to the active scope, keeping identity fields alongside.
type FlatRow = WpaScopeRow & { slug: string; name: string; team: string };

function fmtWpa(v: number): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(3)}`;
}

export function WpaClient({ rows, lastUpdated }: { rows: WpaRow[]; lastUpdated?: string }) {
  const [sortKey, setSortKey] = useState<SortKey>('wpa');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showAll, setShowAll] = useState(false);
  const [phase, setPhase] = useState<Phase>('regular');

  // Only offer the filter once playoff rounds exist, matching the rest of the site.
  const playoffsLive = useMemo(() => rows.some((r) => r.playoffs.rounds > 0), [rows]);
  const scope: Phase = playoffsLive ? phase : 'all';
  const minRounds = MIN_ROUNDS[scope];

  // Flatten every fighter to the active scope, dropping anyone with no rounds
  // in it (a regular-season-only fighter shouldn't appear in the playoff view).
  const scoped: FlatRow[] = useMemo(
    () =>
      rows
        .map((r) => ({ slug: r.slug, name: r.name, team: r.team, ...r[scope] }))
        .filter((r) => r.rounds > 0),
    [rows, scope],
  );

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else {
      setSortKey(key);
      setSortDir(key === 'name' ? 'asc' : 'desc');
    }
  };

  const qualified = useMemo(
    () => scoped.filter((r) => showAll || r.rounds >= minRounds),
    [scoped, showAll, minRounds],
  );

  const sorted = useMemo(() => {
    return [...qualified].sort((a, b) => {
      if (sortKey === 'name') {
        return sortDir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      }
      const va = a[sortKey];
      const vb = b[sortKey];
      return sortDir === 'asc' ? va - vb : vb - va;
    });
  }, [qualified, sortKey, sortDir]);

  const th = (key: SortKey, label: string, align: 'left' | 'right', title?: string) => (
    <th
      onClick={() => handleSort(key)}
      title={title}
      style={{
        textAlign: align,
        padding: '7px 8px',
        fontSize: 10,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: sortKey === key ? 'var(--tbl-accent)' : 'var(--tbl-ink-soft)',
        fontWeight: 700,
        cursor: 'pointer',
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
      <span style={{ opacity: 0.9 }}>{sortKey === key ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ' ↕'}</span>
    </th>
  );

  return (
    <div style={{ padding: '20px 32px 40px' }}>
      <SectionRule
        left={`Advanced Leaderboard · ${PHASE_LABELS[scope]} · ${sorted.length} Fighters`}
        right={lastUpdated ? `Updated ${lastUpdated}` : undefined}
      />
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          margin: '0 0 12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          {playoffsLive && (
            <label className="gz-filter" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span className="gz-filter__label">View</span>
              <select
                className="gz-filter__select"
                value={phase}
                onChange={(e) => setPhase(e.target.value as Phase)}
                aria-label="Filter by season phase"
              >
                {PHASE_ORDER.map((p) => (
                  <option key={p} value={p}>
                    {PHASE_LABELS[p]}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label
            className="gz-filter"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
          >
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
              style={{ accentColor: 'var(--tbl-accent)' }}
            />
            <span className="gz-filter__label">
              Show all fighters (default: ≥ {minRounds} rounds — small samples post wild values)
            </span>
          </label>
        </div>
        <span
          style={{
            fontFamily: 'var(--tbl-font-mono)',
            fontSize: 10,
            letterSpacing: '0.1em',
            color: 'var(--tbl-ink-soft)',
          }}
        >
          Click any column to sort · Rds counts every round; Avg LI and Clutch exclude DQ rounds
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontFamily: 'var(--tbl-font-mono)',
            fontSize: 12,
          }}
        >
          <thead>
            <tr style={{ borderBottom: '2px solid var(--tbl-ink)' }}>
              <th style={{ width: 34, textAlign: 'left', padding: '7px 4px', fontSize: 10, color: 'var(--tbl-ink-soft)' }}>#</th>
              {th('name', 'Fighter', 'left')}
              <th style={{ textAlign: 'left', padding: '7px 8px', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--tbl-ink-soft)', fontWeight: 700 }}>
                Team
              </th>
              {th('matches', 'Matches', 'right')}
              {th('rounds', 'Rounds', 'right')}
              {th('roundWins', 'Rd Wins', 'right')}
              {th('wpa', 'Total WPA', 'right', 'Season Win Probability Added')}
              {th('wpaPerRound', 'WPA / Rd', 'right', 'WPA per round fought')}
              {th('avgLi', 'Avg LI', 'right', 'Average Leverage Index of the rounds they fought — usage, not performance. 1.00 is an average TBL round. Excludes DQ rounds.')}
              {th('clutch', 'Clutch', 'right', 'WPA minus what the same results were worth at average leverage. Excludes DQ rounds.')}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => {
              const logo = getTeamLogoPathByName(r.team);
              return (
                <tr key={r.slug} style={{ borderBottom: '1px dotted rgba(20,17,11,0.3)' }}>
                  <td style={{ padding: '9px 4px', color: 'var(--tbl-ink-soft)', fontWeight: 700 }}>{i + 1}.</td>
                  <td style={{ padding: '9px 8px' }}>
                    <Link
                      href={`/fighters/${r.slug}`}
                      className="tbl-display"
                      style={{ fontSize: 15, fontWeight: 700, color: 'var(--tbl-ink)', textDecoration: 'none' }}
                    >
                      {r.name}
                    </Link>
                  </td>
                  <td style={{ padding: '9px 8px', color: 'var(--tbl-ink-soft)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {logo && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={logo} alt="" style={{ width: 18, height: 18, objectFit: 'contain' }} />
                      )}
                      <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {getCityName(r.team) || '—'}
                      </span>
                    </span>
                  </td>
                  <td style={{ padding: '9px 8px', textAlign: 'right', color: 'var(--tbl-ink-soft)' }}>{r.matches}</td>
                  <td style={{ padding: '9px 8px', textAlign: 'right', color: 'var(--tbl-ink-soft)' }}>{r.rounds}</td>
                  <td style={{ padding: '9px 8px', textAlign: 'right', color: 'var(--tbl-ink-soft)' }}>{r.roundWins}</td>
                  <td
                    style={{
                      padding: '9px 8px',
                      textAlign: 'right',
                      fontWeight: 700,
                      color: r.wpa >= 0 ? 'var(--tbl-green)' : 'var(--tbl-red)',
                    }}
                  >
                    {fmtWpa(r.wpa)}
                  </td>
                  <td
                    style={{
                      padding: '9px 8px',
                      textAlign: 'right',
                      color: r.wpaPerRound >= 0 ? 'var(--tbl-green)' : 'var(--tbl-red)',
                    }}
                  >
                    {fmtWpa(r.wpaPerRound)}
                  </td>
                  <td
                    style={{ padding: '9px 8px', textAlign: 'right', color: 'var(--tbl-ink-soft)' }}
                    title={`${r.liRounds} rounds counted`}
                  >
                    {r.liRounds > 0 ? r.avgLi.toFixed(2) : '—'}
                  </td>
                  <td
                    style={{
                      padding: '9px 8px',
                      textAlign: 'right',
                      fontWeight: 700,
                      color: r.clutch >= 0 ? 'var(--tbl-green)' : 'var(--tbl-red)',
                    }}
                  >
                    {r.liRounds > 0 ? fmtWpa(r.clutch) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {sorted.length === 0 && (
        <p style={{ fontFamily: 'var(--tbl-font-mono)', fontSize: 12, color: 'var(--tbl-ink-soft)' }}>
          No fighters have {minRounds}+ rounds in the {PHASE_LABELS[scope].toLowerCase()} yet — tick
          &ldquo;Show all fighters&rdquo; to see everyone.
        </p>
      )}
    </div>
  );
}
