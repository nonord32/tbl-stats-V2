// src/app/picks/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAllData } from '@/lib/data';
import { isPickOpen } from '@/lib/gameTime';
import { getCurrentWeek } from '@/lib/week';
import { safeGetUser, safeQuery } from '@/lib/supabase/safe';
import { PicksClient } from './PicksClient';
import type { UserPick } from '@/types';

export const dynamic = 'force-dynamic';

export default async function PicksPage() {
  const supabase = await createClient();
  const user = await safeGetUser(supabase);

  if (!user) {
    redirect('/login');
  }

  const [sheetData, picks] = await Promise.all([
    getAllData(),
    safeQuery<UserPick[]>(
      supabase
        .from('picks')
        .select('*')
        .eq('user_id', user.id)
        .order('match_index', { ascending: true }),
      [],
      'picks.list'
    ),
  ]);

  // Current active week (earliest week still taking picks)
  const currentWeek = getCurrentWeek(sheetData.schedule);

  // Only show matches from the current active week with open pick windows
  const upcoming = currentWeek !== null
    ? sheetData.schedule.filter(
        (s) =>
          s.matchIndex &&
          s.status === 'Upcoming' &&
          Number(s.week) === currentWeek &&
          isPickOpen(s.date, s.time, s.venueCity)
      )
    : [];

  // Pending picks = submitted but not yet resolved (may be for locked/started matches)
  const pendingPicks = picks.filter((p) => !p.resolved_at);

  // Build schedule lookup for pending picks labels
  const scheduleMap: Record<number, { team1: string; team2: string; week: string | number }> = {};
  sheetData.schedule.forEach((s) => {
    if (s.matchIndex) scheduleMap[s.matchIndex] = { team1: s.team1, team2: s.team2, week: s.week };
  });

  return (
    <PicksClient
      upcoming={upcoming}
      existingPicks={picks}
      pendingPicks={pendingPicks}
      scheduleMap={scheduleMap}
      userId={user.id}
      currentWeek={currentWeek}
    />
  );
}
