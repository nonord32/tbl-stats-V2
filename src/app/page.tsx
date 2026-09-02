// src/app/page.tsx
// Gazette-direction home, standings first:
//   Hero → Standings → Fighter in Focus → Top Six → Results → Hall of Champions.
//
// The page derives; src/components/home/* renders. There is one tree, not a
// desktop one and a mobile one — the components reflow instead.
import type { Metadata } from 'next';
import { getAllData, extractUniqueMatches } from '@/lib/data';
import { getBracketContext } from '@/lib/bracketData';
import { playoffRoundLabelsByMatch } from '@/lib/playoffs';
import { getDisplayedCurrentWeek } from '@/lib/week';
import { sortStandings } from '@/lib/standings';
import { getComebackData } from '@/lib/wpa';
import {
  aggregateFightersByPhase,
  aggregateTeamStandingsByPhase,
  filterTeamMatchesByPhase,
} from '@/lib/phaseStats';
import { getGameStartUTC } from '@/lib/gameTime';
import { getFullTeamName, getCityName } from '@/lib/teams';
import { HallOfChampions } from '@/components/home/HallOfChampions';
import { Hero } from '@/components/home/Hero';
import { Standings } from '@/components/home/Standings';
import { FocusBand } from '@/components/home/FocusBand';
import { TopFighters } from '@/components/home/TopFighters';
import { RecentResults } from '@/components/home/RecentResults';
import { AdvancedLinks } from '@/components/home/AdvancedLinks';
import { teamSlug, type HeroResult, type ResultCard } from '@/components/home/shared';
import type { ScheduleEntry, MatchResult } from '@/types';

export const metadata: Metadata = {
  title: { absolute: 'TBL Stats | Every Round. Every Fighter. Every Team.' },
  description:
    'Independent stats, standings, and fight results for Team Boxing League. Track fighter performance, team trends, and match outcomes all season long.',
  openGraph: {
    url: 'https://tblstats.com',
    title: 'TBL Stats | Every Round. Every Fighter. Every Team.',
    description: 'Independent stats, standings, and fight results for Team Boxing League.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'TBL Stats' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TBL Stats | Every Round. Every Fighter. Every Team.',
    description: 'Independent stats, standings, and fight results for Team Boxing League.',
    images: ['/og-image.png'],
  },
};

export const revalidate = 300;

const SITE_URL = 'https://tblstats.com';

