// src/components/cards/teamLogo.ts
// The cards display a short team code (NYC, MIA, LAX...) but the logo files
// live at /logos/{city-slug}.png. This is the inverse of the teamShort()
// helper in src/lib/cards.ts.

const SHORT_TO_SLUG: Record<string, string> = {
  ATL: 'atlanta',
  BOS: 'boston',
  DAL: 'dallas',
  HOU: 'houston',
  LV: 'las-vegas',
  LAX: 'los-angeles',
  MIA: 'miami',
  NSH: 'nashville',
  NYC: 'nyc',
  PHI: 'philadelphia',
  PHX: 'phoenix',
  SA: 'san-antonio',
};

export function teamLogoPath(shortOrName: string | undefined): string | null {
  if (!shortOrName) return null;
  const up = shortOrName.toUpperCase().trim();
  if (SHORT_TO_SLUG[up]) return `/logos/${SHORT_TO_SLUG[up]}.png`;

  // Also accept full names / city words ("Miami", "Las Vegas Hustle").
  const slug = shortOrName.toLowerCase().trim().replace(/\s+/g, '-');
  for (const key of Object.values(SHORT_TO_SLUG)) {
    if (slug === key || slug.startsWith(key + '-') || slug.startsWith(key)) {
      return `/logos/${key}.png`;
    }
  }
  return null;
}
