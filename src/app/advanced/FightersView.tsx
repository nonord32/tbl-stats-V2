'use client';
// src/app/advanced/FightersView.tsx
// The merged fighter leaderboard: what used to be /wpa and /ratings.
//
// A stat picker swaps which columns show. Two of the five stat sets are
// phase-aware (WPA, Leverage & Clutch); the other three are whole-season only
// — the ridge fit behind Adjusted NPPR and Schedule has no phase split by
// design, and WAR is a season-level figure. So the phase control DISAPPEARS on
// those rather than sitting there implying a filter the numbers ignore.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { compareWeightClass } from '@/lib/weightClasses';
import { SectionRule } from '@/components/chrome/SectionRule';
import type { AdvancedMeta, FighterRow, Phase, PhaseStats, StatSet } from './types';

const ALL = '__all__';

const STAT_LABELS: Record<StatSet, string> = {
  wpa: 'Win Probability',
  leverage: 'Leverage & Clutch',
  ratings: 'Adjusted NPPR',
  schedule: 'Schedule',
  war: 'Wins Above Replacement',
};
const STAT_ORDER: StatSet[] = ['wpa', 'leverage', 'ratings', 'schedule', 'war'];

/** Which stat sets split by phase. The rest are whole-season figures. */
const PHASE_AWARE: Record<StatSet, boolean> = {
  wpa: true,
  leverage: true,
  ratings: false,
  schedule: false,
  war: false,
};

const PHASE_LABELS: Record<Phase, string> = {
  regular: 'Regular Season',
  playoffs: 'Playoffs',
  all: 'Full Season',
};
const PHASE_ORDER: Phase[] = ['regular', 'playoffs', 'all'];

// A playoff run is only a few rounds, so the qualifier scales with the scope.
const MIN_BY_PHASE: Record<Phase, number> = { regular: 10, playoffs: 3, all: 10 };

type SortKey =
  | 'name' | 'rounds' | 'wpa' | 'wpaPerRound' | 'roundWins' | 'matches'
  | 'avgLi' | 'clutch' | 'nppr' | 'anppr' | 'delta' | 'bootSd' | 'sos'
  | 'war' | 'netPts';

const DEFAULT_SORT: Record<StatSet, SortKey> = {
  wpa: 'wpa',
  leverage: 'clutch',
  ratings: 'anppr',
  schedule: 'sos',
  war: 'war',
};

const signed = (v: number, dp = 3) => `${v >= 0 ? '+' : ''}${v.toFixed(dp)}`;
const tone = (v: number) => (v >= 0 ? 'var(--tbl-green)' : 'var(--tbl-red)');

