// src/lib/teams.ts
// Team logo paths and color accent map
// Place your 12 logo PNGs in /public/logos/{slug}.png

export const TEAM_LOGOS: Record<string, string> = {
  // Keys should match toSlug(teamName) exactly
  // Update these slugs to match your actual team names from the sheet
  'team-alpha': '/logos/team-alpha.png',
  'team-bravo': '/logos/team-bravo.png',
  'team-charlie': '/logos/team-charlie.png',
  'team-delta': '/logos/team-delta.png',
  'team-echo': '/logos/team-echo.png',
  'team-foxtrot': '/logos/team-foxtrot.png',
  'team-golf': '/logos/team-golf.png',
  'team-hotel': '/logos/team-hotel.png',
  'team-india': '/logos/team-india.png',
  'team-juliet': '/logos/team-juliet.png',
  'team-kilo': '/logos/team-kilo.png',
  'team-lima': '/logos/team-lima.png',
};

export function getTeamLogo(slug: string): string {
  return TEAM_LOGOS[slug] || '/logos/placeholder.png';
}

export function getTeamLogoByName(name: string): string {
  const { toSlug } = require('./data');
  return getTeamLogo(toSlug(name));
}
