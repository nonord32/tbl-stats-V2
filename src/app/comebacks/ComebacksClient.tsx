'use client';
// src/app/comebacks/ComebacksClient.tsx
// Sortable table of every decided match by how close the winner came to losing.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { getTeamLogoPathByName, getCityName } from '@/lib/teams';
import { SectionRule } from '@/components/chrome/SectionRule';

export interface ComebackRow {
  matchIndex: number;
  date: string;
  winnerTeam: string;
  loserTeam: string;
  comebackLow: number;
  lowRound: number;
  deficitAtLow: number;
  finalMargin: number;
  isComeback: boolean;
  footnote?: string;
}

type SortKey = 'comebackLow' | 'lowRound' | 'deficitAtLow' | 'finalMargin' | 'matchIndex';

const pct = (v: number) => `${(v * 100).toFixed(2)}%`;

export function ComebacksClient({ rows, threshold }: { rows: ComebackRow[]; threshold: number }) {
  const [sortKey, setSortKey] = useState<SortKey>('comebackLow');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [onlyComebacks, setOnlyComebacks] = useState(false);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      // Lower is a bigger comeback; everything else reads best high-first.
      setSortDir(key === 'comebackLow' ? 'asc' : 'desc');
    }
  };

  const shown = useMemo(() => {
    const base = onlyComebacks ? rows.filter((r) => r.isComeback) : rows;
    return [...base].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      return sortDir === 'asc' ? va - vb : vb - va;
    });
  }, [rows, onlyComebacks, sortKey, sortDir]);

  const th = (key: SortKey, label: string, title?: string) => (
    <th
      onClick={() => handleSort(key)}
      title={title}
      style={{
        textAlign: 'right',
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
      <span style={{ opacity: 0.9 }}>{sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span>
    </th>
  );

  return (
    <div style={{ padding: '20px 32px 40px' }}>
      <SectionRule left={`Every Decided Match · ${shown.length}`} right="Click any column to sort" />
      <label
        className="gz-filter"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', margin: '0 0 12px' }}
      >
        <input
          type="checkbox"
          checked={onlyComebacks}
          onChange={(e) => setOnlyComebacks(e.target.checked)}
          style={{ accentColor: 'var(--tbl-accent)' }}
        />
        <span className="gz-filter__label">
          Only comeback wins (winner once below {(threshold * 100).toFixed(0)}%)
        </span>
      </label>

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
              <th style={{ textAlign: 'left', padding: '7px 8px', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--tbl-ink-soft)', fontWeight: 700 }}>
                Winner
              </th>
              <th style={{ textAlign: 'left', padding: '7px 8px', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--tbl-ink-soft)', fontWeight: 700 }}>
                Loser
              </th>
              {th('comebackLow', 'Low WP', 'The winner’s lowest win probability at any point after a round')}
              {th('lowRound', 'At Round')}
              {th('deficitAtLow', 'Deficit Then', 'The winner’s score differential at their low point')}
              {th('finalMargin', 'Won By')}
              {th('matchIndex', 'Match')}
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={r.matchIndex} style={{ borderBottom: '1px dotted rgba(20,17,11,0.3)' }}>
                <td style={{ padding: '9px 4px', color: 'var(--tbl-ink-soft)', fontWeight: 700 }}>{i + 1}.</td>
                <td style={{ padding: '9px 8px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {getTeamLogoPathByName(r.winnerTeam) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={getTeamLogoPathByName(r.winnerTeam)} alt="" style={{ width: 16, height: 16, objectFit: 'contain' }} />
                    )}
                    <span className="tbl-display" style={{ fontSize: 14, fontWeight: 700 }}>
                      {getCityName(r.winnerTeam)}
                    </span>
                    {r.isComeback && (
                      <span
                        style={{
                          fontSize: 8,
                          letterSpacing: '0.12em',
                          padding: '1px 5px',
                          background: 'var(--tbl-accent)',
                          color: 'var(--tbl-paper)',
                          fontWeight: 700,
                        }}
                      >
                        COMEBACK
                      </span>
                    )}
                    {r.footnote && <span style={{ color: 'var(--tbl-ink-soft)' }} title={r.footnote}>†</span>}
                  </span>
                </td>
                <td style={{ padding: '9px 8px', color: 'var(--tbl-ink-soft)' }}>
                  {getCityName(r.loserTeam)}
                </td>
                <td
                  style={{
                    padding: '9px 8px',
                    textAlign: 'right',
                    fontWeight: 700,
                    color: r.isComeback ? 'var(--tbl-accent)' : 'var(--tbl-ink)',
                  }}
                >
                  {pct(r.comebackLow)}
                </td>
                <td style={{ padding: '9px 8px', textAlign: 'right', color: 'var(--tbl-ink-soft)' }}>{r.lowRound}</td>
                <td
                  style={{
                    padding: '9px 8px',
                    textAlign: 'right',
                    color: r.deficitAtLow < 0 ? 'var(--tbl-red)' : 'var(--tbl-ink-soft)',
                  }}
                >
                  {r.deficitAtLow > 0 ? '+' : ''}
                  {r.deficitAtLow}
                </td>
                <td style={{ padding: '9px 8px', textAlign: 'right', color: 'var(--tbl-green)', fontWeight: 700 }}>
                  +{r.finalMargin}
                </td>
                <td style={{ padding: '9px 8px', textAlign: 'right' }}>
                  <Link href={`/matches/${r.matchIndex}`} style={{ color: 'var(--tbl-accent)', textDecoration: 'none' }}>
                    #{r.matchIndex} →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {shown.length === 0 && (
        <p style={{ fontFamily: 'var(--tbl-font-mono)', fontSize: 12, color: 'var(--tbl-ink-soft)' }}>
          No matches yet.
        </p>
      )}
    </div>
  );
}
