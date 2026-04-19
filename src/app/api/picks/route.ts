// src/app/api/picks/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAllData } from '@/lib/data';
import type { DiffBand } from '@/types';

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: picks, error } = await supabase
    .from('picks')
    .select('*')
    .eq('user_id', user.id)
    .order('match_index', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ picks });
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { match_index: number; picked_team: string; diff_band: DiffBand };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { match_index, picked_team, diff_band } = body;

  if (match_index === undefined || !picked_team || !diff_band) {
    return NextResponse.json({ error: 'Missing required fields: match_index, picked_team, diff_band' }, { status: 400 });
  }

  const validBands: DiffBand[] = ['close', 'medium', 'comfortable', 'dominant'];
  if (!validBands.includes(diff_band)) {
    return NextResponse.json({ error: 'Invalid diff_band' }, { status: 400 });
  }

  // Check match is unlocked (status=Upcoming AND date > today in UTC)
  const sheetData = await getAllData();
  const entry = sheetData.schedule.find((s) => s.matchIndex === match_index);

  if (!entry) {
    return NextResponse.json({ error: 'Match not found in schedule' }, { status: 404 });
  }

  const todayUTC = new Date();
  todayUTC.setUTCHours(0, 0, 0, 0);
  const matchDate = new Date(entry.date);

  const isUpcoming = entry.status === 'Upcoming';
  const isFuture = matchDate >= todayUTC;

  if (!isUpcoming || !isFuture) {
    return NextResponse.json({ error: 'Picks are locked for this match' }, { status: 403 });
  }

  const { data: pick, error } = await supabase
    .from('picks')
    .upsert(
      {
        user_id: user.id,
        match_index,
        picked_team,
        diff_band,
      },
      { onConflict: 'user_id,match_index' }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ pick });
}
