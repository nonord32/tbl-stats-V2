// src/lib/warStats.ts
//
// Builds the fighter roster and every fighter stat — including WAR — purely from
// the per-bout Data tab (fight history + match results). No stat is read from
// the "Fighter Stats" sheet tabs.
//
// The WAR arithmetic and its two league constants live in ./war/core.ts, which
// has no runtime imports so scripts/war.test.mjs can load it. They are
// re-exported here so existing call sites keep working unchanged.

import type {
  FighterStat,
  FighterIdentity,
  FightHistory,
  MatchResult,
  GamePhase,
} from '@/types';
import { getPrimaryWeightClass } from './fighters';
import { computeWar, inScope, leagueBaseline, type StatScope } from './war/core';

export {
  POINTS_PER_WIN,
  WIN_VALUE_PER_POINT,
  percentileInclusive,
  leagueBaseline,
  computeWar,
  type LeagueBaseline,
  type StatScope,
} from './war/core';


// ── Outcome method → finishing bucket + "extra points" over the decision baseline ──
// The TBL round-scoring scale awards 1 point for a decision win and more for a
// finish; "extra points" is that award minus the 1-point decision baseline:
//   Decision 0 · Knockdown 1 · Double Knockdown 2 · KO/TKO 3.
//
// Google-Sheet method labels: "KO / TKO", "KD" (knockdown), "2x KD" (double
// knockdown), "Decision", "DQ". The matching is tolerant of spacing/case and of
// the long forms ("Knockdown", "Double Knockdown") in case the sheet varies.
export type MethodBucket = 'decision' | 'knockdown' | 'double-knockdown' | 'ko-tko';

export function classifyMethod(method: string | undefined): MethodBucket {
  const m = (method ?? '').toLowerCase();
  // Double knockdown FIRST — "2x kd" / "double kd" also contain a "kd".
  if (m.includes('double') || /\b2\s*x\b/.test(m) || /2\s*x\s*kd/.test(m)) {
    return 'double-knockdown';
  }
  // KO / TKO / Knockout, plus referee-stoppage (RSC) and retirement (RTD),
  // which are TKO-type finishes. "kd"/"knockdown" contain no "ko" substring.
  if (/\btko\b/.test(m) || /\bko\b/.test(m) || m.includes('knockout') ||
      m.includes('rsc') || m.includes('rtd')) {
    return 'ko-tko';
  }
  // Single knockdown: sheet "KD", or the long form "Knockdown".
  if (/\bkd\b/.test(m) || m.includes('knockdown')) return 'knockdown';
  return 'decision';
}

const EXTRA_BY_BUCKET: Record<MethodBucket, number> = {
  decision: 0,
  knockdown: 1,
  'double-knockdown': 2,
  'ko-tko': 3,
};

export interface FinishingStats {
  pointsFor: number;
  pointsAgainst: number;
  extraPoints: number;
  extraPointsAllowed: number;
  knockdowns: number;
  doubleKnockdowns: number;
  koTko: number;
  koPct: number;
}

// Scoring + finishing aggregates for a set of bouts (already scope-filtered).
// Counts are over bouts WON; extraPointsAllowed is over bouts LOST. koPct guards
// against a divide-by-zero for winless fighters by returning 0.
export function computeFinishing(bouts: FightHistory[]): FinishingStats {
  let pointsFor = 0;
  let pointsAgainst = 0;
  let extraPoints = 0;
  let extraPointsAllowed = 0;
  let knockdowns = 0;
  let doubleKnockdowns = 0;
  let koTko = 0;
  let wins = 0;

  for (const b of bouts) {
    pointsFor += b.pointsFor;
    pointsAgainst += b.pointsAgainst;
    const extra = EXTRA_BY_BUCKET[classifyMethod(b.resultMethod)];
    if (b.result === 'W') {
      wins++;
      extraPoints += extra;
      switch (classifyMethod(b.resultMethod)) {
        case 'ko-tko': koTko++; break;
        case 'knockdown': knockdowns++; break;
        case 'double-knockdown': doubleKnockdowns++; break;
        default: break;
      }
    } else if (b.result === 'L') {
      extraPointsAllowed += extra;
    }
  }

  return {
    pointsFor,
    pointsAgainst,
    extraPoints,
    extraPointsAllowed,
    knockdowns,
    doubleKnockdowns,
    koTko,
    koPct: wins > 0 ? koTko / wins : 0,
  };
}

// Build the FighterStat roster for a scope, entirely from the Data tab. Only
// fighters with at least one in-scope bout are returned. Identity (name, team,
// gender) comes from `fighterIdentity`; the primary weight class is derived from
// the fighter's full history so it stays stable across scopes.
export function buildFighters(
  fighterIdentity: Record<string, FighterIdentity>,
  fighterHistory: Record<string, FightHistory[]>,
  matches: MatchResult[],
  scope: StatScope,
): FighterStat[] {
  // WAR is measured against ONE league-wide baseline — the whole-season 25th-
  // percentile PPR, and a points-per-win that is a frozen model constant — for
  // every scope. We do NOT recompute the baseline per phase: only the fighter's
  // own NPPR and rounds change between regular season and playoffs, never the
  // yardstick.
  const baseline = leagueBaseline(fighterHistory, matches, 'all');
  const out: FighterStat[] = [];

  for (const [slug, identity] of Object.entries(fighterIdentity)) {
    const fullBouts = fighterHistory[slug] ?? [];
    const bouts = fullBouts.filter((b) => inScope(b.phase, scope));
    if (bouts.length === 0) continue;

    const wins = bouts.filter((b) => b.result === 'W').length;
    const losses = bouts.filter((b) => b.result === 'L').length;
    const rounds = bouts.length;
    const netPts = bouts.reduce((s, b) => s + b.netPts, 0);
    const decisions = wins + losses;
    const nppr = rounds > 0 ? netPts / rounds : 0;
    const finishing = computeFinishing(bouts);

    // Team is scope-specific: the playoff view shows the fighter's playoff team,
    // the regular view their regular-season team. Falls back to the overall team.
    const team =
      scope === 'regular'
        ? identity.regularTeam ?? identity.team
        : scope === 'playoffs'
        ? identity.playoffTeam ?? identity.team
        : identity.team;

    const fighter: FighterStat = {
      name: identity.name,
      team,
      weightClass: '', // set below from full history
      gender: identity.gender,
      wins,
      losses,
      record: `${wins}-${losses}`,
      war: computeWar(nppr, rounds, baseline),
      nppr,
      netPts,
      winPct: decisions > 0 ? wins / decisions : 0,
      rounds,
      slug,
      pointsFor: finishing.pointsFor,
      pointsAgainst: finishing.pointsAgainst,
      extraPoints: finishing.extraPoints,
      extraPointsAllowed: finishing.extraPointsAllowed,
      knockdowns: finishing.knockdowns,
      doubleKnockdowns: finishing.doubleKnockdowns,
      koTko: finishing.koTko,
      koPct: finishing.koPct,
    };
    // Stable across scopes: rank the fighter under the class they've fought most
    // across their whole career, not just this phase.
    fighter.weightClass = getPrimaryWeightClass(fighter, fullBouts);
    out.push(fighter);
  }

  return out;
}
