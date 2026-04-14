// src/app/results/page.tsx
import type { Metadata } from 'next';
import { getAllData, extractUniqueMatches } from '@/lib/data';
import { ResultsClient } from './ResultsClient';

export const metadata: Metadata = {
  title: 'Match Results — TBL Stats',
  description:
    'All Team Boxing League match results. Team scores, winners, and round-by-round box scores for every TBL event.',
};

export const revalidate = 300;
export const dynamic = 'force-dynamic';

export default async function ResultsPage() {
  const data = await getAllData();
  const matches = extractUniqueMatches(data.teamMatches);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'TBL Match Results 2026',
    itemListElement: matches.map((m, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'SportsEvent',
        name: `${m.team1} vs ${m.team2}`,
        startDate: m.date,
        sport: 'Boxing',
        competitor: [
          { '@type': 'SportsTeam', name: m.team1 },
          { '@type': 'SportsTeam', name: m.team2 },
        ],
        description: `${m.team1} ${m.score1.toFixed(1)} – ${m.score2.toFixed(1)} ${m.team2}`,
        organizer: {
          '@type': 'SportsOrganization',
          name: 'Team Boxing League',
          url: 'https://teamboxingleague.com',
        },
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ResultsClient matches={matches} />
    </>
  );
}
