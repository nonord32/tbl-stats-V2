// src/app/admin/page.tsx
import { getAllData, extractUniqueMatches } from '@/lib/data';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { AdminClient } from './AdminClient';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const sheetData = await getAllData();
  const uniqueMatches = extractUniqueMatches(sheetData.teamMatches);
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

  // Fetch all picks with profile info using service role (bypasses RLS)
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: picksData } = await supabase
    .from('picks')
    .select('match_index, picked_team, diff_band, points_earned, resolved_at, profiles(display_name, username)')
    .order('match_index', { ascending: true });

  // Attach match label to each pick
  const picks = (picksData ?? []).map((p) => {
    const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
    const match = matchList.find((m) => m.matchIndex === p.match_index);
    return {
      matchIndex: p.match_index as number,
      matchLabel: match ? `Wk ${match.week}: ${match.team1} vs ${match.team2}` : `Match ${p.match_index}`,
      displayName: (profile as { display_name: string | null; username: string | null } | null)?.display_name ?? '',
      username: (profile as { display_name: string | null; username: string | null } | null)?.username ?? '',
      pickedTeam: p.picked_team as string,
      diffBand: p.diff_band as string,
      pointsEarned: p.points_earned as number,
      resolved: !!p.resolved_at,
    };
  });

  return <AdminClient matches={matchList} picks={picks} />;
}
