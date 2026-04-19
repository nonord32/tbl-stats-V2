// src/app/picks/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAllData } from '@/lib/data';
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

  // Lock picks at midnight before game day — consistent with the API
  const todayUTC = new Date();
  todayUTC.setUTCHours(0, 0, 0, 0);

  // Only show Upcoming matches that are strictly in the future (not today)
  const allUpcoming = sheetData.schedule.filter((s) => {
    if (!s.matchIndex || s.status !== 'Upcoming') return false;
    return new Date(s.date) > todayUTC;
  });

  // Find the current active week: earliest week with open picks
  const currentWeek = allUpcoming.length > 0
    ? Math.min(...allUpcoming.map((s) => Number(s.week)))
    : null;

  // Only show matches from the current active week
  const upcoming = currentWeek !== null
    ? allUpcoming.filter((s) => Number(s.week) === currentWeek)
    : [];

  return (
    <PicksClient
      upcoming={upcoming}
      existingPicks={picks}
      userId={user.id}
      currentWeek={currentWeek}
    />
  );
}
