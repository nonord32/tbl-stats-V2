'use client';
// src/app/results/ResultsClient.tsx

import React, { useState } from 'react';
import Link from 'next/link';
import { toSlug } from '@/lib/data';
import type { MatchResult, BoxScoreRound } from '@/types';

interface Props {
  matches: MatchResult[];
}

function BoxScoreExpand({ boxScore, team1, team2 }: { boxScore: BoxScoreRound[]; team1: string; team2: string }) {
  const total1 = boxScore.reduce((s, r) => s + r.score1, 0);
  const total2 = boxScore.reduce((s, r) => s + r.score2, 0);

  return (
    <div className="results-boxscore">
      <table>
        <thead>
          <tr>
            <th>Rnd</th>
            <th>Phase</th>
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
                <td className="mono" style={{ fontSize: 12 }}>{row.round}</td>
                <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{row.phase}</td>
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
          <tr style={{ background: 'var(--bg-table-alt)', fontWeight: 700 }}>
            <td colSpan={2} className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>TOTAL</td>
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
  );
}

function MatchCard({ match }: { match: MatchResult }) {
  const [expanded, setExpanded] = useState(false);

  const team1Won = match.result === 'W';
  const team2Won = match.result === 'L';
  const isDraw  = match.result === 'D';

  const formattedDate = (() => {
    try {
      return new Date(match.date).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return match.date;
    }
  })();

  return (
    <div className={`results-card ${expanded ? 'results-card--open' : ''}`}>
      <button
        className="results-card-main"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {/* Team 1 */}
        <div className={`results-team results-team--left ${team1Won ? 'results-team--winner' : team2Won ? 'results-team--loser' : ''}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/logos/${toSlug(match.team1)}.png`}
            alt={match.team1}
            className="results-logo"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <span className="results-team-name">{match.team1}</span>
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
          <span className="results-team-name">{match.team2}</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/logos/${toSlug(match.team2)}.png`}
            alt={match.team2}
            className="results-logo"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>

        {/* Expand chevron */}
        <span className="results-chevron" aria-hidden="true">
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      {expanded && (
        <div className="results-expand">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Round-by-round · {formattedDate}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Link
                href={`/teams/${toSlug(match.team1)}`}
                onClick={(e) => e.stopPropagation()}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)' }}
              >
                {match.team1} →
              </Link>
              <Link
                href={`/teams/${toSlug(match.team2)}`}
                onClick={(e) => e.stopPropagation()}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)' }}
              >
                {match.team2} →
              </Link>
            </div>
          </div>
          <BoxScoreExpand boxScore={match.boxScore} team1={match.team1} team2={match.team2} />
        </div>
      )}
    </div>
  );
}

export function ResultsClient({ matches }: Props) {
  // Group matches by date string
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
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="page">
      <div className="container">
        <div className="page-header">
          <h1>Results</h1>
          <div className="subtitle">All Matches · 2026 TBL Season</div>
        </div>
        <p className="page-intro">
          All Team Boxing League match results for the 2026 season, grouped by date. Click any match to view the full round-by-round box score.
        </p>

        {matches.length === 0 ? (
          <div className="card">
            <div className="loading">No match data available</div>
          </div>
        ) : (
          grouped.map(({ date, matches: dayMatches }) => (
            <div key={date} className="results-date-group">
              <div className="results-date-heading">{formatDateHeading(date)}</div>
              {dayMatches.map((m) => (
                <MatchCard key={m.matchIndex} match={m} />
              ))}
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
