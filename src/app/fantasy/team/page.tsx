// src/app/fantasy/team/page.tsx
// Real persisted roster + this week's lineup. Reads fantasy_rosters /
// fantasy_weeks via the fantasyData server helpers; client component
// handles starter swapping with lineup-lock countdown.
//
// Enriches each roster fighter with opponent (this week), season fpts,
// and last-bout fpts for the v2 ESPN-style roster table.
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { safeGetUser } from '@/lib/supabase/safe';
import { getAllData } from '@/lib/data';
import { getCurrentWeek, getDisplayedCurrentWeek } from '@/lib/week';
import { getMyRoster, getOrCreateWeek, methodToPoints } from '@/lib/fantasyData';
import { TeamClient, type RosterFighter } from './TeamClient';

export const dynamic = 'force-dynamic';

export default async function FantasyTeamPage() {
  const supabase = await createClient();
  const user = await safeGetUser(supabase);
  if (!user) {
    redirect('/login?next=/fantasy/team');
  }

  const roster = await getMyRoster(user.id);
  if (!roster) {
    redirect('/fantasy/draft');
  }

  const sheet = await getAllData();
  const week =
    getCurrentWeek(sheet.schedule) ??
    getDisplayedCurrentWeek(sheet.schedule) ??
    1;

  const weekRow = await getOrCreateWeek(user.id, week, sheet.schedule);
  if (!weekRow) {
    return (
      <div className="fv2-body">
        <div className="fv2-empty">
          Couldn&apos;t set up week {week}. Try refreshing.
        </div>
      </div>
    );
  }

  const matchIndexToWeek = new Map<number, number>();
  sheet.schedule.forEach((s) => {
    if (s.matchIndex != null) matchIndexToWeek.set(s.matchIndex, Number(s.week));
  });

  // For each fighter, look up this week's opponent from the schedule
  // (the OTHER TBL team in their team's match), plus season totals from
  // their bout history, plus this week's actual score (if their team's
  // match this week has resolved into the sheet).
  const enriched: RosterFighter[] = roster.fighters.map((f) => {
    const history = sheet.fighterHistory[f.id] ?? [];
    let seasonFpts = 0;
    let lastFpts: number | null = null;
    let weekScore: number | null = null;
    history.forEach((h) => {
      const pts = methodToPoints(h.result, h.resultMethod);
      seasonFpts += pts;
      if (matchIndexToWeek.get(h.matchIndex) === week) {
        weekScore = (weekScore ?? 0) + pts;
      }
    });
    if (history.length > 0) {
      // history is sorted desc by date inside getAllData
      lastFpts = methodToPoints(history[0].result, history[0].resultMethod);
    }

    const teamMatchThisWeek = sheet.schedule.find(
      (s) =>
        Number(s.week) === week &&
        (s.team1 === f.team || s.team2 === f.team)
    );
    const opp = teamMatchThisWeek
      ? teamMatchThisWeek.team1 === f.team
        ? teamMatchThisWeek.team2
        : teamMatchThisWeek.team1
      : null;

    return { ...f, opp, weekScore, seasonFpts, lastFpts };
  });

  return (
    <TeamClient
      roster={enriched}
      starterSlugs={weekRow.starterSlugs}
      week={week}
      locksAtISO={weekRow.locksAt}
      resolved={!!weekRow.resolvedAt}
    />
  );
}
