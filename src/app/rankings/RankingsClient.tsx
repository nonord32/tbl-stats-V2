'use client';
// src/app/rankings/RankingsClient.tsx
// Gazette: four categories (WAR, NPPR, Net Pts, Win%) — top-5 leaders in each,
// filterable by weight class and gender.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { FighterStat, FightHistory } from '@/types';
import { aggregateFightersByPhase, hasPlayoffData, type Phase } from '@/lib/phaseStats';
import { compareWeightClass } from '@/lib/weightClasses';
import { getPrimaryWeightClass, getFighterWeightClasses } from '@/lib/fighters';
import { PageHeader } from '@/components/chrome/PageHeader';
import { getTeamLogoPathByName, getCityName } from '@/lib/teams';

interface Props {
  fighters: FighterStat[];
  fighterHistory: Record<string, FightHistory[]>;
  lastUpdated: string;
}

type Gender = 'All' | 'Male' | 'Female';

// Fighters need at least this many rounds to appear in rankings, so a 1-0
// fighter with one round doesn't beat out a 3-1 fighter on net points.
const MIN_ROUNDS = 2;
const TOP_N = 5;

interface Category {
  key: 'war' | 'nppr' | 'netPts' | 'winPct';
  label: string;
  format: (v: number) => string;
}

const CATEGORIES: Category[] = [
  { key: 'war',    label: 'Wins Above Replacement', format: (v) => v.toFixed(2) },
  { key: 'nppr',   label: 'Net Points Per Round',   format: (v) => v.toFixed(2) },
  { key: 'netPts', label: 'Net Points',             format: (v) => (v >= 0 ? '+' : '') + v.toFixed(0) },
  { key: 'winPct', label: 'Win Percentage',         format: (v) => (v * 100).toFixed(0) + '%' },
];

const PHASE_LABELS: Record<Phase, string> = {
  all: 'Full Season',
  regular: 'Regular Season',
  playoffs: 'Playoffs',
};

export function RankingsClient({ fighters, fighterHistory, lastUpdated }: Props) {
  const [gender, setGender] = useState<Gender>('All');
  const [weightClass, setWeightClass] = useState<string>('All');
  const [phase, setPhase] = useState<Phase>('all');

  // The phase toggle only appears once playoff games exist, so the page is
  // unchanged through the regular season.
  const playoffsLive = useMemo(
    () => hasPlayoffData(fighterHistory, {}),
    [fighterHistory]
  );

  // WAR can't be recomputed per-phase (sheet-only formula), so it's only shown
  // in the Full Season view; phase views drop the WAR category.
  const showWar = phase === 'all';
  const categories = showWar ? CATEGORIES : CATEGORIES.filter((c) => c.key !== 'war');

  // Stats scoped to the selected phase. 'all' passes the sheet stats through.
  const phaseFighters = useMemo(
    () => aggregateFightersByPhase(fighters, fighterHistory, phase),
    [fighters, fighterHistory, phase]
  );

  // Each fighter is ranked under their *primary* class (most fights, ties →
  // most recent). Fighters who've moved up or down still show up in the
  // dropdown for every class they've competed in, but the rankings table
  // only places them under the one they belong to most.
  const primaryClassFor = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of fighters) {
      map.set(f.slug, getPrimaryWeightClass(f, fighterHistory[f.slug] ?? []));
    }
    return map;
  }, [fighters, fighterHistory]);

  const weightClasses = useMemo(() => {
    const set = new Set<string>();
    fighters.forEach((f) => {
      getFighterWeightClasses(f, fighterHistory[f.slug] ?? []).forEach((c) => set.add(c));
    });
    return Array.from(set).sort(compareWeightClass);
  }, [fighters, fighterHistory]);

  const filtered = useMemo(() => {
    return phaseFighters.filter((f) => {
      if (f.rounds < MIN_ROUNDS) return false;
      if (gender !== 'All' && f.gender !== gender) return false;
      if (weightClass !== 'All') {
        if (primaryClassFor.get(f.slug) !== weightClass) return false;
      }
      return true;
    });
  }, [phaseFighters, gender, weightClass, primaryClassFor]);

  const filterSlot = (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      {playoffsLive && (
        <label className="gz-filter">
          <span className="gz-filter__label">View</span>
          <select
            className="gz-filter__select"
            value={phase}
            onChange={(e) => setPhase(e.target.value as Phase)}
          >
            {(['all', 'regular', 'playoffs'] as Phase[]).map((p) => (
              <option key={p} value={p}>{PHASE_LABELS[p]}</option>
            ))}
          </select>
        </label>
      )}
      <label className="gz-filter">
        <span className="gz-filter__label">Weight</span>
        <select
          className="gz-filter__select"
          value={weightClass}
          onChange={(e) => setWeightClass(e.target.value)}
        >
          <option value="All">All</option>
          {weightClasses.map((wc) => (
            <option key={wc} value={wc}>{wc}</option>
          ))}
        </select>
      </label>
      <label className="gz-filter">
        <span className="gz-filter__label">Gender</span>
        <select
          className="gz-filter__select"
          value={gender}
          onChange={(e) => setGender(e.target.value as Gender)}
        >
          <option value="All">All</option>
          <option value="Male">Men</option>
          <option value="Female">Women</option>
        </select>
      </label>
    </div>
  );

  return (
    <>
      <PageHeader
        eyebrow="Pound for Pound"
        title="Rankings"
        subtitle={
          <>
            {showWar ? 'Four Categories' : 'Three Categories'}
            {phase !== 'all' ? ` · ${PHASE_LABELS[phase]}` : ''}
            <span className="rankings-desktop-only"> · Top Five in Each</span>
            <span className="rankings-mobile-only"> · Top Three Each</span>
            {lastUpdated ? ` · Updated ${lastUpdated}` : ''}
          </>
        }
        right={filterSlot}
      />

      <div
        className="gz-rank-grid"
        style={{
          padding: '26px 32px 36px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          columnGap: 40,
          rowGap: 32,
        }}
      >
        {filtered.length === 0 ? (
          <div
            style={{
              gridColumn: '1 / -1',
              padding: 24,
              textAlign: 'center',
              border: '1.5px solid var(--tbl-ink)',
              background: 'var(--tbl-paper)',
              fontFamily: 'var(--tbl-font-mono)',
              fontSize: 12,
              color: 'var(--tbl-ink-soft)',
            }}
          >
            No qualifying fighters for this filter combination.
          </div>
        ) : (
          categories.map((cat) => (
            <CategoryList key={cat.key} cat={cat} fighters={filtered} />
          ))
        )}
      </div>
    </>
  );
}

