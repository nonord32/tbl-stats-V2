'use client';
// src/components/home/Standings.tsx
// The league table, which now leads the home page.
//
// One table at every width, on the shared DataTable: PF, PA, comeback wins,
// blown leads and streak drop below 720px, leaving #, Club, W–L and Diff on a
// phone. It replaces StandingsTwoCol + MobileStandings, which showed twelve
// teams and six respectively.
//
// Client-side because DataTable is: a server component cannot hand it the
// per-column render functions. COMEBACK_THRESHOLD comes straight from
// lib/wpa/comebacks (a pure module) rather than the lib/wpa barrel, which
// would pull the cached server accessors into the client bundle.

import Link from 'next/link';
import { DataTable, type Column } from '@/components/ui';
import { getFullTeamName, getTeamLogoPathByName } from '@/lib/teams';
import { COMEBACK_THRESHOLD } from '@/lib/wpa/comebacks';
import type { TeamStanding } from '@/types';

export interface TeamComebacks {
  comebackWins: number;
  blownLeads: number;
}

const soft = { color: 'var(--tbl-ink-soft)' };
const LOW = `${(COMEBACK_THRESHOLD * 100).toFixed(0)}%`;
const HIGH = `${((1 - COMEBACK_THRESHOLD) * 100).toFixed(0)}%`;

function streakColor(streak: string): string {
  if (streak.startsWith('W')) return 'var(--tbl-green)';
  if (streak.startsWith('D')) return 'var(--tbl-ink-soft)';
  return 'var(--tbl-red)';
}

function signed(n: number): string {
  return `${n >= 0 ? '+' : ''}${Math.round(n)}`;
}

export function Standings({
  teams,
  comebacks,
}: {
  teams: TeamStanding[];
  comebacks: Record<string, TeamComebacks>;
}) {
  if (teams.length === 0) return null;

  const columns: Column<TeamStanding>[] = [
    {
      key: 'club',
      label: 'Club',
      align: 'left',
      render: (t) => (
        <Link
          href={`/teams/${t.slug}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            textDecoration: 'none',
            color: 'var(--tbl-ink)',
          }}
        >
          {getTeamLogoPathByName(t.team) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={getTeamLogoPathByName(t.team)}
              alt=""
              style={{ width: 22, height: 22, objectFit: 'contain' }}
            />
          )}
          <span className="tbl-display" style={{ fontSize: 15, fontWeight: 700 }}>
            {getFullTeamName(t.slug)}
          </span>
        </Link>
      ),
    },
    {
      key: 'record',
      label: 'W–L',
      render: (t) => <span style={{ fontWeight: 600 }}>{t.record}</span>,
    },
    {
      key: 'pf',
      label: 'PF',
      title: 'Points scored',
      hideOnMobile: true,
      render: (t) => <span style={soft}>{Math.round(t.pf)}</span>,
    },
    {
      key: 'pa',
      label: 'PA',
      title: 'Points allowed',
      hideOnMobile: true,
      render: (t) => <span style={soft}>{Math.round(t.pa)}</span>,
    },
    {
      key: 'diff',
      label: 'Diff',
      title: 'Points scored minus points allowed',
      render: (t) => (
        <span style={{ fontWeight: 700, color: t.diff >= 0 ? 'var(--tbl-green)' : 'var(--tbl-red)' }}>
          {signed(t.diff)}
        </span>
      ),
    },
    {
      key: 'cb',
      label: 'CB',
      title: `Comeback wins — matches won after their chances fell below ${LOW}`,
      hideOnMobile: true,
      render: (t) => {
        const n = comebacks[t.slug]?.comebackWins ?? 0;
        return <span style={n > 0 ? { color: 'var(--tbl-accent)', fontWeight: 700 } : soft}>{n}</span>;
      },
    },
    {
      key: 'bl',
      label: 'BL',
      title: `Blown leads — matches lost after their chances rose above ${HIGH}`,
      hideOnMobile: true,
      render: (t) => {
        const n = comebacks[t.slug]?.blownLeads ?? 0;
        return <span style={n > 0 ? { color: 'var(--tbl-red)', fontWeight: 700 } : soft}>{n}</span>;
      },
    },
    {
      key: 'streak',
      label: 'Strk',
      hideOnMobile: true,
      render: (t) => (
        <span style={{ fontWeight: 700, color: streakColor(t.streak) }}>{t.streak}</span>
      ),
    },
  ];

  return (
    <div style={{ padding: '26px 32px 28px', borderBottom: '3px double var(--tbl-ink)' }}>
      <div className="tbl-section-rule">
        <span>The Standings · {teams.length} Clubs</span>
        <Link href="/teams" style={{ color: 'var(--tbl-ink-soft)', textDecoration: 'none' }}>
          Full table →
        </Link>
      </div>

      <DataTable
        rows={teams}
        columns={columns}
        rowKey={(t) => t.slug}
        rank
        preSorted
        emptyMessage="No standings yet."
      />
    </div>
  );
}
