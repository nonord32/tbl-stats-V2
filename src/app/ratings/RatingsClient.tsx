'use client';
// src/app/ratings/RatingsClient.tsx
// Sortable opponent-adjusted leaderboard (gazette styling), in two views:
// Adjusted NPPR with its bootstrap interval, and Strength of Schedule.
//
// Divisions here are the 12 canonical weight classes with gender as its own
// filter — the /rankings convention, not the synthetic "Female X" classes the
// /fighters dropdown uses. The division dropdown carries the qualified count
// for each class, because a division leader over a field of three should be
// visible as such.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { getTeamLogoPathByName, getCityName } from '@/lib/teams';
import { compareWeightClass } from '@/lib/weightClasses';
import { SectionRule } from '@/components/chrome/SectionRule';

export interface RatingsRow {
  slug: string;
  name: string;
  team: string;
  weightClass: string;
  gender: string;
  rounds: number;
  nppr: number;
  sos: number | null;
  anppr: number;
  delta: number;
  bootSd: number;
  lo: number;
  hi: number;
  uncertain: boolean;
}

interface Props {
  rows: RatingsRow[];
  lastUpdated?: string;
  minRounds: number;
  meaningfulDiff: number;
  flagBootSd: number;
}

type View = 'anppr' | 'sos';
type SortKey = 'name' | 'rounds' | 'nppr' | 'anppr' | 'delta' | 'sos' | 'bootSd';

const ALL = '__all__';

const signed = (v: number, dp = 3) => `${v >= 0 ? '+' : ''}${v.toFixed(dp)}`;
const tone = (v: number) => (v >= 0 ? 'var(--tbl-green)' : 'var(--tbl-red)');

