'use client';
// src/app/rankings/RankingsClient.tsx
// Gazette: four categories (WAR, NPPR, Net Pts, Win%) — top-5 leaders in each,
// filterable by weight class and gender.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { FighterStat, FightHistory } from '@/types';
import { compareWeightClass } from '@/lib/weightClasses';
import { PageHeader } from '@/components/chrome/PageHeader';
import { getTeamLogoPathByName, getCityName } from '@/lib/teams';

interface Props {
  fighters: FighterStat[];
  // Accepted but currently unused; kept for future per-weight computation.
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

export function RankingsClient({ fighters, lastUpdated }: Props) {
  const [gender, setGender] = useState<Gender>('All');
  const [weightClass, setWeightClass] = useState<string>('All');

  // Expand combined strings like "Light Heavyweight, Cruiserweight" into the
  // underlying classes so a fighter at two weights shows up in both filter
  // options instead of as a third "combined" entry in the dropdown.
  const splitClasses = (raw: string): string[] =>
    raw
      .split(/[,/]/)
      .map((s) => s.trim())
      .filter(Boolean);

  const weightClasses = useMemo(() => {
    const set = new Set<string>();
    fighters.forEach((f) => {
      splitClasses(f.weightClass).forEach((c) => set.add(c));
    });
    return Array.from(set).sort(compareWeightClass);
  }, [fighters]);

  const filtered = useMemo(() => {
    return fighters.filter((f) => {
      if (f.rounds < MIN_ROUNDS) return false;
      if (gender !== 'All' && f.gender !== gender) return false;
      if (weightClass !== 'All') {
        const classes = splitClasses(f.weightClass);
        if (!classes.includes(weightClass)) return false;
      }
      return true;
    });
  }, [fighters, gender, weightClass]);

  const filterSlot = (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
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
            Four Categories
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
          CATEGORIES.map((cat) => (
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
