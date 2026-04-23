'use client';
// src/app/rankings/RankingsClient.tsx

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { FighterStat, FightHistory } from '@/types';
import { toSlug } from '@/lib/data';
import { getFighterWeightClasses } from '@/lib/fighters';
import { compareWeightClass } from '@/lib/weightClasses';
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

// Minimum rounds a fighter must have fought to qualify for a ranking. Keeps
// low-sample fighters off the top of the list (1-0 with one round shouldn't
// beat a 3-1 fighter on net points).
const MIN_ROUNDS = 2;
const TOP_N = 5;

function classAnchor(wc: string) {
  return `class-${toSlug(wc)}`;
}

export function RankingsClient({ fighters, fighterHistory, lastUpdated }: Props) {
  const [gender, setGender] = useState<Gender>('Male');

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

  return (
    <main>
      <div className="page container" style={{ maxWidth: 960 }}>
        <div className="page-header">
          <h1>Weight Class Rankings</h1>
          <p className="subtitle">
            Top {TOP_N} at every weight class · ranked by net points · minimum{' '}
            {MIN_ROUNDS} rounds to qualify
            {lastUpdated ? ` · updated ${lastUpdated}` : ''}
          </p>
        </div>

        {/* Sticky controls: gender toggle + jump chips */}
        <div className="rank-controls">
          <div className="rank-gender-toggle" role="tablist" aria-label="Gender">
            {(['Male', 'Female'] as Gender[]).map((g) => (
              <button
                key={g}
                role="tab"
                aria-selected={gender === g}
                className={`rank-gender-btn${gender === g ? ' rank-gender-btn--active' : ''}`}
                onClick={() => setGender(g)}
              >
                {g === 'Male' ? 'Men' : 'Women'}
              </button>
            ))}
          </div>
          <nav className="rank-jump" aria-label="Jump to weight class">
            {orderedClasses.map((wc) => (
              <a key={wc} href={`#${classAnchor(wc)}`} className="rank-jump-chip">
                {wc}
              </a>
            ))}
          </nav>
        </div>

        {orderedClasses.length === 0 && (
          <div className="card" style={{ padding: 32, textAlign: 'center', marginTop: 16 }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-muted)' }}>
              No {gender === 'Male' ? 'men' : 'women'} have fought enough rounds to qualify yet.
            </p>
          </div>
        )}

        {orderedClasses.map((wc) => {
          const all = classToFighters.get(wc) ?? [];
          const top = all.slice(0, TOP_N);
          const champion = top[0];
          const contenders = top.slice(1);
          const emptySlots = Math.max(0, TOP_N - top.length);

          return (
            <section
              key={wc}
              id={classAnchor(wc)}
              className="rank-section"
              aria-labelledby={`heading-${classAnchor(wc)}`}
            >
              <h2 id={`heading-${classAnchor(wc)}`} className="rank-section-title">
                {wc} — Top {TOP_N}
              </h2>
              <p className="rank-section-lede">
                Ranked by net points across the 2026 TBL season.
              </p>

              {champion && <ChampionCard rank={1} f={champion} />}
              {contenders.map((f, i) => (
                <ContenderRow key={f.slug} rank={i + 2} f={f} />
              ))}
              {Array.from({ length: emptySlots }).map((_, i) => (
                <div key={`empty-${i}`} className="rank-card rank-card--muted">
                  <span className="rank-card-rank">{top.length + i + 1}</span>
                  <span className="rank-card-name">Awaiting qualified fighter</span>
                </div>
              ))}
            </section>
          );
        })}
      </div>
    </main>
  );
}

function ChampionCard({ rank, f }: { rank: number; f: FighterStat }) {
  const teamColor = getTeamColorByName(f.team) || 'var(--accent)';
  const logo = getTeamLogoPathByName(f.team);
  const teamFull = getFullTeamName(toSlug(f.team)) || f.team;
  const netPtsColor =
    f.netPts >= 0 ? 'var(--result-w)' : 'var(--result-l)';

  return (
    <Link href={`/fighters/${f.slug}`} className="rank-card-champion">
      <span className="rank-card-champion-stripe" style={{ background: teamColor }} />
      <div className="rank-card-champion-inner">
        <div className="rank-card-champion-left">
          <div className="rank-card-champion-rank">#{rank}</div>
          <div>
            <div className="rank-card-champion-name">{f.name}</div>
            <div className="rank-card-champion-team">
              {logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logo}
                  alt={teamFull}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
              <span>{teamFull}</span>
            </div>
          </div>
        </div>
        <div className="rank-card-champion-stats">
          <div className="rank-card-champion-netpts" style={{ color: netPtsColor }}>
            {f.netPts >= 0 ? '+' : ''}
            {f.netPts.toFixed(1)}
          </div>
          <div className="rank-card-champion-record">
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
  const netPtsColor =
    f.netPts >= 0 ? 'var(--result-w)' : 'var(--result-l)';

  return (
    <Link href={`/fighters/${f.slug}`} className="rank-card">
      <span className="rank-card-rank">{rank}</span>
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo}
          alt={teamFull}
          className="rank-card-logo"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      )}
      <div className="rank-card-name-group">
        <span className="rank-card-name">{f.name}</span>
        <span className="rank-card-team">{teamFull}</span>
      </div>
      <span className="rank-card-record">{f.record}</span>
      <span className="rank-card-netpts" style={{ color: netPtsColor }}>
        {f.netPts >= 0 ? '+' : ''}
        {f.netPts.toFixed(1)}
      </span>
    </Link>
  );
}
