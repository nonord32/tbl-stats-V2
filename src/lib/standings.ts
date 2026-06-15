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

import type { TeamStanding, TeamMatch, ScheduleEntry } from '@/types';
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

// ─── Clinch logic ───────────────────────────────────────────────────────────
//
// A team is flagged 'x' (clinched a playoff berth) or 'z' (clinched the #1
// seed) only when it is GUARANTEED — i.e. it cannot be knocked out in any
// completion of the remaining schedule. We do this by enumerating every
// win/loss outcome of the remaining games and, in each scenario, computing the
// team's WORST-CASE finishing rank under TBL's real tiebreaker:
//
//   • Within a group tied on (wins, losses), the head-to-head "sweep" rule is
//     evaluated exactly (sweeper ranks first, recurse). Because the H2H games
//     are part of the enumeration, this is fully determined per scenario.
//   • Any tied teams the sweep can't separate fall to point differential. The
//     margins of future games are unknowable, so such ties are treated
//     adversarially: each unresolved team is placed at the BOTTOM of its block.
//
// Result: a clinch via a locked H2H sweep is credited, while one that would
// depend on point differential never is (it genuinely can't be guaranteed).
//
// Enumeration is 2^n in the number of remaining league games. With 12 teams
// this is cheap near the end of the season; above `maxEnumGames` we fall back
// to the conservative wins-only test (nothing is clinched that early anyway).

// Match a short schedule name ("Las Vegas") to a full standings team
// ("Las Vegas Hustle") by prefix.
function matchScheduleTeam(
  teams: TeamStanding[],
  shortName: string
): TeamStanding | undefined {
  const sn = shortName.toLowerCase().trim();
  if (!sn) return undefined;
  return teams.find((t) => {
    const tn = t.team.toLowerCase();
    return tn === sn || tn.startsWith(sn) || sn.startsWith(tn.split(' ')[0]);
  });
}

// Count of not-yet-played league games per team, keyed by team slug. Week 0
// (non-league / exhibition) and non-upcoming rows are ignored.
export function getRemainingGames(
  teams: TeamStanding[],
  schedule: ScheduleEntry[]
): Map<string, number> {
  const out = new Map<string, number>();
  for (const t of teams) out.set(t.slug, 0);
  for (const s of schedule) {
    if (s.week === 0) continue;
    if (s.status.toLowerCase() !== 'upcoming') continue;
    for (const name of [s.team1, s.team2]) {
      const t = matchScheduleTeam(teams, name);
      if (t) out.set(t.slug, (out.get(t.slug) ?? 0) + 1);
    }
  }
  return out;
}

// Remaining games as [slugA, slugB] pairs (only games where both teams resolve
// to a standings team).
export function getRemainingPairings(
  teams: TeamStanding[],
  schedule: ScheduleEntry[]
): [string, string][] {
  const out: [string, string][] = [];
  for (const s of schedule) {
    if (s.week === 0) continue;
    if (s.status.toLowerCase() !== 'upcoming') continue;
    const a = matchScheduleTeam(teams, s.team1);
    const b = matchScheduleTeam(teams, s.team2);
    if (a && b && a.slug !== b.slug) out.push([a.slug, b.slug]);
  }
  return out;
}

// Conservative wins-only fallback (no tiebreakers). Used when there are too
// many remaining games to enumerate exactly.
function getClinchStatusByWins(
  teams: TeamStanding[],
  remainingByTeam: Map<string, number>,
  playoffSpots: number
): Map<string, 'x' | 'z'> {
  const out = new Map<string, 'x' | 'z'>();
  const maxWins = (t: TeamStanding) => t.wins + (remainingByTeam.get(t.slug) ?? 0);
  for (const t of teams) {
    const clinchedFirst = teams.every((o) => o.slug === t.slug || maxWins(o) < t.wins);
    if (clinchedFirst) {
      out.set(t.slug, 'z');
      continue;
    }
    const threats = teams.filter((o) => o.slug !== t.slug && maxWins(o) >= t.wins).length;
    if (threats < playoffSpots) out.set(t.slug, 'x');
  }
  return out;
}

// Index-based sweeper search for the simulation. `cmp(i, j)` returns -1 when i
// has the winning H2H record over j. Mirrors findSweeper() above.
function findSweeperIdx(
  group: number[],
  cmp: (i: number, j: number) => number
): number | null {
  for (const cand of group) {
    if (group.every((o) => o === cand || cmp(cand, o) === -1)) return cand;
  }
  return null;
}

