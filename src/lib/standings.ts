// src/lib/standings.ts
//
// Shared ranking logic for the league standings and the playoff picture.
//
// Tiebreaker rules when teams share the same (wins, losses):
//   • Exactly 2 teams tied → head-to-head record decides; if H2H is split,
//     fall back to point differential. The H2H winner is flagged with an
//     asterisk in the UI.
//   • 3 or more teams tied → point differential decides (no asterisk).
//   • Final fallbacks: points-for, then team name (stable, deterministic).

import type { TeamStanding, TeamMatch } from '@/types';
import { toSlug } from '@/lib/data';

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

function buildTieGroupSizes(teams: TeamStanding[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const t of teams) {
    const key = `${t.wins}-${t.losses}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const map = new Map<string, number>();
  for (const t of teams) {
    map.set(t.slug, counts.get(`${t.wins}-${t.losses}`) ?? 1);
  }
  return map;
}

export function sortStandings(
  teams: TeamStanding[],
  teamMatches: Record<string, TeamMatch[]>
): TeamStanding[] {
  const tieGroupSize = buildTieGroupSizes(teams);
  return [...teams].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (a.losses !== b.losses) return a.losses - b.losses;
    const size = tieGroupSize.get(a.slug) ?? 1;
    if (size === 2) {
      const h = getH2HResult(a, b, teamMatches);
      if (h !== 0) return h;
    }
    return b.diff - a.diff || b.pf - a.pf || a.team.localeCompare(b.team);
  });
}

export interface H2HWinnerInfo {
  beaten: string[];
}

// Map of winnerSlug → info about which team(s) they out-ranked via H2H.
// Only populated for two-team ties at the same (wins, losses) where H2H decides.
export function getH2HTiebreakerWinners(
  teams: TeamStanding[],
  teamMatches: Record<string, TeamMatch[]>
): Map<string, string[]> {
  const tieGroupSize = buildTieGroupSizes(teams);
  const map = new Map<string, string[]>();
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      const a = teams[i];
      const b = teams[j];
      if (a.wins !== b.wins || a.losses !== b.losses) continue;
      if ((tieGroupSize.get(a.slug) ?? 0) !== 2) continue;
      const h = getH2HResult(a, b, teamMatches);
      if (h < 0) {
        const arr = map.get(a.slug) ?? [];
        arr.push(b.team);
        map.set(a.slug, arr);
      } else if (h > 0) {
        const arr = map.get(b.slug) ?? [];
        arr.push(a.team);
        map.set(b.slug, arr);
      }
    }
  }
  return map;
}
