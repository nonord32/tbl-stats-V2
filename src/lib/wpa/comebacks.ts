// src/lib/wpa/comebacks.ts
//
// Comebacks & Blown Leads — read straight off the win-probability values WPA
// already computes. No new model, no new model constants, and nothing here
// changes WPA / LI / Clutch.
//
// For each DECIDED match, take the eventual winner's win probability at every
// round boundary and find the minimum. That is how close they came to losing:
//
//   comebackLow = min( winner's wpAfter ) over rounds 1..N
//   blownHigh   = 1 - comebackLow            (the loser's high-water mark)
//
// Only the states AFTER each round count. `MatchWpa.rounds[]` holds exactly
// those, so the 0.500 opening boundary (which lives in rounds[0].wpBefore) is
// excluded simply by never reading it — including it would floor every match at
// 50% and make wire-to-wire wins read as comebacks.
//
// Rules inherited from WPA, not re-implemented here:
//  • Draws have no winner, so they yield null (match 25 drops out — 54 of 55
//    matches qualify for 2026).
//  • Match 14 uses the competitive scoreboard, like everywhere else, so it
//    reads as a San Antonio comeback win. Its footnote rides along on the
//    record so the caveat travels with the entry.
//  • Scheduled-round variation (matches 7 and 48 are 21 rounds) needs no
//    handling — it is already baked into the stored win probabilities.
//
// Pure functions, type-imports only, so scripts/wpa.test.mjs can load this
// directly under `node --experimental-strip-types`.

import type { MatchWpa, SeasonWpa } from './core';

// A team is credited with a comeback win when their win probability was once
// below this. A PRESENTATION threshold, deliberately kept out of the frozen
// model config — it is not a model constant. 0.25 yields 12 of 54 matches in
// 2026: frequent enough to populate a page, rare enough to mean something.
export const COMEBACK_THRESHOLD = 0.25;

export interface MatchComeback {
  matchIndex: number;
  date: string;
  phase: MatchWpa['phase'];
  winnerTeam: string;
  loserTeam: string;
  /** the winner's lowest win probability at any post-round boundary */
  comebackLow: number;
  /** the loser's high-water mark — the mirror of comebackLow */
  blownHigh: number;
  /** round at which the low occurred (first occurrence) */
  lowRound: number;
  /** the winner's score differential at that moment (negative = trailing) */
  deficitAtLow: number;
  /** final winning margin, always positive */
  finalMargin: number;
  isComeback: boolean;
  footnote?: string;
}

export interface TeamComebackTotals {
  slug: string;
  team: string;
  comebackWins: number;
  /** lowest comebackLow across their comeback wins; null when none */
  deepestHole: number | null;
  blownLeads: number;
  /** highest blownHigh across their blown leads; null when none */
  highestLeadBlown: number | null;
}

export interface SeasonComebacks {
  /** every decided match, ranked by comebackLow ascending (biggest first) */
  matches: MatchComeback[];
  byTeam: Map<string, TeamComebackTotals>;
  totals: {
    decidedMatches: number;
    comebacks: number;
    /** Σ team comeback wins — must equal Σ team blown leads */
    teamComebackWins: number;
    teamBlownLeads: number;
    /** share of winners who fell below each mark, for the methodology page */
    below: { p05: number; p10: number; p15: number; p25: number; p35: number };
    medianLow: number;
  };
}

