// src/app/api/fantasy/draft/route.ts
// Persist a user's drafted roster (the array of fighter slugs they came
// out of /fantasy/draft with). Idempotent — drafting again overwrites.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeGetUser } from '@/lib/supabase/safe';

export async function POST(request: Request) {
  const supabase = await createClient();
  const user = await safeGetUser(supabase);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { fighter_slugs?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const slugs = Array.isArray(body.fighter_slugs)
    ? body.fighter_slugs.filter((s): s is string => typeof s === 'string' && s.length > 0)
    : null;
  if (!slugs || slugs.length === 0) {
    return NextResponse.json({ error: 'fighter_slugs (string[]) required' }, { status: 400 });
  }

  const { error } = await supabase
    .from('fantasy_rosters')
    .upsert(
      {
        user_id: user.id,
        fighter_slugs: slugs,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

  if (error) {
    console.error('[fantasy/draft] upsert failed', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Wipe any pre-existing fantasy_weeks so the new roster takes effect on
  // the next /fantasy/team load. Otherwise lineups from the previous draft
  // would still point at fighters this user no longer owns.
  await supabase.from('fantasy_weeks').delete().eq('user_id', user.id);

  return NextResponse.json({ ok: true, count: slugs.length });
}
