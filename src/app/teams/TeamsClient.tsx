'use client';
// src/app/teams/TeamsClient.tsx

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import type { TeamStanding, TeamMatch, BoxScoreRound } from '@/types';
import { calcTeamStreak, toSlug } from '@/lib/data';
import { getTeamColor, getTeamLogoPath, getFullTeamName } from '@/lib/teams';

type SortKey = 'record' | 'pf' | 'pa' | 'diff' | 'streak';

interface Props {
  teams: TeamStanding[];
  teamMatches: Record<string, TeamMatch[]>;
  seoText?: string;
}

function StreakBadge({ streak }: { streak: string }) {
  if (!streak) return null;
  const isWin = streak.startsWith('W');
  return <span className={`badge ${isWin ? 'badge-win' : 'badge-loss'}`}>{streak}</span>;
}

function MatchScorecardRow({
  match,
  teamName,
}: {
  match: TeamMatch;
  teamName: string;
}) {
  const phases = Array.from(new Set(match.boxScore.map((r: BoxScoreRound) => r.phase).filter(Boolean)));
  const phaseTotals = phases.map((phase) => {
    const rows = match.boxScore.filter((r: BoxScoreRound) => r.phase === phase);
    return {
      phase,
      score1: rows.reduce((s: number, r: BoxScoreRound) => s + r.score1, 0),
      score2: rows.reduce((s: number, r: BoxScoreRound) => s + r.score2, 0),
    };
  });

  const total1 = match.pf;
  const total2 = match.pa;
  const opponentSlug = toSlug(match.opponent);
  const opponentFullName = getFullTeamName(opponentSlug);

  const formattedDate = (() => {
    try {
      return new Date(match.date).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      });
    } catch { return match.date; }
  })();

  return (
    <div className="match-card" style={{ marginBottom: 16 }}>
      <div className="match-card-header">
        <span className="matchup" style={{ fontSize: 13 }}>
          {teamName} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>vs</span> {opponentFullName}
        </span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className={`result-${match.result.toLowerCase()}`} style={{ fontSize: 13, fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace' }}>
            {match.result === 'W' ? 'WIN' : match.result === 'L' ? 'LOSS' : 'DRAW'}
          </span>
          <span className="badge" style={{ fontSize: 11 }}>
            {match.pf.toFixed(1)} – {match.pa.toFixed(1)}
          </span>
          <span className="match-date">{formattedDate}</span>
        </div>
      </div>

      {/* Phase scorecard */}
      <div style={{ border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 var(--radius) var(--radius)', overflow: 'hidden' }}>
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
                { label: teamName, scores: phaseTotals.map((pt) => pt.score1), oppScores: phaseTotals.map((pt) => pt.score2), total: total1, oppTotal: total2 },
                { label: opponentFullName, scores: phaseTotals.map((pt) => pt.score2), oppScores: phaseTotals.map((pt) => pt.score1), total: total2, oppTotal: total1 },
              ].map(({ label, scores, oppScores, total, oppTotal }) => (
                <tr key={label}>
                  <td className="results-scorecard-team-name">{label}</td>
                  {scores.map((score, i) => {
                    const opp = oppScores[i];
                    const color = score > opp ? 'var(--result-w)' : score < opp ? 'var(--result-l)' : 'var(--text)';
                    return (
                      <td key={i} className="results-scorecard-cell" style={{ color, fontWeight: score > opp ? 700 : 400 }}>
                        {score.toFixed(1)}
                      </td>
                    );
                  })}
                  <td
                    className="results-scorecard-cell results-scorecard-total"
                    style={{
                      color: total > oppTotal ? 'var(--result-w)' : total < oppTotal ? 'var(--result-l)' : 'var(--text)',
                      fontWeight: 700,
                    }}
                  >
                    {total.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '6px 14px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
          <Link
            href={`/matches/${match.matchIndex}`}
            style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--accent)' }}
          >
            Full match →
          </Link>
        </div>
      </div>
    </div>
  );
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
  // Sort most recent first
  const sorted = [...matches].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
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
          {sorted.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No match data found.</p>
          ) : (
            sorted.map((match, mi) => (
              <MatchScorecardRow key={mi} match={match} teamName={team.team} />
            ))
          )}

          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)', textAlign: 'right' }}>
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

function streakVal(s: string): number {
  if (!s) return 0;
  const n = parseInt(s.slice(1)) || 0;
  return s.startsWith('W') ? n : -n;
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: 'asc' | 'desc' }) {
  if (col !== sortKey) return <span style={{ opacity: 0.25, marginLeft: 3 }}>↕</span>;
  return <span style={{ marginLeft: 3 }}>{sortDir === 'desc' ? '↓' : '↑'}</span>;
}

export function TeamsClient({ teams, teamMatches, seoText }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('record');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [modalTeam, setModalTeam] = useState<TeamStanding | null>(null);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sorted = useMemo(() => {
    const base = (a: TeamStanding, b: TeamStanding): number => {
      switch (sortKey) {
        case 'record': return b.wins - a.wins || a.losses - b.losses || b.diff - a.diff;
        case 'pf':     return b.pf - a.pf;
        case 'pa':     return a.pa - b.pa;
        case 'diff':   return b.diff - a.diff;
        case 'streak': return streakVal(b.streak || '') - streakVal(a.streak || '');
        default:       return 0;
      }
    };
    return [...teams].sort((a, b) => sortDir === 'desc' ? base(a, b) : -base(a, b));
  }, [teams, sortKey, sortDir]);

  return (
    <div className="page">
      <div className="container">
        <div className="page-header">
          <h1>Team Standings</h1>
          <div className="subtitle">Team Rankings · 2026 TBL Season</div>
        </div>
        {seoText && <p className="page-intro">{seoText}</p>}

        <div className="card">

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
                  <th className="col-team-rank" style={{ width: 32 }}>#</th>
                  <th className="col-team">Team</th>
                  {(['record', 'pf', 'pa', 'diff'] as SortKey[]).map((col) => (
                    <th
                      key={col}
                      className={`num-cell${col === 'record' ? ' col-result' : col === 'diff' ? ' col-diff' : ''}`}
                      onClick={() => handleSort(col)}
                      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                    >
                      {col === 'record' ? 'Record' : col.toUpperCase()}
                      <SortIcon col={col} sortKey={sortKey} sortDir={sortDir} />
                    </th>
                  ))}
                  <th
                    onClick={() => handleSort('streak')}
                    style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  >
                    Streak<SortIcon col="streak" sortKey={sortKey} sortDir={sortDir} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((t, i) => {
                  const matches = teamMatches[t.team] || [];
                  const streak = t.streak || calcTeamStreak(matches);
                  return (
                    <tr key={t.slug}>
                      <td className="rank-cell col-team-rank">{i + 1}</td>
                      <td className="col-team">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {/* Color accent stripe */}
                          {getTeamColor(t.slug) && (
                            <span style={{
                              display: 'inline-block',
                              width: 3,
                              height: 22,
                              borderRadius: 2,
                              background: getTeamColor(t.slug),
                              flexShrink: 0,
                            }} />
                          )}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={getTeamLogoPath(t.slug)}
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
                      <td className="num-cell mono col-result">{t.record}</td>
                      <td className="num-cell mono">{t.pf.toFixed(1)}</td>
                      <td className="num-cell mono">{t.pa.toFixed(1)}</td>
                      <td
                        className="num-cell mono col-diff"
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
