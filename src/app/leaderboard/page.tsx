// src/app/leaderboard/page.tsx
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { LeaderboardEntry } from '@/types';

export const dynamic = 'force-dynamic';

export default async function LeaderboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Try the leaderboard view first, fall back to manual aggregation
  let entries: LeaderboardEntry[] = [];
  let fetchError = false;

  const { data: viewData, error: viewError } = await supabase
    .from('leaderboard')
    .select('*')
    .order('total_points', { ascending: false });

  if (!viewError && viewData) {
    entries = viewData as LeaderboardEntry[];
  } else {
    // Manual fallback: join picks + profiles
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('picks')
      .select('user_id, points_earned, is_correct_winner, is_correct_band, resolved_at, profiles(username, display_name)')
      .not('resolved_at', 'is', null);

    if (fallbackError) {
      fetchError = true;
    } else {
      // Aggregate manually
      const agg: Record<string, LeaderboardEntry> = {};

      (fallbackData ?? []).forEach((row) => {
        const uid = row.user_id as string;
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        const username = (profile as { username: string; display_name: string | null } | null)?.username ?? 'unknown';
        const displayName = (profile as { username: string; display_name: string | null } | null)?.display_name ?? null;

        if (!agg[uid]) {
          agg[uid] = {
            user_id: uid,
            username,
            display_name: displayName,
            total_picks: 0,
            total_points: 0,
            correct_winners: 0,
            exact_picks: 0,
            win_pct: null,
          };
        }

        agg[uid].total_picks++;
        agg[uid].total_points += (row.points_earned as number) ?? 0;
        if (row.is_correct_winner) agg[uid].correct_winners++;
        if (row.is_correct_winner && row.is_correct_band) agg[uid].exact_picks++;
      });

      entries = Object.values(agg)
        .map((e) => ({
          ...e,
          win_pct: e.total_picks > 0 ? Math.round((e.correct_winners / e.total_picks) * 1000) / 10 : null,
        }))
        .sort((a, b) => b.total_points - a.total_points || b.exact_picks - a.exact_picks);
    }
  }

  const currentUserId = user?.id;

  return (
    <main>
      <div className="page container">
        <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1>Leaderboard</h1>
            <p className="subtitle">2026 TBL Season Pick&apos;em</p>
          </div>
          <Link href="/picks" className="btn btn-outline" style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>
            My Picks
          </Link>
        </div>

        {fetchError && (
          <div className="card" style={{ padding: 20, marginBottom: 24 }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--result-l)' }}>
              Failed to load leaderboard data.
            </p>
          </div>
        )}

        {!fetchError && entries.length === 0 && (
          <div className="card" style={{ padding: 40, textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-muted)' }}>
              No picks have been resolved yet. Check back after the first match.
            </p>
          </div>
        )}

        {!fetchError && entries.length > 0 && (
          <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th className="rank-cell">#</th>
                    <th>User</th>
                    <th className="num-cell">Points</th>
                    <th className="num-cell col-hide-mobile">Correct Wins</th>
                    <th className="num-cell col-hide-mobile">Exact</th>
                    <th className="num-cell">Win%</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, idx) => {
                    const isMe = currentUserId && entry.user_id === currentUserId;
                    return (
                      <tr
                        key={entry.user_id}
                        className={isMe ? 'leaderboard-me' : ''}
                      >
                        <td className="rank-cell">{idx + 1}</td>
                        <td>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: isMe ? 700 : 400, color: isMe ? 'var(--accent)' : 'var(--text)' }}>
                            {entry.display_name || entry.username}
                          </span>
                          {isMe && (
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)', marginLeft: 6, opacity: 0.7 }}>
                              (you)
                            </span>
                          )}
                        </td>
                        <td className="num-cell" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-heading)' }}>
                          {entry.total_points}
                        </td>
                        <td className="num-cell col-hide-mobile" style={{ fontFamily: 'var(--font-mono)' }}>
                          {entry.correct_winners}/{entry.total_picks}
                        </td>
                        <td className="num-cell col-hide-mobile" style={{ fontFamily: 'var(--font-mono)' }}>
                          {entry.exact_picks}
                        </td>
                        <td className="num-cell" style={{ fontFamily: 'var(--font-mono)', color: entry.win_pct !== null && entry.win_pct >= 60 ? 'var(--result-w)' : 'var(--text)' }}>
                          {entry.win_pct !== null ? `${entry.win_pct}%` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
