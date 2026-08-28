// src/app/8-0/page.tsx
// Hidden "/8-0" roster-builder game. Server component: pulls the real TBL
// fighter pool (via getAllData → Google Sheets), scopes stats to the regular
// season, precomputes the blended ratings + opponent lineups, and hands the
// plain game data to the interactive client.
//
// The page is intentionally unlinked and marked noindex — it's reachable only
// by typing /8-0.

import type { Metadata } from 'next';
import { getAllData } from '@/lib/data';
import { aggregateFightersByPhase } from '@/lib/phaseStats';
import { buildGameData } from '@/lib/eightOh';
import { EightOhClient } from './EightOhClient';

export const metadata: Metadata = {
  title: '8-0',
  description: 'Build a 12-fighter roster and see if it goes undefeated.',
  robots: { index: false, follow: false },
};

export const revalidate = 300;

export default async function EightOhPage() {
  const data = await getAllData();
  const regularFighters = aggregateFightersByPhase(
    data.fighters,
    data.fightersByPhase,
    data.fighterHistory,
    'regular',
  );
  const game = buildGameData(data.fighters, regularFighters);
  return <EightOhClient game={game} />;
}
