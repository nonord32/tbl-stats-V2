// src/lib/phaseStats.ts
// Per-phase (regular season vs playoffs) stat aggregation.
//
// Aggregate fighter/team stats are pre-computed season-wide in the source
// sheet. To split them by phase we recompute the derivable stats from the
// per-bout fight history and per-match team data — both of which now carry a
// `phase` tag (see parseMatchData in data.ts).
//
// WAR is the one metric we can't reconstruct here: its formula lives only in
// the sheet and needs a league-wide replacement baseline. Phase-filtered
// fighters therefore carry war = 0, and the rankings UI drops the WAR
// category when viewing a single phase.

import type {
  FighterStat,
  FightHistory,
  TeamStanding,
  TeamMatch,
  GamePhase,
} from '@/types';
import { calcFighterStreak, calcTeamStreak } from './data';

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

// Recompute a single fighter's counting/rate stats from phase-filtered bouts.
// Identity fields (name, team, slug, etc.) are preserved from the sheet stat.
function rebuildFighter(base: FighterStat, bouts: FightHistory[]): FighterStat {
  const wins = bouts.filter((b) => b.result === 'W').length;
  const losses = bouts.filter((b) => b.result === 'L').length;
  const rounds = bouts.length;
  const netPts = bouts.reduce((s, b) => s + b.netPts, 0);
  const decisions = wins + losses;
  return {
    ...base,
    wins,
    losses,
    record: `${wins}-${losses}`,
    war: 0, // not reconstructable per-phase — sheet-only formula
    nppr: rounds > 0 ? netPts / rounds : 0,
    netPts,
    winPct: decisions > 0 ? wins / decisions : 0,
    rounds,
  };
}

// Fighters with their stats scoped to the given phase. `'all'` passes the
// sheet stats through untouched (keeps the real, sheet-computed WAR).
// For a single phase, only fighters with at least one bout in that phase are
// returned, each recomputed from their filtered history.
export function aggregateFightersByPhase(
  fighters: FighterStat[],
  fighterHistory: Record<string, FightHistory[]>,
  phase: Phase
): FighterStat[] {
  if (phase === 'all') return fighters;
  const out: FighterStat[] = [];
  for (const f of fighters) {
    const bouts = (fighterHistory[f.slug] ?? []).filter((b) => b.phase === phase);
    if (bouts.length === 0) continue;
    out.push(rebuildFighter(f, bouts));
  }
  return out;
}

// Team standings scoped to the given phase. `'all'` passes the sheet
// standings through. For a single phase, standings are recomputed from
// phase-filtered match data — which also yields an accurate *frozen*
// regular-season table during the playoffs, independent of whatever the
// cumulative sheet shows. Only teams with a match in the phase are returned.
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
