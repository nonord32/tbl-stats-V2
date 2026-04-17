// src/lib/teams.ts
// Central team metadata: full names, colors, logo paths.
// Keys are city slugs that match /public/logos/{city}.png filenames.
// Add/update TEAM_FULL_NAMES when team nicknames are confirmed.

interface TeamMeta {
  fullName: string;
  color: string;
}

const TEAMS: Record<string, TeamMeta> = {
  'atlanta':     { fullName: 'Atlanta Attack',      color: '#c8102e' },
  'boston':      { fullName: 'Boston Butchers',    color: '#ba0c2f' },
  'dallas':      { fullName: 'Dallas Enforcers',   color: '#003594' },
  'houston':     { fullName: 'Houston Hitmen',     color: '#ce1141' },
  'las-vegas':   { fullName: 'Las Vegas Hustle',   color: '#b4975a' },
  'los-angeles': { fullName: 'Los Angeles Elite',  color: '#552583' },
  'miami':       { fullName: 'Miami Assassins',    color: '#98002e' },
  'nashville':   { fullName: 'Nashville Smash',    color: '#ffb81c' },
  'nyc':         { fullName: 'NYC Attitude',       color: '#e53e3e' },
  'philadelphia':{ fullName: 'Philadelphia Smoke', color: '#003087' },
  'phoenix':     { fullName: 'Phoenix Fury',       color: '#e56020' },
  'san-antonio': { fullName: 'San Antonio Snipers',color: '#3d3d3d' },
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

/** Hex accent color looked up by full team name, e.g. "Los Angeles Elite". */
export function getTeamColorByName(name: string): string {
  const entry = Object.values(TEAMS).find((t) => t.fullName === name);
  return entry ? entry.color : '';
}

/** Logo path looked up by full team name, e.g. "Los Angeles Elite". */
export function getTeamLogoPathByName(name: string): string {
  const key = Object.keys(TEAMS).find((k) => TEAMS[k].fullName === name);
  return key ? `/logos/${key}.png` : '';
}
