// src/lib/bracketScore.ts
// Pure scoring for the Bracket Challenge. A user's stored prediction
// (BracketEntry) is scored against the live team playoff bracket built by
// buildBracket() in src/lib/playoffs.ts. Only slots that have actually been
// played contribute points, so scores climb round by round as results land.
//
// Scoring (per the challenge rules):
//   quarterfinal winner  → 1 pt each (4 slots)
//   semifinal winner     → 2 pts each (2 slots)
//   champion (the Final) → 4 pts
// Maximum 12 points. Ties are broken by the combined-final-score tiebreaker
// (see actualFinalTotal + the leaderboard ranking).

import type { Bracket } from './playoffs';
import type { BracketEntry } from '@/types';

export interface BracketScore {
  points: number;
  qfCorrect: number;
  sfCorrect: number;
  champCorrect: boolean;
}

export const QF_POINTS = 1;
export const SF_POINTS = 2;
export const CHAMP_POINTS = 4;
export const MAX_BRACKET_POINTS = 4 * QF_POINTS + 2 * SF_POINTS + CHAMP_POINTS; // 12

/** Score a single prediction against the actual (possibly partial) bracket. */
export function scoreBracketEntry(entry: BracketEntry, bracket: Bracket): BracketScore {
  let points = 0;
  let qfCorrect = 0;
  let sfCorrect = 0;

  bracket.qf.forEach((m, i) => {
    if (m.status === 'played' && m.winnerSlug && entry.qf_winners[i] === m.winnerSlug) {
      points += QF_POINTS;
      qfCorrect += 1;
    }
  });

  bracket.sf.forEach((m, i) => {
    if (m.status === 'played' && m.winnerSlug && entry.sf_winners[i] === m.winnerSlug) {
      points += SF_POINTS;
      sfCorrect += 1;
    }
  });

  const champCorrect =
    bracket.final.status === 'played' &&
    !!bracket.championSlug &&
    entry.champion === bracket.championSlug;
  if (champCorrect) points += CHAMP_POINTS;

  return { points, qfCorrect, sfCorrect, champCorrect };
}

/**
 * The actual combined score of the Final (both teams), used as the tiebreaker
 * target. Returns null until the Final has been played.
 */
export function actualFinalTotal(bracket: Bracket): number | null {
  const f = bracket.final;
  if (f.status !== 'played' || !f.score) return null;
  return f.score[0] + f.score[1];
}
