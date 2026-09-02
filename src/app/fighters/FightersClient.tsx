'use client';
// src/app/fighters/FightersClient.tsx

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import type { FighterStat, FightHistory, FightersByPhase, ScheduleEntry } from '@/types';
import { calcFighterStreak, toSlug } from '@/lib/data';
import {
  getFighterWeightClasses,
  getFighterWeightClassesOrdered,
  getPrimaryWeightClass,
} from '@/lib/fighters';
import { getTeamLogoPathByName, getCityName } from '@/lib/teams';
import {
  DataTable,
  FilterBar,
  PageHeader,
  SectionRule,
  Select,
  type Column,
} from '@/components/ui';
import { aggregateFightersByPhase, hasPlayoffData, type Phase } from '@/lib/phaseStats';
import { computeFinishing } from '@/lib/warStats';

type SortKey =
  | 'nppr'
  | 'netPts'
  | 'winPct'
  | 'rounds'
  | 'record'
  | 'name'
  | 'koTko'
  | 'koPct';

const PHASE_LABELS: Record<Phase, string> = {
  regular: 'Regular Season',
  playoffs: 'Playoffs',
  all: 'Full Season',
};

interface Props {
  fighters: FighterStat[];
  fightersByPhase: FightersByPhase;
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

export function FightersClient({ fighters, fightersByPhase, fighterHistory, schedule, seoText, lastUpdated }: Props) {
  const formattedUpdate = lastUpdated || null;
  const [search, setSearch] = useState('');
  const [weightFilter, setWeightFilter] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [weekFilter, setWeekFilter] = useState('');
  const [minRoundsFilter, setMinRoundsFilter] = useState('');
  const [phase, setPhase] = useState<Phase>('regular');

  // The View toggle only appears once playoff games exist, so nothing changes
  // through the regular season.
  const playoffsLive = useMemo(() => hasPlayoffData(fighterHistory, {}), [fighterHistory]);

  // Fighter stats scoped to the selected phase (Regular or Playoffs), from that
  // phase's pre-aggregated tab (with a recompute-from-history fallback when the
  // tab is empty).
  const phaseFighters = useMemo(
    () => aggregateFightersByPhase(fighters, fightersByPhase, fighterHistory, phase),
    [fighters, fightersByPhase, fighterHistory, phase]
  );

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
  // classes from their bout history. Used to populate the dropdown so a
  // fighter who's gone up/down a class still surfaces under either option.
  const fighterWeightClasses = useCallback(
    (f: FighterStat): Set<string> =>
      getFighterWeightClasses(f, fighterHistory[f.slug] || []),
    [fighterHistory]
  );

  // Primary class for ranking purposes: the one a fighter has competed in
  // most often (ties → most recent). Drives the weight-class filter so a
  // fighter who's mostly fought at Cruiserweight but has one Light-Heavy
  // bout doesn't show up in the LHW list.
  const primaryClassFor = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of fighters) {
      map.set(f.slug, getPrimaryWeightClass(f, fighterHistory[f.slug] || []));
    }
    return map;
  }, [fighters, fighterHistory]);

  const orderedClassesFor = useCallback(
    (f: FighterStat): string[] =>
      getFighterWeightClassesOrdered(f, fighterHistory[f.slug] || []),
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

  // Dropdown lists the 12 canonical teams. Fighter.team strings can carry a
  // previous-team suffix like "Houston (prev: Miami)"; getCityName() strips
  // that and returns just the current city, so a moved fighter only appears
  // under their current team's filter.
  const teams = useMemo(
    () =>
      Array.from(
        new Set(fighters.map((f) => getCityName(f.team)).filter(Boolean))
      ).sort(),
    [fighters]
  );

  // When a week is selected, replace per-fighter stats (record / net pts /
  // nppr / win% / rounds) with just that week's performance derived from
  // their fight history. WAR is season-level and can't be recomputed here,
  // so it stays as-is.
  const displayedFighters = useMemo(() => {
    if (!weekFilter) return phaseFighters;
    const w = Number(weekFilter);
    return phaseFighters.map((f) => {
      const history = fighterHistory[f.slug] || [];
      const weekOnly = history.filter((h) => matchIndexToWeek.get(h.matchIndex) === w);
      if (weekOnly.length === 0) return f;
      const wins = weekOnly.filter((h) => h.result === 'W').length;
      const losses = weekOnly.filter((h) => h.result === 'L').length;
      const decisions = wins + losses;
      const netPts = weekOnly.reduce((s, h) => s + h.netPts, 0);
      const rounds = weekOnly.length;
      // Recompute scoring + finishing so KO/TKO and KO% reflect just this week.
      const fin = computeFinishing(weekOnly);
      return {
        ...f,
        wins,
        losses,
        record: `${wins}-${losses}`,
        netPts,
        rounds,
        nppr: rounds > 0 ? netPts / rounds : 0,
        winPct: decisions > 0 ? wins / decisions : 0,
        ...fin,
      };
    });
  }, [phaseFighters, fighterHistory, matchIndexToWeek, weekFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const weekNum = weekFilter ? Number(weekFilter) : null;
    const minRounds = minRoundsFilter ? Number(minRoundsFilter) : 0;
    return displayedFighters.filter((f) => {
      if (q && !f.name.toLowerCase().includes(q)) return false;
      if (weightFilter) {
        // "Female X" picks female fighters in class X. A bare class name
        // matches either gender for that class — except the three women's
        // classes (Bantam / Feather / Super Light), which only match the
        // men's bracket so the dropdown splits cleanly.
        // Match against the fighter's PRIMARY class (most fought, ties →
        // most recent) so a multi-class fighter is ranked under one bucket.
        const isFemaleOption = weightFilter.startsWith('Female ');
        const baseClass = isFemaleOption ? weightFilter.slice(7) : weightFilter;
        if (primaryClassFor.get(f.slug) !== baseClass) return false;
        if (isFemaleOption && f.gender !== 'Female') return false;
        if (!isFemaleOption && FEMALE_CLASSES.has(baseClass) && f.gender === 'Female') return false;
      }
      if (teamFilter && getCityName(f.team) !== teamFilter) return false;
      if (genderFilter && f.gender !== genderFilter) return false;
      if (weekNum !== null) {
        const history = fighterHistory[f.slug] || [];
        if (!history.some((h) => matchIndexToWeek.get(h.matchIndex) === weekNum)) return false;
      }
      if (minRounds > 0 && f.rounds < minRounds) return false;
      return true;
    });
  }, [displayedFighters, search, weightFilter, teamFilter, genderFilter, weekFilter, minRoundsFilter, primaryClassFor, fighterHistory, matchIndexToWeek, FEMALE_CLASSES]);

  const columns: Column<FighterStat>[] = [
    {
      key: 'name',
      label: 'Fighter',
      align: 'left',
      sortable: true,
      value: (f) => f.name,
      render: (f) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {getTeamLogoPathByName(f.team) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={getTeamLogoPathByName(f.team) as string}
              alt=""
              style={{ width: 18, height: 18, objectFit: 'contain', flexShrink: 0 }}
            />
          )}
          <Link
            href={`/fighters/${f.slug}`}
            className="tbl-display"
            style={{ fontSize: 15, fontWeight: 700, color: 'var(--tbl-ink)', textDecoration: 'none' }}
          >
            {f.name}
          </Link>
        </span>
      ),
    },
    {
      key: 'team',
      label: 'Team',
      align: 'left',
      hideOnMobile: true,
      render: (f) => (
        <span style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {getCityName(f.team) || '—'}
        </span>
      ),
    },
    {
      key: 'weightClass',
      label: 'Weight',
      align: 'left',
      hideOnMobile: true,
      render: (f) => <span style={{ color: 'var(--tbl-ink-soft)' }}>{f.weightClass || '—'}</span>,
    },
    {
      key: 'record',
      label: 'Record',
      sortable: true,
      value: (f) => f.wins,
      render: (f) => f.record,
    },
    {
      key: 'winPct',
      label: 'Win%',
      sortable: true,
      hideOnMobile: true,
      value: (f) => f.winPct,
      render: (f) => `${(f.winPct * 100).toFixed(0)}%`,
    },
    {
      key: 'rounds',
      label: 'Rds',
      sortable: true,
      hideOnMobile: true,
      value: (f) => f.rounds,
      render: (f) => f.rounds,
    },
    {
      key: 'netPts',
      label: 'Net Pts',
      sortable: true,
      value: (f) => f.netPts,
      render: (f) => (
        <span
          style={{
            color: f.netPts >= 0 ? 'var(--tbl-green)' : 'var(--tbl-red)',
            fontWeight: 700,
          }}
        >
          {f.netPts >= 0 ? '+' : ''}
          {f.netPts.toFixed(0)}
        </span>
      ),
    },
    {
      key: 'nppr',
      label: 'NP/R',
      title: 'Net points per round',
      sortable: true,
      hideOnMobile: true,
      value: (f) => f.nppr,
      render: (f) => (
        <span style={{ color: f.nppr >= 0 ? 'var(--tbl-green)' : 'var(--tbl-red)' }}>
          {f.nppr >= 0 ? '+' : ''}
          {f.nppr.toFixed(2)}
        </span>
      ),
    },
    {
      key: 'koTko',
      label: 'KO/TKO',
      sortable: true,
      hideOnMobile: true,
      value: (f) => f.koTko,
      render: (f) => f.koTko,
    },
    {
      key: 'koPct',
      label: 'KO%',
      title: 'Share of wins that came by stoppage',
      sortable: true,
      hideOnMobile: true,
      value: (f) => f.koPct,
      render: (f) => (f.wins > 0 ? `${(f.koPct * 100).toFixed(0)}%` : '—'),
    },
    {
      key: 'streak',
      label: 'Streak',
      align: 'left',
      hideOnMobile: true,
      render: (f) => {
        const st = calcFighterStreak(fighterHistory[f.slug] || []);
        return st ? <StreakBadge streak={st} /> : null;
      },
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Individual Rankings · 2026 TBL Season"
        title="Fighter Stats"
        subtitle={formattedUpdate ? `Updated ${formattedUpdate}` : undefined}
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

        <SectionRule
          left={`Fighters · ${filtered.length} of ${fighters.length}`}
          right="Click any column to sort"
        />

        <FilterBar>
          <label className="gz-filter">
            <span className="gz-filter__label">Search</span>
            <input
              type="search"
              className="gz-filter__select"
              placeholder="Fighter name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search fighters by name"
            />
          </label>

          {playoffsLive && (
            <Select
              label="When"
              value={phase}
              onChange={(v) => setPhase(v as Phase)}
              ariaLabel="Filter by season phase"
              options={(['regular', 'playoffs', 'all'] as Phase[]).map((x) => ({
                value: x,
                label: PHASE_LABELS[x],
              }))}
            />
          )}

          <Select
            label="Weight"
            value={weightFilter}
            onChange={setWeightFilter}
            options={[
              { value: '', label: 'All weights' },
              ...weightClasses.map((w) => ({ value: w, label: w })),
            ]}
          />
          <Select
            label="Team"
            value={teamFilter}
            onChange={setTeamFilter}
            options={[
              { value: '', label: 'All teams' },
              ...teams.map((t) => ({ value: t, label: t })),
            ]}
          />
          <Select
            label="Gender"
            value={genderFilter}
            onChange={setGenderFilter}
            options={[
              { value: '', label: 'All genders' },
              { value: 'Male', label: 'Male' },
              { value: 'Female', label: 'Female' },
            ]}
          />
          <Select
            label="Week"
            value={weekFilter}
            onChange={setWeekFilter}
            options={[
              { value: '', label: 'All weeks' },
              ...weeks.map((w) => ({ value: String(w), label: `Week ${w}` })),
            ]}
          />
          <Select
            label="Rounds"
            value={minRoundsFilter}
            onChange={setMinRoundsFilter}
            ariaLabel="Filter by minimum rounds"
            options={[
              { value: '', label: 'Any rounds' },
              ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ value: String(n), label: `≥ ${n} rounds` })),
            ]}
          />
        </FilterBar>

        {weekFilter && (
          <p
            style={{
              fontFamily: 'var(--tbl-font-mono)',
              fontSize: 10,
              letterSpacing: '0.1em',
              color: 'var(--tbl-ink-soft)',
              margin: '0 0 10px',
            }}
          >
            Showing week {weekFilter} only. WAR is a season-level figure and is not recomputed here.
          </p>
        )}

        <DataTable
          rows={filtered}
          columns={columns}
          rowKey={(f) => f.slug}
          rank
          defaultSort={{ key: 'netPts', dir: 'desc' }}
          emptyMessage="No fighters match your filters."
        />
      </div>
    </>
  );
}
