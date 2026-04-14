// src/app/fighters/page.tsx
import type { Metadata } from 'next';
import { getAllData } from '@/lib/data';
import { FightersClient } from './FightersClient';

export const metadata: Metadata = {
  title: 'Fighter Stats',
  description:
    'TBL fighter rankings by WAR, NPPR, Net Points, Win%, Record, and Rounds. Filter by weight class, team, or gender.',
};

export const revalidate = 300;
export const dynamic = 'force-dynamic';

export default async function FightersPage() {
  const data = await getAllData();
  return (
    <FightersClient
      fighters={data.fighters}
      fighterHistory={data.fighterHistory}
      seoText="Individual fighter statistics for the 2026 TBL season. Rankings by WAR, NPPR, Net Points, and Win%. Filter by weight class, team, or gender."
    />
  );
}
