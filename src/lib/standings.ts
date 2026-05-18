// src/lib/standings.ts
//
// Shared ranking logic for the league standings and the playoff picture.
//
// Tiebreaker rule for teams sharing the same (wins, losses):
//   • If exactly one team in the tied group has a winning H2H record
//     against EVERY other tied team (a "sweep"), that team ranks first.
//     Recurse on the rest.
//   • Otherwise (no sweep, cycles, partial samples where tied teams
//     haven't played each other), fall back to point differential,
//     then points-for, then team name (stable, deterministic).
//   • An asterisk is shown next to a team only when the sweep actually
//     changed the order vs point differential alone.
//
// The 2-team case is a special case of the same rule: a team "sweeps" by
// having a winning H2H record against the one other tied team.

import type { TeamStanding, TeamMatch } from '@/types';
import { toSlug } from '@/lib/data';

// Number of teams that make the postseason field. Shared by the
// standings page, playoff picture page, and clinch math.
export const PLAYOFF_SPOTS = 8;

export function getH2HResult(
  a: TeamStanding,
  b: TeamStanding,
  teamMatches: Record<string, TeamMatch[]>
): number {
  const aMatches = (teamMatches[a.team] || []).filter((m) => toSlug(m.opponent) === b.slug);
  const aWins = aMatches.filter((m) => m.result === 'W').length;
  const aLosses = aMatches.filter((m) => m.result === 'L').length;
  if (aWins > aLosses) return -1;
  if (aLosses > aWins) return 1;
  return 0;
}

// Returns the team in `group` that has a winning H2H record against
// every other team in the group (a sweep), or null if no such team exists.
// At most one team can satisfy this — if A swept B and B swept A, that's a
// contradiction.
function findSweeper(
  group: TeamStanding[],
  teamMatches: Record<string, TeamMatch[]>
): TeamStanding | null {
  for (const candidate of group) {
    const sweepsAll = group.every(
      (other) => other.slug === candidate.slug || getH2HResult(candidate, other, teamMatches) === -1
    );
    if (sweepsAll) return candidate;
  }
  return null;
}

function pointDiffSort(group: TeamStanding[]): TeamStanding[] {
  return [...group].sort(
    (a, b) => b.diff - a.diff || b.pf - a.pf || a.team.localeCompare(b.team)
  );
}

function rankTiedGroup(
  group: TeamStanding[],
  teamMatches: Record<string, TeamMatch[]>
): TeamStanding[] {
  if (group.length <= 1) return group;
  const sweeper = findSweeper(group, teamMatches);
  if (!sweeper) return pointDiffSort(group);
  const rest = group.filter((t) => t.slug !== sweeper.slug);
  return [sweeper, ...rankTiedGroup(rest, teamMatches)];
}

export function sortStandings(
  teams: TeamStanding[],
  teamMatches: Record<string, TeamMatch[]>
): TeamStanding[] {
  // Group by (wins, losses), then resolve each group, then concatenate
  // in record order. Using a Map keeps insertion order; we sort keys
  // by wins desc, losses asc before iterating.
  const groups = new Map<string, TeamStanding[]>();
  for (const t of teams) {
    const key = `${t.wins}-${t.losses}`;
    const arr = groups.get(key) ?? [];
    arr.push(t);
    groups.set(key, arr);
  }
  const orderedKeys = [...groups.keys()].sort((a, b) => {
    const [aw, al] = a.split('-').map(Number);
    const [bw, bl] = b.split('-').map(Number);
    return bw - aw || al - bl;
  });
  const result: TeamStanding[] = [];
  for (const key of orderedKeys) {
    const group = groups.get(key)!;
    result.push(...rankTiedGroup(group, teamMatches));
  }
  return result;
}

export interface H2HWinnerInfo {
  beaten: string[];
}

// Map of sweeperSlug → list of team names the sweeper beat via H2H.
// Only populated when the sweep actually changed the order — i.e. the
// sweeper has a lower point differential than at least one of the teams
// they swept. If their diff was already higher, they'd rank first
// anyway and the asterisk would be redundant.
export function getH2HTiebreakerWinners(
  teams: TeamStanding[],
  teamMatches: Record<string, TeamMatch[]>
): Map<string, string[]> {
  const map = new Map<string, string[]>();

  // Group by (wins, losses).
  const groups = new Map<string, TeamStanding[]>();
  for (const t of teams) {
    const key = `${t.wins}-${t.losses}`;
    const arr = groups.get(key) ?? [];
    arr.push(t);
    groups.set(key, arr);
  }

  // For each tied group of size >= 2, find the sweeper (if any) and
  // record the names of teams they swept whose point diff is higher
  // than the sweeper's (i.e., where H2H is what's putting the sweeper
  // ahead).
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const sweeper = findSweeper(group, teamMatches);
    if (!sweeper) continue;
    const flippedOver: string[] = [];
    for (const other of group) {
      if (other.slug === sweeper.slug) continue;
      if (other.diff > sweeper.diff) flippedOver.push(other.team);
    }
    if (flippedOver.length > 0) map.set(sweeper.slug, flippedOver);
  }

  return map;
}
