// src/app/fantasy/team/page.tsx
// Real persisted roster + this week's lineup. Reads fantasy_rosters /
// fantasy_weeks via the fantasyData server helpers; client component
// handles starter swapping with lineup-lock countdown.
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { safeGetUser } from '@/lib/supabase/safe';
import { getAllData } from '@/lib/data';
import { getCurrentWeek, getDisplayedCurrentWeek } from '@/lib/week';
import { getMyRoster, getOrCreateWeek } from '@/lib/fantasyData';
import { TeamClient } from './TeamClient';

export const dynamic = 'force-dynamic';

export default async function FantasyTeamPage() {
  const supabase = await createClient();
  const user = await safeGetUser(supabase);
  if (!user) {
    redirect('/login?next=/fantasy/team');
  }

  const roster = await getMyRoster(user.id);
  if (!roster) {
    // No draft saved yet — bounce them to the mock draft.
    redirect('/fantasy/draft');
  }

  const sheet = await getAllData();
  const week =
    getCurrentWeek(sheet.schedule) ??
    getDisplayedCurrentWeek(sheet.schedule) ??
    1;

  const weekRow = await getOrCreateWeek(user.id, week, sheet.schedule);
  if (!weekRow) {
    // Edge case: roster exists but week creation failed (DB hiccup).
    return (
      <div className="fantasy-body">
        <div className="fantasy-empty">
          Couldn&apos;t set up week {week}. Try refreshing.
        </div>
      </div>
    );
  }

  return (
    <TeamClient
      roster={roster.fighters}
      starterSlugs={weekRow.starterSlugs}
      week={week}
      locksAtISO={weekRow.locksAt}
      resolved={!!weekRow.resolvedAt}
    />
  );
}
