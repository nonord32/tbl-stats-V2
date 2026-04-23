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
