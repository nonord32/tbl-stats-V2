// src/app/api/admin/delete-pick/route.ts
// Admin-only deletion of a single pick by (user_id, match_index).
// Authenticated with the same RESOLVE_SECRET used by /api/resolve so the
// admin UI's bearer token works for both. Uses the service role client to
// bypass RLS.
import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization');
  const secret = process.env.RESOLVE_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { user_id?: string; match_index?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { user_id, match_index } = body;
  if (!user_id || match_index === undefined) {
    return NextResponse.json(
      { error: 'Missing user_id or match_index' },
      { status: 400 }
    );
  }

  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error, count } = await supabase
    .from('picks')
    .delete({ count: 'exact' })
    .eq('user_id', user_id)
    .eq('match_index', match_index);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deleted: count ?? 0 });
}
