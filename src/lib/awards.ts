// src/lib/awards.ts
// Shared award-category labels and helpers used by both the /awards page
// and the home Hall of Champions card.

// Single category label for all MegaBrawl finals winners.
export const MEGABRAWL_AWARD = 'MegaBrawl Champions';

// Team awards (the winner is a team, not a fighter). Anything in this list
// renders with the city/team header treatment and skips the fighter link.
export const TEAM_AWARDS = new Set<string>([
  MEGABRAWL_AWARD,
  'Team Championship',
  'Champion',
  'Champions',
]);

// Awards whose `team` field is two teams (e.g. "Houston / San Antonio").
// Both logos render in the right-side chip.
export const TWO_TEAM_AWARDS = new Set<string>(['Fight of the Year']);

// Display order for award categories. Anything not in the list is appended
// after, alphabetically.
export const AWARD_ORDER = [
  MEGABRAWL_AWARD,
  'Most Valuable Fighter',
  'Season MVP',
  'MVP',
  'Rookie of the Year',
  'Rising Star',
  'Most Entertaining Fighter',
  'Fight of the Year',
  'Female Fighter of the Year',
  'Team Championship',
];

// Map an upstream award name to its display category. Roman-numbered
// MegaBrawl entries ("MegaBrawl I Champions", "MegaBrawl II Champions", …)
// collapse into a single MegaBrawl Champions list.
export function normalizeAwardName(name: string): string {
  if (/^megabrawl\b.*champion/i.test(name)) return MEGABRAWL_AWARD;
  return name;
}

export function awardOrderIndex(name: string): number {
  const idx = AWARD_ORDER.indexOf(name);
  return idx === -1 ? AWARD_ORDER.length : idx;
}
