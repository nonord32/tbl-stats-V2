// src/app/admin/page.tsx
import { getAllData, extractUniqueMatches } from '@/lib/data';
import { AdminClient } from './AdminClient';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const sheetData = await getAllData();
  const uniqueMatches = extractUniqueMatches(sheetData.teamMatches);

  // Build a combined list from schedule + resolved matches
  const schedule = sheetData.schedule;

  const matchList = schedule
    .filter((s) => s.matchIndex !== undefined)
    .map((s) => {
      const result = uniqueMatches.find((m) => m.matchIndex === s.matchIndex);
      return {
        matchIndex: s.matchIndex!,
        week: s.week,
        date: s.date,
        team1: s.team1,
        team2: s.team2,
        status: s.status,
        hasResult: !!result,
        score1: result?.score1 ?? null,
        score2: result?.score2 ?? null,
        winner: result ? (result.result === 'W' ? result.team1 : result.team2) : null,
      };
    })
    .sort((a, b) => a.matchIndex - b.matchIndex);

  return <AdminClient matches={matchList} />;
}
