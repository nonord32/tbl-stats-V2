// src/app/api/admin/cards/latest/route.ts
// Compute the four weekly IG card payloads from the live Google Sheet data.
// No auth gate — the underlying Sheet is published publicly, so this
// endpoint only repackages what the rest of the site already shows.
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

export async function GET() {
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
