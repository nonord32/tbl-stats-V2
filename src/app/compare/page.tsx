// src/app/compare/page.tsx
// Side-by-side fighter comparison. Picks two fighters from the roster,
// shows headline stats with the leader highlighted, head-to-head record
// (if they've fought), and a list of common opponents with how each did.

import type { Metadata } from 'next';
import Link from 'next/link';
import type { FighterStat, FightHistory } from '@/types';
import { getAllData, toSlug, calcFighterStreak } from '@/lib/data';
import { getFullTeamName, getTeamLogoPathByName, getCityName } from '@/lib/teams';
import { getFighterWeightClassesOrdered } from '@/lib/fighters';
import { CompareClient } from './CompareClient';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Compare Fighters — TBL Stats',
  description:
    'Side-by-side fighter comparison: WAR, NPPR, net points, head-to-head record, and common opponents.',
};

interface SearchParams {
  a?: string;
  b?: string;
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { fighters, fighterHistory } = await getAllData();
  const fighterBySlug = new Map(fighters.map((f) => [f.slug, f] as const));

  const a = searchParams.a ? fighterBySlug.get(searchParams.a) ?? null : null;
  const b = searchParams.b ? fighterBySlug.get(searchParams.b) ?? null : null;

  return (
    <>
      {/* Breadcrumb */}
      <div
        style={{
          padding: '14px 32px 0',
          fontFamily: 'var(--tbl-font-mono)',
          fontSize: 11,
          letterSpacing: '0.12em',
          color: 'var(--tbl-ink-soft)',
          textTransform: 'uppercase',
        }}
      >
        <Link href="/" style={{ color: 'var(--tbl-ink-soft)', textDecoration: 'none' }}>
          Home
        </Link>
        {' / '}
        <Link href="/fighters" style={{ color: 'var(--tbl-ink-soft)', textDecoration: 'none' }}>
          Fighters
        </Link>
        {' / '}
        <span style={{ color: 'var(--tbl-ink)' }}>Compare</span>
      </div>

      <div style={{ padding: '22px 32px 26px', borderBottom: '3px double var(--tbl-ink)' }}>
        <div className="tbl-eyebrow">Head-to-Head</div>
        <h1 className="tbl-display" style={{ fontSize: 'clamp(40px, 7vw, 72px)', lineHeight: 1, margin: '4px 0 8px' }}>
          Compare Fighters
        </h1>
        <div style={{ fontFamily: 'var(--tbl-font-mono)', fontSize: 11, color: 'var(--tbl-ink-soft)', letterSpacing: '0.16em', textTransform: 'uppercase' }}>
          {a && b
            ? `${a.name} vs ${b.name}`
            : a
              ? `${a.name} vs …`
              : 'Pick two fighters to see how they stack up'}
        </div>
      </div>

      <div style={{ padding: '22px 32px 36px' }}>
        <CompareClient fighters={fighters} initialA={a?.slug ?? ''} initialB={b?.slug ?? ''} />

        {a && b && (
          <ComparedView
            a={a}
            b={b}
            historyA={fighterHistory[a.slug] ?? []}
            historyB={fighterHistory[b.slug] ?? []}
          />
        )}
      </div>
    </>
  );
}

