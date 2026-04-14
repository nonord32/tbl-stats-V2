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
  return <ResultsClient matches={matches} />;
}
