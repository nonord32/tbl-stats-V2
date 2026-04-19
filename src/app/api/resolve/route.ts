// src/app/api/resolve/route.ts
import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getAllData, extractUniqueMatches } from '@/lib/data';
import type { DiffBand } from '@/types';

function scoreToBand(diff: number): DiffBand {
  if (diff <= 2) return 'close';
  if (diff <= 5) return 'medium';
  if (diff <= 9) return 'comfortable';
  return 'dominant';
}

function bandPoints(band: DiffBand): number {
  switch (band) {
    case 'close': return 5;
    case 'medium': return 4;
    case 'comfortable': return 3;
    case 'dominant': return 2;
  }
}

export async function POST(request: Request) {
  // Admin auth check
  const authHeader = request.headers.get('Authorization');
  const secret = process.env.RESOLVE_SECRET;

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { match_index: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { match_index } = body;
  if (match_index === undefined) {
    return NextResponse.json({ error: 'Missing match_index' }, { status: 400 });
  }

  // Get match result from sheet data
  const sheetData = await getAllData();
  const uniqueMatches = extractUniqueMatches(sheetData.teamMatches);
  const match = uniqueMatches.find((m) => m.matchIndex === match_index);

  if (!match) {
    return NextResponse.json({ error: `Match ${match_index} not found in results` }, { status: 404 });
  }

  const diff = Math.abs(match.score1 - match.score2);
  const actualBand = scoreToBand(diff);

  // Determine actual winner team name (team1 perspective, result 'W' means team1 won)
  const actualWinner = match.result === 'W' ? match.team1 : match.team2;

  // Use service role client for admin operations (bypasses RLS)
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch all picks for this match
  const { data: picks, error: fetchError } = await supabase
    .from('picks')
    .select('*')
    .eq('match_index', match_index)
    .is('resolved_at', null);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!picks || picks.length === 0) {
    return NextResponse.json({ message: 'No unresolved picks for this match', resolved: 0 });
  }

  const now = new Date().toISOString();
  let resolved = 0;

  for (const pick of picks) {
    const isCorrectWinner = pick.picked_team === actualWinner;
    const isCorrectBand = pick.diff_band === actualBand;

    let pointsEarned = 0;
    if (isCorrectWinner) {
      if (isCorrectBand) {
        pointsEarned = bandPoints(actualBand);
      } else {
        pointsEarned = 1;
      }
    }

    const { error: updateError } = await supabase
      .from('picks')
      .update({
        is_correct_winner: isCorrectWinner,
        is_correct_band: isCorrectBand,
        points_earned: pointsEarned,
        resolved_at: now,
      })
      .eq('id', pick.id);

    if (!updateError) {
      resolved++;
    }
  }

  return NextResponse.json({
    message: `Resolved ${resolved} picks for match ${match_index}`,
    resolved,
    actualWinner,
    actualBand,
    diff,
    score1: match.score1,
    score2: match.score2,
  });
}