function ComparedView({
  a,
  b,
  historyA,
  historyB,
}: {
  a: FighterStat;
  b: FighterStat;
  historyA: FightHistory[];
  historyB: FightHistory[];
}) {
  // Head-to-head: filter A's history for bouts vs B (match by toSlug on opponent).
  const directBouts = historyA.filter((h) => toSlug(h.opponent) === b.slug);
  const aWins = directBouts.filter((h) => h.result === 'W').length;
  const bWins = directBouts.filter((h) => h.result === 'L').length;
  const draws = directBouts.filter((h) => h.result === 'D').length;

  let h2hLine: string;
  if (directBouts.length === 0) {
    h2hLine = 'First meeting — no shared bouts on record';
  } else if (aWins > bWins) {
    h2hLine = `${a.name} leads ${aWins}–${bWins}${draws ? `–${draws}` : ''}`;
  } else if (bWins > aWins) {
    h2hLine = `${b.name} leads ${bWins}–${aWins}${draws ? `–${draws}` : ''}`;
  } else {
    h2hLine = `Series tied ${aWins}–${bWins}${draws ? `–${draws}` : ''}`;
  }

  // Common opponents: opponents both A and B have faced (excluding each other).
  const aOpponents = new Map<string, FightHistory[]>();
  for (const h of historyA) {
    const slug = toSlug(h.opponent);
    if (slug === b.slug) continue;
    const arr = aOpponents.get(slug) ?? [];
    arr.push(h);
    aOpponents.set(slug, arr);
  }
  const commonRows: Array<{
    slug: string;
    name: string;
    aRecord: string;
    bRecord: string;
    lastDate: string;
  }> = [];
  for (const h of historyB) {
    const slug = toSlug(h.opponent);
    if (slug === a.slug) continue;
    if (!aOpponents.has(slug)) continue;
    if (commonRows.find((r) => r.slug === slug)) continue;
    const aBouts = aOpponents.get(slug) ?? [];
    const bBouts = historyB.filter((x) => toSlug(x.opponent) === slug);
    commonRows.push({
      slug,
      name: h.opponent,
      aRecord: recordString(aBouts),
      bRecord: recordString(bBouts),
      lastDate: latestDate([...aBouts, ...bBouts]),
    });
  }
  commonRows.sort((x, y) => (x.lastDate < y.lastDate ? 1 : -1));
  const topCommon = commonRows.slice(0, 5);

  return (
    <div style={{ marginTop: 28 }}>
      <div className="cmp-grid">
        <FighterCard fighter={a} history={historyA} side="left" />
        <div className="cmp-vs-rule" aria-hidden="true">vs</div>
        <FighterCard fighter={b} history={historyB} side="right" />
      </div>

      <StatGrid a={a} b={b} />

      <section style={{ marginTop: 28 }}>
        <div className="cmp-section-rule">Head-to-Head</div>
        <div className="cmp-h2h">{h2hLine}</div>
        {directBouts.length > 0 && (
          <ul className="cmp-h2h-list">
            {directBouts.map((h, i) => (
              <li key={i}>
                <span className={`cmp-h2h-list__result is-${h.result.toLowerCase()}`}>
                  {h.result === 'W' ? `${a.name} W` : h.result === 'L' ? `${b.name} W` : 'Draw'}
                </span>
                <span className="cmp-h2h-list__meta">
                  {h.date}
                  {h.roundPhase ? ` · ${h.roundPhase}` : ''}
                  {h.resultMethod ? ` · ${h.resultMethod}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ marginTop: 28 }}>
        <div className="cmp-section-rule">Common Opponents</div>
        {topCommon.length === 0 ? (
          <div className="cmp-empty">No shared opponents on record yet.</div>
        ) : (
          <div className="cmp-table">
            <div className="cmp-table__head">
              <span>Opponent</span>
              <span style={{ textAlign: 'right' }}>{a.name}</span>
              <span style={{ textAlign: 'right' }}>{b.name}</span>
            </div>
            {topCommon.map((row) => (
              <Link key={row.slug} href={`/fighters/${row.slug}`} className="cmp-table__row">
                <span className="cmp-table__name">{row.name}</span>
                <span className="cmp-table__record">{row.aRecord}</span>
                <span className="cmp-table__record">{row.bRecord}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function FighterCard({
  fighter,
  history,
  side,
}: {
  fighter: FighterStat;
  history: FightHistory[];
  side: 'left' | 'right';
}) {
  const teamSlug = toSlug(fighter.team);
  const teamLogo = getTeamLogoPathByName(fighter.team);
  const teamName = getFullTeamName(teamSlug) || fighter.team;
  const cityLabel = getCityName(fighter.team).toUpperCase();
  const streak = calcFighterStreak(history);
  const classes = getFighterWeightClassesOrdered(fighter, history);
  const classLabel = classes.join(', ') || fighter.weightClass;

  return (
    <div className={`cmp-card cmp-card--${side}`}>
      <div className="cmp-card__eyebrow">{cityLabel} · {classLabel}</div>
      <Link href={`/fighters/${fighter.slug}`} className="cmp-card__name">
        {fighter.name}
      </Link>
      <div className="cmp-card__team">
        {teamLogo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={teamLogo} alt="" className="cmp-card__logo" />
        )}
        <Link href={`/teams/${teamSlug}`} className="cmp-card__team-name">
          {teamName}
        </Link>
      </div>
      <div className="cmp-card__meta">
        <span>{fighter.record}</span>
        {streak && (
          <span className={streak.startsWith('W') ? 'cmp-card__streak is-win' : 'cmp-card__streak is-loss'}>
            {streak}
          </span>
        )}
      </div>
    </div>
  );
}

function StatGrid({ a, b }: { a: FighterStat; b: FighterStat }) {
  const recordCmp = a.wins !== b.wins ? a.wins - b.wins : b.losses - a.losses;
  const rows: Array<{
    label: string;
    aText: string;
    bText: string;
    leader: -1 | 0 | 1; // -1 = a leads, 1 = b leads, 0 = no highlight
  }> = [
    { label: 'Record', aText: a.record, bText: b.record, leader: recordCmp > 0 ? -1 : recordCmp < 0 ? 1 : 0 },
    { label: 'WAR', aText: a.war.toFixed(2), bText: b.war.toFixed(2), leader: cmp(a.war, b.war) },
    { label: 'NPPR', aText: a.nppr.toFixed(2), bText: b.nppr.toFixed(2), leader: cmp(a.nppr, b.nppr) },
    {
      label: 'Net Pts',
      aText: `${a.netPts >= 0 ? '+' : ''}${a.netPts.toFixed(0)}`,
      bText: `${b.netPts >= 0 ? '+' : ''}${b.netPts.toFixed(0)}`,
      leader: cmp(a.netPts, b.netPts),
    },
    { label: 'Rounds', aText: String(a.rounds), bText: String(b.rounds), leader: 0 },
  ];

  return (
    <div className="cmp-stats">
      {rows.map((row) => (
        <div key={row.label} className="cmp-stats__row">
          <span className={`cmp-stats__val${row.leader === -1 ? ' is-leader' : ''}`}>
            {row.aText}
          </span>
          <span className="cmp-stats__label">{row.label}</span>
          <span className={`cmp-stats__val${row.leader === 1 ? ' is-leader' : ''}`}>
            {row.bText}
          </span>
        </div>
      ))}
    </div>
  );
}

function cmp(x: number, y: number): -1 | 0 | 1 {
  if (x > y) return -1;
  if (y > x) return 1;
  return 0;
}

function recordString(bouts: FightHistory[]): string {
  const w = bouts.filter((h) => h.result === 'W').length;
  const l = bouts.filter((h) => h.result === 'L').length;
  const d = bouts.filter((h) => h.result === 'D').length;
  return d > 0 ? `${w}-${l}-${d}` : `${w}-${l}`;
}

function latestDate(bouts: FightHistory[]): string {
  if (bouts.length === 0) return '';
  return bouts.reduce((latest, h) => (h.date > latest ? h.date : latest), '');
}
