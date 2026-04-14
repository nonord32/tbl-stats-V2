// src/lib/teams.ts
// Team color accents keyed by city slug (matches /public/logos/{city}.png filenames).
// Full team name slugs (e.g. "las-vegas-hustle") are matched via prefix so you
// don't need to update this file when the sheet nickname changes.
// Update colors here to match official team branding.

export const CITY_COLORS: Record<string, string> = {
  'atlanta':     '#c8102e',
  'boston':      '#ba0c2f',
  'dallas':      '#003594',
  'houston':     '#ce1141',
  'las-vegas':   '#b4975a',
  'los-angeles': '#552583',
  'miami':       '#98002e',
  'nashville':   '#ffb81c',
  'nyc':         '#e53e3e',
  'philadelphia':'#003087',
  'phoenix':     '#e56020',
  'san-antonio': '#3d3d3d',
};

/** Returns a hex color for the given team slug, or '' if unknown. */
export function getTeamColor(slug: string): string {
  // Exact match first
  if (CITY_COLORS[slug]) return CITY_COLORS[slug];
  // Prefix match: "las-vegas-hustle" → "las-vegas"
  for (const [city, color] of Object.entries(CITY_COLORS)) {
    if (slug.startsWith(city)) return color;
  }
  return '';
}

/** Returns the city-portion logo path for a given team slug. */
export function getTeamLogoPath(slug: string): string {
  if (typeof window === 'undefined') {
    // server-side: just use slug directly
  }
  // Try exact first
  const cities = Object.keys(CITY_COLORS);
  const city = cities.find((c) => slug === c || slug.startsWith(c));
  return city ? `/logos/${city}.png` : `/logos/${slug}.png`;
}
