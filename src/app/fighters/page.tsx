// src/app/fighters/page.tsx
import type { Metadata } from 'next';
import { getAllData } from '@/lib/data';
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
      <FightersClient
        fighters={data.fighters}
        fighterHistory={data.fighterHistory}
        seoText="Individual fighter statistics for the 2026 TBL season. Rankings by WAR, NPPR, Net Points, and Win%. Filter by weight class, team, or gender."
      />
    </>
  );
}
