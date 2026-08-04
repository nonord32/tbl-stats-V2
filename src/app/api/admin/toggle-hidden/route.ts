// src/app/api/admin/toggle-hidden/route.ts
// Admin-only: sets the `hidden` flag on a player's profile so they can be
// shown or hidden from the public leaderboard. Authenticated with the same
// RESOLVE_SECRET bearer token as the other admin routes and uses the service
// role client to bypass RLS.
import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization');
  const secret = process.env.RESOLVE_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { user_id?: string; hidden?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { user_id, hidden } = body;
  if (!user_id || typeof hidden !== 'boolean') {
    return NextResponse.json(
      { error: 'Missing user_id or hidden flag' },
      { status: 400 }
    );
  }

  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabase
    .from('profiles')
    .update({ hidden })
    .eq('id', user_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, user_id, hidden });
}
