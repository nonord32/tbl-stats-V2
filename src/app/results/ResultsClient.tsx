'use client';
// src/app/results/ResultsClient.tsx

import React, { useState } from 'react';
import Link from 'next/link';
import { toSlug } from '@/lib/data';
import { getFullTeamName } from '@/lib/teams';
import type { MatchResult, BoxScoreRound, HighlightEntry } from '@/types';

interface Props {
  matches: MatchResult[];
  lastUpdated?: string;
  highlights?: HighlightEntry[];
}

function ScorecardStrip({
  boxScore,
  team1,
  team2,
  score1,
  score2,
}: {
  boxScore: BoxScoreRound[];
  team1: string;
  team2: string;
  score1: number;
  score2: number;
}) {
  const phases = Array.from(new Set(boxScore.map((r) => r.phase).filter(Boolean)));
  const phaseTotals = phases.map((phase) => {
    const rows = boxScore.filter((r) => r.phase === phase);
    return {
      phase,
      s1: rows.reduce((s, r) => s + r.score1, 0),
      s2: rows.reduce((s, r) => s + r.score2, 0),
    };
  });

  return (
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
            { label: team1, scores: phaseTotals.map((pt) => pt.s1), oppScores: phaseTotals.map((pt) => pt.s2), total: score1, oppTotal: score2 },
            { label: team2, scores: phaseTotals.map((pt) => pt.s2), oppScores: phaseTotals.map((pt) => pt.s1), total: score2, oppTotal: score1 },
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
  );
}

function MatchCard({ match, hasHighlights }: { match: MatchResult; hasHighlights: boolean }) {
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Box Score · {formattedDate}
            </span>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {hasHighlights && (
                <Link
                  href={`/matches/${match.matchIndex}`}
                  onClick={(e) => e.stopPropagation()}
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#fff', fontWeight: 700, background: 'var(--accent)', padding: '3px 10px', borderRadius: 4, textDecoration: 'none' }}
                >
                  ▶ Watch
                </Link>
              )}
              <Link
                href={`/matches/${match.matchIndex}`}
                onClick={(e) => e.stopPropagation()}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}
              >
                Full match →
              </Link>
            </div>
          </div>
          <ScorecardStrip
            boxScore={match.boxScore}
            team1={team1Name}
            team2={team2Name}
            score1={match.score1}
            score2={match.score2}
          />
        </div>
      )}
    </div>
  );
}

export function ResultsClient({ matches, lastUpdated, highlights = [] }: Props) {
  const formattedUpdate = lastUpdated || null;
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
          <div className="subtitle">
            All Matches · 2026 TBL Season
            {formattedUpdate && (
              <span style={{ marginLeft: 10, fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>
                · Updated {formattedUpdate}
              </span>
            )}
          </div>
        </div>
        <p className="page-intro">
          All Team Boxing League match results for the 2026 season. Click any match to see the phase box score, or view the full round-by-round breakdown.
        </p>

        {matches.length === 0 ? (
          <div className="card"><div className="loading">No match data available</div></div>
        ) : (
          grouped.map(({ date, matches: dayMatches }) => (
            <div key={date} className="results-date-group">
              <div className="results-date-heading">{formatDateHeading(date)}</div>
              {dayMatches.map((m) => (
                <MatchCard
                  key={m.matchIndex}
                  match={m}
                  hasHighlights={highlights.some((h) => h.page === String(m.matchIndex))}
                />
              ))}
            </div>
          ))
        )}

        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
          {matches.length} match{matches.length !== 1 ? 'es' : ''} · Click any match for the box score
        </div>
      </div>
    </div>
  );
}
