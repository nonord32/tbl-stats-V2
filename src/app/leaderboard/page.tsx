// src/app/leaderboard/page.tsx
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js';
import { getAllData } from '@/lib/data';
import { ensureResolved } from '@/lib/resolve-on-read';
import { safeGetUser, safeQuery } from '@/lib/supabase/safe';
import { getDisplayedCurrentWeek, getLastCompletedWeek, scheduleForWeek } from '@/lib/week';
import { LeaderboardClient, type LeaderRow, type ThisWeekMatchup } from './LeaderboardClient';

export const dynamic = 'force-dynamic';

interface PickRow {
  user_id: string;
  match_index: number;
  picked_team: string | null;
  diff_band: string | null;
  points_earned: number | null;
  resolved_at: string | null;
}
interface ProfileRow {
  id: string;
  display_name: string | null;
  username: string;
}

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const user = await safeGetUser(supabase);

  // Service role client bypasses RLS to see all picks. Guard construction so a
  // missing env var doesn't crash — fall back to empty data.
  let service: SupabaseClient | null = null;
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      service = createServiceClient(url, key);
    } else {
      console.error('[leaderboard] service role env vars missing');
    }
  } catch (err) {
    console.error('[leaderboard] service client construction failed:', err);
  }

  const sheetData = await getAllData();
  await ensureResolved(sheetData);

  const [resolvedPicks, allPicks, profilesData] = await Promise.all([
    service
      ? safeQuery<PickRow[]>(
          service
            .from('picks')
            .select('user_id, match_index, picked_team, diff_band, points_earned, resolved_at')
            .not('resolved_at', 'is', null),
          [],
          'leaderboard.picks.resolved'
        )
      : Promise.resolve<PickRow[]>([]),
    service
      ? safeQuery<PickRow[]>(
          service
            .from('picks')
            .select('user_id, match_index, picked_team, diff_band, points_earned, resolved_at'),
          [],
          'leaderboard.picks.all'
        )
      : Promise.resolve<PickRow[]>([]),
    service
      ? safeQuery<ProfileRow[]>(
          service.from('profiles').select('id, display_name, username'),
          [],
          'leaderboard.profiles'
        )
      : Promise.resolve<ProfileRow[]>([]),
  ]);

  const profileMap = new Map(
    profilesData.map((p) => [p.id, p as ProfileRow])
  );

  // matchIndex → week mapping from the schedule.
  const matchWeekMap: Record<number, number> = {};
  sheetData.schedule.forEach((s) => {
    if (s.matchIndex) matchWeekMap[s.matchIndex] = Number(s.week);
  });

  const resolvedWeeks = Array.from(
    new Set(
      resolvedPicks
        .map((p) => matchWeekMap[p.match_index])
        .filter((w): w is number => w !== undefined && !isNaN(w))
    )
  ).sort((a, b) => a - b);

  interface WeekEntry {
    user_id: string;
    display_name: string | null;
    username: string;
    total_picks: number;
    total_points: number;
    correct_winners: number;
    exact_picks: number;
  }

  const weekData: Record<number, Record<string, WeekEntry>> = {};
  const allTimeData: Record<string, WeekEntry> = {};

  function ensureWeek(map: Record<string, WeekEntry>, uid: string, profile: ProfileRow | undefined) {
    if (!map[uid]) {
      map[uid] = {
        user_id: uid,
        display_name: profile?.display_name ?? null,
        username: profile?.username ?? 'unknown',
        total_picks: 0,
        total_points: 0,
        correct_winners: 0,
        exact_picks: 0,
      };
    }
    return map[uid];
  }

  resolvedPicks.forEach((p) => {
    const uid = p.user_id;
    const profile = profileMap.get(uid);
    const pts = p.points_earned ?? 0;
    const week = matchWeekMap[p.match_index];
    const correct = pts > 0;
    const exact = pts >= 2;

    const all = ensureWeek(allTimeData, uid, profile);
    all.total_picks++;
    all.total_points += pts;
    if (correct) all.correct_winners++;
    if (exact) all.exact_picks++;

    if (week !== undefined && !isNaN(week)) {
      if (!weekData[week]) weekData[week] = {};
      const w = ensureWeek(weekData[week], uid, profile);
      w.total_picks++;
      w.total_points += pts;
      if (correct) w.correct_winners++;
      if (exact) w.exact_picks++;
    }
  });

  type DecoratedEntry = WeekEntry & { win_pct: number | null };
  function decorate(entries: WeekEntry[]): DecoratedEntry[] {
    return entries
      .map((e) => ({
        ...e,
        win_pct:
          e.total_picks > 0
            ? Math.round((e.correct_winners / e.total_picks) * 1000) / 10
            : null,
      }))
      .sort((a, b) => b.total_points - a.total_points || b.exact_picks - a.exact_picks);
  }

  // For each user, compute streak ("W3" / "L1") from their per-week win%
  // and the trend (rank delta vs the previous week's cumulative ranking).
  const sortedWeeks = [...resolvedWeeks].sort((a, b) => a - b);

  // Build per-user weekly totals (chronological).
  const userWeekly: Record<string, { week: number; pts: number; picks: number; wins: number }[]> = {};
  sortedWeeks.forEach((wk) => {
    Object.values(weekData[wk] ?? {}).forEach((e) => {
      if (!userWeekly[e.user_id]) userWeekly[e.user_id] = [];
      userWeekly[e.user_id].push({
        week: wk,
        pts: e.total_points,
        picks: e.total_picks,
        wins: e.correct_winners,
      });
    });
  });

  // Streak from the tail end of the user's weekly history. A "win" week =
  // got more picks right than wrong (>= 50%). Counts how many trailing weeks
  // share the same outcome.
  function streakOf(uid: string): { kind: 'W' | 'L' | null; count: number } {
    const list = userWeekly[uid];
    if (!list || list.length === 0) return { kind: null, count: 0 };
    const ordered = [...list].sort((a, b) => b.week - a.week);
    const isWin = (w: { picks: number; wins: number }) =>
      w.picks > 0 && w.wins / w.picks >= 0.5;
    const first = ordered[0];
    if (first.picks === 0) return { kind: null, count: 0 };
    const kind: 'W' | 'L' = isWin(first) ? 'W' : 'L';
    let count = 0;
    for (const w of ordered) {
      if (w.picks === 0) continue;
      if ((isWin(w) ? 'W' : 'L') !== kind) break;
      count++;
    }
    return { kind, count };
  }

  // Cumulative standings up to (and including) a given week. Used to compute
  // last-week rank for the trend column.
  function cumulativeRanksThrough(weekLimit: number | null): Map<string, number> {
    const acc: Record<string, number> = {};
    sortedWeeks.forEach((wk) => {
      if (weekLimit !== null && wk > weekLimit) return;
      Object.values(weekData[wk] ?? {}).forEach((e) => {
        acc[e.user_id] = (acc[e.user_id] ?? 0) + e.total_points;
      });
    });
    const sorted = Object.entries(acc).sort((a, b) => b[1] - a[1]);
    const ranks = new Map<string, number>();
    sorted.forEach(([uid], i) => ranks.set(uid, i + 1));
    return ranks;
  }

  const lastWeek = sortedWeeks.length >= 2 ? sortedWeeks[sortedWeeks.length - 2] : null;
  const previousRanks = cumulativeRanksThrough(lastWeek);

  const allTimeBase = decorate(Object.values(allTimeData));
  const allTimeEntries: LeaderRow[] = allTimeBase.map((e, idx) => {
    const rank = idx + 1;
    const prev = previousRanks.get(e.user_id);
    const trend = prev != null ? prev - rank : null; // positive = climbed
    const last = userWeekly[e.user_id]?.slice(-1)[0];
    const s = streakOf(e.user_id);
    return {
      ...e,
      rank,
      trend,
      streak_kind: s.kind,
      streak_count: s.count,
      last_week_points: last?.pts ?? 0,
    };
  });

  const weekEntries: Record<number, LeaderRow[]> = {};
  sortedWeeks.forEach((wk) => {
    const list = decorate(Object.values(weekData[wk] ?? {}));
    weekEntries[wk] = list.map((e, idx) => ({
      ...e,
      rank: idx + 1,
      trend: null,
      streak_kind: null,
      streak_count: 0,
      last_week_points: e.total_points,
    }));
  });

  // ── This week's picks panel ────────────────────────────────────────────────
  // Prefer the displayed current pick'em week, fall back to the last
  // completed week so the panel never goes empty mid-season.
  const thisWeek =
    getDisplayedCurrentWeek(sheetData.schedule) ??
    getLastCompletedWeek(sheetData.schedule);

  const thisWeekSchedule = thisWeek ? scheduleForWeek(sheetData.schedule, thisWeek) : [];

  // Map matchIndex → score (for completed matches we can show the result).
  const matchScores = new Map<number, { s1: number; s2: number }>();
  Object.values(sheetData.teamMatches).forEach((arr) => {
    arr.forEach((m) => {
      if (m.matchIndex != null && !matchScores.has(m.matchIndex)) {
        matchScores.set(m.matchIndex, { s1: m.pf, s2: m.pa });
      }
    });
  });

  const myPicksByMatch = new Map<number, PickRow>();
  if (user) {
    allPicks
      .filter((p) => p.user_id === user.id)
      .forEach((p) => myPicksByMatch.set(p.match_index, p));
  }

  const thisWeekMatchups: ThisWeekMatchup[] = thisWeekSchedule
    .filter((s) => s.matchIndex != null)
    .map((s) => {
      const myPick = myPicksByMatch.get(s.matchIndex as number);
      const score = matchScores.get(s.matchIndex as number) ?? null;
      return {
        matchIndex: s.matchIndex as number,
        team1: s.team1,
        team2: s.team2,
        status: s.status,
        date: s.date,
        time: s.time,
        pickedTeam: myPick?.picked_team ?? null,
        pointsEarned: myPick?.points_earned ?? null,
        resolved: !!myPick?.resolved_at,
        team1Score: score?.s1 ?? null,
        team2Score: score?.s2 ?? null,
      };
    });

  return (
    <main>
      <LeaderboardClient
        currentUserId={user?.id ?? null}
        allTimeEntries={allTimeEntries}
        weekEntries={weekEntries}
        resolvedWeeks={sortedWeeks}
        thisWeek={thisWeek}
        thisWeekMatchups={thisWeekMatchups}
        totalEntrants={allTimeEntries.length}
      />
    </main>
  );
}