// Within one (wins,losses) group occupying ranks starting after `pos` teams,
// assign each member its WORST possible 1-based rank and fold it into
// `worstRank` (keeping the max seen across scenarios).
function foldWorstRanks(
  group: number[],
  pos: number,
  cmp: (i: number, j: number) => number,
  worstRank: number[]
): void {
  let remaining = group.slice();
  let p = pos;
  // Peel deterministic sweepers off the top.
  while (remaining.length > 1) {
    const sweeper = findSweeperIdx(remaining, cmp);
    if (sweeper === null) break;
    const r = p + 1;
    if (r > worstRank[sweeper]) worstRank[sweeper] = r;
    remaining = remaining.filter((x) => x !== sweeper);
    p++;
  }
  if (remaining.length === 1) {
    const r = p + 1;
    if (r > worstRank[remaining[0]]) worstRank[remaining[0]] = r;
  } else {
    // Unresolved (point-diff) block: worst case is the bottom for everyone.
    const worst = p + remaining.length;
    for (const t of remaining) if (worst > worstRank[t]) worstRank[t] = worst;
  }
}

// Returns a slug → marker map: 'z' = clinched the #1 seed, 'x' = clinched a
// playoff berth. 'z' implies a playoff berth, so such teams are returned as
// 'z' only. Honors the H2H tiebreaker (see header comment).
export function getClinchStatus(
  teams: TeamStanding[],
  teamMatches: Record<string, TeamMatch[]>,
  schedule: ScheduleEntry[],
  playoffSpots = 8,
  maxEnumGames = 18
): Map<string, 'x' | 'z'> {
  const pairings = getRemainingPairings(teams, schedule);
  const n = pairings.length;
  if (n > maxEnumGames) {
    return getClinchStatusByWins(teams, getRemainingGames(teams, schedule), playoffSpots);
  }

  const T = teams.length;
  const idxOf = new Map(teams.map((t, i) => [t.slug, i]));

  // Base H2H wins from games already played: baseH2H[i][j] = times i beat j.
  const baseH2H: number[][] = Array.from({ length: T }, () => new Array(T).fill(0));
  for (let i = 0; i < T; i++) {
    for (const m of teamMatches[teams[i].team] || []) {
      const j = idxOf.get(toSlug(m.opponent));
      if (j === undefined) continue;
      if (m.result === 'W') baseH2H[i][j]++;
    }
  }

  const pairIdx: [number, number][] = pairings.map(
    ([a, b]) => [idxOf.get(a)!, idxOf.get(b)!] as [number, number]
  );

  const baseWins = teams.map((t) => t.wins);
  const baseLosses = teams.map((t) => t.losses);
  const worstRank = new Array<number>(T).fill(0);

  const scenarios = 1 << n;
  for (let mask = 0; mask < scenarios; mask++) {
    const wins = baseWins.slice();
    const losses = baseLosses.slice();
    const overlay = new Map<number, number>(); // i*T+j -> extra wins by i over j
    for (let g = 0; g < n; g++) {
      const [a, b] = pairIdx[g];
      if ((mask >> g) & 1) {
        wins[a]++; losses[b]++;
        overlay.set(a * T + b, (overlay.get(a * T + b) ?? 0) + 1);
      } else {
        wins[b]++; losses[a]++;
        overlay.set(b * T + a, (overlay.get(b * T + a) ?? 0) + 1);
      }
    }
    const cmp = (i: number, j: number): number => {
      const iw = baseH2H[i][j] + (overlay.get(i * T + j) ?? 0);
      const jw = baseH2H[j][i] + (overlay.get(j * T + i) ?? 0);
      return iw > jw ? -1 : jw > iw ? 1 : 0;
    };

    // Order all teams by (wins desc, losses asc); walk (wins,losses) groups.
    const order = [...Array(T).keys()].sort(
      (x, y) => wins[y] - wins[x] || losses[x] - losses[y]
    );
    let pos = 0;
    let gi = 0;
    while (gi < order.length) {
      const w = wins[order[gi]];
      const l = losses[order[gi]];
      let gj = gi;
      while (gj < order.length && wins[order[gj]] === w && losses[order[gj]] === l) gj++;
      const group = order.slice(gi, gj);
      foldWorstRanks(group, pos, cmp, worstRank);
      pos += group.length;
      gi = gj;
    }
  }

  const out = new Map<string, 'x' | 'z'>();
  for (let i = 0; i < T; i++) {
    if (worstRank[i] === 1) out.set(teams[i].slug, 'z');
    else if (worstRank[i] <= playoffSpots) out.set(teams[i].slug, 'x');
  }
  return out;
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
