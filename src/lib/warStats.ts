// src/lib/warStats.ts
//
// Builds the fighter roster and every fighter stat — including WAR — purely from
// the per-bout Data tab (fight history + match results). No stat is read from
// the "Fighter Stats" sheet tabs.
//
// WAR (Wins Above Replacement), per the league definition:
//   Replacement level = 25th percentile PPR overall
//   Performance above replacement is scaled by rounds fought
//   Wins are derived by converting net points via league-wide match margins
//
//   WAR = (PPR − Replacement PPR) × Rounds ÷ Average Margin Per Match
//
// where, all derived in code:
//   • PPR              = NPPR = (Σ bout net points) / rounds fought
//   • Replacement PPR  = 25th percentile of every in-scope fighter's PPR
//                        (Google-Sheets PERCENTILE: inclusive, interpolated)
//   • Avg Margin/Match = mean |team PF − PA| over non-draw matches in scope
//
// Baselines are computed per scope: the season view ('all') spans all
// bouts/matches (reproducing the sheet's WAR); Regular and Playoffs each use
// their own phase's replacement PPR and average margin.

import type {
  FighterStat,
  FighterIdentity,
  FightHistory,
  MatchResult,
  GamePhase,
} from '@/types';
import { getPrimaryWeightClass } from './fighters';

export type StatScope = GamePhase | 'all';

// Google-Sheets PERCENTILE (a.k.a. Excel PERCENTILE.INC): inclusive, linearly
// interpolated. `values` need not be sorted. Returns 0 for an empty input.
export function percentileInclusive(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const rank = p * (sorted.length - 1);
  const lo = Math.floor(rank);
  const frac = rank - lo;
  if (lo + 1 >= sorted.length) return sorted[sorted.length - 1];
  return sorted[lo] + frac * (sorted[lo + 1] - sorted[lo]);
}

function inScope(phase: GamePhase, scope: StatScope): boolean {
  return scope === 'all' || phase === scope;
}

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

// Net points per round (NPPR / PPR) for one fighter's in-scope bouts.
function npprOf(bouts: FightHistory[]): number {
  const rounds = bouts.length;
  if (rounds === 0) return 0;
  const netPts = bouts.reduce((s, b) => s + b.netPts, 0);
  return netPts / rounds;
}

export interface LeagueBaseline {
  replacementNppr: number;
  avgMargin: number;
}

// The two league-wide constants WAR is measured against, for a given scope.
export function leagueBaseline(
  fighterHistory: Record<string, FightHistory[]>,
  matches: MatchResult[],
  scope: StatScope,
): LeagueBaseline {
  // Replacement level: 25th percentile of every in-scope fighter's PPR.
  const npprs: number[] = [];
  for (const bouts of Object.values(fighterHistory)) {
    const scoped = bouts.filter((b) => inScope(b.phase, scope));
    if (scoped.length > 0) npprs.push(npprOf(scoped));
  }
  const replacementNppr = percentileInclusive(npprs, 0.25);

  // Points per win: average winning margin across decided in-scope matches.
  const margins: number[] = [];
  for (const m of matches) {
    if (!inScope(m.phase, scope)) continue;
    if (m.result === 'D') continue; // draws aren't a "win"
    margins.push(Math.abs(m.score1 - m.score2));
  }
  const avgMargin =
    margins.length > 0 ? margins.reduce((s, x) => s + x, 0) / margins.length : 0;

  return { replacementNppr, avgMargin };
}

export function computeWar(
  nppr: number,
  rounds: number,
  baseline: LeagueBaseline,
): number {
  if (baseline.avgMargin <= 0) return 0;
  return ((nppr - baseline.replacementNppr) * rounds) / baseline.avgMargin;
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
  // percentile PPR and the whole-season average match margin — for every scope.
  // We do NOT recompute the baseline per phase: only the fighter's own NPPR and
  // rounds change between regular season and playoffs, never the yardstick.
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
