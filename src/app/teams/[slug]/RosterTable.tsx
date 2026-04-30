'use client';
// src/app/teams/[slug]/RosterTable.tsx
// Sortable roster table for the team page. Defaults to Net Points (desc).
// Click any column header to re-sort; clicking the same header flips direction.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { FighterStat } from '@/types';

type SortKey = 'name' | 'weightClass' | 'record' | 'war' | 'nppr' | 'netPts';

const COLUMNS: Array<{
  key: SortKey;
  label: string;
  align: 'left' | 'right';
}> = [
  { key: 'name', label: 'Fighter', align: 'left' },
  { key: 'weightClass', label: 'Weight', align: 'left' },
  { key: 'record', label: 'Rec', align: 'right' },
  { key: 'war', label: 'WAR', align: 'right' },
  { key: 'nppr', label: 'NPPR', align: 'right' },
  { key: 'netPts', label: 'Net', align: 'right' },
];

export function RosterTable({ fighters }: { fighters: FighterStat[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('netPts');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sorted = useMemo(() => {
    const arr = [...fighters];
    arr.sort((a, b) => {
      let va: number | string;
      let vb: number | string;
      switch (sortKey) {
        case 'name':
          va = a.name;
          vb = b.name;
          break;
        case 'weightClass':
          va = a.weightClass;
          vb = b.weightClass;
          break;
        case 'record':
          va = a.wins;
          vb = b.wins;
          break;
        case 'war':
          va = a.war;
          vb = b.war;
          break;
        case 'nppr':
          va = a.nppr;
          vb = b.nppr;
          break;
        case 'netPts':
          va = a.netPts;
          vb = b.netPts;
          break;
      }
      if (typeof va === 'string') {
        return sortDir === 'asc'
          ? va.localeCompare(vb as string)
          : (vb as string).localeCompare(va);
      }
      return sortDir === 'asc'
        ? (va as number) - (vb as number)
        : (vb as number) - (va as number);
    });
    return arr;
  }, [fighters, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      // Numeric columns default to desc (highest first); name/weight default to asc.
      setSortDir(key === 'name' || key === 'weightClass' ? 'asc' : 'desc');
    }
  }

  if (fighters.length === 0) return null;

  return (
    <table
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontFamily: 'var(--tbl-font-mono)',
        fontSize: 12,
      }}
    >
      <thead>
        <tr style={{ borderBottom: '1.5px solid var(--tbl-ink)' }}>
          {COLUMNS.map((c) => {
            const isActive = sortKey === c.key;
            const arrow = isActive ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ' ↕';
            return (
              <th
                key={c.key}
                onClick={() => handleSort(c.key)}
                style={{
                  textAlign: c.align,
                  padding: '6px 6px',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  fontSize: 10,
                  textTransform: 'uppercase',
                  color: isActive ? 'var(--tbl-ink)' : 'var(--tbl-ink-soft)',
                  cursor: 'pointer',
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                {c.label}
                <span style={{ opacity: isActive ? 1 : 0.5 }}>{arrow}</span>
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {sorted.map((f) => (
          <tr key={f.slug} style={{ borderBottom: '1px dotted rgba(20,17,11,0.3)' }}>
            <td
              style={{
                padding: '9px 6px',
                fontFamily: 'var(--tbl-font-serif)',
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              <Link
                href={`/fighters/${f.slug}`}
                style={{ color: 'var(--tbl-accent)', textDecoration: 'none' }}
              >
                {f.name}
              </Link>
            </td>
            <td style={{ padding: '9px 6px', color: 'var(--tbl-ink-soft)' }}>
              {f.weightClass}
            </td>
            <td style={{ padding: '9px 6px', textAlign: 'right', fontWeight: 600 }}>
              {f.record}
            </td>
            <td
              style={{
                padding: '9px 6px',
                textAlign: 'right',
                fontWeight: 700,
                color: 'var(--tbl-accent)',
              }}
            >
              {f.war.toFixed(2)}
            </td>
            <td style={{ padding: '9px 6px', textAlign: 'right' }}>
              {f.nppr.toFixed(2)}
            </td>
            <td
              style={{
                padding: '9px 6px',
                textAlign: 'right',
                color: f.netPts >= 0 ? 'var(--tbl-green)' : 'var(--tbl-red)',
              }}
            >
              {f.netPts >= 0 ? '+' : ''}
              {f.netPts.toFixed(0)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
