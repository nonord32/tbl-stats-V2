// src/app/fighters/[slug]/opengraph-image.tsx
// Dynamic Open Graph card for /fighters/<slug>. When the profile is shared,
// the preview renders the fighter's name, team, and three headline stats over
// the site's dark "gazette" band.
import { ImageResponse } from 'next/og';
import { getFighterBySlug } from '@/lib/data';
import { getFullTeamName, getTeamLogoPathByName } from '@/lib/teams';
import {
  OG_SIZE,
  OG_CONTENT_TYPE,
  ACCENT,
  MUTED,
  EntityCard,
  FallbackCard,
  loadOgFonts,
  ogLogoUrl,
} from '@/app/_og/card';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'TBL Stats — Fighter Profile';

export default async function FighterOG({ params }: { params: { slug: string } }) {
  const fonts = loadOgFonts();
  const result = await getFighterBySlug(params.slug);

  if (!result) {
    return new ImageResponse(<FallbackCard />, { ...OG_SIZE, fonts });
  }

  const { fighter, streak } = result;
  const tSlug = fighter.team
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  const teamName = getFullTeamName(tSlug) || fighter.team;

  const eyebrow = ['Fighter', streak ? `${streak} Streak` : null]
    .filter(Boolean)
    .join('  ·  ')
    .toUpperCase();

  const netPts = `${fighter.netPts >= 0 ? '+' : ''}${fighter.netPts.toFixed(0)}`;
  const winPct = `${(fighter.winPct * 100).toFixed(0)}%`;

  const logoUrl = ogLogoUrl(getTeamLogoPathByName(fighter.team)) || undefined;

  return new ImageResponse(
    (
      <EntityCard
        eyebrow={eyebrow}
        name={fighter.name}
        logoUrl={logoUrl}
        sub={
          <>
            <div style={{ fontFamily: 'Playfair', fontWeight: 700, fontSize: 30, color: ACCENT }}>
              {teamName}
            </div>
            <div
              style={{
                fontFamily: 'PlexMono',
                fontWeight: 400,
                fontSize: 20,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: MUTED,
              }}
            >
              · {fighter.weightClass} · {fighter.gender}
            </div>
          </>
        }
        stats={[
          { label: 'Record', value: fighter.record },
          { label: 'Net Pts', value: netPts, accent: true },
          { label: 'Win %', value: winPct },
        ]}
      />
    ),
    { ...OG_SIZE, fonts },
  );
}
