// src/app/admin/page.tsx
import { getAllData, extractUniqueMatches } from '@/lib/data';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { AdminClient } from './AdminClient';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const sheetData = await getAllData();
  const uniqueMatches = extractUniqueMatches(sheetData.teamMatches);
  const schedule = sheetData.schedule;

  // Only upcoming matches — completed matches are not pickable
  const upcomingMatchList = schedule
    .filter((s) => s.matchIndex !== undefined && s.status === 'Upcoming')
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

  const upcomingIndices = upcomingMatchList.map((m) => m.matchIndex);

  // Fetch picks using service role key (bypasses RLS)
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const [picksResult, profilesResult] = await Promise.all([
    supabase
      .from('picks')
      .select('user_id, match_index, picked_team, diff_band, points_earned, resolved_at')
      .in('match_index', upcomingIndices.length > 0 ? upcomingIndices : [-1])
      .order('match_index'),
    supabase.from('profiles').select('id, display_name, username'),
  ]);

  const dbError = picksResult.error?.message ?? profilesResult.error?.message ?? null;
  const profileMap = new Map((profilesResult.data ?? []).map((p) => [p.id as string, p]));

  const picks = (picksResult.data ?? []).map((p) => {
    const profile = profileMap.get(p.user_id as string);
    const match = upcomingMatchList.find((m) => m.matchIndex === p.match_index);
    return {
      matchIndex: p.match_index as number,
      matchLabel: match ? `Wk ${match.week}: ${match.team1} vs ${match.team2}` : `Match ${p.match_index}`,
      displayName: (profile?.display_name as string) ?? '',
      username: (profile?.username as string) ?? '',
      pickedTeam: p.picked_team as string,
      diffBand: p.diff_band as string,
      pointsEarned: p.points_earned as number,
      resolved: !!p.resolved_at,
    };
  });

  return <AdminClient matches={upcomingMatchList} picks={picks} dbError={dbError} />;
}
