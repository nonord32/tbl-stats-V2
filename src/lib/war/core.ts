// src/lib/war/core.ts
//
// WAR (Wins Above Replacement) — pure computation core.
//
//   WAR = (NP/R − Replacement NP/R) × Rounds ÷ Points Per Win
//
//   • NP/R            = (Σ bout net points) / rounds fought
//   • Replacement NP/R = 25th percentile of every in-scope fighter's NP/R
//                        (Google-Sheets PERCENTILE: inclusive, interpolated)
//   • Points Per Win  = 1 / WIN_VALUE_PER_POINT, below
//
// The denominator used to be the average winning margin. That is not the price
// of a win: flipping a 3-point loss into a win takes about 6 points, not 3, and
// most points land in matches whose result they cannot change. It understated
// the cost of a win roughly 3x and inflated every WAR to match — which is why
// WAR and WPA, both denominated in wins, disagreed by 3x for the same fighter.
// The mean margin is still computed and reported; it is a real descriptive
// statistic, just not this one.
//
// IMPORTANT for testability: this file has NO runtime imports (types only, and
// they are erased at compile time), so it can be loaded directly by
// `node --experimental-strip-types` in scripts/war.test.mjs.

import type { FightHistory, GamePhase, MatchResult } from '@/types';

export type StatScope = GamePhase | 'all';

// The win value of one point of round margin, at average leverage. This is the
// WPA model's cnWpaByMargin["1"] (src/lib/wpa/wpa-model-2026.json), reused here
// on purpose so WAR and WPA can never end up denominated in different "wins" —
// scripts/war.test.mjs reads that file and fails if the two ever drift apart.
//
// Per-point value declines slightly at wider margins (0.0620 at a margin of 1,
// 0.0554 at 4). Margin 1 is the right one: net points accrue a point at a time.
export const WIN_VALUE_PER_POINT = 0.06196;
export const POINTS_PER_WIN = 1 / WIN_VALUE_PER_POINT; // ≈ 16.14 for 2026

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

export function inScope(phase: GamePhase, scope: StatScope): boolean {
  return scope === 'all' || phase === scope;
}

// Net points per round (NP/R) for one fighter's in-scope bouts.
export function npprOf(bouts: FightHistory[]): number {
  const rounds = bouts.length;
  if (rounds === 0) return 0;
  const netPts = bouts.reduce((s, b) => s + b.netPts, 0);
  return netPts / rounds;
}

export interface LeagueBaseline {
  replacementNppr: number;
  /** what WAR divides by: net points that buy one win */
  pointsPerWin: number;
  /** mean |PF − PA| over decided matches — descriptive only, NOT the divisor */
  avgMargin: number;
}

// The league-wide constants WAR is measured against, for a given scope.
export function leagueBaseline(
  fighterHistory: Record<string, FightHistory[]>,
  matches: MatchResult[],
  scope: StatScope,
): LeagueBaseline {
  // Replacement level: 25th percentile of every in-scope fighter's NP/R.
  const npprs: number[] = [];
  for (const bouts of Object.values(fighterHistory)) {
    const scoped = bouts.filter((b) => inScope(b.phase, scope));
    if (scoped.length > 0) npprs.push(npprOf(scoped));
  }
  const replacementNppr = percentileInclusive(npprs, 0.25);

  // Average winning margin over decided in-scope matches. Reported on /stats
  // and in the admin export beside points-per-win, because the difference
  // between the two is the whole point.
  const margins: number[] = [];
  for (const m of matches) {
    if (!inScope(m.phase, scope)) continue;
    if (m.result === 'D') continue; // draws aren't a "win"
    margins.push(Math.abs(m.score1 - m.score2));
  }
  const avgMargin =
    margins.length > 0 ? margins.reduce((s, x) => s + x, 0) / margins.length : 0;

  return { replacementNppr, pointsPerWin: POINTS_PER_WIN, avgMargin };
}

export function computeWar(nppr: number, rounds: number, baseline: LeagueBaseline): number {
  if (baseline.pointsPerWin <= 0) return 0;
  return ((nppr - baseline.replacementNppr) * rounds) / baseline.pointsPerWin;
}
