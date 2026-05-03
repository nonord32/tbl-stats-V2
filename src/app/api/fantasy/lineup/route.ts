// src/app/api/fantasy/lineup/route.ts
// Update the user's starting 7 for a given fantasy week. Lock is now
// PER-FIGHTER, not whole-lineup: a slot is rejected only if the fighter
// being removed OR the fighter being added has already kicked off their
// match this week. Fighters who haven't fought yet are still swappable.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeGetUser } from '@/lib/supabase/safe';
import { getAllData } from '@/lib/data';
import { getGameStartUTC } from '@/lib/gameTime';

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

  const existing = await supabase
    .from('fantasy_weeks')
    .select('id, starter_slugs, resolved_at')
    .eq('user_id', user.id)
    .eq('week', week)
    .maybeSingle();

  if (existing.error || !existing.data) {
    return NextResponse.json({ error: 'No fantasy week found — load /fantasy/team first' }, { status: 404 });
  }
  if (existing.data.resolved_at) {
    return NextResponse.json({ error: 'Week already resolved — lineup is final' }, { status: 403 });
  }

  // Roster ownership check — every starter must be on the user's roster.
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

  // Per-fighter lock: figure out which slots changed, then reject if
  // either side of any swap has already kicked off.
  const oldSlugs = (existing.data.starter_slugs as string[]) ?? [];
  const changed: { oldSlug: string | null; newSlug: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const o = oldSlugs[i] ?? null;
    const n = slugs[i];
    if (o !== n) changed.push({ oldSlug: o, newSlug: n });
  }

  if (changed.length > 0) {
    const sheet = await getAllData();
    const matchStartBySlug = new Map<string, number>();
    // Build slug → match-start UTC ms map (only for fighters whose team
    // plays this week). Fighters with no match this week have no lock.
    const fightersBySlug = new Map(sheet.fighters.map((f) => [f.slug, f]));
    for (const entry of sheet.schedule) {
      if (Number(entry.week) !== week) continue;
      const start = getGameStartUTC(entry.date, entry.time, entry.venueCity);
      if (!start || isNaN(start.getTime())) continue;
      // Both teams' fighters have this kickoff time.
      sheet.fighters.forEach((f) => {
        if (f.team === entry.team1 || f.team === entry.team2) {
          matchStartBySlug.set(f.slug, start.getTime());
        }
      });
    }

    const now = Date.now();
    for (const { oldSlug, newSlug } of changed) {
      // Old fighter (being removed): if their match has started, reject.
      if (oldSlug) {
        const ts = matchStartBySlug.get(oldSlug);
        if (ts !== undefined && ts <= now) {
          const f = fightersBySlug.get(oldSlug);
          return NextResponse.json(
            { error: `${f?.name ?? oldSlug} has already kicked off — can't bench` },
            { status: 403 }
          );
        }
      }
      // New fighter (being started): same rule.
      const tsNew = matchStartBySlug.get(newSlug);
      if (tsNew !== undefined && tsNew <= now) {
        const f = fightersBySlug.get(newSlug);
        return NextResponse.json(
          { error: `${f?.name ?? newSlug} has already kicked off — can't add` },
          { status: 403 }
        );
      }
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
