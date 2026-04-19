// src/app/leaderboard/page.tsx
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { getAllData } from '@/lib/data';
import { LeaderboardClient } from './LeaderboardClient';

export const dynamic = 'force-dynamic';

export default async function LeaderboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Use service role to bypass RLS and see all picks
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch all resolved picks + profiles
  const [picksRes, profilesRes, sheetData] = await Promise.all([
    service
      .from('picks')
      .select('user_id, match_index, points_earned, resolved_at')
      .not('resolved_at', 'is', null),
    service.from('profiles').select('id, display_name, username'),
    getAllData(),
  ]);

  const profileMap = new Map(
    (profilesRes.data ?? []).map((p) => [p.id as string, p as { id: string; display_name: string | null; username: string }])
  );

  // Build matchIndex → week mapping from schedule
  const matchWeekMap: Record<number, number> = {};
  sheetData.schedule.forEach((s) => {
    if (s.matchIndex) matchWeekMap[s.matchIndex] = Number(s.week);
  });

  // All unique weeks that have resolved picks
  const resolvedWeeks = Array.from(
    new Set(
      (picksRes.data ?? [])
        .map((p) => matchWeekMap[p.match_index as number])
        .filter((w) => w !== undefined && !isNaN(w))
    )
  ).sort((a, b) => a - b);

  // Aggregate per user per week
  interface WeekEntry {
    user_id: string;
    display_name: string | null;
    username: string;
    total_picks: number;
    total_points: number;
    correct_winners: number;
    exact_picks: number;
  }

  // weekData[week][user_id] = WeekEntry
  const weekData: Record<number, Record<string, WeekEntry>> = {};
  const allTimeData: Record<string, WeekEntry> = {};

  (picksRes.data ?? []).forEach((p) => {
    const uid = p.user_id as string;
    const profile = profileMap.get(uid);
    const displayName = profile?.display_name ?? null;
    const username = profile?.username ?? 'unknown';
    const pts = (p.points_earned as number) ?? 0;
    const week = matchWeekMap[p.match_index as number];
    const correct = pts > 0;
    const exact = pts >= 2;

    // All-time
    if (!allTimeData[uid]) {
      allTimeData[uid] = { user_id: uid, display_name: displayName, username, total_picks: 0, total_points: 0, correct_winners: 0, exact_picks: 0 };
    }
    allTimeData[uid].total_picks++;
    allTimeData[uid].total_points += pts;
    if (correct) allTimeData[uid].correct_winners++;
    if (exact) allTimeData[uid].exact_picks++;

    // Per-week
    if (week !== undefined && !isNaN(week)) {
      if (!weekData[week]) weekData[week] = {};
      if (!weekData[week][uid]) {
        weekData[week][uid] = { user_id: uid, display_name: displayName, username, total_picks: 0, total_points: 0, correct_winners: 0, exact_picks: 0 };
      }
      weekData[week][uid].total_picks++;
      weekData[week][uid].total_points += pts;
      if (correct) weekData[week][uid].correct_winners++;
      if (exact) weekData[week][uid].exact_picks++;
    }
  });

  function toSorted(agg: Record<string, WeekEntry>) {
    return Object.values(agg)
      .map((e) => ({
        ...e,
        win_pct: e.total_picks > 0 ? Math.round((e.correct_winners / e.total_picks) * 1000) / 10 : null,
      }))
      .sort((a, b) => b.total_points - a.total_points || b.exact_picks - a.exact_picks);
  }

  const allTimeEntries = toSorted(allTimeData);
  const weekEntries: Record<number, ReturnType<typeof toSorted>> = {};
  resolvedWeeks.forEach((w) => {
    weekEntries[w] = toSorted(weekData[w] ?? {});
  });

  return (
    <main>
      <div className="page container">
        <div className="page-header">
          <h1>Leaderboard</h1>
          <p className="subtitle">2026 TBL Season Pick&apos;em</p>
        </div>

        {/* Picks CTA — always visible on mobile */}
        <Link href="/picks" style={{ textDecoration: 'none', display: 'block', marginBottom: 24 }}>
          <div style={{
            background: 'linear-gradient(135deg, #1a0a00 0%, #2d1200 60%, #1a0a00 100%)',
            border: '1px solid rgba(230,60,0,0.4)',
            borderRadius: 'var(--radius)',
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <path d="M9 12l2 2 4-4"/>
              </svg>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: '#fff' }}>
                Make your picks for Week 5
              </span>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent)', fontWeight: 700, whiteSpace: 'nowrap' }}>
              Pick now →
            </span>
          </div>
        </Link>

        <LeaderboardClient
          currentUserId={user?.id ?? null}
          allTimeEntries={allTimeEntries}
          weekEntries={weekEntries}
          resolvedWeeks={resolvedWeeks}
        />
      </div>
    </main>
  );
}
