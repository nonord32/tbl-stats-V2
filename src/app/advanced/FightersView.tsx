'use client';
// src/app/advanced/FightersView.tsx
// The merged fighter leaderboard: what used to be /wpa and /ratings.
//
// A stat picker swaps which columns show. Two of the five stat sets are
// phase-aware (WPA, Stakes & Timing); the other three are whole-season only
// — the ridge fit behind Adjusted NPPR and Schedule has no phase split by
// design, and WAR is a season-level figure. So the phase control DISAPPEARS on
// those rather than sitting there implying a filter the numbers ignore.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { compareWeightClass } from '@/lib/weightClasses';
import {
  DataTable,
  FilterBar,
  SectionRule,
  Select,
  Toggle,
  type Column,
} from '@/components/ui';
import type { AdvancedMeta, FighterRow, Phase, PhaseStats, StatSet } from './types';

const ALL = '__all__';

const STAT_LABELS: Record<StatSet, string> = {
  wpa: 'Win Probability Added',
  leverage: 'Stakes & Timing',
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

const DEFAULT_SORT: Record<StatSet, string> = {
  wpa: 'wpa',
  leverage: 'clutch',
  ratings: 'anppr',
  schedule: 'sos',
  war: 'war',
};

const signed = (v: number, dp = 3) => `${v >= 0 ? '+' : ''}${v.toFixed(dp)}`;
const tone = (v: number) => (v >= 0 ? 'var(--tbl-green)' : 'var(--tbl-red)');
const Num = ({ v, color, bold }: { v: React.ReactNode; color?: string; bold?: boolean }) => (
  <span style={{ color, fontWeight: bold ? 700 : undefined }}>{v}</span>
);

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

  const phaseAware = PHASE_AWARE[stat];
  const playoffsLive = useMemo(() => rows.some((r) => r.playoffs.rounds > 0), [rows]);
  // Whole-season stat sets ignore the phase control entirely.
  const scope: Phase = phaseAware ? (playoffsLive ? phase : 'all') : 'all';
  const minRounds = phaseAware ? MIN_BY_PHASE[scope] : meta.minRounds;

  const genders = useMemo(
    () => [...new Set(rows.map((r) => r.gender).filter(Boolean))].sort(),
    [rows],
  );

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

  const p = (r: FighterRow): PhaseStats => r[scope];

  const identity: Column<FighterRow>[] = [
    {
      key: 'name',
      label: 'Fighter',
      align: 'left',
      sortable: true,
      value: (r) => r.name,
      render: (r) => (
        <Link
          href={`/fighters/${r.slug}`}
          className="tbl-display"
          style={{ fontSize: 15, fontWeight: 700, color: 'var(--tbl-ink)', textDecoration: 'none' }}
        >
          {r.name}
        </Link>
      ),
    },
    {
      key: 'team',
      label: 'Team',
      align: 'left',
      hideOnMobile: true,
      render: (r) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {r.teamLogo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.teamLogo} alt="" width={18} height={18} style={{ objectFit: 'contain' }} />
          )}
          <span style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {r.teamCity || '—'}
          </span>
        </span>
      ),
    },
    {
      key: 'rounds',
      label: 'Rds',
      title: 'Rounds fought',
      sortable: true,
      value: roundsOf,
      render: (r) => roundsOf(r),
    },
  ];

  const BY_STAT: Record<StatSet, Column<FighterRow>[]> = {
    wpa: [
      {
        key: 'wpa',
        label: 'WPA',
        title: 'How much their rounds moved the team’s chance of winning, in wins',
        sortable: true,
        value: (r) => p(r).wpa,
        render: (r) => <Num v={signed(p(r).wpa)} color={tone(p(r).wpa)} bold />,
      },
      {
        key: 'wpaPerRound',
        label: 'Per Rd',
        sortable: true,
        hideOnMobile: true,
        value: (r) => p(r).wpaPerRound,
        render: (r) => <Num v={signed(p(r).wpaPerRound)} color="var(--tbl-ink-soft)" />,
      },
      {
        key: 'roundWins',
        label: 'Won',
        sortable: true,
        hideOnMobile: true,
        value: (r) => p(r).roundWins,
        render: (r) => p(r).roundWins,
      },
      {
        key: 'matches',
        label: 'Matches',
        sortable: true,
        hideOnMobile: true,
        value: (r) => p(r).matches,
        render: (r) => p(r).matches,
      },
    ],
    leverage: [
      {
        key: 'avgLi',
        label: 'Stakes',
        title: 'How big their rounds were — 1.00× is an ordinary round. Usage, not performance.',
        sortable: true,
        value: (r) => p(r).avgLi,
        render: (r) =>
          p(r).liRounds > 0 ? (
            <Num v={`${p(r).avgLi.toFixed(2)}×`} bold />
          ) : (
            <Num v="—" color="var(--tbl-ink-soft)" />
          ),
      },
      {
        key: 'clutch',
        label: 'Timing',
        title: 'The part of their WPA that came from when those results landed, in wins',
        sortable: true,
        value: (r) => p(r).clutch,
        render: (r) =>
          p(r).liRounds > 0 ? (
            <Num v={signed(p(r).clutch)} color={tone(p(r).clutch)} />
          ) : (
            <Num v="—" color="var(--tbl-ink-soft)" />
          ),
      },
      {
        key: 'wpa',
        label: 'WPA',
        sortable: true,
        hideOnMobile: true,
        value: (r) => p(r).wpa,
        render: (r) => <Num v={signed(p(r).wpa)} color={tone(p(r).wpa)} />,
      },
    ],
    ratings: [
      {
        key: 'nppr',
        label: 'NPPR',
        title: 'Net points per round, ignoring who they fought',
        sortable: true,
        hideOnMobile: true,
        value: (r) => r.nppr,
        render: (r) => <Num v={signed(r.nppr)} color={tone(r.nppr)} />,
      },
      {
        key: 'anppr',
        label: 'aNPPR',
        title: 'Net points per round, accounting for who they fought',
        sortable: true,
        value: (r) => r.anppr,
        render: (r) => <Num v={signed(r.anppr)} color={tone(r.anppr)} bold />,
      },
      {
        key: 'delta',
        label: 'Δ',
        title: 'How far their schedule moved them from the raw number',
        sortable: true,
        hideOnMobile: true,
        value: (r) => r.delta,
        render: (r) => <Num v={signed(r.delta)} color="var(--tbl-ink-soft)" />,
      },
      {
        key: 'range',
        label: '90% Range',
        hideOnMobile: true,
        render: (r) => (
          <span style={{ color: 'var(--tbl-ink-soft)', whiteSpace: 'nowrap' }}>
            {signed(r.lo, 2)} – {signed(r.hi, 2)}
          </span>
        ),
      },
      {
        key: 'bootSd',
        label: 'Wobble',
        title: 'How much the rating moves when we rebuild the season',
        sortable: true,
        value: (r) => r.bootSd,
        render: (r) => (
          <span
            style={{ color: r.uncertain ? 'var(--tbl-accent)' : 'var(--tbl-ink-mute)' }}
            title={
              r.uncertain ? `Moves more than ${meta.flagBootSd.toFixed(2)} — treat as soft` : undefined
            }
          >
            {r.bootSd.toFixed(2)}
            {r.uncertain ? ' ⚠' : ''}
          </span>
        ),
      },
    ],
    schedule: [
      {
        key: 'nppr',
        label: 'NPPR',
        sortable: true,
        hideOnMobile: true,
        value: (r) => r.nppr,
        render: (r) => <Num v={signed(r.nppr)} color={tone(r.nppr)} />,
      },
      {
        key: 'sos',
        label: 'SOS',
        title: 'How good their opponents were, not counting rounds against this fighter',
        sortable: true,
        value: (r) => r.sos ?? 0,
        render: (r) =>
          r.sos === null ? (
            <Num v="—" color="var(--tbl-ink-soft)" />
          ) : (
            <Num v={signed(r.sos)} color={tone(r.sos)} bold />
          ),
      },
    ],
    war: [
      {
        key: 'netPts',
        label: 'Net Pts',
        sortable: true,
        hideOnMobile: true,
        value: (r) => r.netPts,
        render: (r) => <Num v={signed(r.netPts, 0)} color={tone(r.netPts)} />,
      },
      {
        key: 'nppr',
        label: 'NP/R',
        sortable: true,
        hideOnMobile: true,
        value: (r) => r.nppr,
        render: (r) => <Num v={signed(r.nppr, 2)} color={tone(r.nppr)} />,
      },
      {
        key: 'war',
        label: 'WAR',
        title: 'Wins added over an easily replaced fighter',
        sortable: true,
        value: (r) => r.war,
        render: (r) => <Num v={r.war.toFixed(2)} color="var(--tbl-accent)" bold />,
      },
    ],
  };

  const columns = [...identity, ...BY_STAT[stat]];
  const scopeLabel = phaseAware ? PHASE_LABELS[scope] : 'Full Season';
  const divisionLabel = division === ALL ? 'Pound for Pound' : division;

  return (
    <div style={{ padding: '20px 32px 40px' }}>
      <SectionRule
        left={`${STAT_LABELS[stat]} · ${divisionLabel} · ${scopeLabel} · ${filtered.length} Fighters`}
        right={lastUpdated ? `Updated ${lastUpdated}` : undefined}
      />

      <FilterBar
        hint={
          stat === 'ratings'
            ? `Gaps under ${meta.meaningfulDiff.toFixed(2)} do not mean anything`
            : stat === 'schedule'
            ? 'Click Schedule twice for the easiest schedules'
            : !phaseAware
            ? 'Whole season — this stat has no phase split'
            : 'Click any column to sort'
        }
      >
        <Select
          label="Rank by"
          value={stat}
          onChange={(v) => setStat(v as StatSet)}
          ariaLabel="Which stat to rank by"
          options={STAT_ORDER.map((s) => ({ value: s, label: STAT_LABELS[s] }))}
        />

        {/* Only shown when the active stat actually splits by phase. */}
        {phaseAware && playoffsLive && (
          <Select
            label="When"
            value={phase}
            onChange={(v) => setPhase(v as Phase)}
            ariaLabel="Filter by season phase"
            options={PHASE_ORDER.map((x) => ({ value: x, label: PHASE_LABELS[x] }))}
          />
        )}

        <Select
          label="Division"
          value={division}
          onChange={setDivision}
          ariaLabel="Filter by weight class"
          options={[
            { value: ALL, label: 'Pound for Pound' },
            ...divisionCounts.map(([wc, n]) => ({ value: wc, label: `${wc} (${n})` })),
          ]}
        />

        {genders.length > 1 && (
          <Select
            label="Gender"
            value={gender}
            onChange={setGender}
            ariaLabel="Filter by gender"
            options={[{ value: ALL, label: 'All' }, ...genders.map((g) => ({ value: g, label: g }))]}
          />
        )}

        <Toggle
          checked={showAll}
          onChange={setShowAll}
          label={`Show everyone (default: ${minRounds}+ rounds)`}
        />
      </FilterBar>

      <DataTable
        // Remount on a stat change so the table's own sort resets to that
        // stat's headline column rather than keeping a key that just vanished.
        key={stat}
        rows={filtered}
        columns={columns}
        rowKey={(r) => r.slug}
        rank
        defaultSort={{ key: DEFAULT_SORT[stat], dir: 'desc' }}
        emptyMessage="Nobody matches this filter. Try a wider division, or tick “show everyone”."
      />
    </div>
  );
}
