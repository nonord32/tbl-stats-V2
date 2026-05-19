// src/app/api/admin/cards/latest/route.ts
// Compute the four weekly IG card payloads from the live Google Sheet data.
// Gated behind the same RESOLVE_SECRET bearer used by the rest of /admin.
import { NextResponse } from 'next/server';
import { getAllData } from '@/lib/data';
import { getLastCompletedWeek, getDisplayedCurrentWeek } from '@/lib/week';
import {
  computeTopPerformers,
  computeHotStreak,
  computeFinishRates,
  computeFeaturedMatchup,
} from '@/lib/cards';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization');
  const secret = process.env.RESOLVE_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const data = await getAllData();
  const { fighters, fighterHistory, schedule } = data;

  const completed = getLastCompletedWeek(schedule);
  const upcoming = getDisplayedCurrentWeek(schedule);
  const week = completed ?? upcoming ?? 1;

  const card1 = computeTopPerformers(fighters, fighterHistory, schedule, week);
  const card2 = computeHotStreak(fighters, fighterHistory);
  const card3 = computeFinishRates(fighters, fighterHistory);
  const card4 = computeFeaturedMatchup(fighters, fighterHistory, schedule, week);

  return NextResponse.json({ week, card1, card2, card3, card4 });
}
