// src/lib/teams.ts
// Central team metadata: full names, colors, logo paths.
// Keys are city slugs that match /public/logos/{city}.png filenames.
// Add/update TEAM_FULL_NAMES when team nicknames are confirmed.

interface TeamMeta {
  fullName: string;
  color: string;
}

const TEAMS: Record<string, TeamMeta> = {
  'atlanta':     { fullName: 'Atlanta',            color: '#c8102e' },
  'boston':      { fullName: 'Boston Butchers',    color: '#ba0c2f' },
  'dallas':      { fullName: 'Dallas',             color: '#003594' },
  'houston':     { fullName: 'Houston',            color: '#ce1141' },
  'las-vegas':   { fullName: 'Las Vegas Hustle',   color: '#b4975a' },
  'los-angeles': { fullName: 'Los Angeles',        color: '#552583' },
  'miami':       { fullName: 'Miami',              color: '#98002e' },
  'nashville':   { fullName: 'Nashville',          color: '#ffb81c' },
  'nyc':         { fullName: 'NYC Attitude',       color: '#e53e3e' },
  'philadelphia':{ fullName: 'Philadelphia Smoke', color: '#003087' },
  'phoenix':     { fullName: 'Phoenix Fury',       color: '#e56020' },
  'san-antonio': { fullName: 'San Antonio',        color: '#3d3d3d' },
};

/** Resolve city key from any slug (exact or prefix match). */
function cityKey(slug: string): string | undefined {
  if (TEAMS[slug]) return slug;
  return Object.keys(TEAMS).find((c) => slug.startsWith(c));
}

/** Full team name, e.g. "Las Vegas Hustle". Falls back to slug if unknown. */
export function getFullTeamName(slug: string): string {
  const key = cityKey(slug);
  return key ? TEAMS[key].fullName : slug;
}

/** Hex accent color for the team, or '' if unknown. */
export function getTeamColor(slug: string): string {
  const key = cityKey(slug);
  return key ? TEAMS[key].color : '';
}

/** Logo path using the city-slug filename convention. */
export function getTeamLogoPath(slug: string): string {
  const key = cityKey(slug);
  return key ? `/logos/${key}.png` : `/logos/${slug}.png`;
}
