// src/app/teams/[slug]/opengraph-image.tsx
// Dynamic Open Graph card for /teams/<slug>. Renders the team's two-tone name,
// city + roster size, and three headline stats (record, net points, standing).
import { ImageResponse } from 'next/og';
import { getAllData, getTeamBySlug } from '@/lib/data';
import { sortStandings } from '@/lib/standings';
import { getCityName } from '@/lib/teams';
import {
  OG_SIZE,
  OG_CONTENT_TYPE,
  MUTED,
  EntityCard,
  FallbackCard,
  splitName,
  ordinal,
  loadOgFonts,
} from '@/app/_og/card';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'TBL Stats — Team Profile';

export default async function TeamOG({ params }: { params: { slug: string } }) {
  const fonts = loadOgFonts();
  const result = await getTeamBySlug(params.slug);

  if (!result) {
    return new ImageResponse(<FallbackCard />, { ...OG_SIZE, fonts });
  }

  const { team, roster } = result;

  // getAllData is React-cached, so this shares the fetch with getTeamBySlug.
  const data = await getAllData();
  const rank = sortStandings(data.teams, data.teamMatches).findIndex((t) => t.slug === team.slug) + 1;

  const [front, back] = splitName(team.team);
  const city = getCityName(team.team) || team.team;
  const netPts = `${team.diff >= 0 ? '+' : ''}${team.diff.toFixed(1)}`;

  const eyebrow = ['Team', rank > 0 ? `${ordinal(rank)} in Standings` : null]
    .filter(Boolean)
    .join('  ·  ')
    .toUpperCase();

  return new ImageResponse(
    (
      <EntityCard
        eyebrow={eyebrow}
        name={front}
        nameTwoTone={back}
        sub={
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
            {city} · {roster.length} {roster.length === 1 ? 'Fighter' : 'Fighters'}
          </div>
        }
        stats={[
          { label: 'Record', value: team.record },
          { label: 'Net Pts', value: netPts, accent: true },
          { label: 'Standing', value: rank > 0 ? ordinal(rank) : '—' },
        ]}
      />
    ),
    { ...OG_SIZE, fonts },
  );
}
