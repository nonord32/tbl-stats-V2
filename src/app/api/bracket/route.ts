// src/app/api/bracket/route.ts
// Read/write the signed-in user's Bracket Challenge entry. Entries lock 1.5h
// after the first playoff game starts; the server re-derives the lock time on
// every write so a client clock can't bypass it. The stored prediction is
// validated to be a consistent chain (SF winners come from the user's QF
// winners; the champion comes from the SF winners) and to reference only the
// eight locked seeds.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAllData } from '@/lib/data';
import { getBracketContext } from '@/lib/bracketData';
import { isBracketOpen } from '@/lib/bracketLock';

const SF_SOURCES: Record<number, [number, number]> = { 0: [0, 1], 1: [2, 3] };

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: entry, error } = await supabase
    .from('bracket_entries')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entry: entry ?? null });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: {
    qf_winners?: unknown;
    sf_winners?: unknown;
    champion?: unknown;
    final_total?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Normalise input into fixed-length slug arrays / scalar.
  const asSlug = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
  const qf = [0, 1, 2, 3].map((i) => asSlug((body.qf_winners as unknown[])?.[i]));
  const sf = [0, 1].map((i) => asSlug((body.sf_winners as unknown[])?.[i]));
  const champion = asSlug(body.champion);
  let finalTotal: number | null = null;
  if (body.final_total != null && body.final_total !== '') {
    const n = Number(body.final_total);
    if (!Number.isFinite(n) || n < 0 || n > 999) {
      return NextResponse.json({ error: 'Invalid final score' }, { status: 400 });
    }
    finalTotal = Math.round(n);
  }

  // Entries must still be open. Re-derive the lock time server-side.
  const sheetData = await getAllData();
  const { seeds, lockTime } = getBracketContext(sheetData);
  if (!isBracketOpen(lockTime)) {
    return NextResponse.json(
      { error: 'The Bracket Challenge is locked — entries closed after the first playoff game.' },
      { status: 403 }
    );
  }

  // Every provided winner must be one of the eight locked seeds.
  const validSlugs = new Set(seeds.map((s) => s.team.slug));
  for (const slug of [...qf, ...sf, champion]) {
    if (slug && !validSlugs.has(slug)) {
      return NextResponse.json({ error: `Unknown team: ${slug}` }, { status: 400 });
    }
  }

  // The prediction must be a valid chain: an SF winner must be one of the two
  // QF winners feeding it; the champion must be one of the two SF winners.
  for (const sfi of [0, 1] as const) {
    if (!sf[sfi]) continue;
    const [a, b] = SF_SOURCES[sfi];
    if (![qf[a], qf[b]].includes(sf[sfi])) {
      return NextResponse.json(
        { error: 'Semifinal pick must be one of your quarterfinal winners' },
        { status: 400 }
      );
    }
  }
  if (champion && ![sf[0], sf[1]].includes(champion)) {
    return NextResponse.json(
      { error: 'Champion must be one of your semifinal winners' },
      { status: 400 }
    );
  }

  // Ensure a profile row exists (handles users created before the DB trigger).
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single();
  if (!existingProfile) {
    const baseUsername =
      user.user_metadata?.preferred_username ?? user.email?.split('@')[0] ?? 'user';
    await supabase.from('profiles').insert({
      id: user.id,
      username: `${baseUsername}_${user.id.slice(0, 6)}`,
      display_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? baseUsername,
    });
  }

  const { data: entry, error } = await supabase
    .from('bracket_entries')
    .upsert(
      {
        user_id: user.id,
        qf_winners: qf,
        sf_winners: sf,
        champion: champion || null,
        final_total: finalTotal,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entry });
}
