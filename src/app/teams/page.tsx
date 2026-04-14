// src/app/teams/page.tsx
import type { Metadata } from 'next';
import { getAllData } from '@/lib/data';
import { TeamsClient } from './TeamsClient';

export const metadata: Metadata = {
  title: 'Team Standings',
  description:
    'TBL team standings: records, Points For, Points Against, point differential, and streaks.',
};

export const revalidate = 300;
export const dynamic = 'force-dynamic';

const BASE = 'https://tblstats.com';

export default async function TeamsPage() {
  const data = await getAllData();
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'TBL Stats',      item: BASE },
      { '@type': 'ListItem', position: 2, name: 'Team Standings', item: `${BASE}/teams` },
    ],
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <TeamsClient
        teams={data.teams}
        teamMatches={data.teamMatches}
        seoText="Team Boxing League standings based on match results and performance across the season. Sorted by wins, with Points For, Points Against, and point differential."
      />
    </>
  );
}
