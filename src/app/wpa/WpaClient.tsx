'use client';
// src/app/wpa/WpaClient.tsx
// Sortable WPA leaderboard table (gazette styling). Defaults to a minimum of
// 10 rounds to qualify — small samples post wild values — with a toggle to
// show everyone.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { getTeamLogoPathByName, getCityName } from '@/lib/teams';
import { SectionRule } from '@/components/chrome/SectionRule';

export interface WpaRow {
  slug: string;
  name: string;
  team: string;
  matches: number;
  rounds: number;
  roundWins: number;
  wpa: number;
  wpaPerRound: number;
}

type SortKey = 'wpa' | 'wpaPerRound' | 'rounds' | 'roundWins' | 'matches' | 'name';

const MIN_ROUNDS = 10;

function fmtWpa(v: number): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(3)}`;
}

export function WpaClient({ rows, lastUpdated }: { rows: WpaRow[]; lastUpdated?: string }) {
  const [sortKey, setSortKey] = useState<SortKey>('wpa');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showAll, setShowAll] = useState(false);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else {
      setSortKey(key);
      setSortDir(key === 'name' ? 'asc' : 'desc');
    }
  };

  const qualified = useMemo(
    () => rows.filter((r) => showAll || r.rounds >= MIN_ROUNDS),
    [rows, showAll],
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
        left={`WPA Leaderboard · ${sorted.length} Fighters`}
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
            Show all fighters (default: ≥ {MIN_ROUNDS} rounds — small samples post wild values)
          </span>
        </label>
        <span
          style={{
            fontFamily: 'var(--tbl-font-mono)',
            fontSize: 10,
            letterSpacing: '0.1em',
            color: 'var(--tbl-ink-soft)',
          }}
        >
          Click any column to sort
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
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {sorted.length === 0 && (
        <p style={{ fontFamily: 'var(--tbl-font-mono)', fontSize: 12, color: 'var(--tbl-ink-soft)' }}>
          No fighters qualify yet.
        </p>
      )}
    </div>
  );
}
