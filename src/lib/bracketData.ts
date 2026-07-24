// src/lib/bracketData.ts
// Shared derivation of the live playoff bracket + entry-lock time, used by both
// the Bracket Challenge entry page (/bracket) and the standings (/leaderboard).
// Mirrors the seeding logic in src/app/playoffs/page.tsx so the challenge scores
// against exactly the same bracket the Playoffs tab renders.

import type { ParsedSheetData, TeamMatch } from '@/types';
import { extractUniqueMatches } from './data';
import { sortStandings } from './standings';
import { buildBracket, type Bracket, type Seed } from './playoffs';
import { getBracketLockTime, isBracketOpen } from './bracketLock';

export const PLAYOFF_SPOTS = 8;

// Keep only regular-season matches so seeds reflect the final regular-season
// table (playoff games must not perturb the standings).
function regularSeasonMatches(
  teamMatches: Record<string, TeamMatch[]>
): Record<string, TeamMatch[]> {
  const out: Record<string, TeamMatch[]> = {};
  for (const [team, matches] of Object.entries(teamMatches)) {
    out[team] = matches.filter((m) => m.phase === 'regular');
  }
  return out;
}

export interface BracketContext {
  seeds: Seed[];
  bracket: Bracket;
  lockTime: Date | null;
  /** Whether entries can still be created or edited right now. */
  open: boolean;
}

/** Build the top-8 seeds, the live bracket, the entry-lock time, and whether
 *  entries are still open. Entries close 1.5h after the first playoff game
 *  starts, or immediately once any playoff game has been played. */
export function getBracketContext(sheetData: ParsedSheetData): BracketContext {
  const regularMatches = regularSeasonMatches(sheetData.teamMatches);
  const standings = sortStandings(sheetData.teams, regularMatches);
  const seeds: Seed[] = standings.slice(0, PLAYOFF_SPOTS).map((team, i) => ({
    seed: i + 1,
    team,
  }));

  const playoffResults = extractUniqueMatches(sheetData.teamMatches).filter(
    (m) => m.phase === 'playoffs'
  );
  const bracket = buildBracket(seeds, playoffResults);
  const lockTime = getBracketLockTime(sheetData.schedule, seeds);
  // Once any playoff game is on the board the field is in play — lock even if
  // the schedule row has since flipped to Completed (making lockTime null).
  const open = !bracket.anyPlayed && isBracketOpen(lockTime);

  return { seeds, bracket, lockTime, open };
}
