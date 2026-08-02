// src/lib/eightOh.ts
// Pure logic for the hidden "/8-0" roster-builder game.
//
// The player fills a 12-slot roster (one fighter per weight class: 3 female +
// 9 male), then we simulate an 8-game regular season and report the record.
// A perfect 8-0 is an undefeated regular season.
//
// Scoring basis (per the league owner): a blended fighter rating that is
// 80% Net Points + 20% NPPR, using REGULAR-SEASON stats only. The two stats
// live on different scales, so each is min-max normalized across the whole
// pool before blending.
//
// This module is framework-agnostic and side-effect free: it takes already
// fetched sheet data (FighterStat[]) and returns plain data. The route's
// server component does the fetching and hands the result to the client game.

import type { FighterStat } from '@/types';
import { compareWeightClass } from './weightClasses';
import { getTeamSlugByName, getFullTeamName, getCityName } from './teams';

// The three female weight classes, mirroring FEMALE_FANTASY_CLASSES in
// fantasyData.ts. Everything else on the female side is ignored; the male
// slots are derived from the data so we never hard-code the 9 male classes.
const FEMALE_CLASSES = new Set(['Super Lightweight', 'Bantamweight', 'Featherweight']);

const NET_POINTS_WEIGHT = 0.8;
const NPPR_WEIGHT = 0.2;
const REGULAR_SEASON_GAMES = 8;

