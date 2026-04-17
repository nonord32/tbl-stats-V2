'use client';
// src/app/results/ResultsClient.tsx

import React, { useState } from 'react';
import Link from 'next/link';
import { toSlug } from '@/lib/data';
import { getFullTeamName } from '@/lib/teams';
import type { MatchResult, BoxScoreRound } from '@/types';

interface Props {
  matches: MatchResult[];
}

function BoxScoreExpand({ boxScore, team1, team2 }: { boxScore: BoxScoreRound[]; team1: string; team2: string }) {
  // Ordered unique phases as they appear in the data
  const phases = Array.from(new Set(boxScore.map((r) => r.phase).filter(Boolean)));

  // Per-phase subtotals
  const phaseTotals = phases.map((phase) => {
    const rows = boxScore.filter((r) => r.phase === phase);
    return {
      phase,
      score1: rows.reduce((s, r) => s + r.score1, 0),
      score2: rows.reduce((s, r) => s + r.score2, 0),
    };
  });

  const total1 = boxScore.reduce((s, r) => s + r.score1, 0);
  const total2 = boxScore.reduce((s, r) => s + r.score2, 0);

  return (
    <div>
      {/* ── Option B: Phase summary scorecard strip ── */}
      <div className="results-scorecard-wrap">
        <table className="results-scorecard">
          <thead>
            <tr>
              <th className="results-scorecard-team-col">Team</th>
              {phaseTotals.map((pt) => (
                <th key={pt.phase} className="results-scorecard-phase-col">{pt.phase || 'Rounds'}</th>
              ))}
              <th className="results-scorecard-total-col">Total</th>
            </tr>
          </thead>
          <tbody>
            {[
              { label: team1, s: (pt: typeof phaseTotals[0]) => pt.score1, opp: (pt: typeof phaseTotals[0]) => pt.score2, total: total1, oppTotal: total2 },
              { label: team2, s: (pt: typeof phaseTotals[0]) => pt.score2, opp: (pt: typeof phaseTotals[0]) => pt.score1, total: total2, oppTotal: total1 },
            ].map(({ label, s, opp, total, oppTotal }) => (
              <tr key={label}>
                <td className="results-scorecard-team-name">{label}</td>
                {phaseTotals.map((pt) => {
                  const mine = s(pt);
                  const theirs = opp(pt);
                  const color = mine > theirs ? 'var(--result-w)' : mine < theirs ? 'var(--result-l)' : 'var(--text)';
                  return (
                    <td key={pt.phase} className="results-scorecard-cell" style={{ color, fontWeight: mine > theirs ? 700 : 400 }}>
                      {mine.toFixed(1)}
                    </td>
                  );
                })}
                <td className="results-scorecard-cell results-scorecard-total" style={{
                  color: total > oppTotal ? 'var(--result-w)' : total < oppTotal ? 'var(--result-l)' : 'var(--text)',
                  fontWeight: 700,
                }}>
                  {total.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Phase-sectioned round-by-round table ── */}
      <div className="results-phases">
        {phases.length > 0 ? (
          phases.map((phase) => {
            const rows = boxScore.filter((r) => r.phase === phase);
            const sub1 = rows.reduce((s, r) => s + r.score1, 0);
            const sub2 = rows.reduce((s, r) => s + r.score2, 0);
            return (
              <div key={phase} className="results-phase-section">
                <div className="results-phase-header">{phase || 'Rounds'}</div>
                <div className="results-boxscore">
                  <table>
                    <thead>
                      <tr>
                        <th>Rnd</th>
                        <th>{team1}</th>
                        <th>{team2}</th>
                        <th className="num-cell">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => {
                        const home = row.score1 > row.score2;
                        const away = row.score2 > row.score1;
                        return (
                          <tr key={i}>
                            <td className="mono" style={{ fontSize: 12, color: 'var(--text-muted)', width: 36 }}>{row.round}</td>
                            <td style={{ fontWeight: home ? 700 : 400, fontSize: 13 }}>
                              <Link href={`/fighters/${toSlug(row.fighter1)}`} style={{ color: home ? 'var(--accent)' : 'var(--text)' }}>
                                {row.fighter1}
                              </Link>
                            </td>
                            <td style={{ fontWeight: away ? 700 : 400, fontSize: 13 }}>
                              <Link href={`/fighters/${toSlug(row.fighter2)}`} style={{ color: away ? 'var(--accent)' : 'var(--text)' }}>
                                {row.fighter2}
                              </Link>
                            </td>
                            <td className="num-cell mono" style={{ fontSize: 12 }}>
                              <span style={{ color: home ? 'var(--result-w)' : 'var(--text-muted)' }}>{row.score1.toFixed(1)}</span>
                              {' – '}
                              <span style={{ color: away ? 'var(--result-w)' : 'var(--text-muted)' }}>{row.score2.toFixed(1)}</span>
                            </td>
                          </tr>
                        );
                      })}
                      {/* Phase subtotal */}
                      <tr className="results-phase-subtotal">
                        <td className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>SUB</td>
                        <td />
                        <td />
                        <td className="num-cell mono" style={{ fontSize: 12 }}>
                          <span style={{ color: sub1 > sub2 ? 'var(--result-w)' : sub1 < sub2 ? 'var(--result-l)' : 'var(--text-muted)' }}>{sub1.toFixed(1)}</span>
                          {' – '}
                          <span style={{ color: sub2 > sub1 ? 'var(--result-w)' : sub2 < sub1 ? 'var(--result-l)' : 'var(--text-muted)' }}>{sub2.toFixed(1)}</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        ) : (
          // Fallback: no phase data, render flat table
          <div className="results-boxscore">
            <table>
              <thead>
                <tr>
                  <th>Rnd</th>
                  <th>{team1}</th>
                  <th>{team2}</th>
                  <th className="num-cell">Score</th>
                </tr>
              </thead>
              <tbody>
                {boxScore.map((row, i) => {
                  const home = row.score1 > row.score2;
                  const away = row.score2 > row.score1;
                  return (
                    <tr key={i}>
                      <td className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{row.round}</td>
                      <td style={{ fontWeight: home ? 700 : 400 }}>
                        <Link href={`/fighters/${toSlug(row.fighter1)}`} style={{ color: home ? 'var(--accent)' : 'var(--text)' }}>{row.fighter1}</Link>
                      </td>
                      <td style={{ fontWeight: away ? 700 : 400 }}>
                        <Link href={`/fighters/${toSlug(row.fighter2)}`} style={{ color: away ? 'var(--accent)' : 'var(--text)' }}>{row.fighter2}</Link>
                      </td>
                      <td className="num-cell mono" style={{ fontSize: 12 }}>
                        <span style={{ color: home ? 'var(--result-w)' : 'var(--text-muted)' }}>{row.score1.toFixed(1)}</span>
                        {' – '}
                        <span style={{ color: away ? 'var(--result-w)' : 'var(--text-muted)' }}>{row.score2.toFixed(1)}</span>
                      </td>
                    </tr>
                  );
                })}
                <tr style={{ background: 'var(--bg-table-alt)', fontWeight: 700 }}>
                  <td className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>TOTAL</td>
                  <td /><td />
                  <td className="num-cell mono" style={{ fontSize: 13 }}>
                    <span style={{ color: total1 > total2 ? 'var(--result-w)' : 'var(--result-l)' }}>{total1.toFixed(1)}</span>
                    {' – '}
                    <span style={{ color: total2 > total1 ? 'var(--result-w)' : 'var(--result-l)' }}>{total2.toFixed(1)}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function MatchCard({ match }: { match: MatchResult }) {
  const [expanded, setExpanded] = useState(false);

  const team1Name = getFullTeamName(toSlug(match.team1));
  const team2Name = getFullTeamName(toSlug(match.team2));

  const team1Won = match.result === 'W';
  const team2Won = match.result === 'L';
  const isDraw  = match.result === 'D';

  const formattedDate = (() => {
    try {
      return new Date(match.date).toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
      });
    } catch { return match.date; }
  })();

  return (
    <div className={`results-card ${expanded ? 'results-card--open' : ''}`}>
      <button className="results-card-main" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
        {/* Team 1 */}
        <div className={`results-team results-team--left ${team1Won ? 'results-team--winner' : team2Won ? 'results-team--loser' : ''}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/logos/${toSlug(match.team1)}.png`} alt={team1Name} className="results-logo"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <span className="results-team-name">{team1Name}</span>
          {team1Won && <span className="results-winner-badge">W</span>}
        </div>

        {/* Score */}
        <div className="results-score-block">
          <span className="results-score">
            <span style={{ color: team1Won ? 'var(--result-w)' : team2Won ? 'var(--result-l)' : 'var(--text)' }}>
              {match.score1.toFixed(1)}
            </span>
            <span className="results-score-sep">–</span>
            <span style={{ color: team2Won ? 'var(--result-w)' : team1Won ? 'var(--result-l)' : 'var(--text)' }}>
              {match.score2.toFixed(1)}
            </span>
          </span>
          <span className="results-rounds-line">
            {isDraw ? 'Draw' : `Rounds ${match.wins1}–${match.wins2}`}
          </span>
        </div>

        {/* Team 2 */}
        <div className={`results-team results-team--right ${team2Won ? 'results-team--winner' : team1Won ? 'results-team--loser' : ''}`}>
          {team2Won && <span className="results-winner-badge">W</span>}
          <span className="results-team-name">{team2Name}</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/logos/${toSlug(match.team2)}.png`} alt={team2Name} className="results-logo"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </div>

        <span className="results-chevron" aria-hidden="true">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="results-expand">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Box Score · {formattedDate}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Link href={`/teams/${toSlug(match.team1)}`} onClick={(e) => e.stopPropagation()}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)' }}>
                {team1Name} →
              </Link>
              <Link href={`/teams/${toSlug(match.team2)}`} onClick={(e) => e.stopPropagation()}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)' }}>
                {team2Name} →
              </Link>
            </div>
          </div>
          <BoxScoreExpand boxScore={match.boxScore} team1={team1Name} team2={team2Name} />
        </div>
      )}
    </div>
  );
}

export function ResultsClient({ matches }: Props) {
  const grouped: { date: string; matches: MatchResult[] }[] = [];
  const dateMap = new Map<string, MatchResult[]>();

  for (const m of matches) {
    if (!dateMap.has(m.date)) {
      dateMap.set(m.date, []);
      grouped.push({ date: m.date, matches: dateMap.get(m.date)! });
    }
    dateMap.get(m.date)!.push(m);
  }

  const formatDateHeading = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      });
    } catch { return dateStr; }
  };

  return (
    <div className="page">
      <div className="container">
        <div className="page-header">
          <h1>Results</h1>
          <div className="subtitle">All Matches · 2026 TBL Season</div>
        </div>
        <p className="page-intro">
          All Team Boxing League match results for the 2026 season. Click any match to see the full box score broken down by phase.
        </p>

        {matches.length === 0 ? (
          <div className="card"><div className="loading">No match data available</div></div>
        ) : (
          grouped.map(({ date, matches: dayMatches }) => (
            <div key={date} className="results-date-group">
              <div className="results-date-heading">{formatDateHeading(date)}</div>
              {dayMatches.map((m) => <MatchCard key={m.matchIndex} match={m} />)}
            </div>
          ))
        )}

        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
          {matches.length} match{matches.length !== 1 ? 'es' : ''} · Click any match to see the box score
        </div>
      </div>
    </div>
  );
}
