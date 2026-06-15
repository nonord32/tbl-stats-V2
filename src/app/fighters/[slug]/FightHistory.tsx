'use client';
// src/app/fighters/[slug]/FightHistory.tsx
// Phase-aware Form strip + Fight History for a fighter profile. When the
// fighter has playoff bouts, a Full Season / Regular Season / Playoffs toggle
// scopes both the form pills and the bout list; otherwise it renders exactly
// as before.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { FightHistory as FightHistoryEntry } from '@/types';
import { toSlug } from '@/lib/data';
import { calcFighterStreak, type Phase } from '@/lib/phaseStats';
import { getTeamLogoPathByName } from '@/lib/teams';
import { SectionRule } from '@/components/chrome/SectionRule';

const PHASE_LABELS: Record<Phase, string> = {
  all: 'Full Season',
  regular: 'Regular Season',
  playoffs: 'Playoffs',
};

export function FightHistory({ history }: { history: FightHistoryEntry[] }) {
  const [phase, setPhase] = useState<Phase>('all');
  const hasPlayoffs = useMemo(() => history.some((h) => h.phase === 'playoffs'), [history]);

  const scoped = useMemo(
    () => (phase === 'all' ? history : history.filter((h) => h.phase === phase)),
    [history, phase]
  );
  const streak = useMemo(() => calcFighterStreak(scoped), [scoped]);
  // Last 10 bouts oldest → newest for the form strip (history is newest-first).
  const formLast10 = [...scoped].slice(0, 10).reverse();

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
                left={`Fight History${phase === 'all' ? ' · 2026 Season' : ` · ${PHASE_LABELS[phase]}`}`}
                right={`${scoped.length} ${scoped.length === 1 ? 'bout' : 'bouts'} shown`}
              />
            </div>
            {phaseToggle && <div style={{ paddingBottom: 12 }}>{phaseToggle}</div>}
          </div>
          {scoped.length === 0 ? (
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
                {scoped.map((h, i) => {
                  const oppLogo = getTeamLogoPathByName(h.opponentTeam);
                  const isWin = h.result === 'W';
                  const roundLabel = String(h.round).startsWith('R')
                    ? String(h.round)
                    : `R${h.round}`;
                  return (
                    <div key={i} className="gz-fighter-history-row">
                      <div className="gz-fighter-history-row__result">
                        <div
                          className={`gz-fighter-history-row__badge${
                            isWin ? ' is-win' : ' is-loss'
                          }`}
                        >
                          {h.result}
                        </div>
                        {h.resultMethod && (
                          <span className="gz-fighter-history-row__method">
                            {h.resultMethod}
                          </span>
                        )}
                      </div>
                      {oppLogo && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={oppLogo}
                          alt=""
                          className="gz-fighter-history-row__logo"
                        />
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
                          {h.date} · {roundLabel}
                          {h.roundPhase ? ` · ${h.roundPhase}` : ''}
                          {h.phase === 'playoffs' ? ' · Playoffs' : ''}
                        </div>
                      </div>
                      <div
                        className="gz-fighter-history-row__net"
                        style={{
                          color:
                            h.netPts >= 0 ? 'var(--tbl-green)' : 'var(--tbl-red)',
                        }}
                      >
                        {h.netPts >= 0 ? '+' : ''}
                        {h.netPts.toFixed(0)}
                      </div>
                    </div>
                  );
                })}
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
                      {['Date', 'Opponent', 'Team', 'Round', 'Result', 'Net'].map((h, i) => (
                        <th
                          key={h}
                          style={{
                            textAlign: i < 3 ? 'left' : 'right',
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
                    {scoped.map((h, i) => {
                      const oppSlug = h.opponentTeam
                        .toLowerCase()
                        .replace(/\s+/g, '-')
                        .replace(/[^a-z0-9-]/g, '');
                      const oppLogo = getTeamLogoPathByName(h.opponentTeam);
                      const winBg = h.result === 'W' ? 'var(--tbl-green)' : 'var(--tbl-red)';
                      return (
                        <tr key={i} style={{ borderBottom: '1px dotted rgba(20,17,11,0.3)' }}>
                          <td style={{ padding: '10px 6px', color: 'var(--tbl-ink-soft)' }}>
                            {h.date}
                            {h.phase === 'playoffs' && (
                              <span
                                style={{
                                  marginLeft: 6,
                                  padding: '0 5px',
                                  fontSize: 9,
                                  fontWeight: 700,
                                  letterSpacing: '0.08em',
                                  color: '#fff',
                                  background: 'var(--tbl-accent)',
                                  textTransform: 'uppercase',
                                }}
                              >
                                PO
                              </span>
                            )}
                          </td>
                          <td
                            style={{
                              padding: '10px 6px',
                              fontFamily: 'var(--tbl-font-serif)',
                              fontSize: 14,
                              fontWeight: 700,
                            }}
                          >
                            <Link
                              href={`/fighters/${toSlug(h.opponent)}`}
                              style={{ color: 'inherit', textDecoration: 'none' }}
                            >
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
                                <img
                                  src={oppLogo}
                                  alt=""
                                  style={{ width: 18, height: 18, objectFit: 'contain' }}
                                />
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
                        </tr>
                      );
                    })}
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