function CategoryList({ cat, fighters }: { cat: Category; fighters: FighterStat[] }) {
  const sorted = [...fighters]
    .sort((a, b) => b[cat.key] - a[cat.key])
    .slice(0, TOP_N);
  if (sorted.length === 0) return null;
  const topVal = sorted[0][cat.key];
  const maxAbs = Math.max(
    Math.abs(topVal),
    ...sorted.map((f) => Math.abs(f[cat.key]))
  ) || 1;

  return (
    <div>
      <div className="tbl-eyebrow">{cat.label}</div>
      <div
        className="tbl-display"
        style={{ fontSize: 30, lineHeight: 1, marginTop: 4, marginBottom: 14 }}
      >
        Leaders
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {sorted.map((f, i) => {
          const val = f[cat.key];
          const pct = Math.min(100, (Math.abs(val) / maxAbs) * 100);
          const isTop = i === 0;
          const teamLabel = getCityName(f.team).toUpperCase();
          const logo = getTeamLogoPathByName(f.team);
          return (
            <Link
              key={f.slug}
              href={`/fighters/${f.slug}`}
              className="gz-cat-row"
              aria-label={`${f.name}, ${cat.label}: ${cat.format(val)}`}
            >
              <div
                className="tbl-display"
                style={{
                  fontSize: 20,
                  fontWeight: 900,
                  color: isTop ? 'var(--tbl-accent)' : 'var(--tbl-ink-soft)',
                }}
              >
                {i + 1}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {logo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logo}
                      alt=""
                      style={{ width: 20, height: 20, objectFit: 'contain', flexShrink: 0 }}
                    />
                  )}
                  <span
                    className="tbl-display"
                    style={{
                      fontSize: 15,
                      fontWeight: isTop ? 900 : 700,
                      color: 'var(--tbl-ink)',
                    }}
                  >
                    {f.name}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--tbl-font-mono)',
                      fontSize: 10,
                      color: 'var(--tbl-ink-soft)',
                      letterSpacing: '0.1em',
                    }}
                  >
                    · {teamLabel}
                  </span>
                </div>
                <div
                  style={{
                    marginTop: 4,
                    height: 6,
                    background: 'rgba(20,17,11,0.08)',
                    position: 'relative',
                  }}
                  aria-hidden="true"
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      height: '100%',
                      width: `${pct}%`,
                      background: isTop ? 'var(--tbl-accent)' : 'var(--tbl-ink)',
                    }}
                  />
                </div>
              </div>
              <div
                className="tbl-display"
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  color: isTop ? 'var(--tbl-accent)' : 'var(--tbl-ink)',
                  minWidth: 72,
                  textAlign: 'right',
                }}
              >
                {cat.format(val)}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
