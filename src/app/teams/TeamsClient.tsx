'use client';
// src/app/teams/TeamsClient.tsx

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import type { TeamStanding, TeamMatch } from '@/types';
import { calcTeamStreak } from '@/lib/data';

type SortKey = 'record' | 'pf' | 'pa' | 'diff';

interface Props {
  teams: TeamStanding[];
  teamMatches: Record<string, TeamMatch[]>;
  lastUpdated: string;
}

function StreakBadge({ streak }: { streak: string }) {
  if (!streak) return null;
  const isWin = streak.startsWith('W');
  return <span className={`badge ${isWin ? 'badge-win' : 'badge-loss'}`}>{streak}</span>;
}

function BoxScoreModal({
  team,
  matches,
  onClose,
}: {
  team: TeamStanding;
  matches: TeamMatch[];
  onClose: () => void;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 900 }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-header">
          <div>
            <div className="modal-title">{team.team} — Box Scores</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
              <span className="badge">{team.record}</span>
              <span className="badge">PF {team.pf.toFixed(1)}</span>
              <span className="badge">PA {team.pa.toFixed(1)}</span>
              <span className="badge" style={{ color: team.diff >= 0 ? 'var(--result-w)' : 'var(--result-l)' }}>
                Diff {team.diff >= 0 ? '+' : ''}{team.diff.toFixed(1)}
              </span>
              {team.streak && <StreakBadge streak={team.streak} />}
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">
          {matches.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No match data found.</p>
          ) : (
            matches.map((match, mi) => (
              <div key={mi} className="match-card">
                <div className="match-card-header">
                  <span className="matchup">
                    {team.team} vs {match.opponent}
                  </span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className={`result-${match.result.toLowerCase()}`} style={{ fontSize: 14 }}>
                      {match.result === 'W' ? 'WIN' : match.result === 'L' ? 'LOSS' : 'DRAW'}
                    </span>
                    <span className="badge">
                      {match.pf.toFixed(1)} – {match.pa.toFixed(1)}
                    </span>
                    <span className="match-date">{match.date}</span>
                  </div>
                </div>
                <div className="table-wrap" style={{ border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 var(--radius) var(--radius)' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Rnd</th>
                        <th>Phase</th>
                        <th>{team.team}</th>
                        <th>{match.opponent}</th>
                        <th className="num-cell">Score</th>
                        <th>Winner</th>
                      </tr>
                    </thead>
                    <tbody>
                      {match.boxScore.map((row, ri) => {
                        const homeWon = row.score1 > row.score2;
                        const awayWon = row.score2 > row.score1;
                        return (
                          <tr key={ri}>
                            <td className="mono" style={{ fontSize: 12 }}>{row.round}</td>
                            <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{row.phase}</td>
                            <td style={{ fontWeight: homeWon ? 700 : 400 }}>{row.fighter1}</td>
                            <td style={{ fontWeight: awayWon ? 700 : 400 }}>{row.fighter2}</td>
                            <td className="num-cell mono" style={{ fontSize: 12 }}>
                              <span style={{ color: homeWon ? 'var(--result-w)' : 'inherit' }}>{row.score1.toFixed(1)}</span>
                              {' – '}
                              <span style={{ color: awayWon ? 'var(--result-w)' : 'inherit' }}>{row.score2.toFixed(1)}</span>
                            </td>
                            <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{row.winner}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}

          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <Link
              href={`/teams/${team.slug}`}
              style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: 'var(--accent)' }}
              onClick={onClose}
            >
              View full team page →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TeamsClient({ teams, teamMatches, lastUpdated }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('record');
  const [modalTeam, setModalTeam] = useState<TeamStanding | null>(null);

  const sorted = useMemo(() => {
    return [...teams].sort((a, b) => {
      switch (sortKey) {
        case 'record': return b.wins - a.wins || a.losses - b.losses || b.diff - a.diff;
        case 'pf':     return b.pf - a.pf;
        case 'pa':     return a.pa - b.pa; // lower PA = better
        case 'diff':   return b.diff - a.diff;
        default:       return 0;
      }
    });
  }, [teams, sortKey]);

  const updatedStr = new Date(lastUpdated).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  });

  return (
    <div className="page">
      <div className="container">
        <div className="page-header">
          <h1>Team Standings</h1>
          <div className="subtitle">Team Rankings · 2026 TBL Season</div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="sort-btns">
              <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--text-muted)', marginRight: 4 }}>
                Sort by:
              </span>
              {(['record', 'pf', 'pa', 'diff'] as SortKey[]).map((k) => (
                <button
                  key={k}
                  className={`sort-btn ${sortKey === k ? 'active' : ''}`}
                  onClick={() => setSortKey(k)}
                >
                  {k === 'record' ? 'Record' : k.toUpperCase()}
                </button>
              ))}
            </div>
            <span className="last-updated">Updated: {updatedStr}</span>
          </div>

          {/* Stat key */}
          <div style={{ padding: '8px 20px', display: 'flex', gap: 16, flexWrap: 'wrap', borderBottom: '1px solid var(--border)', background: 'var(--bg-table-alt)' }}>
            {[
              { k: 'PF', v: 'Points For' },
              { k: 'PA', v: 'Points Against' },
              { k: 'Diff', v: 'Point Differential' },
            ].map((s) => (
              <span key={s.k} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--text-muted)' }}>
                <strong style={{ color: 'var(--text)' }}>{s.k}</strong> {s.v}
              </span>
            ))}
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 32 }}>#</th>
                  <th>Team</th>
                  <th className="num-cell">Record</th>
                  <th className="num-cell">PF</th>
                  <th className="num-cell">PA</th>
                  <th className="num-cell">Diff</th>
                  <th>Streak</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((t, i) => {
                  const matches = teamMatches[t.team] || [];
                  const streak = t.streak || calcTeamStreak(matches);
                  return (
                    <tr key={t.slug}>
                      <td className="rank-cell">{i + 1}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`/logos/${t.slug}.png`}
                            alt={t.team}
                            style={{ width: 24, height: 24, objectFit: 'contain', flexShrink: 0 }}
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                          <button
                            className="fighter-name-btn"
                            onClick={() => setModalTeam(t)}
                          >
                            {t.team}
                          </button>
                        </div>
                      </td>
                      <td className="num-cell mono">{t.record}</td>
                      <td className="num-cell mono">{t.pf.toFixed(1)}</td>
                      <td className="num-cell mono">{t.pa.toFixed(1)}</td>
                      <td
                        className="num-cell mono"
                        style={{ color: t.diff >= 0 ? 'var(--result-w)' : 'var(--result-l)', fontWeight: 600 }}
                      >
                        {t.diff >= 0 ? '+' : ''}{t.diff.toFixed(1)}
                      </td>
                      <td>{streak && <StreakBadge streak={streak} />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
          {teams.length} teams · Click a team name to view box scores
        </div>
      </div>

      {/* Modal */}
      {modalTeam && (
        <BoxScoreModal
          team={modalTeam}
          matches={teamMatches[modalTeam.team] || []}
          onClose={() => setModalTeam(null)}
        />
      )}
    </div>
  );
}
