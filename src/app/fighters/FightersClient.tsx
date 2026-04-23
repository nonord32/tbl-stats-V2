'use client';
// src/app/fighters/FightersClient.tsx

import React, { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import type { FighterStat, FightHistory } from '@/types';
import { calcFighterStreak } from '@/lib/data';
import { getFighterWeightClasses } from '@/lib/fighters';
import { getTeamColorByName, getTeamLogoPathByName } from '@/lib/teams';

type SortKey = 'war' | 'nppr' | 'netPts' | 'winPct' | 'rounds' | 'record' | 'name';

interface Props {
  fighters: FighterStat[];
  fighterHistory: Record<string, FightHistory[]>;
  seoText?: string;
  lastUpdated?: string;
}

function StreakBadge({ streak }: { streak: string }) {
  if (!streak) return null;
  const isWin = streak.startsWith('W');
  return (
    <span className={`badge ${isWin ? 'badge-win' : 'badge-loss'}`}>{streak}</span>
  );
}

function FighterModal({
  fighter,
  history,
  streak,
  onClose,
}: {
  fighter: FighterStat;
  history: FightHistory[];
  streak: string;
  onClose: () => void;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="modal-title">{fighter.name}</div>
              {fighter.instagram && (
                <a
                  href={fighter.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${fighter.name} on Instagram`}
                  title="Instagram"
                  style={{ color: 'var(--text-muted)', lineHeight: 0, flexShrink: 0 }}
                  className="ig-link"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                    <circle cx="12" cy="12" r="4"/>
                    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
                  </svg>
                </a>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
              <span className="badge">{fighter.team}</span>
              <span className="badge">{fighter.weightClass}</span>
              <span className="badge">{fighter.gender}</span>
              {streak && <StreakBadge streak={streak} />}
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">
          <div className="stat-grid" style={{ padding: 0, marginBottom: 20 }}>
            {[
              { label: 'Record', value: fighter.record },
              { label: 'WAR', value: fighter.war.toFixed(2) },
              { label: 'NPPR', value: fighter.nppr.toFixed(3) },
              { label: 'Net Pts', value: fighter.netPts.toFixed(1) },
              { label: 'Win%', value: `${(fighter.winPct * 100).toFixed(1)}%` },
              { label: 'Rounds', value: fighter.rounds },
            ].map((s) => (
              <div className="stat-box" key={s.label}>
                <span className="label">{s.label}</span>
                <span className="value">{s.value}</span>
              </div>
            ))}
          </div>

          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
            Fight History
          </div>

          {history.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No fight data found.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Opponent</th>
                    <th>Team</th>
                    <th>Weight</th>
                    <th>Round</th>
                    <th>Phase</th>
                    <th>Result</th>
                    <th className="num-cell">Net Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h, i) => (
                    <tr key={i}>
                      <td className="mono" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{h.date}</td>
                      <td style={{ fontWeight: 500 }}>{h.opponent}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{h.opponentTeam}</td>
                      <td style={{ fontSize: 12 }}>{h.weightClass}</td>
                      <td className="mono" style={{ fontSize: 12 }}>{h.round}</td>
                      <td style={{ fontSize: 12 }}>{h.roundPhase}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <span className={`result-${h.result.toLowerCase()}`}>{h.result}</span>
                        {h.resultMethod && (
                          <span style={{ marginLeft: 4, fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>
                            {h.resultMethod}
                          </span>
                        )}
                      </td>
                      <td className="num-cell mono" style={{ color: h.netPts >= 0 ? 'var(--result-w)' : 'var(--result-l)' }}>
                        {h.netPts >= 0 ? '+' : ''}{h.netPts.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <Link
              href={`/fighters/${fighter.slug}`}
              style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: 'var(--accent)' }}
              onClick={onClose}
            >
              View full profile →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FightersClient({ fighters, fighterHistory, seoText, lastUpdated }: Props) {
  const formattedUpdate = lastUpdated || null;
  const [sortKey, setSortKey] = useState<SortKey>('netPts');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [search, setSearch] = useState('');
  const [weightFilter, setWeightFilter] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [modalFighter, setModalFighter] = useState<FighterStat | null>(null);

  // Every weight class the fighter has competed in — listed class plus any
  // classes from their bout history. Fighters who've gone up/down a class
  // (common in TBL) should appear in every relevant filter.
  const fighterWeightClasses = useCallback(
    (f: FighterStat): Set<string> =>
      getFighterWeightClasses(f, fighterHistory[f.slug] || []),
    [fighterHistory]
  );

  const weightClasses = useMemo(() => {
    const set = new Set<string>();
    fighters.forEach((f) => {
      fighterWeightClasses(f).forEach((wc) => set.add(wc));
    });
    return Array.from(set).sort();
  }, [fighters, fighterWeightClasses]);

  const teams = useMemo(
    () => Array.from(new Set(fighters.map((f) => f.team).filter(Boolean))).sort(),
    [fighters]
  );

  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
      } else {
        setSortKey(key);
        setSortDir('desc');
      }
    },
    [sortKey]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return fighters.filter((f) => {
      if (q && !f.name.toLowerCase().includes(q)) return false;
      if (weightFilter && !fighterWeightClasses(f).has(weightFilter)) return false;
      if (teamFilter && f.team !== teamFilter) return false;
      if (genderFilter && f.gender !== genderFilter) return false;
      return true;
    });
  }, [fighters, search, weightFilter, teamFilter, genderFilter, fighterWeightClasses]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let va: number | string = 0;
      let vb: number | string = 0;
      switch (sortKey) {
        case 'war': va = a.war; vb = b.war; break;
        case 'nppr': va = a.nppr; vb = b.nppr; break;
        case 'netPts': va = a.netPts; vb = b.netPts; break;
        case 'winPct': va = a.winPct; vb = b.winPct; break;
        case 'rounds': va = a.rounds; vb = b.rounds; break;
        case 'record': va = a.wins; vb = b.wins; break;
        case 'name': va = a.name; vb = b.name; break;
      }
      if (typeof va === 'string') {
        return sortDir === 'asc' ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
      }
      return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
  }, [filtered, sortKey, sortDir]);

  const SortTh = ({ col, label, title, className }: { col: SortKey; label: string; title?: string; className?: string; }) => (
    <th
      className={`sortable ${sortKey === col ? 'sorted' : ''} ${className || ''}`}
      onClick={() => handleSort(col)}
      title={title}
    >
      {label}
      <span className="sort-icon">{sortKey === col ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ' ↕'}</span>
    </th>
  );

  return (
    <div className="page">
      <div className="container">
        <div className="page-header">
          <h1>Fighter Stats</h1>
          <div className="subtitle">
            Individual Rankings · 2026 TBL Season
            {formattedUpdate && (
              <span style={{ marginLeft: 10, fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>
                · Updated {formattedUpdate}
              </span>
            )}
          </div>
        </div>
        {seoText && <p className="page-intro">{seoText}</p>}

        <div className="card">
          <div className="card-header">
            <div className="filters">
              <input
                type="search"
                className="filter-search"
                placeholder="Search fighters…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search fighters by name"
              />
              <select className="filter-select" value={weightFilter} onChange={(e) => setWeightFilter(e.target.value)}>
                <option value="">All weights</option>
                {weightClasses.map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
              <select className="filter-select" value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
                <option value="">All teams</option>
                {teams.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select className="filter-select" value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)}>
                <option value="">All genders</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
          </div>

          <div style={{ padding: '8px 20px', display: 'flex', gap: 16, flexWrap: 'wrap', borderBottom: '1px solid var(--border)', background: 'var(--bg-table-alt)' }}>
            {[
              { k: 'Net Pts', v: 'Total net points scored' },
              { k: 'NPPR', v: 'Net Points Per Round' },
              { k: 'Win%', v: 'Win percentage' },
              { k: 'WAR', v: 'Wins Above Replacement' },
            ].map((s) => (
              <span key={s.k} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--text-muted)' }}>
                <strong style={{ color: 'var(--text)' }}>{s.k}</strong> {s.v}
              </span>
            ))}
          </div>

          <div className="table-wrap">
            <table data-mobile-full>
              <thead>
                <tr>
                  <th className="col-rank" style={{ width: 32 }}>#</th>
                  <SortTh col="name" label="Fighter" className="always-show" />
                  <th className="col-hide-mobile">Team</th>
                  <th className="col-hide-mobile">Weight</th>
                  <th className="col-hide-mobile">Gender</th>
                  <SortTh col="record" label="Record" title="W-L" className="col-record" />
                  <SortTh col="netPts" label="Net Pts" title="Total Net Points" className="col-war" />
                  <SortTh col="nppr" label="NPPR" title="Net Points Per Round" className="col-hide-mobile" />
                  <SortTh col="winPct" label="Win%" title="Win Percentage" className="col-hide-mobile" />
                  <SortTh col="war" label="WAR" title="Wins Above Replacement" className="col-hide-mobile" />
                  <SortTh col="rounds" label="Rounds" title="Total Rounds Fought" className="col-hide-mobile" />
                  <th>Streak</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((f, i) => {
                  const history = fighterHistory[f.slug] || [];
                  const streak = calcFighterStreak(history);
                  return (
                    <tr key={f.slug}>
                      <td className="rank-cell col-rank">{i + 1}</td>
                      <td className="always-show">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {getTeamColorByName(f.team) && (
                            <span style={{
                              display: 'inline-block',
                              width: 3,
                              height: 22,
                              borderRadius: 2,
                              background: getTeamColorByName(f.team),
                              flexShrink: 0,
                            }} />
                          )}
                          <div>
                            <Link href={`/fighters/${f.slug}`} className="fighter-name-btn">
                              {f.name}
                            </Link>
                            {/* Team shown as subtitle on mobile when Team column is hidden */}
                            <div className="fighter-team-sub">{f.team}</div>
                          </div>
                        </div>
                      </td>
                      <td className="col-hide-mobile" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {getTeamLogoPathByName(f.team) && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={getTeamLogoPathByName(f.team)}
                              alt={f.team}
                              style={{ width: 18, height: 18, objectFit: 'contain', flexShrink: 0 }}
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          )}
                          {f.team}
                        </div>
                      </td>
                      <td className="col-hide-mobile" style={{ fontSize: 12 }}>{f.weightClass}</td>
                      <td className="col-hide-mobile" style={{ fontSize: 12 }}>{f.gender}</td>
                      <td className="num-cell mono col-record">{f.record}</td>
                      <td className="num-cell mono col-war" style={{ color: f.netPts >= 0 ? 'var(--result-w)' : 'var(--result-l)' }}>
                        {f.netPts >= 0 ? '+' : ''}{f.netPts.toFixed(1)}
                      </td>
                      <td className="num-cell mono col-hide-mobile">{f.nppr.toFixed(3)}</td>
                      <td className="num-cell mono col-hide-mobile">{(f.winPct * 100).toFixed(1)}%</td>
                      <td className="num-cell mono col-hide-mobile">{f.war.toFixed(2)}</td>
                      <td className="num-cell mono col-hide-mobile">{f.rounds}</td>
                      <td>{streak && <StreakBadge streak={streak} />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {sorted.length === 0 && (
            <div className="loading">No fighters match your filters</div>
          )}
        </div>

        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
          {sorted.length} of {fighters.length} fighters · Click a name to view fight history
        </div>
      </div>

      {modalFighter && (
        <FighterModal
          fighter={modalFighter}
          history={fighterHistory[modalFighter.slug] || []}
          streak={calcFighterStreak(fighterHistory[modalFighter.slug] || [])}
          onClose={() => setModalFighter(null)}
        />
      )}
    </div>
  );
}
