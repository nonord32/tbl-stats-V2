// src/lib/seasons.ts
//
// The league's seasons. Each season has its own Google Sheet with the same
// tabs and headers (see docs/NEW-SEASON.md). Everything that reads league
// data goes through getAllData(season), which looks the sheet up here.
//
// To start a new season:
//   1. Add an entry below with that sheet's published key (and its tab gids
//      if they differ from 2026's — a "Make a copy" of the whole spreadsheet
//      keeps the same gids).
//   2. Set the previous season's `complete: true`.
//   3. Point CURRENT_SEASON_ID at the new season.
//
// No runtime imports: this file is safe to load from node:test.

export type SheetTab = 'fighters' | 'teams' | 'matches' | 'schedule' | 'highlights' | 'awards';

export interface SeasonDef {
  /** Stable id used in URLs and the API (?season=2026). */
  id: string;
  year: number;
  /** League season number (2026 is the league's 4th season). */
  number: number;
  /** Display label, e.g. "2026 · Season 4". */
  label: string;
  /** The "2PACX-…" key from File → Share → Publish to web. */
  publishedKey: string;
  /** Tab ids (the `gid=` in each tab's URL). */
  gids: Record<SheetTab, number>;
  /**
   * A finished season. Its sheet is cached for a day instead of two minutes,
   * since the numbers no longer change.
   */
  complete: boolean;
}

/** Tab ids of the 2026 sheet. A full copy of the spreadsheet keeps these. */
export const GIDS_2026: Record<SheetTab, number> = {
  fighters: 1273687161,
  teams: 1404001793,
  matches: 0,
  schedule: 1716719705,
  highlights: 1508158260,
  awards: 644608532,
};

/** Oldest first. */
export const SEASONS: readonly SeasonDef[] = [
  {
    id: '2026',
    year: 2026,
    number: 4,
    label: '2026 · Season 4',
    publishedKey: '2PACX-1vTDpxOV--xewT8SdQckLWo70ZEeupxHRcyOYui9nEPQwvbvE2bc5nkOs0JN-XUVpIXwjn3WauVLdeJw',
    gids: GIDS_2026,
    complete: false,
  },
  // {
  //   id: '2027',
  //   year: 2027,
  //   number: 5,
  //   label: '2027 · Season 5',
  //   publishedKey: '2PACX-…',   // from the 2027 sheet's Publish to web
  //   gids: GIDS_2026,           // same tabs if the sheet is a full copy
  //   complete: false,
  // },
];

export const CURRENT_SEASON_ID = '2026';

/** Pseudo-season for all-time totals (leaders, fighter careers). */
export const CAREER = 'career';

export function getSeason(id: string): SeasonDef | null {
  return SEASONS.find((s) => s.id === id) ?? null;
}

export function currentSeason(): SeasonDef {
  return getSeason(CURRENT_SEASON_ID) ?? SEASONS[SEASONS.length - 1];
}

/** A season id from user input ("2026", " 2026 ") or null if unknown. */
export function normalizeSeasonId(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const v = String(raw).trim().toLowerCase();
  return getSeason(v) ? v : null;
}

export function sheetCsvUrl(season: SeasonDef, tab: SheetTab): string {
  return `https://docs.google.com/spreadsheets/d/e/${season.publishedKey}/pub?gid=${season.gids[tab]}&single=true&output=csv`;
}

/** Seconds to cache this season's CSVs. */
export function sheetRevalidateSeconds(season: SeasonDef): number {
  return season.complete ? 86_400 : 120;
}

/** 4 → "IV". For 1–3999; anything else comes back as plain digits. */
export function toRoman(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 3999) return String(n);
  const table: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let out = '';
  for (const [v, r] of table) while (n >= v) { out += r; n -= v; }
  return out;
}

/** The season's championship final, e.g. Season 4 → "MegaBrawl IV". */
export function megaBrawlName(season: Pick<SeasonDef, 'number'>): string {
  return `MegaBrawl ${toRoman(season.number)}`;
}

/** Newest first, the order the API lists them. */
export function seasonsNewestFirst(): SeasonDef[] {
  return [...SEASONS].sort((a, b) => b.year - a.year);
}
