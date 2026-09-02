'use client';
// src/app/teams/[slug]/RosterTable.tsx
// Sortable roster table for the team page. Defaults to Net Points (desc).
//
// On the shared DataTable at compact density, which is what this table's
// tighter 6px padding became when the five hand-rolled tables were unified.

import Link from 'next/link';
import { DataTable, type Column } from '@/components/ui';
import type { FighterStat } from '@/types';

const COLUMNS: Column<FighterStat>[] = [
  {
    key: 'name',
    label: 'Fighter',
    align: 'left',
    sortable: true,
    value: (f) => f.name,
    render: (f) => (
      <Link
        href={`/fighters/${f.slug}`}
        style={{
          color: 'var(--tbl-accent)',
          textDecoration: 'none',
          fontFamily: 'var(--tbl-font-serif)',
          fontSize: 14,
          fontWeight: 700,
        }}
      >
        {f.name}
      </Link>
    ),
  },
  {
    key: 'weightClass',
    label: 'Weight',
    align: 'left',
    sortable: true,
    hideOnMobile: true,
    value: (f) => f.weightClass,
    render: (f) => <span style={{ color: 'var(--tbl-ink-soft)' }}>{f.weightClass}</span>,
  },
  {
    key: 'record',
    label: 'Rec',
    sortable: true,
    value: (f) => f.wins,
    render: (f) => <span style={{ fontWeight: 600 }}>{f.record}</span>,
  },
  {
    key: 'war',
    label: 'WAR',
    sortable: true,
    value: (f) => f.war,
    render: (f) => (
      <span style={{ fontWeight: 700, color: 'var(--tbl-accent)' }}>{f.war.toFixed(2)}</span>
    ),
  },
  {
    key: 'nppr',
    label: 'NPPR',
    sortable: true,
    hideOnMobile: true,
    value: (f) => f.nppr,
    render: (f) => f.nppr.toFixed(2),
  },
  {
    key: 'netPts',
    label: 'Net',
    sortable: true,
    value: (f) => f.netPts,
    render: (f) => (
      <span style={{ color: f.netPts >= 0 ? 'var(--tbl-green)' : 'var(--tbl-red)' }}>
        {f.netPts >= 0 ? '+' : ''}
        {f.netPts.toFixed(0)}
      </span>
    ),
  },
];

export function RosterTable({ fighters }: { fighters: FighterStat[] }) {
  return (
    <DataTable
      rows={fighters}
      columns={COLUMNS}
      rowKey={(f) => f.slug}
      density="compact"
      defaultSort={{ key: 'netPts', dir: 'desc' }}
      emptyMessage="No fighters on this roster yet."
    />
  );
}