export function FightersView({
  rows,
  initialStat,
  lastUpdated,
  meta,
}: {
  rows: FighterRow[];
  initialStat: StatSet;
  lastUpdated?: string;
  meta: AdvancedMeta;
}) {
  const [stat, setStat] = useState<StatSet>(initialStat);
  const [phase, setPhase] = useState<Phase>('regular');
  const [division, setDivision] = useState<string>(ALL);
  const [gender, setGender] = useState<string>(ALL);
  const [showAll, setShowAll] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>(DEFAULT_SORT[initialStat]);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const phaseAware = PHASE_AWARE[stat];
  const playoffsLive = useMemo(() => rows.some((r) => r.playoffs.rounds > 0), [rows]);
  // Whole-season stat sets ignore the phase control entirely.
  const scope: Phase = phaseAware ? (playoffsLive ? phase : 'all') : 'all';
  const minRounds = phaseAware ? MIN_BY_PHASE[scope] : meta.minRounds;

  const genders = useMemo(() => [...new Set(rows.map((r) => r.gender).filter(Boolean))].sort(), [rows]);

  const genderScoped = useMemo(
    () => (gender === ALL ? rows : rows.filter((r) => r.gender === gender)),
    [rows, gender],
  );

  const roundsOf = (r: FighterRow) => (phaseAware ? r[scope].rounds : r.seasonRounds);

  const divisionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of genderScoped) {
      if (roundsOf(r) < minRounds || !r.weightClass) continue;
      counts.set(r.weightClass, (counts.get(r.weightClass) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => compareWeightClass(a[0], b[0]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genderScoped, minRounds, scope, phaseAware]);

  const filtered = useMemo(() => {
    let out = genderScoped.filter((r) => roundsOf(r) > 0);
    if (division !== ALL) out = out.filter((r) => r.weightClass === division);
    if (!showAll) out = out.filter((r) => roundsOf(r) >= minRounds);
    // Schedule is undefined for a fighter whose every opponent was faced only
    // by them; those rows would sort as blanks.
    if (stat === 'schedule') out = out.filter((r) => r.sos !== null);
    if (stat === 'ratings') out = out.filter((r) => r.hasRating);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genderScoped, division, showAll, minRounds, stat, scope, phaseAware]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'name' ? 'asc' : 'desc');
    }
  };

  const pickStat = (s: StatSet) => {
    setStat(s);
    setSortKey(DEFAULT_SORT[s]);
    setSortDir('desc');
  };

  const sorted = useMemo(() => {
    const value = (r: FighterRow): number => {
      const p: PhaseStats = r[scope];
      switch (sortKey) {
        case 'rounds': return roundsOf(r);
        case 'wpa': return p.wpa;
        case 'wpaPerRound': return p.wpaPerRound;
        case 'roundWins': return p.roundWins;
        case 'matches': return p.matches;
        case 'avgLi': return p.avgLi;
        case 'clutch': return p.clutch;
        case 'nppr': return r.nppr;
        case 'anppr': return r.anppr;
        case 'delta': return r.delta;
        case 'bootSd': return r.bootSd;
        case 'sos': return r.sos ?? 0;
        case 'war': return r.war;
        case 'netPts': return r.netPts;
        default: return 0;
      }
    };
    const out = [...filtered];
    out.sort((a, b) => {
      if (sortKey === 'name') {
        return sortDir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      }
      const d = value(a) - value(b);
      return sortDir === 'desc' ? -d : d;
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sortKey, sortDir, scope, phaseAware]);

  const th = (key: SortKey, label: string, title?: string) => (
    <th
      onClick={() => handleSort(key)}
      title={title}
      style={{
        textAlign: 'right',
        padding: '7px 8px',
        fontSize: 10,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: sortKey === key ? 'var(--tbl-accent)' : 'var(--tbl-ink-soft)',
        fontWeight: 700,
        cursor: 'pointer',
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
      <span style={{ opacity: 0.9 }}>{sortKey === key ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ' ↕'}</span>
    </th>
  );

  const num = (v: React.ReactNode, color?: string, bold = false) => (
    <td style={{ textAlign: 'right', padding: '9px 8px', color, fontWeight: bold ? 700 : undefined }}>
      {v}
    </td>
  );

  const scopeLabel = phaseAware ? PHASE_LABELS[scope] : 'Full Season';
  const divisionLabel = division === ALL ? 'Pound for Pound' : division;

  return (
    <div style={{ padding: '20px 32px 40px' }}>
      <SectionRule
        left={`${STAT_LABELS[stat]} · ${divisionLabel} · ${scopeLabel} · ${sorted.length} Fighters`}
        right={lastUpdated ? `Updated ${lastUpdated}` : undefined}
      />

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          margin: '0 0 12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <label className="gz-filter" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span className="gz-filter__label">Rank by</span>
            <select
              className="gz-filter__select"
              value={stat}
              onChange={(e) => pickStat(e.target.value as StatSet)}
              aria-label="Which stat to rank by"
            >
              {STAT_ORDER.map((s) => (
                <option key={s} value={s}>{STAT_LABELS[s]}</option>
              ))}
            </select>
          </label>

          {/* Only shown when the active stat actually splits by phase. */}
          {phaseAware && playoffsLive && (
            <label className="gz-filter" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span className="gz-filter__label">When</span>
              <select
                className="gz-filter__select"
                value={phase}
                onChange={(e) => setPhase(e.target.value as Phase)}
                aria-label="Filter by season phase"
              >
                {PHASE_ORDER.map((p) => (
                  <option key={p} value={p}>{PHASE_LABELS[p]}</option>
                ))}
              </select>
            </label>
          )}

          <label className="gz-filter" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span className="gz-filter__label">Division</span>
            <select
              className="gz-filter__select"
              value={division}
              onChange={(e) => setDivision(e.target.value)}
              aria-label="Filter by weight class"
            >
              <option value={ALL}>Pound for Pound</option>
              {divisionCounts.map(([wc, n]) => (
                <option key={wc} value={wc}>{wc} ({n})</option>
              ))}
            </select>
          </label>

          {genders.length > 1 && (
            <label className="gz-filter" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span className="gz-filter__label">Gender</span>
              <select
                className="gz-filter__select"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                aria-label="Filter by gender"
              >
                <option value={ALL}>All</option>
                {genders.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </label>
          )}

          <label
            className="gz-filter"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
          >
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
              style={{ accentColor: 'var(--tbl-accent)' }}
            />
            <span className="gz-filter__label">
              Show everyone (default: {minRounds}+ rounds)
            </span>
          </label>
        </div>

        <span
          style={{
            fontFamily: 'var(--tbl-font-mono)',
            fontSize: 10,
            letterSpacing: '0.1em',
            color: 'var(--tbl-ink-soft)',
          }}
        >
          {stat === 'ratings'
            ? `Gaps under ${meta.meaningfulDiff.toFixed(2)} do not mean anything`
            : stat === 'schedule'
            ? 'Click Schedule twice for the easiest schedules'
            : !phaseAware
            ? 'Whole season — this stat has no phase split'
            : 'Click any column to sort'}
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontFamily: 'var(--tbl-font-mono)',
            fontSize: 12,
          }}
        >
          <thead>
            <tr style={{ borderBottom: '2px solid var(--tbl-ink)' }}>
              <th style={{ width: 34, textAlign: 'right', padding: '7px 4px', fontSize: 10, color: 'var(--tbl-ink-soft)' }}>#</th>
              {th('name', 'Fighter')}
              <th style={{ textAlign: 'left', padding: '7px 8px', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--tbl-ink-soft)', fontWeight: 700 }}>
                Team
              </th>
              {th('rounds', 'Rds', 'Rounds fought')}

              {stat === 'wpa' && (
                <>
                  {th('wpa', 'WPA', 'How much their rounds moved the team’s chance of winning')}
                  {th('wpaPerRound', 'Per Rd')}
                  {th('roundWins', 'Won')}
                  {th('matches', 'Matches')}
                </>
              )}
              {stat === 'leverage' && (
                <>
                  {th('avgLi', 'At Stake', 'How big their rounds were — usage, not performance')}
                  {th('clutch', 'Clutch', 'Whether their results came in the rounds that mattered')}
                  {th('wpa', 'WPA')}
                </>
              )}
              {stat === 'ratings' && (
                <>
                  {th('nppr', 'NPPR', 'Net points per round, ignoring who they fought')}
                  {th('anppr', 'aNPPR', 'Net points per round, accounting for who they fought')}
                  {th('delta', 'Δ', 'How far their schedule moved them')}
                  <th style={{ textAlign: 'right', padding: '7px 8px', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--tbl-ink-soft)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    90% Range
                  </th>
                  {th('bootSd', 'Wobble', 'How much the rating moves when we rebuild the season')}
                </>
              )}
              {stat === 'schedule' && (
                <>
                  {th('nppr', 'NPPR')}
                  {th('sos', 'SOS', 'How good their opponents were, not counting rounds against this fighter')}
                </>
              )}
              {stat === 'war' && (
                <>
                  {th('netPts', 'Net Pts')}
                  {th('nppr', 'NP/R')}
                  {th('war', 'WAR', 'Wins added over an easily replaced fighter')}
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => {
              const p = r[scope];
              return (
                <tr key={r.slug} style={{ borderBottom: '1px dotted rgba(20,17,11,0.3)' }}>
                  <td style={{ textAlign: 'right', padding: '9px 4px', color: 'var(--tbl-ink-mute)', fontSize: 11 }}>
                    {i + 1}
                  </td>
                  <td style={{ padding: '9px 8px' }}>
                    <Link
                      href={`/fighters/${r.slug}`}
                      className="tbl-display"
                      style={{ fontSize: 15, fontWeight: 700, color: 'var(--tbl-ink)', textDecoration: 'none' }}
                    >
                      {r.name}
                    </Link>
                  </td>
                  <td style={{ padding: '9px 8px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {r.teamLogo && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.teamLogo} alt="" width={18} height={18} style={{ objectFit: 'contain' }} />
                      )}
                      <span style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        {r.teamCity || '—'}
                      </span>
                    </span>
                  </td>
                  {num(roundsOf(r))}

                  {stat === 'wpa' && (
                    <>
                      {num(signed(p.wpa), tone(p.wpa), true)}
                      {num(signed(p.wpaPerRound), 'var(--tbl-ink-soft)')}
                      {num(p.roundWins)}
                      {num(p.matches)}
                    </>
                  )}
                  {stat === 'leverage' && (
                    <>
                      {num(p.liRounds > 0 ? p.avgLi.toFixed(2) : '—', p.liRounds > 0 ? undefined : 'var(--tbl-ink-soft)', true)}
                      {num(p.liRounds > 0 ? signed(p.clutch) : '—', p.liRounds > 0 ? tone(p.clutch) : 'var(--tbl-ink-soft)')}
                      {num(signed(p.wpa), tone(p.wpa))}
                    </>
                  )}
                  {stat === 'ratings' && (
                    <>
                      {num(signed(r.nppr), tone(r.nppr))}
                      {num(signed(r.anppr), tone(r.anppr), true)}
                      {num(signed(r.delta), 'var(--tbl-ink-soft)')}
                      <td style={{ textAlign: 'right', padding: '9px 8px', color: 'var(--tbl-ink-soft)', whiteSpace: 'nowrap' }}>
                        {signed(r.lo, 2)} – {signed(r.hi, 2)}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          padding: '9px 8px',
                          color: r.uncertain ? 'var(--tbl-accent)' : 'var(--tbl-ink-mute)',
                        }}
                        title={r.uncertain ? `Moves more than ${meta.flagBootSd.toFixed(2)} — treat as soft` : undefined}
                      >
                        {r.bootSd.toFixed(2)}{r.uncertain ? ' ⚠' : ''}
                      </td>
                    </>
                  )}
                  {stat === 'schedule' && (
                    <>
                      {num(signed(r.nppr), tone(r.nppr))}
                      {num(r.sos === null ? '—' : signed(r.sos), r.sos === null ? 'var(--tbl-ink-soft)' : tone(r.sos), true)}
                    </>
                  )}
                  {stat === 'war' && (
                    <>
                      {num(signed(r.netPts, 0), tone(r.netPts))}
                      {num(signed(r.nppr, 2), tone(r.nppr))}
                      {num(r.war.toFixed(2), 'var(--tbl-accent)', true)}
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {sorted.length === 0 && (
        <p style={{ fontFamily: 'var(--tbl-font-mono)', fontSize: 12, color: 'var(--tbl-ink-soft)', padding: '18px 0' }}>
          Nobody matches this filter. Try a wider division, or tick “show everyone”.
        </p>
      )}
    </div>
  );
}
