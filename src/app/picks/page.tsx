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

  // Fetch sheet data + user picks in parallel
  const [sheetData, picksResult] = await Promise.all([
    getAllData(),
    supabase
      .from('picks')
      .select('*')
      .eq('user_id', user.id)
      .order('match_index', { ascending: true }),
  ]);

  const picks: UserPick[] = (picksResult.data ?? []) as UserPick[];

  // Separate schedule into upcoming vs locked/past
  const todayUTC = new Date();
  todayUTC.setUTCHours(0, 0, 0, 0);

  const upcoming = sheetData.schedule.filter((s) => {
    const matchDate = new Date(s.date);
    return s.status === 'Upcoming' && matchDate >= todayUTC;
  });

  const lockedOrPast = sheetData.schedule.filter((s) => {
    const matchDate = new Date(s.date);
    return s.status !== 'Upcoming' || matchDate < todayUTC;
  });

  return (
    <PicksClient
      upcoming={upcoming}
      lockedOrPast={lockedOrPast}
      existingPicks={picks}
      userId={user.id}
    />
  );
}
