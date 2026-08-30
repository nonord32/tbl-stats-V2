// src/lib/phaseStats.ts
// Per-phase (regular season vs playoffs) stat aggregation.
//
// Fighter stats: each phase has its own pre-aggregated source tab ("Fighter
// Stats - Regular" / "Fighter Stats - Playoffs"), parsed in data.ts into
// `fightersByPhase`. Those already carry season WAR (merged from the joint
// tab), so per-phase views show real WAR too. If a phase tab is missing we
// fall back to recomputing counting/rate stats from the per-bout fight
// history (war = 0 in that case) — see aggregateFightersByPhase.
//
// Team stats: there are no per-phase team tabs, so team standings are still
// recomputed from the phase-tagged per-match data (see parseMatchData in
// data.ts and aggregateTeamStandingsByPhase below).

import type {
  FighterStat,
  FightHistory,
  FightersByPhase,
  TeamStanding,
  TeamMatch,
  GamePhase,
} from '@/types';
import { calcFighterStreak, calcTeamStreak } from './data';

// The site offers Regular Season and Playoffs views, plus a combined
// "Full Season" ('all') view that spans both.
export type Phase = GamePhase | 'all';

// True once at least one game anywhere is tagged as a playoff game. Drives
// whether the phase toggle renders at all, so the site is unchanged until
// the playoffs begin.
export function hasPlayoffData(
  fighterHistory: Record<string, FightHistory[]>,
  teamMatches: Record<string, TeamMatch[]>
): boolean {
  for (const hist of Object.values(fighterHistory)) {
    if (hist.some((h) => h.phase === 'playoffs')) return true;
  }
  for (const matches of Object.values(teamMatches)) {
    if (matches.some((m) => m.phase === 'playoffs')) return true;
  }
  return false;
}

// Fighters with their stats scoped to the given phase.
//
// Every fighter roster is now derived from the Data tab in `getAllData`
// (see `buildFighters` in warStats.ts): `fighters` is the season/all-scope set,
// and `fightersByPhase` holds the Regular and Playoffs sets — each already
// carries its own scope-correct WAR. So this is just a selector.
export function aggregateFightersByPhase(
  fighters: FighterStat[],
  fightersByPhase: FightersByPhase,
  fighterHistory: Record<string, FightHistory[]>,
  phase: Phase
): FighterStat[] {
  if (phase === 'all') return fighters;
  void fighterHistory; // no longer needed — rosters are pre-derived per scope
  return fightersByPhase[phase] ?? [];
}

// Team standings scoped to the given phase. `'all'` passes the sheet standings
// through. For a single phase, standings are recomputed from phase-filtered
// match data — which also yields an accurate *frozen* regular-season table
// during the playoffs, independent of whatever the cumulative sheet shows. Only
// teams with a match in the phase are returned.
export function aggregateTeamStandingsByPhase(
  teams: TeamStanding[],
  teamMatches: Record<string, TeamMatch[]>,
  phase: Phase
): TeamStanding[] {
  if (phase === 'all') return teams;
  const out: TeamStanding[] = [];
  for (const t of teams) {
    const matches = (teamMatches[t.team] ?? []).filter((m) => m.phase === phase);
    if (matches.length === 0) continue;
    const wins = matches.filter((m) => m.result === 'W').length;
    const losses = matches.filter((m) => m.result === 'L').length;
    const pf = matches.reduce((s, m) => s + m.pf, 0);
    const pa = matches.reduce((s, m) => s + m.pa, 0);
    out.push({
      ...t,
      wins,
      losses,
      record: `${wins}-${losses}`,
      pf,
      pa,
      diff: pf - pa,
      streak: calcTeamStreak(matches),
    });
  }
  return out;
}

// Convenience: phase-filtered per-team matches, preserving the
// most-recent-first order already established in parseMatchData.
export function filterTeamMatchesByPhase(
  teamMatches: Record<string, TeamMatch[]>,
  phase: Phase
): Record<string, TeamMatch[]> {
  if (phase === 'all') return teamMatches;
  const out: Record<string, TeamMatch[]> = {};
  for (const [team, matches] of Object.entries(teamMatches)) {
    out[team] = matches.filter((m) => m.phase === phase);
  }
  return out;
}

export { calcFighterStreak };
