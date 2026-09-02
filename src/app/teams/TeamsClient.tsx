'use client';
// src/app/teams/TeamsClient.tsx

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import type { TeamStanding, TeamMatch, BoxScoreRound } from '@/types';
import { calcTeamStreak, toSlug } from '@/lib/data';
import {
  aggregateTeamStandingsByPhase,
  filterTeamMatchesByPhase,
} from '@/lib/phaseStats';
import { getTeamColor, getTeamLogoPath, getFullTeamName, getCityName } from '@/lib/teams';
import { sortStandings, getH2HTiebreakerWinners } from '@/lib/standings';
import { PageHeader } from '@/components/chrome/PageHeader';
import { DataTable, type Column } from '@/components/ui';

type SortKey = 'record' | 'pf' | 'pa' | 'diff' | 'streak' | 'cb' | 'bl';

export interface ComebackTotals {
  comebackWins: number;
  blownLeads: number;
}

interface Props {
  teams: TeamStanding[];
  teamMatches: Record<string, TeamMatch[]>;
  // slug → 'z' (clinched #1 seed) | 'x' (clinched playoff berth)
  clinch?: Record<string, 'x' | 'z'>;
  // slug → comeback wins / blown leads (see src/lib/wpa/comebacks.ts)
  comebacks?: Record<string, ComebackTotals>;
  seoText?: string;
  lastUpdated?: string;
}

// Small superscript-style clinch marker shown before a team name.
function ClinchMark({ mark }: { mark?: 'x' | 'z' }) {
  if (!mark) return null;
  const label = mark === 'z' ? 'Clinched #1 seed' : 'Clinched playoff berth';
  return (
    <span
      title={label}
      aria-label={label}
      style={{
        fontFamily: 'IBM Plex Mono, monospace',
        fontSize: 11,
        fontWeight: 700,
        color: 'var(--accent)',
        marginRight: 5,
      }}
    >
      {mark}
    </span>
  );
}

function StreakBadge({ streak }: { streak: string }) {
  if (!streak) return null;
  const cls = streak.startsWith('W')
    ? 'badge-win'
    : streak.startsWith('D')
    ? 'badge-draw'
    : 'badge-loss';
  return <span className={`badge ${cls}`}>{streak}</span>;
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
  if (s.startsWith('W')) return n;
  if (s.startsWith('L')) return -n;
  return 0; // draws sort between wins and losses
}

