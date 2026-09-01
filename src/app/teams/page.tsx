// src/app/teams/page.tsx
import type { Metadata } from 'next';
import { getAllData } from '@/lib/data';
import { getComebackData } from '@/lib/wpa';
import { getClinchStatus } from '@/lib/standings';
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

const BASE = 'https://tblstats.com';

export default async function TeamsPage() {
  const data = await getAllData();
  // Comeback wins / blown leads per team slug, for the two extra columns.
  const cb = await getComebackData();
  const comebacks = Object.fromEntries(
    [...cb.byTeam.values()].map((t) => [
      t.slug,
      { comebackWins: t.comebackWins, blownLeads: t.blownLeads },
    ]),
  );
  const clinch = Object.fromEntries(
    getClinchStatus(data.teams, data.teamMatches, data.schedule)
  );
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
          clinch={clinch}
          comebacks={comebacks}
          lastUpdated={data.lastUpdated}
          seoText="Team Boxing League standings based on match results and performance across the season. Sorted by wins, with Points For, Points Against, and point differential."
        />
      )}
    </>
  );
}
