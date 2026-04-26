'use client';
// src/app/fighters/FightersClient.tsx

import React, { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import type { FighterStat, FightHistory, ScheduleEntry } from '@/types';
import { calcFighterStreak } from '@/lib/data';
import { getFighterWeightClasses } from '@/lib/fighters';
import { getTeamColorByName, getTeamLogoPathByName } from '@/lib/teams';
import { PageHeader } from '@/components/chrome/PageHeader';

type SortKey = 'war' | 'nppr' | 'netPts' | 'winPct' | 'rounds' | 'record' | 'name';

interface Props {
  fighters: FighterStat[];
  fighterHistory: Record<string, FightHistory[]>;
  schedule: ScheduleEntry[];
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
              { label: 'NPPR', value: fighter.nppr.toFixed(2) },
              { label: 'Net Pts', value: `${fighter.netPts >= 0 ? '+' : ''}${fighter.netPts.toFixed(0)}` },
              { label: 'Win%', value: `${(fighter.winPct * 100).toFixed(0)}%` },
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
                        {h.netPts >= 0 ? '+' : ''}{h.netPts.toFixed(0)}
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

export function FightersClient({ fighters, fighterHistory, schedule, seoText, lastUpdated }: Props) {
  const formattedUpdate = lastUpdated || null;
  const [sortKey, setSortKey] = useState<SortKey>('netPts');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [search, setSearch] = useState('');
  const [weightFilter, setWeightFilter] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [weekFilter, setWeekFilter] = useState('');
  const [modalFighter, setModalFighter] = useState<FighterStat | null>(null);

  const matchIndexToWeek = useMemo(() => {
    const map = new Map<number, number>();
    for (const s of schedule) {
      if (s.matchIndex && s.week > 0) map.set(s.matchIndex, s.week);
    }
    return map;
  }, [schedule]);

  const weeks = useMemo(() => {
    const foughtMatchIndexes = new Set<number>();
    for (const history of Object.values(fighterHistory)) {
      for (const h of history) foughtMatchIndexes.add(h.matchIndex);
    }
    const set = new Set<number>();
    for (const mi of foughtMatchIndexes) {
      const w = matchIndexToWeek.get(mi);
      if (w) set.add(w);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [fighterHistory, matchIndexToWeek]);

  // Every weight class the fighter has competed in — listed class plus any
  // classes from their bout history. Fighters who've gone up/down a class
  // (common in TBL) should appear in every relevant filter.
  const fighterWeightClasses = useCallback(
    (f: FighterStat): Set<string> =>
      getFighterWeightClasses(f, fighterHistory[f.slug] || []),
    [fighterHistory]
  );

  // The TBL women's classes share names with men's (Bantamweight, Featherweight,
  // Super Lightweight) but compete in their own bracket — surface them as
  // dedicated "Female X" options in the dropdown so the filter splits cleanly.
  const FEMALE_CLASSES = useMemo(
    () => new Set(['Bantamweight', 'Featherweight', 'Super Lightweight']),
    []
  );

  const weightClasses = useMemo(() => {
    const set = new Set<string>();
    fighters.forEach((f) => {
      const classes = fighterWeightClasses(f);
      classes.forEach((wc) => {
        if (f.gender === 'Female' && FEMALE_CLASSES.has(wc)) {
          set.add(`Female ${wc}`);
        } else {
          set.add(wc);
        }
      });
    });
    return Array.from(set).sort();
  }, [fighters, fighterWeightClasses, FEMALE_CLASSES]);

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

  // When a week is selected, replace per-fighter stats (record / net pts /
  // nppr / win% / rounds) with just that week's performance derived from
  // their fight history. WAR is season-level and can't be recomputed here,
  // so it stays as-is.
  const displayedFighters = useMemo(() => {
    if (!weekFilter) return fighters;
    const w = Number(weekFilter);
    return fighters.map((f) => {
      const history = fighterHistory[f.slug] || [];
      const weekOnly = history.filter((h) => matchIndexToWeek.get(h.matchIndex) === w);
      if (weekOnly.length === 0) return f;
      const wins = weekOnly.filter((h) => h.result === 'W').length;
      const losses = weekOnly.filter((h) => h.result === 'L').length;
      const netPts = weekOnly.reduce((s, h) => s + h.netPts, 0);
      const rounds = weekOnly.length;
      return {
        ...f,
        wins,
        losses,
        record: `${wins}-${losses}`,
        netPts,
        rounds,
        nppr: rounds > 0 ? netPts / rounds : 0,
        winPct: rounds > 0 ? wins / rounds : 0,
      };
    });
  }, [fighters, fighterHistory, matchIndexToWeek, weekFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const weekNum = weekFilter ? Number(weekFilter) : null;
    return displayedFighters.filter((f) => {
      if (q && !f.name.toLowerCase().includes(q)) return false;
      if (weightFilter) {
        // "Female X" picks female fighters in class X. A bare class name
        // matches either gender for that class — except the three women's
        // classes (Bantam / Feather / Super Light), which only match the
        // men's bracket so the dropdown splits cleanly.
        const isFemaleOption = weightFilter.startsWith('Female ');
        const baseClass = isFemaleOption ? weightFilter.slice(7) : weightFilter;
        const fClasses = fighterWeightClasses(f);
        if (!fClasses.has(baseClass)) return false;
        if (isFemaleOption && f.gender !== 'Female') return false;
        if (!isFemaleOption && FEMALE_CLASSES.has(baseClass) && f.gender === 'Female') return false;
      }
      if (teamFilter && f.team !== teamFilter) return false;
      if (genderFilter && f.gender !== genderFilter) return false;
      if (weekNum !== null) {
        const history = fighterHistory[f.slug] || [];
        if (!history.some((h) => matchIndexToWeek.get(h.matchIndex) === weekNum)) return false;
      }
      return true;
    });
  }, [displayedFighters, search, weightFilter, teamFilter, genderFilter, weekFilter, fighterWeightClasses, fighterHistory, matchIndexToWeek, FEMALE_CLASSES]);

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
    <div className="page fighters-page">
      {/* Mobile-only Gazette-style header */}
      <div className="fighters-mobile-header">
        <PageHeader
          eyebrow="The Roster"
          title="Fighters"
          subtitle={`${fighters.length} Fighters · Sorted by Net Points`}
        />
        <div className="fighters-mobile-filters">
          <input
            type="search"
            className="fighters-mobile-search"
            placeholder="Search fighter…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search fighters by name"
          />
          <select
            className="fighters-mobile-select"
            value={weightFilter}
            onChange={(e) => setWeightFilter(e.target.value)}
            aria-label="Filter by weight class"
          >
            <option value="">All weights</option>
            {weightClasses.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Mobile list view — render the full filtered roster, no slice. */}
      <div className="fighters-mobile-list">
        {sorted.map((f, i) => {
          const logo = getTeamLogoPathByName(f.team);
          return (
            <Link
              key={f.slug}
              href={`/fighters/${f.slug}`}
              className="fighters-mobile-row"
            >
              <div className="fighters-mobile-row__rank">{i + 1}</div>
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="" className="fighters-mobile-row__logo" />
              ) : (
                <span className="fighters-mobile-row__logo" />
              )}
              <div className="fighters-mobile-row__body">
                <div className="fighters-mobile-row__name">{f.name}</div>
                <div className="fighters-mobile-row__meta">
                  {f.weightClass} · {f.record} · WAR {f.war.toFixed(2)}
                </div>
              </div>
              <div className="fighters-mobile-row__value">
                <span
                  className="fighters-mobile-row__num"
                  style={{ color: f.netPts >= 0 ? 'var(--tbl-accent)' : 'var(--tbl-red)' }}
                >
                  {f.netPts >= 0 ? '+' : ''}
                  {f.netPts.toFixed(0)}
                </span>
                <span className="fighters-mobile-row__unit">Net</span>
              </div>
            </Link>
          );
        })}
        {sorted.length === 0 && (
          <div className="fighters-mobile-empty">No fighters match your filters.</div>
        )}
      </div>

      <div className="container fighters-desktop-only">
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
              <select className="filter-select" value={weekFilter} onChange={(e) => setWeekFilter(e.target.value)}>
                <option value="">All weeks</option>
                {weeks.map((w) => <option key={w} value={w}>Week {w}</option>)}
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
                        {f.netPts >= 0 ? '+' : ''}{f.netPts.toFixed(0)}
                      </td>
                      <td className="num-cell mono col-hide-mobile">{f.nppr.toFixed(2)}</td>
                      <td className="num-cell mono col-hide-mobile">{(f.winPct * 100).toFixed(0)}%</td>
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
