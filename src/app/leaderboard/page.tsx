// src/app/leaderboard/page.tsx
// Bracket Challenge standings. Reads every entry with the service-role key
// (bypassing RLS, like the old pick'em leaderboard) and scores each one live
// against the playoff results, ranking by points then the combined-final-score
// tiebreaker.
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js';
import { getAllData } from '@/lib/data';
import { getFullTeamName } from '@/lib/teams';
import { getBracketContext } from '@/lib/bracketData';
import { scoreBracketEntry, actualFinalTotal, MAX_BRACKET_POINTS } from '@/lib/bracketScore';
import { safeGetUser, safeQuery } from '@/lib/supabase/safe';
import { LeaderboardClient } from './LeaderboardClient';
import type { BracketEntry, BracketLeaderRow } from '@/types';

export const dynamic = 'force-dynamic';

interface EntryRow {
  user_id: string;
  qf_winners: string[] | null;
  sf_winners: string[] | null;
  champion: string | null;
  final_total: number | null;
  created_at: string;
}
interface ProfileRow {
  id: string;
  display_name: string | null;
  username: string;
}

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const user = await safeGetUser(supabase);

  // Service-role client bypasses RLS to read all entries. Guard construction so
  // a missing env var degrades to empty data rather than crashing.
  let service: SupabaseClient | null = null;
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) service = createServiceClient(url, key);
    else console.error('[leaderboard] service role env vars missing');
  } catch (err) {
    console.error('[leaderboard] service client construction failed:', err);
  }

  const sheetData = await getAllData();
  const { bracket, open: bracketOpen } = getBracketContext(sheetData);

  const [entryRows, profileRows] = await Promise.all([
    service
      ? safeQuery<EntryRow[]>(
          service
            .from('bracket_entries')
            .select('user_id, qf_winners, sf_winners, champion, final_total, created_at'),
          [],
          'leaderboard.bracket.entries'
        )
      : Promise.resolve<EntryRow[]>([]),
    service
      ? safeQuery<ProfileRow[]>(
          service.from('profiles').select('id, display_name, username'),
          [],
          'leaderboard.profiles'
        )
      : Promise.resolve<ProfileRow[]>([]),
  ]);

  const profileMap = new Map(profileRows.map((p) => [p.id, p]));
  const finalTotalActual = actualFinalTotal(bracket);

  const rows: BracketLeaderRow[] = entryRows.map((r) => {
    const entry: BracketEntry = {
      user_id: r.user_id,
      qf_winners: r.qf_winners ?? [],
      sf_winners: r.sf_winners ?? [],
      champion: r.champion,
      final_total: r.final_total,
      created_at: r.created_at,
      updated_at: r.created_at,
    };
    const s = scoreBracketEntry(entry, bracket);
    const profile = profileMap.get(r.user_id);
    const tiebreak_diff =
      finalTotalActual != null && r.final_total != null
        ? Math.abs(r.final_total - finalTotalActual)
        : null;
    return {
      user_id: r.user_id,
      username: profile?.username ?? 'unknown',
      display_name: profile?.display_name ?? null,
      points: s.points,
      qf_correct: s.qfCorrect,
      sf_correct: s.sfCorrect,
      champ_correct: s.champCorrect,
      final_total: r.final_total,
      tiebreak_diff,
      rank: 0,
      // carry created_at for stable ordering, stripped below
      ...( { created_at: r.created_at } as object ),
    } as BracketLeaderRow & { created_at: string };
  });

  // Rank: points desc, then closest tiebreaker (nulls last), then earliest entry.
  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const ad = a.tiebreak_diff;
    const bd = b.tiebreak_diff;
    if (ad != null && bd != null && ad !== bd) return ad - bd;
    if (ad != null && bd == null) return -1;
    if (ad == null && bd != null) return 1;
    const ac = (a as unknown as { created_at: string }).created_at ?? '';
    const bc = (b as unknown as { created_at: string }).created_at ?? '';
    return ac.localeCompare(bc);
  });
  rows.forEach((r, i) => {
    r.rank = i + 1;
  });

  const championName =
    bracket.final.status === 'played' && bracket.championSlug
      ? getFullTeamName(bracket.championSlug)
      : null;

  return (
    <main>
      <LeaderboardClient
        currentUserId={user?.id ?? null}
        entries={rows}
        totalEntrants={rows.length}
        maxPoints={MAX_BRACKET_POINTS}
        championName={championName}
        finalTotalActual={finalTotalActual}
        bracketOpen={bracketOpen}
      />
    </main>
  );
}
