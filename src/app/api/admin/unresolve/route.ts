// src/app/api/admin/unresolve/route.ts
// Admin-only: clears resolution for every pick on a match so they can be
// re-resolved after a sheet score is corrected. Uses the same RESOLVE_SECRET
// bearer token as /api/resolve and the service role client to bypass RLS.
import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization');
  const secret = process.env.RESOLVE_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { match_index?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { match_index } = body;
  if (match_index === undefined) {
    return NextResponse.json({ error: 'Missing match_index' }, { status: 400 });
  }

  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('picks')
    .update({
      is_correct_winner: null,
      is_correct_band: null,
      points_earned: 0,
      resolved_at: null,
    })
    .eq('match_index', match_index)
    .not('resolved_at', 'is', null)
    .select('id');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const unresolved = data?.length ?? 0;
  return NextResponse.json({
    message: `Unresolved ${unresolved} picks for match ${match_index}`,
    unresolved,
  });
}
