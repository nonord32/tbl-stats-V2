'use client';
// src/app/rankings/RankingsClient.tsx

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { FighterStat, FightHistory } from '@/types';
import { toSlug } from '@/lib/data';
import { getFighterWeightClasses } from '@/lib/fighters';
import { compareWeightClass } from '@/lib/weightClasses';
import { PageHeader } from '@/components/chrome/PageHeader';
import {
  getFullTeamName,
  getTeamColorByName,
  getTeamLogoPathByName,
} from '@/lib/teams';

interface Props {
  fighters: FighterStat[];
  fighterHistory: Record<string, FightHistory[]>;
  lastUpdated: string;
}

type Gender = 'Male' | 'Female';

// Minimum rounds a fighter must have fought to qualify. Keeps low-sample
// fighters off the top of the list.
const MIN_ROUNDS = 2;

function classAnchor(wc: string) {
  return `class-${toSlug(wc)}`;
}

export function RankingsClient({ fighters, fighterHistory, lastUpdated }: Props) {
  const [gender, setGender] = useState<Gender>('Male');
  const [weightClass, setWeightClass] = useState<string>('All');

  const classToFighters = useMemo(() => {
    const map = new Map<string, FighterStat[]>();
    fighters.forEach((f) => {
      if (f.gender !== gender) return;
      if (f.rounds < MIN_ROUNDS) return;
      const history = fighterHistory[f.slug] || [];
      const classes = getFighterWeightClasses(f, history);
      classes.forEach((wc) => {
        const bucket = map.get(wc) ?? [];
        bucket.push(f);
        map.set(wc, bucket);
      });
    });
    map.forEach((list) => list.sort((a, b) => b.netPts - a.netPts));
    return map;
  }, [fighters, fighterHistory, gender]);

  const orderedClasses = useMemo(
    () => Array.from(classToFighters.keys()).sort(compareWeightClass),
    [classToFighters]
  );

  // Keep the class filter valid when switching gender.
  const visibleClasses = weightClass === 'All'
    ? orderedClasses
    : orderedClasses.filter((wc) => wc === weightClass);

  const filterSlot = (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <div className="gz-seg" role="tablist" aria-label="Gender">
        {(['Male', 'Female'] as Gender[]).map((g) => (
          <button
            key={g}
            type="button"
            role="tab"
            aria-selected={gender === g}
            className={`gz-seg__btn${gender === g ? ' is-active' : ''}`}
            onClick={() => setGender(g)}
          >
            {g === 'Male' ? 'Men' : 'Women'}
          </button>
        ))}
      </div>
      <label className="gz-filter">
        <span className="gz-filter__label">Weight</span>
        <select
          className="gz-filter__select"
          value={weightClass}
          onChange={(e) => setWeightClass(e.target.value)}
        >
          <option value="All">All</option>
          {orderedClasses.map((wc) => (
            <option key={wc} value={wc}>{wc}</option>
          ))}
        </select>
      </label>
    </div>
  );

  return (
    <>
      <PageHeader
        eyebrow="The Record"
        title="Weight Class Rankings"
        subtitle={`Ranked by net points · minimum ${MIN_ROUNDS} rounds to qualify${lastUpdated ? ` · updated ${lastUpdated}` : ''}`}
        right={filterSlot}
      />

      <div className="tbl-page-body">
        {visibleClasses.length === 0 && (
          <div className="card" style={{ padding: 24, textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--tbl-font-mono)', fontSize: 13, color: 'var(--tbl-ink-soft)' }}>
              No {gender === 'Male' ? 'men' : 'women'} have fought enough rounds to qualify yet.
            </p>
          </div>
        )}

        {visibleClasses.map((wc) => {
          const all = classToFighters.get(wc) ?? [];
          const champion = all[0];
          const contenders = all.slice(1);

          return (
            <section
              key={wc}
              id={classAnchor(wc)}
              className="gz-rank-section"
              aria-labelledby={`heading-${classAnchor(wc)}`}
            >
              <div className="tbl-section-rule">
                <span id={`heading-${classAnchor(wc)}`}>
                  {wc} · {all.length} {all.length === 1 ? 'Fighter' : 'Fighters'}
                </span>
                <span>Ranked by Net Points</span>
              </div>

              {champion && <ChampionCard rank={1} f={champion} />}
              {contenders.map((f, i) => (
                <ContenderRow key={f.slug} rank={i + 2} f={f} />
              ))}
            </section>
          );
        })}
      </div>
    </>
  );
}

function ChampionCard({ rank, f }: { rank: number; f: FighterStat }) {
  const teamColor = getTeamColorByName(f.team) || 'var(--tbl-accent)';
  const logo = getTeamLogoPathByName(f.team);
  const teamFull = getFullTeamName(toSlug(f.team)) || f.team;
  const netPtsColor = f.netPts >= 0 ? 'var(--tbl-green)' : 'var(--tbl-red)';

  return (
    <Link href={`/fighters/${f.slug}`} className="gz-rank-champ">
      <span className="gz-rank-champ__stripe" style={{ background: teamColor }} />
      <div className="gz-rank-champ__inner">
        <div className="gz-rank-champ__left">
          <div className="gz-rank-champ__rank">#{rank}</div>
          <div>
            <div className="gz-rank-champ__name">{f.name}</div>
            <div className="gz-rank-champ__team">
              {logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logo}
                  alt={teamFull}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              )}
              <span>{teamFull}</span>
            </div>
          </div>
        </div>
        <div className="gz-rank-champ__stats">
          <div className="gz-rank-champ__netpts" style={{ color: netPtsColor }}>
            {f.netPts >= 0 ? '+' : ''}
            {f.netPts.toFixed(1)}
          </div>
          <div className="gz-rank-champ__record">
            {f.record} · {(f.winPct * 100).toFixed(0)}% wins
          </div>
        </div>
      </div>
    </Link>
  );
}

function ContenderRow({ rank, f }: { rank: number; f: FighterStat }) {
  const logo = getTeamLogoPathByName(f.team);
  const teamFull = getFullTeamName(toSlug(f.team)) || f.team;
  const netPtsColor = f.netPts >= 0 ? 'var(--tbl-green)' : 'var(--tbl-red)';

  return (
    <Link href={`/fighters/${f.slug}`} className="gz-rank-row">
      <span className="gz-rank-row__rank">{rank}</span>
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo}
          alt={teamFull}
          className="gz-rank-row__logo"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      )}
      <div className="gz-rank-row__names">
        <span className="gz-rank-row__name">{f.name}</span>
        <span className="gz-rank-row__team">{teamFull}</span>
      </div>
      <span className="gz-rank-row__record">{f.record}</span>
      <span className="gz-rank-row__netpts" style={{ color: netPtsColor }}>
        {f.netPts >= 0 ? '+' : ''}
        {f.netPts.toFixed(1)}
      </span>
    </Link>
  );
}
