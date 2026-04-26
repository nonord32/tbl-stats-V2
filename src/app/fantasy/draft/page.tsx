// src/app/fantasy/draft/page.tsx
// Mock draft entry point. Server component pulls the real TBL fighter
// pool (via getFantasyData → getAllData → Google Sheets), then hands it
// to the interactive client-side DraftRoom that runs the snake order,
// 60-sec clock, AI auto-picks, and live roster building.

import { getFantasyData } from '@/lib/fantasyData';
import { DraftRoom } from './DraftRoom';

export const dynamic = 'force-dynamic';

const TEAMS = [
  'Snipers Inc.',
  'Glove Mafia',
  'Assassin Yacht Club',
  'Throwing Hands FC', // ← you
  'Headgear Heroes',
  'Speed Bag Society',
  'Cornermen United',
  'Knockout Equity',
];
const USER_TEAM_INDEX = 3; // 4th pick in round 1

export default async function FantasyDraftPage() {
  const { pool } = await getFantasyData();
  return (
    <DraftRoom
      pool={pool}
      teams={TEAMS}
      userTeamIndex={USER_TEAM_INDEX}
      rounds={10}
      pickClockSeconds={60}
    />
  );
}
