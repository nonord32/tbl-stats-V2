// src/lib/fighters.ts
// Shared helpers that operate on fighter data, used by multiple pages.

import type { FighterStat, FightHistory } from '@/types';

/**
 * Every weight class a fighter has competed in. The sheet's "Weight Class"
 * column may list multiple classes comma-joined (e.g.
 * "Light Heavyweight, Cruiserweight") and a fighter may have bouts in the
 * history at additional classes. This helper returns the union as individual
 * trimmed classes — so one fighter correctly appears under every class they
 * belong to in filters and rankings.
 */
export function getFighterWeightClasses(
  f: FighterStat,
  history?: FightHistory[]
): Set<string> {
  const classes = new Set<string>();
  const add = (wc: string | undefined) => {
    if (!wc) return;
    wc.split(',').forEach((part) => {
      const trimmed = part.trim();
      if (trimmed) classes.add(trimmed);
    });
  };
  add(f.weightClass);
  (history ?? []).forEach((h) => add(h.weightClass));
  return classes;
}

function bucketByClass(history: FightHistory[]): {
  counts: Map<string, number>;
  lastRound: Map<string, number>;
} {
  const counts = new Map<string, number>();
  const lastRound = new Map<string, number>();
  for (const h of history) {
    const wc = (h.weightClass || '').trim();
    if (!wc) continue;
    counts.set(wc, (counts.get(wc) ?? 0) + 1);
    const rid =
      typeof h.roundId === 'number'
        ? h.roundId
        : Number.isFinite(new Date(h.date).getTime())
          ? new Date(h.date).getTime()
          : 0;
    const prev = lastRound.get(wc);
    if (prev === undefined || rid > prev) lastRound.set(wc, rid);
  }
  return { counts, lastRound };
}

/**
 * The weight class a fighter should be ranked under. Fighters who bounce
 * between classes get bucketed into the one they've fought MOST in; ties
 * are broken by whichever class they last competed in. Falls back to the
 * first class from the sheet's listed `weightClass` field when there's no
 * fight history yet.
 */
export function getPrimaryWeightClass(
  f: FighterStat,
  history?: FightHistory[]
): string {
  const { counts, lastRound } = bucketByClass(history ?? []);
  if (counts.size > 0) {
    let best = '';
    let bestCount = -1;
    let bestRecent = -Infinity;
    for (const [wc, c] of counts) {
      const recent = lastRound.get(wc) ?? -Infinity;
      if (c > bestCount || (c === bestCount && recent > bestRecent)) {
        best = wc;
        bestCount = c;
        bestRecent = recent;
      }
    }
    if (best) return best;
  }
  const fallback = (f.weightClass || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return fallback[0] ?? '';
}

/**
 * Every weight class the fighter belongs to, ordered with the primary class
 * (most fought, ties → most recent) first and any additional classes after.
 * Includes classes from both the listed `weightClass` field and fight history,
 * so the UI can show "Cruiserweight, Light Heavyweight" with the primary up
 * front while still surfacing the secondary class.
 */
export function getFighterWeightClassesOrdered(
  f: FighterStat,
  history?: FightHistory[]
): string[] {
  const { counts, lastRound } = bucketByClass(history ?? []);
  // Make sure listed-but-unfought classes still appear.
  for (const wc of (f.weightClass || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)) {
    if (!counts.has(wc)) counts.set(wc, 0);
  }
  return [...counts.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      const ra = lastRound.get(a[0]) ?? -Infinity;
      const rb = lastRound.get(b[0]) ?? -Infinity;
      return rb - ra;
    })
    .map(([wc]) => wc);
}