/** Split "Light Heavyweight, Cruiserweight" into its individual classes. */
export function splitClasses(raw: string): string[] {
  return raw
    .split(/[,/]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ─── Seeded RNG (local copies; the ones in fantasyData.ts aren't exported) ───

/** FNV-1a hash → 32-bit seed. */
export function hashSeed(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic Fisher-Yates shuffle (does not mutate the input). */
export function deterministicShuffle<T>(arr: T[], seed: number): T[] {
  const out = arr.slice();
  let s = seed || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ─── Types ───────────────────────────────────────────────────────────────

export type Gender = 'Male' | 'Female';

/** A slot the roster must fill: a (weight class, gender) pair. */
export interface Slot {
  id: string;            // `${gender}:${weightClass}`
  weightClass: string;
  gender: Gender;
  label: string;         // e.g. "Featherweight (F)"
}

/** A pickable fighter, with a precomputed blended rating. */
export interface GameFighter {
  slug: string;
  name: string;
  team: string;          // full team name, e.g. "Las Vegas Hustle"
  teamSlug: string;      // city slug, e.g. "las-vegas"
  city: string;          // e.g. "Las Vegas"
  gender: Gender;
  classes: string[];     // all weight classes this fighter is eligible for
  slotIds: string[];     // slot ids this fighter can fill
  // Regular-season stats (netPts/nppr drive scoring; war is season-wide, display only)
  netPts: number;
  nppr: number;
  war: number;
  wins: number;
  losses: number;
  record: string;
  rating: number;        // 0–100 blended (80% net points, 20% NPPR)
}

/** A real team's strongest possible lineup (best fighter per slot). */
export interface OpponentTeam {
  teamSlug: string;
  team: string;          // full name
  city: string;
  lineup: Record<string, GameFighter | null>;  // slot id → best fighter (or null)
  total: number;         // sum of lineup ratings
}

export interface GameData {
  slots: Slot[];
  fighters: GameFighter[];       // the full pickable pool
  opponents: OpponentTeam[];     // one per real team
  teamSlugs: string[];           // distinct team slugs present in the pool
}

export interface GameLogEntry {
  opponent: string;      // full team name
  opponentCity: string;
  yourTotal: number;
  theirTotal: number;
  won: boolean;
}

export interface SeasonResult {
  wins: number;
  losses: number;
  record: string;        // e.g. "8-0"
  perfect: boolean;
  yourTotal: number;
  games: GameLogEntry[];
}

// ─── Building the game data ────────────────────────────────────────────────

function normGender(g: string): Gender {
  return g === 'Female' ? 'Female' : 'Male';
}

function slotId(gender: Gender, weightClass: string): string {
  return `${gender}:${weightClass}`;
}

/**
 * Turn raw sheet fighters into the game pool.
 *
 * `regularFighters` is the phase-filtered set from
 * aggregateFightersByPhase(..., 'regular'); it drops fighters with no
 * regular-season bouts, so we key it by slug and fall back to the season-wide
 * `all` stats (pre-season, or fighters with playoff-only bouts) to keep every
 * team fully represented in the pool.
 */
export function buildGameData(
  allFighters: FighterStat[],
  regularFighters: FighterStat[],
): GameData {
  const regBySlug = new Map(regularFighters.map((f) => [f.slug, f]));

  // Resolve the stat source (regular-season if available, else season-wide).
  interface Raw {
    base: FighterStat;
    netPts: number;
    nppr: number;
    wins: number;
    losses: number;
    record: string;
  }
  const raws: Raw[] = allFighters.map((f) => {
    const reg = regBySlug.get(f.slug);
    const src = reg ?? f;
    return {
      base: f,
      netPts: src.netPts,
      nppr: src.nppr,
      wins: src.wins,
      losses: src.losses,
      record: src.record,
    };
  });

  // Min-max ranges for the blend.
  const netVals = raws.map((r) => r.netPts).filter((n) => Number.isFinite(n));
  const npprVals = raws.map((r) => r.nppr).filter((n) => Number.isFinite(n));
  const minNet = Math.min(...netVals);
  const maxNet = Math.max(...netVals);
  const minNppr = Math.min(...npprVals);
  const maxNppr = Math.max(...npprVals);
  const norm = (x: number, lo: number, hi: number) =>
    hi > lo && Number.isFinite(x) ? (x - lo) / (hi - lo) : 0;

  // Collect the (gender, class) pairs that actually occur, to derive slots.
  const femaleClasses = new Set<string>();
  const maleClasses = new Set<string>();

  const fighters: GameFighter[] = raws.map((r) => {
    const f = r.base;
    const gender = normGender(f.gender);
    const classes = splitClasses(f.weightClass);
    // Female fighters only fill the three female classes; male fighters fill
    // whatever (non-female-designated) classes they list.
    const eligible = classes.filter((c) =>
      gender === 'Female' ? FEMALE_CLASSES.has(c) : true,
    );
    for (const c of eligible) {
      if (gender === 'Female') femaleClasses.add(c);
      else maleClasses.add(c);
    }
    const rating =
      100 *
      (NET_POINTS_WEIGHT * norm(r.netPts, minNet, maxNet) +
        NPPR_WEIGHT * norm(r.nppr, minNppr, maxNppr));
    const teamSlug = getTeamSlugByName(f.team);
    return {
      slug: f.slug,
      name: f.name,
      team: teamSlug ? getFullTeamName(teamSlug) : f.team,
      teamSlug,
      city: getCityName(f.team),
      gender,
      classes: eligible,
      slotIds: eligible.map((c) => slotId(gender, c)),
      netPts: r.netPts,
      nppr: r.nppr,
      war: f.war,
      wins: r.wins,
      losses: r.losses,
      record: r.record,
      rating: +rating.toFixed(1),
    };
  });

  // Build the ordered slot list: 3 female (canonical order) then the male
  // classes (canonical order).
  const femaleSlots: Slot[] = [...femaleClasses]
    .sort(compareWeightClass)
    .map((c) => ({ id: slotId('Female', c), weightClass: c, gender: 'Female' as Gender, label: `${c} (F)` }));
  const maleSlots: Slot[] = [...maleClasses]
    .sort(compareWeightClass)
    .map((c) => ({ id: slotId('Male', c), weightClass: c, gender: 'Male' as Gender, label: `${c} (M)` }));
  const slots = [...femaleSlots, ...maleSlots];
  const slotIdSet = new Set(slots.map((s) => s.id));

  // Trim each fighter's slotIds to real slots (drops any stray class).
  for (const f of fighters) {
    f.slotIds = f.slotIds.filter((id) => slotIdSet.has(id));
  }

  // Distinct teams present.
  const teamSlugs = [...new Set(fighters.map((f) => f.teamSlug).filter(Boolean))].sort();

  // Each team's strongest lineup: best-rated fighter per slot.
  const opponents: OpponentTeam[] = teamSlugs.map((teamSlug) => {
    const roster = fighters.filter((f) => f.teamSlug === teamSlug);
    const lineup: Record<string, GameFighter | null> = {};
    let total = 0;
    for (const slot of slots) {
      const best = roster
        .filter((f) => f.slotIds.includes(slot.id))
        .sort((a, b) => b.rating - a.rating)[0];
      lineup[slot.id] = best ?? null;
      total += best ? best.rating : 0;
    }
    return {
      teamSlug,
      team: getFullTeamName(teamSlug),
      city: getCityName(teamSlug),
      lineup,
      total: +total.toFixed(1),
    };
  });

  return { slots, fighters, opponents, teamSlugs };
}

// ─── Simulating the season ─────────────────────────────────────────────────

/**
 * Simulate an 8-game regular season for a hand-picked roster.
 *
 * The schedule is a deterministic shuffle of the real teams (seeded by the
 * picked fighter slugs, so the same roster always yields the same result),
 * taking the first 8. Each game is decided by total team rating — your roster's
 * summed ratings vs the opponent's strongest lineup total.
 */
export function simulateSeason(
  picked: GameFighter[],
  opponents: OpponentTeam[],
): SeasonResult {
  const yourTotal = +picked.reduce((s, f) => s + f.rating, 0).toFixed(1);
  const seed = hashSeed(picked.map((f) => f.slug).join('|'));
  const schedule = deterministicShuffle(opponents, seed).slice(0, REGULAR_SEASON_GAMES);

  const games: GameLogEntry[] = schedule.map((opp) => ({
    opponent: opp.team,
    opponentCity: opp.city,
    yourTotal,
    theirTotal: opp.total,
    // Ties fall to the player, so a theoretically optimal roster can reach 8-0.
    // With real float ratings exact ties are essentially impossible anyway.
    won: yourTotal >= opp.total,
  }));

  const wins = games.filter((g) => g.won).length;
  const losses = games.length - wins;
  return {
    wins,
    losses,
    record: `${wins}-${losses}`,
    perfect: wins === REGULAR_SEASON_GAMES && losses === 0,
    yourTotal,
    games,
  };
}