export default async function HomePage() {
  const data = await getAllData();
  const { fighters, fightersByPhase, fighterHistory, teams, schedule, teamMatches, awards } = data;
  // Hall-of-Champions links resolve against the full roster (incl. playoff-only
  // fighters), so keep this from the joint fighter list.
  const fighterSlugs = new Set(fighters.map((f) => f.slug));

  // Home leaders and standings default to REGULAR-SEASON stats (not full
  // season), matching the default view on the Fighters and Teams pages. During
  // the regular season this equals the full-season data; it only diverges once
  // playoff games are tagged, keeping playoff results out of the home snippets.
  const regularFighters = aggregateFightersByPhase(
    fighters,
    fightersByPhase,
    fighterHistory,
    'regular',
  );
  const regularTeams = aggregateTeamStandingsByPhase(teams, teamMatches, 'regular');
  const regularTeamMatches = filterTeamMatchesByPhase(teamMatches, 'regular');

  const currentWeek = getDisplayedCurrentWeek(schedule);
  // "Upcoming" stays on the schedule entry until results are entered, so a
  // game in progress (or one that started a few hours ago and just hasn't
  // been finalized yet) would otherwise still be the featured match. Pick
  // the next genuinely-future match across the entire schedule, not just
  // the current week, so the hero advances the moment kickoff passes —
  // even if it has to roll forward into next week.
  const now = Date.now();
  const isStillFuture = (s: ScheduleEntry) => {
    if (s.status !== 'Upcoming') return false;
    const start = getGameStartUTC(s.date, s.time, s.venueCity);
    if (!start || isNaN(start.getTime())) return true; // fail open
    return start.getTime() > now;
  };
  const allFuture = [...schedule]
    .filter(isStillFuture)
    .sort((a, b) => {
      const aStart = getGameStartUTC(a.date, a.time, a.venueCity)?.getTime() ?? 0;
      const bStart = getGameStartUTC(b.date, b.time, b.venueCity)?.getTime() ?? 0;
      return aStart - bStart;
    });
  const featured = allFuture[0] ?? null;
  // "Also this week" only lists matches in the same week as the featured
  // game (or the displayed current week if none is featured).
  const referenceWeek = featured ? Number(featured.week) : currentWeek;
  const alsoThisWeek = allFuture
    .slice(1)
    .filter((s) => referenceWeek != null && Number(s.week) === referenceWeek);

  // Sort by Net Points — drives "Top Six" and the fighter in focus.
  const fightersByNetPts = [...regularFighters].sort((a, b) => b.netPts - a.netPts);

  // Fighter in Focus: top net-points fighter from either side of the featured
  // matchup, so the spotlight matches the upcoming event. Falls back to the
  // league leader when there's no upcoming match (offseason / between weeks).
  const focus = (() => {
    if (!featured) return fightersByNetPts[0] ?? null;
    const slug1 = teamSlug(featured.team1);
    const slug2 = teamSlug(featured.team2);
    const fromMatch = fightersByNetPts.find((f) => {
      const fs = teamSlug(f.team);
      return fs === slug1 || fs === slug2;
    });
    return fromMatch ?? fightersByNetPts[0] ?? null;
  })();

  // Use the shared standings sorter so the home table matches the Teams page
  // row-for-row, including the head-to-head tiebreaker for two-team ties. Both
  // use the regular-season standings.
  const topTeams = sortStandings(regularTeams, regularTeamMatches);

  // Comeback wins / blown leads per team slug, for the two extra columns —
  // the same accessor and shape the Teams page uses.
  const cb = await getComebackData();
  const comebacks = Object.fromEntries(
    [...cb.byTeam.values()].map((t) => [
      t.slug,
      { comebackWins: t.comebackWins, blownLeads: t.blownLeads },
    ]),
  );

  // Map each completed match back to its schedule week so result cards can
  // show "Week 3" etc. instead of the boxScore's scoring-phase label.
  const weekByMatchIndex = new Map<number, number>();
  schedule.forEach((s) => {
    if (s.matchIndex != null) weekByMatchIndex.set(s.matchIndex, s.week);
  });

  // Bracket context: playoff round labels for result cards, and the MegaBrawl
  // champion for the hero below.
  const { bracket } = getBracketContext(data);
  const playoffLabels = playoffRoundLabelsByMatch(bracket);

  // Real match results from the teamMatches data (same source the /results
  // page uses), sorted newest-first and capped at 6 cards. Playoff games are
  // labeled by round (Quarterfinals / Semifinals / MegaBrawl IV), never
  // "Week 0".
  const completed: ResultCard[] = extractUniqueMatches(teamMatches)
    .slice(0, 6)
    .map((m: MatchResult) => {
      const wk = weekByMatchIndex.get(m.matchIndex);
      const phase =
        m.phase === 'playoffs'
          ? playoffLabels.get(m.matchIndex) ?? 'Playoffs'
          : wk != null && wk > 0
          ? `Week ${wk}`
          : undefined;
      return {
        matchIndex: m.matchIndex,
        date: m.date,
        team1: m.team1,
        team2: m.team2,
        s1: m.score1,
        s2: m.score2,
        phase,
      };
    });

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'TBL Stats', item: SITE_URL },
        ],
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: 'TBL Stats',
        description:
          'Independent stats, standings, and fight results for Team Boxing League.',
      },
      {
        '@type': 'SportsOrganization',
        '@id': `${SITE_URL}/#organization`,
        name: 'Team Boxing League',
        alternateName: 'TBL',
        sport: 'Boxing',
        url: 'https://teamboxingleague.com',
        sameAs: [
          'https://www.instagram.com/teamboxingleague/',
          'https://www.youtube.com/@teamboxingleague',
        ],
      },
    ],
  };

  // Quick team→record lookup for the hero poster (regular-season record).
  const teamRecords = new Map<string, string>();
  regularTeams.forEach((t) => {
    teamRecords.set(t.team, t.record);
    teamRecords.set(getFullTeamName(t.slug), t.record);
    teamRecords.set(getCityName(t.team), t.record);
  });
  const lastCompleted = completed[0] ?? null;

  // MegaBrawl champion — only once the final has been played. Derived from the
  // live bracket (computed above), with the winner's score shown first.
  const finalMatch = bracket.final;
  const champSeed =
    finalMatch.status === 'played'
      ? finalMatch.a?.team.slug === finalMatch.winnerSlug
        ? finalMatch.a
        : finalMatch.b
      : undefined;
  const runnerSeed = champSeed
    ? champSeed === finalMatch.a
      ? finalMatch.b
      : finalMatch.a
    : undefined;
  const champScoreLine =
    champSeed && finalMatch.score
      ? finalMatch.a?.team.slug === finalMatch.winnerSlug
        ? `${finalMatch.score[0]}–${finalMatch.score[1]}`
        : `${finalMatch.score[1]}–${finalMatch.score[0]}`
      : null;

  // What the hero shows when nothing is upcoming: the most recent result,
  // framed as the MegaBrawl champion crowning when that result is the final.
  const heroResult: HeroResult | null = (() => {
    if (champSeed) {
      return {
        eyebrow: 'MegaBrawl IV · Champion',
        winnerName: getFullTeamName(champSeed.team.slug),
        winnerTeam: champSeed.team.team,
        loserName: runnerSeed ? getFullTeamName(runnerSeed.team.slug) : '',
        loserTeam: runnerSeed?.team.team ?? '',
        scoreLine: champScoreLine ?? '',
        href: '/playoffs',
        isChampion: true,
        verb: 'def.',
      };
    }
    if (lastCompleted) {
      const isDraw = Math.abs(lastCompleted.s1 - lastCompleted.s2) < 0.0001;
      const t1Won = lastCompleted.s1 >= lastCompleted.s2;
      const winner = t1Won ? lastCompleted.team1 : lastCompleted.team2;
      const loser = t1Won ? lastCompleted.team2 : lastCompleted.team1;
      const ws = t1Won ? lastCompleted.s1 : lastCompleted.s2;
      const ls = t1Won ? lastCompleted.s2 : lastCompleted.s1;
      const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
      return {
        eyebrow: `Latest Result · ${lastCompleted.date}`,
        winnerName: getFullTeamName(teamSlug(winner)),
        winnerTeam: winner,
        loserName: getFullTeamName(teamSlug(loser)),
        loserTeam: loser,
        scoreLine: `${fmt(ws)}–${fmt(ls)}`,
        href: `/matches/${lastCompleted.matchIndex}`,
        isChampion: false,
        verb: isDraw ? 'drew' : 'def.',
      };
    }
    return null;
  })();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Hero featured={featured} heroResult={heroResult} teamRecords={teamRecords} />
      <Standings teams={topTeams} comebacks={comebacks} />
      <FocusBand focus={focus} alsoThisWeek={alsoThisWeek} />
      <TopFighters fighters={fightersByNetPts} />
      <RecentResults results={completed} />

      {awards.length > 0 && (
        <div className="home-awards-section" style={{ padding: '0 32px 40px' }}>
          <div className="tbl-section-rule">
            <span>Past MVPs &amp; Trophies · Hall of Champions</span>
          </div>
          <HallOfChampions awards={awards} fighterSlugs={fighterSlugs} />
        </div>
      )}

      <AdvancedLinks />
    </>
  );
}
