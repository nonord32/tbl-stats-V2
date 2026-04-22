// src/app/teams/page.tsx
import type { Metadata } from 'next';
import { getAllData } from '@/lib/data';
import { DataUnavailable } from '@/components/DataUnavailable';
import { TeamsClient } from './TeamsClient';

export const metadata: Metadata = {
  title: 'Team Standings',
  description:
    'TBL team standings: records, Points For, Points Against, point differential, and streaks.',
  openGraph: {
    url: 'https://tblstats.com/teams',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
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
      {data.teams.length === 0 ? (
        <main>
          <div className="page container" style={{ maxWidth: 560 }}>
            <div className="page-header">
              <h1>Team Standings</h1>
            </div>
            <DataUnavailable
              title="Standings are temporarily unavailable"
              description="Team data couldn’t be loaded from the source. Try again in a minute."
            />
          </div>
        </main>
      ) : (
        <TeamsClient
          teams={data.teams}
          teamMatches={data.teamMatches}
          lastUpdated={data.lastUpdated}
          seoText="Team Boxing League standings based on match results and performance across the season. Sorted by wins, with Points For, Points Against, and point differential."
        />
      )}
    </>
  );
}
