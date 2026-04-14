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

export default async function TeamsPage() {
  const data = await getAllData();
  return (
    <TeamsClient
      teams={data.teams}
      teamMatches={data.teamMatches}
      lastUpdated={data.lastUpdated}
      seoText="Team Boxing League standings based on match results and performance across the season. Sorted by wins, with Points For, Points Against, and point differential."
    />
  );
}
