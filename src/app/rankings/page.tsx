// src/app/rankings/page.tsx
import type { Metadata } from 'next';
import { getAllData } from '@/lib/data';
import { RankingsClient } from './RankingsClient';

export const revalidate = 300;
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Rankings',
  description: 'TBL fighter rankings by weight class. See the top performers at every weight in the 2026 Team Boxing League season.',
  openGraph: {
    url: 'https://tblstats.com/rankings',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
};

export default async function RankingsPage() {
  const data = await getAllData();
  return <RankingsClient fighters={data.fighters} lastUpdated={data.lastUpdated} />;
}
