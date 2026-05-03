// src/app/api/fantasy/team-name/route.ts
// Update the user's fantasy team name (display label only).
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeGetUser } from '@/lib/supabase/safe';

const MAX_LEN = 32;

export async function POST(request: Request) {
  const supabase = await createClient();
  const user = await safeGetUser(supabase);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { team_name?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const raw = typeof body.team_name === 'string' ? body.team_name : '';
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (trimmed.length === 0) {
    return NextResponse.json({ error: 'team_name required' }, { status: 400 });
  }
  if (trimmed.length > MAX_LEN) {
    return NextResponse.json(
      { error: `team_name must be ${MAX_LEN} chars or fewer` },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from('fantasy_rosters')
    .update({ team_name: trimmed, updated_at: new Date().toISOString() })
    .eq('user_id', user.id);

  if (error) {
    console.error('[fantasy/team-name] update failed', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, team_name: trimmed });
}
