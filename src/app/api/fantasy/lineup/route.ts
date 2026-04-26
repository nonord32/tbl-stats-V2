// src/app/api/fantasy/lineup/route.ts
// Update the user's starting 7 for a given fantasy week. Rejected once
// the week has locked (locks_at = first kickoff of the week).
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeGetUser } from '@/lib/supabase/safe';

export async function POST(request: Request) {
  const supabase = await createClient();
  const user = await safeGetUser(supabase);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { week?: unknown; starter_slugs?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const week = typeof body.week === 'number' ? body.week : Number(body.week);
  const slugs = Array.isArray(body.starter_slugs)
    ? body.starter_slugs.filter((s): s is string => typeof s === 'string' && s.length > 0)
    : null;
  if (!Number.isFinite(week) || week <= 0) {
    return NextResponse.json({ error: 'week (number) required' }, { status: 400 });
  }
  if (!slugs || slugs.length !== 7) {
    return NextResponse.json(
      { error: 'starter_slugs must be a length-7 string[]' },
      { status: 400 }
    );
  }

  // Look up the row; we need locks_at + ownership for sanity.
  const existing = await supabase
    .from('fantasy_weeks')
    .select('id, locks_at, resolved_at')
    .eq('user_id', user.id)
    .eq('week', week)
    .maybeSingle();

  if (existing.error || !existing.data) {
    return NextResponse.json({ error: 'No fantasy week found — load /fantasy/team first' }, { status: 404 });
  }
  if (existing.data.resolved_at) {
    return NextResponse.json({ error: 'Week already resolved — lineup is final' }, { status: 403 });
  }
  if (new Date(existing.data.locks_at as string).getTime() <= Date.now()) {
    return NextResponse.json({ error: 'Lineup locked — first kickoff has passed' }, { status: 403 });
  }

  // Confirm every starter slug is on the user's roster (no smuggling
  // free agents into your lineup via crafted requests).
  const roster = await supabase
    .from('fantasy_rosters')
    .select('fighter_slugs')
    .eq('user_id', user.id)
    .maybeSingle();
  const ownedSlugs = new Set<string>(
    Array.isArray(roster.data?.fighter_slugs) ? (roster.data!.fighter_slugs as string[]) : []
  );
  for (const s of slugs) {
    if (!ownedSlugs.has(s)) {
      return NextResponse.json(
        { error: `Fighter not on your roster: ${s}` },
        { status: 400 }
      );
    }
  }

  const { error } = await supabase
    .from('fantasy_weeks')
    .update({ starter_slugs: slugs })
    .eq('id', existing.data.id);

  if (error) {
    console.error('[fantasy/lineup] update failed', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