export function RatingsClient({ rows, lastUpdated, minRounds, meaningfulDiff, flagBootSd }: Props) {
  const [view, setView] = useState<View>('anppr');
  const [division, setDivision] = useState<string>(ALL);
  const [gender, setGender] = useState<string>(ALL);
  const [showAll, setShowAll] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('anppr');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const genders = useMemo(() => {
    const set = new Set(rows.map((r) => r.gender).filter(Boolean));
    return [...set].sort();
  }, [rows]);

  // Gender narrows the pool before divisions are counted, so the counts in the
  // dropdown always describe the field actually being ranked.
  const genderScoped = useMemo(
    () => (gender === ALL ? rows : rows.filter((r) => r.gender === gender)),
    [rows, gender],
  );

  const divisionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of genderScoped) {
      if (r.rounds < minRounds || !r.weightClass) continue;
      counts.set(r.weightClass, (counts.get(r.weightClass) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => compareWeightClass(a[0], b[0]));
  }, [genderScoped, minRounds]);

  const filtered = useMemo(() => {
    let out = genderScoped;
    if (division !== ALL) out = out.filter((r) => r.weightClass === division);
    if (!showAll) out = out.filter((r) => r.rounds >= minRounds);
    // SOS is undefined for a fighter whose every opponent was faced only by
    // them; those rows would sort as blanks in the SOS view.
    if (view === 'sos') out = out.filter((r) => r.sos !== null);
    return out;
  }, [genderScoped, division, showAll, minRounds, view]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' ? 'asc' : 'desc');
    }
  };

  const sorted = useMemo(() => {
    const out = [...filtered];
    out.sort((a, b) => {
      if (sortKey === 'name') {
        return sortDir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      }
      const pick = (r: RatingsRow): number => {
        switch (sortKey) {
          case 'rounds':
            return r.rounds;
          case 'nppr':
            return r.nppr;
          case 'delta':
            return r.delta;
          case 'sos':
            return r.sos ?? 0;
          case 'bootSd':
            return r.bootSd;
          default:
            return r.anppr;
        }
      };
      const d = pick(a) - pick(b);
      return sortDir === 'desc' ? -d : d;
    });
    return out;
  }, [filtered, sortKey, sortDir]);

  const th = (key: SortKey, label: string, align: 'left' | 'right', title?: string) => (
    <th
      onClick={() => handleSort(key)}
      title={title}
      style={{
        textAlign: align,
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
      <span style={{ opacity: 0.9 }}>
        {sortKey === key ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ' ↕'}
      </span>
    </th>
  );

  const plainTh = (label: string, align: 'left' | 'right', width?: number) => (
    <th
      style={{
        textAlign: align,
        padding: '7px 8px',
        fontSize: 10,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: 'var(--tbl-ink-soft)',
        fontWeight: 700,
        whiteSpace: 'nowrap',
        width,
      }}
    >
      {label}
    </th>
  );

  const scopeLabel =
    division === ALL ? 'Pound for Pound' : division + (gender === ALL ? '' : ` · ${gender}`);

  return (
    <div style={{ padding: '20px 32px 40px' }}>
      <SectionRule
        left={`${view === 'anppr' ? 'Adjusted NPPR' : 'Strength of Schedule'} · ${scopeLabel} · ${sorted.length} Fighters`}
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
          <div style={{ display: 'inline-flex' }}>
            {(['anppr', 'sos'] as View[]).map((v) => (
              <button
                key={v}
                type="button"
                className={`gz-seg__btn${view === v ? ' is-active' : ''}`}
                onClick={() => {
                  setView(v);
                  setSortKey(v === 'anppr' ? 'anppr' : 'sos');
                  setSortDir('desc');
                }}
              >
                {v === 'anppr' ? 'Adjusted NPPR' : 'Schedule'}
              </button>
            ))}
          </div>

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
                <option key={wc} value={wc}>
                  {wc} ({n})
                </option>
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
                {genders.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
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
              Show all fighters (default: ≥ {minRounds} rounds)
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
          {view === 'sos'
            ? 'Click Schedule twice for the easiest schedules — just as interesting'
            : `Differences under ${meaningfulDiff.toFixed(2)} are not meaningful`}
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
              {plainTh('#', 'right', 34)}
              {th('name', 'Fighter', 'left')}
              {plainTh('Team', 'left')}
              {plainTh('Division', 'left')}
              {th('rounds', 'Rds', 'right', 'Rounds fought — the NPPR denominator')}
              {th('nppr', 'NPPR', 'right', 'Net points per round, unadjusted')}
              {view === 'anppr' ? (
                <>
                  {th('anppr', 'aNPPR', 'right', 'Opponent-adjusted rating')}
                  {th('delta', 'Δ', 'right', 'aNPPR minus NPPR — how much the schedule moved them')}
                  {plainTh('90% Range', 'right')}
                  {th('bootSd', 'SD', 'right', 'Bootstrap standard deviation of the rating')}
                </>
              ) : (
                th('sos', 'SOS', 'right', 'Average opponent NPPR, head-to-head rounds excluded')
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={r.slug} style={{ borderBottom: '1px dotted rgba(20,17,11,0.3)' }}>
                <td
                  style={{
                    textAlign: 'right',
                    padding: '9px 4px',
                    color: 'var(--tbl-ink-mute)',
                    fontSize: 11,
                  }}
                >
                  {i + 1}
                </td>
                <td style={{ padding: '9px 8px' }}>
                  <Link
                    href={`/fighters/${r.slug}`}
                    className="tbl-display"
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: 'var(--tbl-ink)',
                      textDecoration: 'none',
                    }}
                  >
                    {r.name}
                  </Link>
                </td>
                <td style={{ padding: '9px 8px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {getTeamLogoPathByName(r.team) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={getTeamLogoPathByName(r.team) as string}
                        alt=""
                        width={18}
                        height={18}
                        style={{ objectFit: 'contain' }}
                      />
                    )}
                    <span
                      style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}
                    >
                      {getCityName(r.team) || '—'}
                    </span>
                  </span>
                </td>
                <td
                  style={{
                    padding: '9px 8px',
                    fontSize: 11,
                    color: 'var(--tbl-ink-soft)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {r.weightClass || '—'}
                </td>
                <td style={{ textAlign: 'right', padding: '9px 8px' }}>{r.rounds}</td>
                <td style={{ textAlign: 'right', padding: '9px 8px', color: tone(r.nppr) }}>
                  {signed(r.nppr)}
                </td>
                {view === 'anppr' ? (
                  <>
                    <td
                      style={{
                        textAlign: 'right',
                        padding: '9px 8px',
                        fontWeight: 700,
                        color: tone(r.anppr),
                      }}
                    >
                      {signed(r.anppr)}
                    </td>
                    <td
                      style={{ textAlign: 'right', padding: '9px 8px', color: 'var(--tbl-ink-soft)' }}
                      title="aNPPR minus NPPR"
                    >
                      {signed(r.delta)}
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        padding: '9px 8px',
                        color: 'var(--tbl-ink-soft)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {signed(r.lo, 2)} – {signed(r.hi, 2)}
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        padding: '9px 8px',
                        color: r.uncertain ? 'var(--tbl-accent)' : 'var(--tbl-ink-mute)',
                      }}
                      title={
                        r.uncertain
                          ? `Bootstrap SD above ${flagBootSd.toFixed(2)} — this rating is soft`
                          : undefined
                      }
                    >
                      {r.bootSd.toFixed(2)}
                      {r.uncertain ? ' ⚠' : ''}
                    </td>
                  </>
                ) : (
                  <td
                    style={{
                      textAlign: 'right',
                      padding: '9px 8px',
                      fontWeight: 700,
                      color: tone(r.sos ?? 0),
                    }}
                  >
                    {r.sos === null ? '—' : signed(r.sos)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sorted.length === 0 && (
        <p
          style={{
            fontFamily: 'var(--tbl-font-mono)',
            fontSize: 12,
            color: 'var(--tbl-ink-soft)',
            padding: '18px 0',
          }}
        >
          No fighters match this filter. Try widening the division, or tick “show all fighters”.
        </p>
      )}

      <p
        style={{
          fontFamily: 'var(--tbl-font-mono)',
          fontSize: 10,
          lineHeight: 1.7,
          letterSpacing: '0.06em',
          color: 'var(--tbl-ink-soft)',
          margin: '16px 0 0',
          maxWidth: 720,
        }}
      >
        <strong>aNPPR</strong> ridge-solves every fighter&apos;s rating simultaneously, so it shrinks
        low-round fighters toward league average by design. <strong>Δ</strong> is the gap from raw
        NPPR — the movers are the story. <strong>90% Range</strong> is a bootstrap interval over 200
        refits; a ⚠ marks a rating whose spread exceeds {flagBootSd.toFixed(2)}. Two fighters whose
        ranges overlap are not distinguishable.{' '}
        <Link href="/stats/ratings" style={{ color: 'var(--tbl-accent)' }}>
          Full methodology →
        </Link>
      </p>
    </div>
  );
}
