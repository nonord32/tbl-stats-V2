// src/app/api/admin/cards/latest/route.ts
// Compute the four weekly IG card payloads from the live Google Sheet data.
// No auth gate — the underlying Sheet is published publicly, so this
// endpoint only repackages what the rest of the site already shows.
import { NextResponse } from 'next/server';
import { getAllData } from '@/lib/data';
import { getLastCompletedWeek, getDisplayedCurrentWeek } from '@/lib/week';
import {
  computeTopPerformersByWeek,
  computeHotStreak,
  computeFinishRates,
  computeFeaturedMatchup,
} from '@/lib/cards';

export const dynamic = 'force-dynamic';

const DEFAULT_CARD1_COUNT = 6;

export async function GET() {
  const data = await getAllData();
  const { fighters, fighterHistory, schedule } = data;

  const completed = getLastCompletedWeek(schedule);
  const upcoming = getDisplayedCurrentWeek(schedule);

  const { byWeek: topPerformersByWeek, weeks: availableWeeks } =
    computeTopPerformersByWeek(fighters, fighterHistory, schedule);

  // Prefer the most recent week with actual fight data; fall back to the
  // last-completed/upcoming heuristics, then to 1.
  const week =
    (availableWeeks.length ? availableWeeks[availableWeeks.length - 1] : null) ??
    completed ??
    upcoming ??
    1;

  const card1 = {
    week,
    fighters: (topPerformersByWeek[week] || []).slice(0, DEFAULT_CARD1_COUNT),
  };
  const card2 = computeHotStreak(fighters, fighterHistory);
  const card3 = computeFinishRates(fighters, fighterHistory);
  const card4 = computeFeaturedMatchup(fighters, fighterHistory, schedule, week);

  return NextResponse.json({
    week,
    card1,
    card2,
    card3,
    card4,
    topPerformersByWeek,
    availableWeeks,
    card1Count: DEFAULT_CARD1_COUNT,
  });
}
