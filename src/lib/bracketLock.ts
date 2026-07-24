// src/lib/bracketLock.ts
// Determines when Bracket Challenge entries lock. Entries lock 1.5 hours after
// the first playoff game (a quarterfinal) starts.
//
// The schedule tab carries no phase marker, but the playoff field is set, so
// the four quarterfinal pairings are deterministic (seeds 1v8, 4v5, 3v6, 2v7).
// We match those unordered team-slug pairs against schedule rows and take the
// earliest game start (reusing getGameStartUTC's venue-timezone logic), then
// add the 90-minute grace. If no QF game is on the schedule yet, entries stay
// open (lock time is null).

import type { ScheduleEntry } from '@/types';
import type { Seed } from './playoffs';
import { toSlug } from './data';
import { getGameStartUTC } from './gameTime';

/** Grace period after the first playoff game starts before entries lock. */
export const BRACKET_LOCK_GRACE_MS = 90 * 60 * 1000; // 1.5 hours

// Fixed 8-team quarterfinal seed pairings — same as buildBracket().
const QF_SEED_PAIRS: Array<[number, number]> = [
  [1, 8],
  [4, 5],
  [3, 6],
  [2, 7],
];

/**
 * The moment bracket entries lock: 1.5h after the earliest quarterfinal game
 * starts. Returns null when no quarterfinal game with a parseable start time
 * is on the schedule yet (→ entries remain open).
 */
export function getBracketLockTime(schedule: ScheduleEntry[], seeds: Seed[]): Date | null {
  const bySeed = new Map(seeds.map((s) => [s.seed, s] as const));

  const qfPairKeys = new Set<string>();
  for (const [hi, lo] of QF_SEED_PAIRS) {
    const a = bySeed.get(hi)?.team.slug;
    const b = bySeed.get(lo)?.team.slug;
    if (a && b) qfPairKeys.add([a, b].sort().join('|'));
  }
  if (qfPairKeys.size === 0) return null;

  let earliest: Date | null = null;
  for (const s of schedule) {
    if (!s.team1 || !s.team2) continue;
    // Only the *upcoming* meeting counts. The same two teams almost certainly
    // also met in the regular season (a Completed row in the past) — matching
    // that would lock the bracket the moment the field is set. Blank statuses
    // parse as "Upcoming", so unplayed playoff games are included.
    if (s.status !== 'Upcoming') continue;
    const key = [toSlug(s.team1), toSlug(s.team2)].sort().join('|');
    if (!qfPairKeys.has(key)) continue;
    const start = getGameStartUTC(s.date, s.time, s.venueCity);
    if (start && !isNaN(start.getTime())) {
      if (!earliest || start < earliest) earliest = start;
    }
  }

  if (!earliest) return null;
  return new Date(earliest.getTime() + BRACKET_LOCK_GRACE_MS);
}

/** True while entries can still be created or edited. */
export function isBracketOpen(lockTime: Date | null): boolean {
  if (!lockTime) return true; // no playoff game scheduled yet — open
  return new Date() < lockTime;
}
