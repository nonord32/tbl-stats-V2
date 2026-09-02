'use client';
// src/app/advanced/MatchesView.tsx
// Comebacks and blown leads: how close each winner came to losing. Featured
// cards for the biggest, then every decided match in a sortable table.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, DataTable, SectionRule, StatTile, Toggle, type Column } from '@/components/ui';
import type { AdvancedMeta, MatchRow } from './types';

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
  const [onlyComebacks, setOnlyComebacks] = useState(false);

  const shown = useMemo(
    () => (onlyComebacks ? rows.filter((r) => r.isComeback) : rows),
    [rows, onlyComebacks],
  );

  const footnoted = featured.find((f) => f.footnote);

  const columns: Column<MatchRow>[] = [
    {
      key: 'winner',
      label: 'Winner',
      align: 'left',
      render: (r) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {r.winnerLogo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.winnerLogo} alt="" style={{ width: 16, height: 16, objectFit: 'contain' }} />
          )}
          <span className="tbl-display" style={{ fontSize: 14, fontWeight: 700 }}>
            {r.winnerTeam}
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
          {r.footnote && (
            <span style={{ color: 'var(--tbl-ink-soft)' }} title={r.footnote}>
              †
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'loser',
      label: 'Loser',
      align: 'left',
      hideOnMobile: true,
      render: (r) => <span style={{ color: 'var(--tbl-ink-soft)' }}>{r.loserTeam}</span>,
    },
    {
      key: 'comebackLow',
      label: 'Low Point',
      title: 'The lowest the winner’s chances ever fell after a round',
      sortable: true,
      ascFirst: true, // a lower low is a bigger comeback
      value: (r) => r.comebackLow,
      render: (r) => (
        <span
          style={{ fontWeight: 700, color: r.isComeback ? 'var(--tbl-accent)' : 'var(--tbl-ink)' }}
        >
          {pct(r.comebackLow)}
        </span>
      ),
    },
    {
      key: 'lowRound',
      label: 'At Round',
      sortable: true,
      hideOnMobile: true,
      value: (r) => r.lowRound,
      render: (r) => <span style={{ color: 'var(--tbl-ink-soft)' }}>{r.lowRound}</span>,
    },
    {
      key: 'deficitAtLow',
      label: 'Behind By',
      title: 'The winner’s score differential at their low point',
      sortable: true,
      hideOnMobile: true,
      value: (r) => r.deficitAtLow,
      render: (r) => (
        <span style={{ color: r.deficitAtLow < 0 ? 'var(--tbl-red)' : 'var(--tbl-ink-soft)' }}>
          {r.deficitAtLow > 0 ? '+' : ''}
          {r.deficitAtLow}
        </span>
      ),
    },
    {
      key: 'finalMargin',
      label: 'Won By',
      sortable: true,
      value: (r) => r.finalMargin,
      render: (r) => (
        <span style={{ color: 'var(--tbl-green)', fontWeight: 700 }}>+{r.finalMargin}</span>
      ),
    },
    {
      key: 'matchIndex',
      label: 'Match',
      sortable: true,
      value: (r) => r.matchIndex,
      render: (r) => (
        <Link
          href={`/matches/${r.matchIndex}`}
          style={{ color: 'var(--tbl-accent)', textDecoration: 'none' }}
        >
          #{r.matchIndex} →
        </Link>
      ),
    },
  ];

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
              <Card
                key={m.matchIndex}
                padding="13px 15px"
                style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
              >
                <StatTile
                  label={`No. ${i + 1}`}
                  value={pct(m.comebackLow)}
                  size="xl"
                  tone="mute"
                  color="var(--tbl-accent)"
                  orientation="stacked"
                  align="left"
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {m.winnerLogo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.winnerLogo}
                      alt=""
                      style={{ width: 18, height: 18, objectFit: 'contain' }}
                    />
                  )}
                  <span className="tbl-display" style={{ fontSize: 17, fontWeight: 800 }}>
                    {m.winnerTeam}
                  </span>
                  {m.footnote && (
                    <span style={{ color: 'var(--tbl-ink-soft)' }} title={m.footnote}>
                      †
                    </span>
                  )}
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
                  <Link
                    href={`/matches/${m.matchIndex}`}
                    style={{ color: 'var(--tbl-accent)', textDecoration: 'none' }}
                  >
                    Match #{m.matchIndex} →
                  </Link>
                </div>
              </Card>
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
      <div style={{ margin: '0 0 12px' }}>
        <Toggle
          checked={onlyComebacks}
          onChange={setOnlyComebacks}
          label={`Only comeback wins (winner once below ${(meta.comebackThreshold * 100).toFixed(0)}%)`}
        />
      </div>

      <DataTable
        rows={shown}
        columns={columns}
        rowKey={(r) => r.matchIndex}
        rank
        defaultSort={{ key: 'comebackLow', dir: 'asc' }}
        emptyMessage="No matches yet."
      />
    </div>
  );
}
