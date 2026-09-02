'use client';
// src/app/advanced/MatchesView.tsx
// Comebacks and blown leads: how close each winner came to losing. Featured
// cards for the biggest, then every decided match in a sortable table.
// Lifted from the old /comebacks page and its client.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { SectionRule } from '@/components/chrome/SectionRule';
import type { AdvancedMeta, MatchRow } from './types';

type SortKey = 'comebackLow' | 'lowRound' | 'deficitAtLow' | 'finalMargin' | 'matchIndex';

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

export function MatchesView({
  rows,
  featured,
  lastUpdated,
  meta,
}: {
  rows: MatchRow[];
  featured: MatchRow[];
  lastUpdated?: string;
  meta: AdvancedMeta;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('comebackLow');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [onlyComebacks, setOnlyComebacks] = useState(false);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      // A lower low is a bigger comeback; everything else reads best high-first.
      setSortDir(key === 'comebackLow' ? 'asc' : 'desc');
    }
  };

  const shown = useMemo(() => {
    const base = onlyComebacks ? rows.filter((r) => r.isComeback) : rows;
    return [...base].sort((a, b) => {
      const d = a[sortKey] - b[sortKey];
      return sortDir === 'asc' ? d : -d;
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

  const footnoted = featured.find((f) => f.footnote);

  return (
    <div style={{ padding: '20px 32px 40px' }}>
      {featured.length > 0 && (
        <>
          <SectionRule
            left={`Biggest Comebacks · ${meta.comebackCount} of ${meta.decidedMatches} matches`}
            right={lastUpdated ? `Updated ${lastUpdated}` : undefined}
          />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
              gap: 12,
              margin: '0 0 26px',
            }}
          >
            {featured.map((m, i) => (
              <div
                key={m.matchIndex}
                style={{
                  background: 'var(--tbl-paper)',
                  border: '1.5px solid var(--tbl-ink)',
                  padding: '13px 15px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--tbl-font-mono)',
                    fontSize: 9,
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    color: 'var(--tbl-ink-mute)',
                    fontWeight: 700,
                  }}
                >
                  No. {i + 1}
                </div>
                <div className="tbl-display" style={{ fontSize: 38, lineHeight: 1, color: 'var(--tbl-accent)' }}>
                  {pct(m.comebackLow)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {m.winnerLogo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.winnerLogo} alt="" style={{ width: 18, height: 18, objectFit: 'contain' }} />
                  )}
                  <span className="tbl-display" style={{ fontSize: 17, fontWeight: 800 }}>
                    {m.winnerTeam}
                  </span>
                  {m.footnote && <span style={{ color: 'var(--tbl-ink-soft)' }} title={m.footnote}>†</span>}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--tbl-font-mono)',
                    fontSize: 10,
                    lineHeight: 1.6,
                    color: 'var(--tbl-ink-soft)',
                  }}
                >
                  Down {Math.abs(m.deficitAtLow)} after round {m.lowRound} against {m.loserTeam}. Won
                  by {m.finalMargin}.{' '}
                  <Link href={`/matches/${m.matchIndex}`} style={{ color: 'var(--tbl-accent)', textDecoration: 'none' }}>
                    Match #{m.matchIndex} →
                  </Link>
                </div>
              </div>
            ))}
          </div>
          {footnoted?.footnote && (
            <p
              style={{
                fontFamily: 'var(--tbl-font-mono)',
                fontSize: 10,
                lineHeight: 1.65,
                color: 'var(--tbl-ink-soft)',
                margin: '-16px 0 24px',
                maxWidth: 720,
              }}
            >
              † {footnoted.footnote}
            </p>
          )}
        </>
      )}

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
          Only comeback wins (winner once below {(meta.comebackThreshold * 100).toFixed(0)}%)
        </span>
      </label>

      <div style={{ overflowX: 'auto' }}>
        <table
          style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--tbl-font-mono)', fontSize: 12 }}
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
              {th('comebackLow', 'Low Point', 'The lowest the winner’s chances ever fell after a round')}
              {th('lowRound', 'At Round')}
              {th('deficitAtLow', 'Behind By', 'The winner’s score differential at their low point')}
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
                    {r.winnerLogo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.winnerLogo} alt="" style={{ width: 16, height: 16, objectFit: 'contain' }} />
                    )}
                    <span className="tbl-display" style={{ fontSize: 14, fontWeight: 700 }}>{r.winnerTeam}</span>
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
                <td style={{ padding: '9px 8px', color: 'var(--tbl-ink-soft)' }}>{r.loserTeam}</td>
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
                  {r.deficitAtLow > 0 ? '+' : ''}{r.deficitAtLow}
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
