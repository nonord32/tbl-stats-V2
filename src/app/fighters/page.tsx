// src/app/fighters/page.tsx
import type { Metadata } from 'next';
import { getAllData } from '@/lib/data';
import { DataUnavailable } from '@/components/DataUnavailable';
import { FightersClient } from './FightersClient';

export const metadata: Metadata = {
  title: 'Fighter Stats',
  description:
    'TBL fighter rankings by WAR, NPPR, Net Points, Win%, Record, and Rounds. Filter by weight class, team, or gender.',
  openGraph: {
    url: 'https://tblstats.com/fighters',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
};

export const revalidate = 300;
export const dynamic = 'force-dynamic';

const BASE = 'https://tblstats.com';

export default async function FightersPage() {
  const data = await getAllData();
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'TBL Stats',     item: BASE },
      { '@type': 'ListItem', position: 2, name: 'Fighter Stats', item: `${BASE}/fighters` },
    ],
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      {data.fighters.length === 0 ? (
        <main>
          <div className="page container" style={{ maxWidth: 560 }}>
            <div className="page-header">
              <h1>Fighter Stats</h1>
            </div>
            <DataUnavailable
              title="Fighter stats are temporarily unavailable"
              description="The fighter data couldn’t be loaded from the source. Try again in a minute."
            />
          </div>
        </main>
      ) : (
        <FightersClient
          fighters={data.fighters}
          fighterHistory={data.fighterHistory}
          schedule={data.schedule}
          lastUpdated={data.lastUpdated}
          seoText="Individual fighter statistics for the 2026 TBL season. Rankings by WAR, NPPR, Net Points, and Win%. Filter by weight class, team, or gender."
        />
      )}
    </>
  );
}
