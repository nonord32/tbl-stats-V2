// src/app/schedule/page.tsx
import type { Metadata } from 'next';
import { getAllData, extractUniqueMatches } from '@/lib/data';
import { getDisplayedCurrentWeek } from '@/lib/week';
import { getBracketContext } from '@/lib/bracketData';
import { playoffRoundLabelsByMatch, ROUND_LABELS } from '@/lib/playoffs';
import { ScheduleClient } from './ScheduleClient';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Schedule',
  description:
    'Full 2026 Team Boxing League schedule. Upcoming matches, venues, dates, and results.',
  openGraph: {
    url: 'https://tblstats.com/schedule',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
};

export default async function SchedulePage() {
  const data = await getAllData();
  const { schedule } = data;
  const currentWeek = getDisplayedCurrentWeek(schedule);

  // The match result's team1/team2 ordering can differ from the schedule
  // entry's (extractUniqueMatches walks teamMatches in object-key order, not
  // schedule order). Pass the result's team1 along so the client can swap
  // score1/score2 when needed instead of hard-pinning them to the schedule
  // ordering — that's what was making BOS/NYC and DAL/HOU look like the
  // wrong team had won.
  const scores: Record<
    number,
    { score1: number; score2: number; result: 'W' | 'L' | 'D'; team1: string }
  > = {};
  for (const m of extractUniqueMatches(data.teamMatches)) {
    scores[m.matchIndex] = {
      score1: m.score1,
      score2: m.score2,
      result: m.result,
      team1: m.team1,
    };
  }

  // matchIndex → playoff round for identified playoff games, so the client can
  // group them under "Quarterfinals" / "Semifinals" / "MegaBrawl IV" sections
  // instead of a week number (playoff rows carry week 0 in the sheet).
  const roundByMatch = playoffRoundLabelsByMatch(getBracketContext(data).bracket);
  const orderByLabel: Record<string, number> = {
    [ROUND_LABELS.QF]: 1,
    [ROUND_LABELS.SF]: 2,
    [ROUND_LABELS.F]: 3,
  };
  const playoffRounds: Record<number, { label: string; order: number }> = {};
  for (const [matchIndex, label] of roundByMatch) {
    playoffRounds[matchIndex] = { label, order: orderByLabel[label] ?? 3 };
  }

  const BASE = 'https://tblstats.com';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'TBL Stats', item: BASE },
          { '@type': 'ListItem', position: 2, name: 'Schedule', item: `${BASE}/schedule` },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ScheduleClient
        schedule={schedule}
        currentWeek={currentWeek}
        scores={scores}
        playoffRounds={playoffRounds}
      />
    </>
  );
}
