// src/app/rankings/page.tsx
import type { Metadata } from 'next';
import { getAllData } from '@/lib/data';
import { DataUnavailable } from '@/components/DataUnavailable';
import { RankingsClient } from './RankingsClient';

export const metadata: Metadata = {
  title: 'Weight Class Rankings',
  description:
    'TBL Top 5 at every weight class — Heavyweight, Cruiserweight, Light Heavyweight, Middleweight, Welterweight, Lightweight, and more. Ranked by net points across the 2026 Team Boxing League season.',
  openGraph: {
    url: 'https://tblstats.com/rankings',
    title: 'Weight Class Rankings — TBL Top 5 per Class',
    description:
      'The top 5 TBL fighters at every weight class, ranked by net points.',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TBL Weight Class Rankings',
    description: 'Top 5 at every weight class — updated weekly.',
    images: ['/og-image.png'],
  },
};

export const revalidate = 300;
export const dynamic = 'force-dynamic';

const BASE = 'https://tblstats.com';

export default async function RankingsPage() {
  const data = await getAllData();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'TBL Stats', item: BASE },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Weight Class Rankings',
            item: `${BASE}/rankings`,
          },
        ],
      },
      {
        '@type': 'CollectionPage',
        '@id': `${BASE}/rankings`,
        name: 'TBL Weight Class Rankings',
        description:
          'Top 5 TBL fighters at every weight class, ranked by net points.',
        isPartOf: { '@id': `${BASE}/#website` },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {data.fighters.length === 0 ? (
        <main>
          <div className="page container" style={{ maxWidth: 560 }}>
            <div className="page-header">
              <h1>Weight Class Rankings</h1>
            </div>
            <DataUnavailable
              title="Rankings are temporarily unavailable"
              description="Fighter data couldn’t be loaded from the source. Try again in a minute."
            />
          </div>
        </main>
      ) : (
        <RankingsClient
          fighters={data.fighters}
          fighterHistory={data.fighterHistory}
          lastUpdated={data.lastUpdated}
        />
      )}
    </>
  );
}