// One match. Returns null for draws — no winner, so no comeback.
export function computeMatchComeback(mw: MatchWpa): MatchComeback | null {
  if (mw.outcome === 0.5) return null;
  if (mw.rounds.length === 0) return null;

  const team1Won = mw.outcome === 1;
  let comebackLow = Infinity;
  let lowRound = mw.rounds[0].round;
  let deficitAtLow = 0;

  for (const r of mw.rounds) {
    // Flip to the winner's perspective; stored values are team-1's.
    const winnerWp = team1Won ? r.wpAfter : 1 - r.wpAfter;
    if (winnerWp < comebackLow) {
      comebackLow = winnerWp;
      lowRound = r.round;
      deficitAtLow = team1Won ? r.diffAfter : -r.diffAfter;
    }
  }

  return {
    matchIndex: mw.matchIndex,
    date: mw.date,
    phase: mw.phase,
    winnerTeam: team1Won ? mw.team1 : mw.team2,
    loserTeam: team1Won ? mw.team2 : mw.team1,
    comebackLow,
    blownHigh: 1 - comebackLow,
    lowRound,
    deficitAtLow,
    finalMargin: Math.abs(mw.finalDiff),
    isComeback: comebackLow < COMEBACK_THRESHOLD,
    footnote: mw.footnote,
  };
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// Whole season. `slugOf` maps a raw team name to its canonical slug — pass
// getTeamSlugByName from src/lib/teams.ts (it handles full names, short names
// and city variants, and returns '' on a miss so failures are detectable).
export function computeSeasonComebacks(
  season: SeasonWpa,
  slugOf: (team: string) => string,
): SeasonComebacks {
  const matches: MatchComeback[] = [];
  for (const mw of season.byMatch.values()) {
    const c = computeMatchComeback(mw);
    if (c) matches.push(c);
  }
  // Biggest comeback first.
  matches.sort((a, b) => a.comebackLow - b.comebackLow);

  const byTeam = new Map<string, TeamComebackTotals>();
  const ensure = (team: string): TeamComebackTotals => {
    const slug = slugOf(team) || team;
    let t = byTeam.get(slug);
    if (!t) {
      t = {
        slug,
        team,
        comebackWins: 0,
        deepestHole: null,
        blownLeads: 0,
        highestLeadBlown: null,
      };
      byTeam.set(slug, t);
    }
    return t;
  };

  for (const c of matches) {
    // Every match touches both teams so they appear even with zero of each.
    const w = ensure(c.winnerTeam);
    const l = ensure(c.loserTeam);
    if (!c.isComeback) continue;
    // The same match, viewed from both sides.
    w.comebackWins++;
    w.deepestHole = w.deepestHole == null ? c.comebackLow : Math.min(w.deepestHole, c.comebackLow);
    l.blownLeads++;
    l.highestLeadBlown =
      l.highestLeadBlown == null ? c.blownHigh : Math.max(l.highestLeadBlown, c.blownHigh);
  }

  const lows = matches.map((m) => m.comebackLow);
  const share = (bar: number) => lows.filter((v) => v < bar).length;
  let teamComebackWins = 0;
  let teamBlownLeads = 0;
  for (const t of byTeam.values()) {
    teamComebackWins += t.comebackWins;
    teamBlownLeads += t.blownLeads;
  }

  return {
    matches,
    byTeam,
    totals: {
      decidedMatches: matches.length,
      comebacks: matches.filter((m) => m.isComeback).length,
      teamComebackWins,
      teamBlownLeads,
      below: {
        p05: share(0.05),
        p10: share(0.1),
        p15: share(0.15),
        p25: share(0.25),
        p35: share(0.35),
      },
      medianLow: median(lows),
    },
  };
}

// For a comeback match: who actually drove it. Top rounds by the WINNING side's
// fighter WPA credit, from the low point onward. Context for the match page —
// deliberately NOT a season-wide fighter leaderboard, which would just be a
// subset of WPA measuring the same thing twice and would reward fighters for
// the accident of being scheduled after their team fell behind.
export interface ComebackDriver {
  round: number;
  fighter: string;
  opponent: string;
  wpa: number;
  method?: string;
  diffBefore: number;
  diffAfter: number;
}

export function comebackDrivers(
  mw: MatchWpa,
  fromRound: number,
  limit = 3,
): ComebackDriver[] {
  if (mw.outcome === 0.5) return [];
  const team1Won = mw.outcome === 1;
  return mw.rounds
    .filter((r) => r.round >= fromRound)
    .map((r) => ({
      round: r.round,
      fighter: team1Won ? r.fighter1 : r.fighter2,
      opponent: team1Won ? r.fighter2 : r.fighter1,
      wpa: team1Won ? r.fighter1Wpa : r.fighter2Wpa,
      method: r.method,
      // Winner-perspective differentials.
      diffBefore: team1Won ? r.diffBefore : -r.diffBefore,
      diffAfter: team1Won ? r.diffAfter : -r.diffAfter,
    }))
    .filter((d) => d.wpa > 0 && d.fighter && d.fighter.trim().toUpperCase() !== 'N/A')
    .sort((a, b) => b.wpa - a.wpa)
    .slice(0, limit);
}
