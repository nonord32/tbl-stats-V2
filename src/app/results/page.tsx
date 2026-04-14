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

  const BASE = 'https://tblstats.com';

  const toIso = (d: string) => {
    try { return new Date(d).toISOString().split('T')[0]; } catch { return d; }
  };

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'TBL Stats', item: BASE },
          { '@type': 'ListItem', position: 2, name: 'Results',   item: `${BASE}/results` },
        ],
      },
      ...matches.map((m) => ({
        '@type': 'SportsEvent',
        name: `${m.team1} vs ${m.team2}`,
        startDate: toIso(m.date),
        eventStatus: 'https://schema.org/EventScheduled',
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        sport: 'Boxing',
        url: `${BASE}/results`,
        competitor: [
          { '@type': 'SportsTeam', name: m.team1 },
          { '@type': 'SportsTeam', name: m.team2 },
        ],
        description: `${m.team1} ${m.score1.toFixed(1)} – ${m.score2.toFixed(1)} ${m.team2}. ${m.result === 'W' ? m.team1 : m.team2} wins.`,
        organizer: {
          '@type': 'SportsOrganization',
          name: 'Team Boxing League',
          url: 'https://teamboxingleague.com',
        },
      })),
    ],
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