export function TeamsClient({
  teams: allTeams,
  teamMatches: allMatches,
  clinch,
  comebacks = {},
  seoText,
  lastUpdated,
}: Props) {
  const formattedUpdate = lastUpdated || null;
  const [sortKey, setSortKey] = useState<SortKey>('record');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [modalTeam, setModalTeam] = useState<TeamStanding | null>(null);
  // Standings are always regular-season only — this table decides playoff
  // seeding, so playoff games never fold into it. Recomputed from the
  // regular-season match data, which stays frozen once the playoffs begin.
  const clinchFor = (slug: string): 'x' | 'z' | undefined => clinch?.[slug];
  const anyClinch = !!clinch && Object.keys(clinch).length > 0;

  const teams = useMemo(
    () => aggregateTeamStandingsByPhase(allTeams, allMatches, 'regular'),
    [allTeams, allMatches]
  );
  const teamMatches = useMemo(
    () => filterTeamMatchesByPhase(allMatches, 'regular'),
    [allMatches]
  );

  // The playoff-cutoff line and games-back column always apply here — this is
  // the seeding table.
  const showCutoff = true;

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const recordSorted = useMemo(
    () => sortStandings(teams, teamMatches),
    [teams, teamMatches]
  );

  const sorted = useMemo(() => {
    if (sortKey === 'record') {
      return sortDir === 'desc' ? recordSorted : [...recordSorted].reverse();
    }
    const base = (a: TeamStanding, b: TeamStanding): number => {
      switch (sortKey) {
        case 'pf':     return b.pf - a.pf;
        case 'pa':     return a.pa - b.pa;
        case 'diff':   return b.diff - a.diff;
        case 'streak': return streakVal(b.streak || '') - streakVal(a.streak || '');
        case 'cb':     return (comebacks[b.slug]?.comebackWins ?? 0) - (comebacks[a.slug]?.comebackWins ?? 0);
        case 'bl':     return (comebacks[b.slug]?.blownLeads ?? 0) - (comebacks[a.slug]?.blownLeads ?? 0);
        default:       return 0;
      }
    };
    return [...teams].sort((a, b) => sortDir === 'desc' ? base(a, b) : -base(a, b));
  }, [teams, sortKey, sortDir, recordSorted, comebacks]);

  const columns: Column<TeamStanding>[] = [
    {
      key: 'team',
      label: 'Team',
      align: 'left',
      render: (t) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {getTeamColor(t.slug) && (
            <span
              style={{
                display: 'inline-block',
                width: 3,
                height: 22,
                borderRadius: 2,
                background: getTeamColor(t.slug),
                flexShrink: 0,
              }}
            />
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getTeamLogoPath(t.slug)}
            alt={t.team}
            style={{ width: 24, height: 24, objectFit: 'contain', flexShrink: 0 }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <Link
            href={`/teams/${t.slug}`}
            className="tbl-display"
            style={{ color: 'var(--tbl-ink)', textDecoration: 'none', fontSize: 15, fontWeight: 700 }}
          >
            <ClinchMark mark={clinchFor(t.slug)} />
            {t.team}
            {sortKey === 'record' && h2hWinners.has(t.slug) && (
              <span
                title={`Wins tiebreaker over ${h2hWinners.get(t.slug)!.join(', ')} via head-to-head record`}
                style={{ color: 'var(--tbl-accent)', marginLeft: 2, fontSize: 11 }}
              >
                *
              </span>
            )}
          </Link>
        </div>
      ),
    },
    {
      key: 'record',
      label: 'Record',
      sortable: true,
      value: (t) => t.wins,
      render: (t) => t.record,
    },
    {
      key: 'pf',
      label: 'PF',
      sortable: true,
      hideOnMobile: true,
      value: (t) => t.pf,
      render: (t) => t.pf.toFixed(0),
    },
    {
      key: 'pa',
      label: 'PA',
      sortable: true,
      hideOnMobile: true,
      value: (t) => t.pa,
      render: (t) => t.pa.toFixed(0),
    },
    {
      key: 'diff',
      label: 'Diff',
      sortable: true,
      value: (t) => t.diff,
      render: (t) => (
        <span
          style={{
            color: t.diff >= 0 ? 'var(--tbl-green)' : 'var(--tbl-red)',
            fontWeight: 600,
          }}
        >
          {t.diff >= 0 ? '+' : ''}
          {t.diff.toFixed(0)}
        </span>
      ),
    },
    {
      key: 'cb',
      label: 'CB',
      title: 'Comeback wins — once below 25% and still won',
      sortable: true,
      hideOnMobile: true,
      value: (t) => comebacks[t.slug]?.comebackWins ?? 0,
      render: (t) => (
        <span
          style={{
            color:
              (comebacks[t.slug]?.comebackWins ?? 0) > 0
                ? 'var(--tbl-green)'
                : 'var(--tbl-ink-mute)',
          }}
        >
          {comebacks[t.slug]?.comebackWins ?? 0}
        </span>
      ),
    },
    {
      key: 'bl',
      label: 'BL',
      title: 'Blown leads — once above 75% and still lost',
      sortable: true,
      hideOnMobile: true,
      value: (t) => comebacks[t.slug]?.blownLeads ?? 0,
      render: (t) => (
        <span
          style={{
            color:
              (comebacks[t.slug]?.blownLeads ?? 0) > 0 ? 'var(--tbl-red)' : 'var(--tbl-ink-mute)',
          }}
        >
          {comebacks[t.slug]?.blownLeads ?? 0}
        </span>
      ),
    },
    {
      key: 'gb',
      label: 'GB',
      title: 'Games from the playoff cutoff (+ ahead / behind)',
      hideOnMobile: true,
      render: (t) => {
        const gb = calcGB(t);
        return (
          <span
            style={{
              color:
                gb > 0 ? 'var(--tbl-green)' : gb < 0 ? 'var(--tbl-red)' : 'var(--tbl-ink-mute)',
              fontWeight: gb !== 0 ? 600 : 400,
            }}
          >
            {gb === 0
              ? '0'
              : gb > 0
              ? `+${gb % 1 === 0 ? gb : gb.toFixed(1)}`
              : `${gb % 1 === 0 ? Math.abs(gb) : Math.abs(gb).toFixed(1)}`}
          </span>
        );
      },
    },
    {
      key: 'streak',
      label: 'Streak',
      align: 'left',
      sortable: true,
      value: (t) => streakVal(t.streak || ''),
      render: (t) => {
        const streak = t.streak || calcTeamStreak(teamMatches[t.team] || []);
        return streak ? <StreakBadge streak={streak} /> : null;
      },
    },
  ];

  const PLAYOFF_SPOTS = 8;

  // Games back is always measured against the record-order standings, whatever
  // the table is currently sorted by — the 8th seed is the 8th seed.
  const calcGB = (t: TeamStanding) => {
    const cutoff = recordSorted[PLAYOFF_SPOTS - 1];
    if (!cutoff) return 0;
    return (t.wins - cutoff.wins + (cutoff.losses - t.losses)) / 2;
  };

  const h2hWinners = useMemo(
    () => getH2HTiebreakerWinners(teams, teamMatches),
    [teams, teamMatches]
  );

  // Mobile card list mirrors the desktop "record" sort.
  const sortedByWins = recordSorted;

  return (
    <div className="page teams-page">
      {/* Mobile-only Gazette header + card list */}
      <div className="teams-mobile-header">
        <PageHeader
          eyebrow="The League"
          title="Standings"
          subtitle={`${teams.length} Clubs · Sorted by Wins`}
          right={
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <Link href="/playoffs" className="teams-playoffs-link">
                Playoff Picture →
              </Link>
            </div>
          }
        />
      </div>
      <div className="teams-mobile-list">
        <div className="teams-mobile-list__head">
          <span className="teams-mobile-list__head-col teams-mobile-list__head-col--club">Club</span>
          <span className="teams-mobile-list__head-col teams-mobile-list__head-col--record">W-L</span>
          <span className="teams-mobile-list__head-col teams-mobile-list__head-col--diff">Diff</span>
        </div>
        {sortedByWins.map((t, i) => {
          const streak = t.streak || calcTeamStreak(teamMatches[t.team] || []);
          return (
            <React.Fragment key={t.slug}>
              <Link href={`/teams/${t.slug}`} className="teams-mobile-row">
                <div className="teams-mobile-row__rank">{i + 1}</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getTeamLogoPath(t.slug)}
                  alt=""
                  className="teams-mobile-row__logo"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                <div className="teams-mobile-row__body">
                  <div className="teams-mobile-row__name">
                    <ClinchMark mark={clinchFor(t.slug)} />
                    {getFullTeamName(t.slug)}
                    {h2hWinners.has(t.slug) && (
                      <span
                        className="teams-mobile-row__h2h"
                        aria-label={`Wins tiebreaker over ${h2hWinners.get(t.slug)!.join(', ')} via head-to-head record`}
                      >
                        *
                      </span>
                    )}
                  </div>
                  <div className="teams-mobile-row__meta">
                    {getCityName(t.team)}
                    {streak && (
                      <>
                        {' '}·{' '}
                        <span
                          className={`teams-mobile-row__streak ${
                            streak.startsWith('W')
                              ? 'is-win'
                              : streak.startsWith('D')
                              ? 'is-draw'
                              : 'is-loss'
                          }`}
                        >
                          {streak}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="teams-mobile-row__record">{t.record}</div>
                <div
                  className="teams-mobile-row__diff"
                  style={{ color: t.diff >= 0 ? 'var(--tbl-green)' : 'var(--tbl-red)' }}
                >
                  {t.diff >= 0 ? '+' : ''}
                  {t.diff.toFixed(0)}
                </div>
              </Link>
              {showCutoff && i === 7 && i < sortedByWins.length - 1 && (
                <div className="teams-mobile-cutoff" aria-hidden="true">
                  <span>── Playoff Cutoff ──</span>
                </div>
              )}
            </React.Fragment>
          );
        })}
        {anyClinch && (
          <div className="teams-mobile-h2h-note">
            <div><span style={{ color: 'var(--accent)', fontWeight: 700 }}>x</span> — Clinched playoff berth · <span style={{ color: 'var(--accent)', fontWeight: 700 }}>z</span> — Clinched #1 seed</div>
          </div>
        )}
        {h2hWinners.size > 0 && (
          <div className="teams-mobile-h2h-note">
            {Array.from(h2hWinners.entries()).map(([slug, beaten]) => {
              const winnerTeam = teams.find((t) => t.slug === slug)?.team ?? slug;
              return (
                <div key={slug}>
                  <span className="teams-mobile-h2h-note__star">*</span> {winnerTeam} wins tiebreaker over {beaten.join(', ')} via head-to-head record
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="teams-desktop-only">
        <PageHeader
          eyebrow="Team Rankings · 2026 TBL Season"
          title="Team Standings"
          subtitle={formattedUpdate ? `Updated ${formattedUpdate}` : undefined}
          right={
            <Link href="/playoffs" className="teams-playoffs-link">
              Playoff Picture →
            </Link>
          }
        />

      <div style={{ padding: '20px 32px 40px' }}>
        {seoText && (
          <p
            style={{
              fontFamily: 'var(--tbl-font-body)',
              fontSize: 14,
              lineHeight: 1.7,
              color: 'var(--tbl-ink-soft)',
              maxWidth: 720,
              margin: '0 0 18px',
            }}
          >
            {seoText}
          </p>
        )}

        <div style={{ border: '1.5px solid var(--tbl-ink)', background: 'var(--tbl-paper)' }}>
          {/* Stat key */}
          <div
            style={{
              padding: '8px 20px',
              display: 'flex',
              gap: 16,
              flexWrap: 'wrap',
              borderBottom: '1px solid var(--tbl-ink)',
              background: 'rgba(20,17,11,0.025)',
            }}
          >
            {[
              { k: 'PF', v: 'Points For' },
              { k: 'PA', v: 'Points Against' },
              { k: 'Diff', v: 'Point Differential' },
              { k: 'CB', v: 'Comeback Wins (once below 25%)' },
              { k: 'BL', v: 'Blown Leads' },
              { k: 'GB', v: 'Games from playoff cutoff (+ahead / behind)' },
            ].map((s2) => (
              <span
                key={s2.k}
                style={{
                  fontFamily: 'var(--tbl-font-mono)',
                  fontSize: 11,
                  color: 'var(--tbl-ink-soft)',
                }}
              >
                <strong style={{ color: 'var(--tbl-ink)' }}>{s2.k}</strong> {s2.v}
              </span>
            ))}
          </div>

          <div style={{ padding: '0 12px 8px' }}>
            <DataTable
              rows={sorted}
              columns={columns}
              rowKey={(t) => t.slug}
              rank
              preSorted
              defaultSort={{ key: sortKey, dir: sortDir }}
              onSortChange={(k, d) => {
                setSortKey(k as SortKey);
                setSortDir(d);
              }}
              renderAfterRow={(t, i, colSpan) =>
                // Only meaningful in record order; in any other sort the 8th row
                // is not the 8th seed.
                showCutoff && sortKey === 'record' && i === PLAYOFF_SPOTS - 1 ? (
                  <tr className="playoff-cutoff-row">
                    <td colSpan={colSpan}>
                      <div className="playoff-cutoff-line">
                        <span className="playoff-cutoff-label">── Playoff Cutoff ──</span>
                      </div>
                    </td>
                  </tr>
                ) : null
              }
              emptyMessage="No standings yet."
            />
          </div>
        </div>

        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
          {teams.length} teams · Click a team name to view box scores
        </div>
        {anyClinch && (
          <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono, monospace' }}>
            <span style={{ color: 'var(--accent)', fontWeight: 700 }}>x</span> — Clinched playoff berth
            {'  ·  '}
            <span style={{ color: 'var(--accent)', fontWeight: 700 }}>z</span> — Clinched #1 seed
          </div>
        )}
        {h2hWinners.size > 0 && sortKey === 'record' && (
          <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono, monospace' }}>
            {Array.from(h2hWinners.entries()).map(([slug, beaten]) => {
              const winnerTeam = teams.find((t) => t.slug === slug)?.team ?? slug;
              return (
                <div key={slug}>
                  <span style={{ color: 'var(--accent)' }}>*</span> {winnerTeam} wins tiebreaker over {beaten.join(', ')} via head-to-head record
                </div>
              );
            })}
          </div>
        )}
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
