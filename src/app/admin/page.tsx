// src/app/admin/page.tsx
import { getAllData, extractUniqueMatches } from '@/lib/data';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { safeQuery } from '@/lib/supabase/safe';
import { AdminClient } from './AdminClient';

export const dynamic = 'force-dynamic';

interface AdminPickRow {
  user_id: string;
  match_index: number;
  picked_team: string;
  diff_band: string;
  points_earned: number | null;
  resolved_at: string | null;
}
interface AdminProfileRow {
  id: string;
  display_name: string | null;
  username: string | null;
}

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

  // Guard service-role client construction so missing env vars can't crash
  // the page. If the client can't be built, admin renders with empty data
  // and a dbError banner.
  const serviceKeySet = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  let supabase: SupabaseClient | null = null;
  let clientError: string | null = null;
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      clientError = 'Supabase env vars missing (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY).';
    } else {
      supabase = createSupabaseClient(url, key);
    }
  } catch (err) {
    clientError = err instanceof Error ? err.message : String(err);
    console.error('[admin] service client construction failed:', err);
  }

  const [rawPicks, profilesData] = await Promise.all([
    supabase
      ? safeQuery<AdminPickRow[]>(
          supabase
            .from('picks')
            .select('user_id, match_index, picked_team, diff_band, points_earned, resolved_at')
            .order('match_index'),
          [],
          'admin.picks'
        )
      : Promise.resolve<AdminPickRow[]>([]),
    supabase
      ? safeQuery<AdminProfileRow[]>(
          supabase.from('profiles').select('id, display_name, username'),
          [],
          'admin.profiles'
        )
      : Promise.resolve<AdminProfileRow[]>([]),
  ]);

  const dbError = clientError;
  const dbDebug = {
    picksCount: rawPicks.length,
    picksError: null,
    profilesCount: profilesData.length,
    profilesError: null,
    serviceKeySet,
  };
  const profileMap = new Map(profilesData.map((p) => [p.id, p]));

  // Build full match list for label lookup (all matches, not just upcoming)
  const allMatchList = schedule
    .filter((s) => s.matchIndex !== undefined)
    .map((s) => ({ matchIndex: s.matchIndex!, week: s.week, team1: s.team1, team2: s.team2 }));

  const picks = rawPicks.map((p) => {
    const profile = profileMap.get(p.user_id);
    const match = allMatchList.find((m) => m.matchIndex === p.match_index);
    return {
      userId: p.user_id,
      matchIndex: p.match_index,
      matchLabel: match ? `Wk ${match.week}: ${match.team1} vs ${match.team2}` : `Match ${p.match_index}`,
      displayName: profile?.display_name ?? '',
      username: profile?.username ?? '',
      pickedTeam: p.picked_team,
      diffBand: p.diff_band,
      pointsEarned: p.points_earned,
      resolved: !!p.resolved_at,
    };
  });

  return <AdminClient matches={upcomingMatchList} picks={picks} dbError={dbError} dbDebug={dbDebug} />;
}
