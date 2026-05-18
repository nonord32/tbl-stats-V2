// src/lib/clinch.ts
//
// Mathematical clinch / elimination computation for the TBL standings.
//
// Status values:
//   'x' — clinched a playoff berth (top PLAYOFF_SPOTS, currently top 8)
//   'z' — clinched the #1 overall seed (implies 'x', reported as 'z')
//   'e' — eliminated from playoff contention
//   null — still in play
//
// W-L only — PF/PA tiebreakers are ignored. A team that could be caught
// (any chaser's max wins >= this team's worst-case wins) is NOT marked
// clinched, since the resulting tie could swing on a tiebreaker.

import type { TeamStanding, ScheduleEntry } from '@/types';
import { PLAYOFF_SPOTS } from '@/lib/standings';

export type ClinchStatus = 'x' | 'z' | 'e' | null;

function gamesRemaining(team: TeamStanding, schedule: ScheduleEntry[]): number {
  const name = team.team.toLowerCase();
  let n = 0;
  for (const s of schedule) {
    if (s.status !== 'Upcoming') continue;
    if (s.team1.toLowerCase() === name || s.team2.toLowerCase() === name) n++;
  }
  return n;
}

export function computeClinchStatus(
  teams: TeamStanding[],
  schedule: ScheduleEntry[]
): Map<string, ClinchStatus> {
  const remaining = new Map<string, number>();
  for (const t of teams) remaining.set(t.slug, gamesRemaining(t, schedule));

  const result = new Map<string, ClinchStatus>();
  for (const t of teams) {
    const tRem = remaining.get(t.slug) ?? 0;
    const tMin = t.wins;            // T loses out
    const tMax = t.wins + tRem;     // T wins out

    let canMatchOrExceedMin = 0;    // other teams whose max wins >= tMin
    let strictlyAhead = 0;          // other teams whose current wins > tMax

    for (const b of teams) {
      if (b.slug === t.slug) continue;
      const bMax = b.wins + (remaining.get(b.slug) ?? 0);
      if (bMax >= tMin) canMatchOrExceedMin++;
      if (b.wins > tMax) strictlyAhead++;
    }

    // Eliminated: PLAYOFF_SPOTS teams already have more wins than T's
    // best case — winning out is still not enough.
    if (strictlyAhead >= PLAYOFF_SPOTS) {
      result.set(t.slug, 'e');
      continue;
    }

    // #1 seed clinched: no other team can match or exceed T's worst case.
    if (canMatchOrExceedMin === 0) {
      result.set(t.slug, 'z');
      continue;
    }

    // Berth clinched: at most PLAYOFF_SPOTS - 1 other teams can reach or
    // pass T's worst case. Since ties are counted here, T is guaranteed
    // to land in the top PLAYOFF_SPOTS regardless of tiebreaker direction.
    if (canMatchOrExceedMin <= PLAYOFF_SPOTS - 1) {
      result.set(t.slug, 'x');
      continue;
    }

    result.set(t.slug, null);
  }

  return result;
}
