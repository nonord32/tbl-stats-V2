// src/lib/playoffs.ts
// Live playoff bracket builder. Turns the locked top-8 seeds plus the set of
// completed playoff games (matches tagged Game Phase = Playoffs in the source
// sheet) into an advancing single-elimination bracket.
//
// Rounds are inferred *structurally*, with no extra sheet column: seeds are
// locked and the quarterfinal pairings are fixed, so in a single-elimination
// format each unordered pair of teams can only ever meet in one bracket slot.
// "The playoff game between team X and team Y" therefore uniquely identifies a
// matchup, which is all we need to advance winners round by round.
//
// With zero playoff games this degrades gracefully to the old behaviour: every
// quarterfinal is `pending` (both teams known, nothing played) and the
// semifinals/final are `tbd` — i.e. exactly the "if the playoffs started today"
// projection.

import type { MatchResult, TeamStanding } from '@/types';
import { toSlug } from './data';

export interface Seed {
  seed: number;
  team: TeamStanding;
}

// A bracket slot's state:
//   played  — the game is decided; winnerSlug/score/matchIndex are set.
//   pending — both participants are known but the game hasn't happened yet.
//   tbd     — at least one participant is still unknown (upstream not decided).
export type SlotStatus = 'played' | 'pending' | 'tbd';

export type Round = 'QF' | 'SF' | 'F';

// Human-facing round names. The final is branded "MegaBrawl".
export const ROUND_LABELS: Record<Round, string> = {
  QF: 'Quarterfinals',
  SF: 'Semifinals',
  F: 'MegaBrawl',
};

export interface BracketMatch {
  round: Round;
  a?: Seed;
  b?: Seed;
  winnerSlug?: string;
  score?: [number, number]; // aligned to [a, b]
  matchIndex?: number;
  status: SlotStatus;
}

export interface Bracket {
  qf: BracketMatch[]; // 4, in seed-pair order: 1v8, 4v5, 3v6, 2v7
  sf: BracketMatch[]; // 2: top half, bottom half
  final: BracketMatch;
  championSlug?: string;
  anyPlayed: boolean;
}

interface GameOutcome {
  winnerSlug: string;
  loserSlug: string;
  // Score from the winner's perspective isn't guaranteed, so keep both keyed
  // by slug and re-align to the slot's a/b at render time.
  scoreBySlug: Record<string, number>;
  matchIndex: number;
}

// Map a completed playoff game's matchIndex → its round label ("Quarterfinals",
// "Semifinals", "MegaBrawl"), derived from a built bracket. Only games that have
// actually been played carry a matchIndex, so only those are labeled — a
// not-yet-played round can't be identified from results alone.
export function playoffRoundLabelsByMatch(bracket: Bracket): Map<number, string> {
  const out = new Map<number, string>();
  for (const slot of [...bracket.qf, ...bracket.sf, bracket.final]) {
    if (slot.matchIndex != null) out.set(slot.matchIndex, ROUND_LABELS[slot.round]);
  }
  return out;
}

// Index completed playoff games by the unordered slug pair of the two teams,
// so a slot can look up "did these two play, and who won?".
function indexPlayoffGames(playoffResults: MatchResult[]): Map<string, GameOutcome> {
  const byPair = new Map<string, GameOutcome>();
  for (const m of playoffResults) {
    const s1 = toSlug(m.team1);
    const s2 = toSlug(m.team2);
    // Draws shouldn't happen in a knockout bracket; leave such a slot
    // unresolved rather than guessing an advancer.
    if (m.result === 'D') continue;
    const winnerSlug = m.result === 'W' ? s1 : s2;
    const loserSlug = m.result === 'W' ? s2 : s1;
    const key = [s1, s2].sort().join('|');
    byPair.set(key, {
      winnerSlug,
      loserSlug,
      scoreBySlug: { [s1]: m.score1, [s2]: m.score2 },
      matchIndex: m.matchIndex,
    });
  }
  return byPair;
}

// Resolve a single matchup between two (possibly unknown) participants against
// the completed-games index.
function resolveMatch(
  round: Round,
  a: Seed | undefined,
  b: Seed | undefined,
  games: Map<string, GameOutcome>
): BracketMatch {
  if (!a || !b) {
    return { round, a, b, status: 'tbd' };
  }
  const key = [a.team.slug, b.team.slug].sort().join('|');
  const outcome = games.get(key);
  if (!outcome) {
    return { round, a, b, status: 'pending' };
  }
  return {
    round,
    a,
    b,
    winnerSlug: outcome.winnerSlug,
    score: [outcome.scoreBySlug[a.team.slug] ?? 0, outcome.scoreBySlug[b.team.slug] ?? 0],
    matchIndex: outcome.matchIndex,
    status: 'played',
  };
}

// The Seed that won a played match, or undefined if the match isn't decided.
function winnerOf(match: BracketMatch): Seed | undefined {
  if (match.status !== 'played' || !match.winnerSlug) return undefined;
  if (match.a?.team.slug === match.winnerSlug) return match.a;
  if (match.b?.team.slug === match.winnerSlug) return match.b;
  return undefined;
}

/**
 * Build the advancing bracket from the locked seeds and the completed playoff
 * games. `seeds` is expected to be the top-8 in seed order (index 0 = 1 seed).
 */
export function buildBracket(seeds: Seed[], playoffResults: MatchResult[]): Bracket {
  const games = indexPlayoffGames(playoffResults);
  const bySeed = new Map(seeds.map((s) => [s.seed, s] as const));

  // Standard 8-team pairings. Top half = 1v8, 4v5; bottom half = 3v6, 2v7.
  const qfSeedPairs: Array<[number, number]> = [
    [1, 8],
    [4, 5],
    [3, 6],
    [2, 7],
  ];
  const qf = qfSeedPairs.map(([hi, lo]) =>
    resolveMatch('QF', bySeed.get(hi), bySeed.get(lo), games)
  );

  // Semifinals: top = QF0 winner vs QF1 winner; bottom = QF2 vs QF3.
  const sf = [
    resolveMatch('SF', winnerOf(qf[0]), winnerOf(qf[1]), games),
    resolveMatch('SF', winnerOf(qf[2]), winnerOf(qf[3]), games),
  ];

  // Final: the two semifinal winners.
  const final = resolveMatch('F', winnerOf(sf[0]), winnerOf(sf[1]), games);

  const championSlug = winnerOf(final)?.team.slug;
  const anyPlayed = [...qf, ...sf, final].some((m) => m.status === 'played');

  return { qf, sf, final, championSlug, anyPlayed };
}
