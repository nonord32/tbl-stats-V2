'use client';
// src/app/fighters/[slug]/FightHistory.tsx
// Form strip + Fight History for a fighter profile.

import { Fragment, useMemo } from 'react';
import Link from 'next/link';
import type { FightHistory as FightHistoryEntry } from '@/types';
import { toSlug } from '@/lib/data';
import { calcFighterStreak } from '@/lib/phaseStats';
import { getTeamLogoPathByName } from '@/lib/teams';
import { SectionRule } from '@/components/chrome/SectionRule';

export function FightHistory({
  history,
  roundLabels = {},
  wpaByRound = {},
  wpaBestKey,
  wpaWorstKey,
}: {
  history: FightHistoryEntry[];
  // matchIndex → playoff round label ("Quarterfinals" / "Semifinals" / "MegaBrawl")
  roundLabels?: Record<number, string>;
  // matchIndex:roundId → this fighter's WPA for that bout (see fighters/[slug]/page.tsx)
  wpaByRound?: Record<string, number>;
  wpaBestKey?: string; // key of the fighter's single biggest positive round
  wpaWorstKey?: string; // ... and biggest negative round
}) {
  const streak = useMemo(() => calcFighterStreak(history), [history]);
  // For a bout, the label shown in the "week" slot: the playoff round for
  // playoff bouts (falling back to "Playoffs" if the round can't be resolved),
  // otherwise the regular-season week number.
  const weekSlot = (h: FightHistoryEntry): string | null => {
    if (h.phase === 'playoffs') return roundLabels[h.matchIndex] ?? 'Playoffs';
    return h.week != null ? `Wk ${h.week}` : null;
  };
  // Last 10 bouts oldest → newest for the form strip (history is newest-first).
  const formLast10 = [...history].slice(0, 10).reverse();

  // Phase split: group the history into a Postseason block (on top, most recent)
  // and a Regular Season block, each with its own record / net / NPPR summary.
  // With no playoff bouts, fall back to a single flat list (unchanged).
  const playoffBouts = history.filter((h) => h.phase === 'playoffs');
  const regularBouts = history.filter((h) => h.phase !== 'playoffs');
  const groups: { label: string | null; accent: boolean; bouts: FightHistoryEntry[] }[] =
    playoffBouts.length > 0
      ? [
          { label: 'Postseason', accent: true, bouts: playoffBouts },
          { label: 'Regular Season', accent: false, bouts: regularBouts },
        ].filter((g) => g.bouts.length > 0)
      : [{ label: null, accent: false, bouts: history }];
  const summaryText = (bouts: FightHistoryEntry[]): string => {
    const w = bouts.filter((b) => b.result === 'W').length;
    const l = bouts.filter((b) => b.result === 'L').length;
    const net = bouts.reduce((s, b) => s + b.netPts, 0);
    const nppr = bouts.length ? net / bouts.length : 0;
    return `${w}-${l} · ${net >= 0 ? '+' : ''}${net.toFixed(0)} net · ${nppr.toFixed(2)} NPPR`;
  };
  const boutKey = (h: FightHistoryEntry) => `${h.matchIndex}-${h.roundId}`;
  // Join key into wpaByRound — must mirror wpaRoundKey in fighters/[slug]/page.tsx.
  const wpaKey = (h: FightHistoryEntry) => `${h.matchIndex}:${h.roundId}`;
  const hasWpa = Object.keys(wpaByRound).length > 0;
  const fmtWpa = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(3)}`;
  const wpaMarker = (key: string): { label: string; color: string } | null => {
    if (key === wpaBestKey) return { label: '▲ best', color: 'var(--tbl-green)' };
    if (key === wpaWorstKey) return { label: '▼ worst', color: 'var(--tbl-red)' };
    return null;
  };

  // ── Mobile card + desktop row renderers (shared across phase groups) ──
  const renderCard = (h: FightHistoryEntry) => {
    const oppLogo = getTeamLogoPathByName(h.opponentTeam);
    const isWin = h.result === 'W';
    const roundLabel = String(h.round).startsWith('R') ? String(h.round) : `R${h.round}`;
    return (
      <div key={boutKey(h)} className="gz-fighter-history-row">
        <div className="gz-fighter-history-row__result">
          <div className={`gz-fighter-history-row__badge${isWin ? ' is-win' : ' is-loss'}`}>
            {h.result}
          </div>
          {h.resultMethod && (
            <span className="gz-fighter-history-row__method">{h.resultMethod}</span>
          )}
        </div>
        {oppLogo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={oppLogo} alt="" className="gz-fighter-history-row__logo" />
        )}
        <div className="gz-fighter-history-row__body">
          <Link
            href={`/fighters/${toSlug(h.opponent)}`}
            className="gz-fighter-history-row__name"
            style={{ color: 'inherit', textDecoration: 'none' }}
          >
            {h.opponent}
          </Link>
          <div className="gz-fighter-history-row__meta">
            {weekSlot(h) ? `${weekSlot(h)} · ` : ''}
            {h.date} · {roundLabel}
            {h.roundPhase ? ` · ${h.roundPhase}` : ''}
            {hasWpa && wpaByRound[wpaKey(h)] != null && (
              <>
                {' · '}
                <span
                  style={{
                    color: wpaByRound[wpaKey(h)] >= 0 ? 'var(--tbl-green)' : 'var(--tbl-red)',
                    fontWeight: 700,
                  }}
                >
                  WPA {fmtWpa(wpaByRound[wpaKey(h)])}
                </span>
                {wpaMarker(wpaKey(h)) && (
                  <span style={{ color: wpaMarker(wpaKey(h))!.color, fontWeight: 700 }}>
                    {' '}
                    {wpaMarker(wpaKey(h))!.label}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
        <div
          className="gz-fighter-history-row__net"
          style={{ color: h.netPts >= 0 ? 'var(--tbl-green)' : 'var(--tbl-red)' }}
        >
          {h.netPts >= 0 ? '+' : ''}
          {h.netPts.toFixed(0)}
        </div>
      </div>
    );
  };

  const renderRow = (h: FightHistoryEntry) => {
    const oppSlug = h.opponentTeam.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const oppLogo = getTeamLogoPathByName(h.opponentTeam);
    const winBg = h.result === 'W' ? 'var(--tbl-green)' : 'var(--tbl-red)';
    return (
      <tr key={boutKey(h)} style={{ borderBottom: '1px dotted rgba(20,17,11,0.3)' }}>
        <td style={{ padding: '10px 6px', color: 'var(--tbl-ink-soft)' }}>
          {h.date}
        </td>
        <td style={{ padding: '10px 6px', color: 'var(--tbl-ink-soft)' }}>
          {h.phase === 'playoffs'
            ? roundLabels[h.matchIndex] ?? 'Playoffs'
            : h.week != null
            ? h.week
            : '—'}
        </td>
        <td
          style={{
            padding: '10px 6px',
            fontFamily: 'var(--tbl-font-serif)',
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          <Link href={`/fighters/${toSlug(h.opponent)}`} style={{ color: 'inherit', textDecoration: 'none' }}>
            {h.opponent}
          </Link>
        </td>
        <td style={{ padding: '10px 6px' }}>
          <Link
            href={`/teams/${oppSlug}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: 'var(--tbl-ink-soft)',
              textDecoration: 'none',
            }}
          >
            {oppLogo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={oppLogo} alt="" style={{ width: 18, height: 18, objectFit: 'contain' }} />
            )}
            <span style={{ fontSize: 11 }}>{h.opponentTeam.toUpperCase()}</span>
          </Link>
        </td>
        <td style={{ padding: '10px 6px', textAlign: 'right' }}>
          <div>{String(h.round).startsWith('R') ? h.round : `R${h.round}`}</div>
          {h.roundPhase && (
            <div style={{ fontSize: 10, color: 'var(--tbl-ink-soft)', marginTop: 2 }}>
              {h.roundPhase}
            </div>
          )}
        </td>
        <td style={{ padding: '10px 6px', textAlign: 'right' }}>
          <span
            style={{
              display: 'inline-block',
              padding: '1px 8px',
              minWidth: 22,
              background: winBg,
              color: '#fff',
              fontFamily: 'var(--tbl-font-serif)',
              fontWeight: 900,
              fontSize: 14,
            }}
          >
            {h.result}
          </span>
          {h.resultMethod && (
            <div style={{ fontSize: 10, color: 'var(--tbl-ink-soft)', marginTop: 2 }}>
              {h.resultMethod}
            </div>
          )}
        </td>
        <td
          style={{
            padding: '10px 6px',
            textAlign: 'right',
            fontWeight: 700,
            color: h.netPts >= 0 ? 'var(--tbl-green)' : 'var(--tbl-red)',
          }}
        >
          {h.netPts >= 0 ? '+' : ''}
          {h.netPts.toFixed(0)}
        </td>
        {hasWpa && (() => {
          const key = wpaKey(h);
          const wpa = wpaByRound[key];
          const marker = wpaMarker(key);
          return (
            <td style={{ padding: '10px 6px', textAlign: 'right', whiteSpace: 'nowrap' }}>
              {wpa != null ? (
                <>
                  <span style={{ fontWeight: 700, color: wpa >= 0 ? 'var(--tbl-green)' : 'var(--tbl-red)' }}>
                    {fmtWpa(wpa)}
                  </span>
                  {marker && (
                    <div style={{ fontSize: 9, letterSpacing: '0.1em', color: marker.color, marginTop: 2, textTransform: 'uppercase', fontWeight: 700 }}>
                      {marker.label}
                    </div>
                  )}
                </>
              ) : (
                <span style={{ color: 'var(--tbl-ink-mute)' }}>—</span>
              )}
            </td>
          );
        })()}
      </tr>
    );
  };

  // Group-header styling helpers.
  const groupLabelColor = (accent: boolean) =>
    accent ? 'var(--tbl-accent)' : 'var(--tbl-ink)';

  return (
    <>
      {/* Form · Last 10 — desktop-only strip of W/L pills (oldest → newest). */}
      {formLast10.length > 0 && (
        <div className="gz-fighter-form" style={{ padding: '20px 32px 4px' }}>
          <SectionRule
            left={`Form · Last ${formLast10.length}`}
            right={`Streak ${streak || '—'}`}
          />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {formLast10.map((h, i) => {
              const isWin = h.result === 'W';
              return (
                <div
                  key={i}
                  className="tbl-display"
                  style={{
                    width: 36,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isWin ? 'var(--tbl-green)' : 'var(--tbl-red)',
                    color: '#fff',
                    fontSize: 16,
                    fontWeight: 900,
                  }}
                  title={`${h.date} · ${h.opponent} · ${h.result}`}
                >
                  {h.result}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Body: Fight History */}
      <div>
        <div style={{ padding: '24px 32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <SectionRule
                left="Fight History · 2026 Season"
                right={`${history.length} ${history.length === 1 ? 'bout' : 'bouts'} shown`}
              />
            </div>
          </div>
          {history.length === 0 ? (
            <p
              style={{
                fontFamily: 'var(--tbl-font-mono)',
                fontSize: 12,
                color: 'var(--tbl-ink-soft)',
              }}
            >
              No fight data available.
            </p>
          ) : (
            <>
              {/* Mobile: card-list view (hidden on desktop) */}
              <div className="gz-fighter-history-cards">
                {groups.map((g) => (
                  <Fragment key={g.label ?? 'all'}>
                    {g.label && (
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'baseline',
                          gap: 10,
                          flexWrap: 'wrap',
                          margin: '14px 0 6px',
                          paddingBottom: 4,
                          borderBottom: '1.5px solid var(--tbl-ink)',
                          fontFamily: 'var(--tbl-font-mono)',
                          fontSize: 10,
                          letterSpacing: '0.16em',
                          textTransform: 'uppercase',
                          fontWeight: 700,
                        }}
                      >
                        <span style={{ color: groupLabelColor(g.accent) }}>{g.label}</span>
                        <span style={{ color: 'var(--tbl-ink-soft)', fontWeight: 400 }}>
                          {summaryText(g.bouts)}
                        </span>
                      </div>
                    )}
                    {g.bouts.map(renderCard)}
                  </Fragment>
                ))}
              </div>

              {/* Desktop: full table (hidden on mobile) */}
              <div className="gz-fighter-history-table" style={{ overflowX: 'auto' }}>
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
                      {([
                        ['Date', 'left'],
                        ['Week', 'left'],
                        ['Opponent', 'left'],
                        ['Team', 'left'],
                        ['Round', 'right'],
                        ['Result', 'right'],
                        ['Net', 'right'],
                        ...(hasWpa ? ([['WPA', 'right']] as [string, 'left' | 'right'][]) : []),
                      ] as [string, 'left' | 'right'][]).map(([h, align]) => (
                        <th
                          key={h}
                          style={{
                            textAlign: align,
                            padding: '6px 6px',
                            fontWeight: 700,
                            letterSpacing: '0.12em',
                            fontSize: 10,
                            textTransform: 'uppercase',
                            color: 'var(--tbl-ink-soft)',
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((g) => (
                      <Fragment key={g.label ?? 'all'}>
                        {g.label && (
                          <tr>
                            <td
                              colSpan={hasWpa ? 8 : 7}
                              style={{
                                padding: '16px 6px 6px',
                                borderBottom: '1.5px solid var(--tbl-ink)',
                                fontFamily: 'var(--tbl-font-mono)',
                                fontSize: 10,
                                letterSpacing: '0.16em',
                                textTransform: 'uppercase',
                                fontWeight: 700,
                              }}
                            >
                              <span style={{ color: groupLabelColor(g.accent) }}>{g.label}</span>
                              <span style={{ color: 'var(--tbl-ink-soft)', fontWeight: 400 }}>
                                {'  ·  '}
                                {summaryText(g.bouts)}
                              </span>
                            </td>
                          </tr>
                        )}
                        {g.bouts.map(renderRow)}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
