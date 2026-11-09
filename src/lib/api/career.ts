// src/lib/api/career.ts
//
// Multi-season helpers for the public API: matching the same fighter across
// seasons, and adding season stat lines into career totals.
//
// No runtime imports (tested directly by scripts/career.test.mjs).

/** One fighter's stat line, in the public API's shape (see fighterStats in v1.ts). */
export interface StatLine {
  wins: number;
  losses: number;
  draws: number;
  record: string;
  rounds: number;
  win_pct: number;
  net_points: number;
  nppr: number;
  points_scored: number;
  points_allowed: number;
  points_allowed_per_round: number;
  war: number;
  ko_tko: number;
  knockdowns: number;
  double_knockdowns: number;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Career totals from season lines, like a baseball card's "Career" row.
 * Counting stats (wins, rounds, points, WAR, knockouts…) are added up. Rates
 * are recomputed from the totals — never averaged — so a 2-round season
 * doesn't count as much as a 20-round one.
 */
export function combineStatLines(lines: readonly StatLine[]): StatLine {
  const sum = (k: keyof StatLine) => lines.reduce((n, l) => n + (Number(l[k]) || 0), 0);
  const wins = sum('wins');
  const losses = sum('losses');
  const draws = sum('draws');
  const rounds = sum('rounds');
  const net = sum('net_points');
  const allowed = sum('points_allowed');
  const decisions = wins + losses;
  return {
    wins,
    losses,
    draws,
    record: `${wins}-${losses}-${draws}`,
    rounds,
    win_pct: decisions > 0 ? round3(wins / decisions) : 0,
    net_points: round3(net),
    nppr: rounds > 0 ? round3(net / rounds) : 0,
    points_scored: round3(sum('points_scored')),
    points_allowed: round3(allowed),
    points_allowed_per_round: rounds > 0 ? round3(allowed / rounds) : 0,
    war: round3(sum('war')),
    ko_tko: sum('ko_tko'),
    knockdowns: sum('knockdowns'),
    double_knockdowns: sum('double_knockdowns'),
  };
}

/** A fighter as they appear in one season's sheet. */
export interface SeasonFighterRef {
  seasonId: string;
  /** Name slug in that season. */
  slug: string;
  /** Stable Fighter ID from that season's Data tab, if filled in. */
  id: string | null;
}

/**
 * Groups the same person across seasons. Returns groupKey → their entries.
 *
 * 1. Entries with a stable Fighter ID are grouped by that ID (so a renamed
 *    fighter, or two people with the same name but different IDs, are handled).
 * 2. Entries without an ID join the ID group with the same name slug — but only
 *    when exactly one ID uses that slug. Otherwise they're grouped by name slug.
 */
export function groupFightersAcrossSeasons<T extends SeasonFighterRef>(entries: readonly T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  const add = (key: string, e: T) => {
    const list = groups.get(key);
    if (list) list.push(e);
    else groups.set(key, [e]);
  };

  const idsBySlug = new Map<string, Set<string>>();
  for (const e of entries) {
    const id = normId(e.id);
    if (!id) continue;
    add('id:' + id, e);
    const set = idsBySlug.get(e.slug) ?? new Set<string>();
    set.add(id);
    idsBySlug.set(e.slug, set);
  }
  for (const e of entries) {
    if (normId(e.id)) continue;
    const ids = idsBySlug.get(e.slug);
    add(ids && ids.size === 1 ? 'id:' + [...ids][0] : 'slug:' + e.slug, e);
  }
  return groups;
}

function normId(id: string | null | undefined): string {
  return (id ?? '').trim().toLowerCase();
}
