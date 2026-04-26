// src/app/api/fantasy/score/route.ts
// Admin-gated weekly fantasy resolution. Walks every fantasy_weeks row
// for a given week, scores both starter sets via scoreLineup, and writes
// user_points / opponent_points / resolved_at. Idempotent — safe to
// re-run after sheet corrections (the row just gets overwritten).
import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getAllData } from '@/lib/data';
import { scoreLineup } from '@/lib/fantasyData';

export async function POST(request: Request) {
  // Admin auth check — same RESOLVE_SECRET bearer the picks resolver uses.
  const authHeader = request.headers.get('Authorization');
  const secret = process.env.RESOLVE_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { week?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const week = typeof body.week === 'number' ? body.week : Number(body.week);
  if (!Number.isFinite(week) || week <= 0) {
    return NextResponse.json({ error: 'week (number) required' }, { status: 400 });
  }

  // Service-role client so we bypass RLS to read every user's row.
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Pull all fantasy_weeks rows for this week (every user's lineup).
  const { data: weekRows, error: fetchError } = await supabase
    .from('fantasy_weeks')
    .select('id, user_id, starter_slugs, opponent_starter_slugs')
    .eq('week', week);
  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!weekRows || weekRows.length === 0) {
    return NextResponse.json({ message: 'No fantasy weeks found', resolved: 0 });
  }

  // Source of truth for fighter histories + week mapping comes from the
  // sheet data layer, not Supabase.
  const data = await getAllData();
  // Re-derive a FantasyFighter-shaped pool the same way fantasyData does.
  // (We don't need projected/owned/etc. for scoring — only id + name —
  // so a slim shape would do, but reusing the full pool keeps the helper
  // signature consistent.)
  const minimalPool = data.fighters.map((f) => ({
    id: f.slug,
    name: f.name,
    team: f.team,
    city: f.team,
    weightClass: f.weightClass,
    gender: (f.gender === 'Female' ? 'Female' : 'Male') as 'Female' | 'Male',
    projected: 0,
    avg: 0,
    owned: 0,
    status: 'active' as const,
  }));

  const matchIndexToWeek = new Map<number, number>();
  data.schedule.forEach((s) => {
    if (s.matchIndex != null) matchIndexToWeek.set(s.matchIndex, Number(s.week));
  });

  let resolved = 0;
  const now = new Date().toISOString();
  for (const row of weekRows) {
    const userScore = scoreLineup(
      (row.starter_slugs as string[]) ?? [],
      minimalPool,
      data.fighterHistory,
      matchIndexToWeek,
      week
    );
    const oppScore = scoreLineup(
      (row.opponent_starter_slugs as string[]) ?? [],
      minimalPool,
      data.fighterHistory,
      matchIndexToWeek,
      week
    );
    const upd = await supabase
      .from('fantasy_weeks')
      .update({
        user_points: userScore.total,
        opponent_points: oppScore.total,
        resolved_at: now,
      })
      .eq('id', row.id);
    if (!upd.error) resolved += 1;
  }

  return NextResponse.json({
    message: `Resolved ${resolved}/${weekRows.length} fantasy lineups for week ${week}`,
    resolved,
    total: weekRows.length,
    week,
  });
}
