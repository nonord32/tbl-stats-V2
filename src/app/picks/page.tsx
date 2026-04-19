// src/app/picks/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAllData } from '@/lib/data';
import { isPickOpen } from '@/lib/gameTime';
import { PicksClient } from './PicksClient';
import type { UserPick } from '@/types';

export const dynamic = 'force-dynamic';

export default async function PicksPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const [sheetData, picksResult] = await Promise.all([
    getAllData(),
    supabase
      .from('picks')
      .select('*')
      .eq('user_id', user.id)
      .order('match_index', { ascending: true }),
  ]);

  const picks: UserPick[] = (picksResult.data ?? []) as UserPick[];

  // Show only Upcoming matches where picks are still open (game hasn't started)
  const allUpcoming = sheetData.schedule.filter((s) => {
    if (!s.matchIndex || s.status !== 'Upcoming') return false;
    return isPickOpen(s.date, s.time, s.venueCity);
  });

  // Find the current active week: earliest week with open picks
  const currentWeek = allUpcoming.length > 0
    ? Math.min(...allUpcoming.map((s) => Number(s.week)))
    : null;

  // Only show matches from the current active week
  const upcoming = currentWeek !== null
    ? allUpcoming.filter((s) => Number(s.week) === currentWeek)
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
