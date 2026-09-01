// src/app/fighters/[slug]/page.tsx
// Gazette profile: identity hero (name, team, form, record) over a compact
// stat sheet, then the fight history.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getFighterBySlug, getAllData } from '@/lib/data';
import { getBracketContext } from '@/lib/bracketData';
import { getWpaData } from '@/lib/wpa';
import { playoffRoundLabelsByMatch } from '@/lib/playoffs';
import { getFullTeamName } from '@/lib/teams';
import { FightHistory } from './FightHistory';
import { FighterHero } from './FighterHero';

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const result = await getFighterBySlug(params.slug);
  if (!result) return { title: 'Fighter Not Found' };
  const { fighter, warRank } = result;
  const tSlug = fighter.team
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  const metaTeamName = getFullTeamName(tSlug);
  const netPts = `${fighter.netPts >= 0 ? '+' : ''}${fighter.netPts.toFixed(0)}`;
  // "Standing" for a fighter is their rank on the WAR leaderboard; fall back to
  // a plain phrasing if the fighter isn't ranked (warRank === 0).
  const warStanding = warRank > 0 ? `ranks #${warRank} in WAR` : 'competes';
  return {
    title: `${fighter.name} — TBL Record, Stats & Fight History`,
    description: `${fighter.name} of ${metaTeamName} is ${fighter.record} with ${netPts} net points and ${warStanding} across the Team Boxing League. Full fight history, career averages, and round-by-round stats — ${fighter.weightClass} · ${fighter.gender}.`,
    openGraph: {
      // og:image / twitter:image are supplied by the sibling opengraph-image.tsx.
      url: `https://tblstats.com/fighters/${params.slug}`,
      title: `${fighter.name} | TBL Stats`,
      description: `${fighter.record} · ${netPts} net pts · ${metaTeamName}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${fighter.name} | TBL Stats`,
      description: `${fighter.record} · ${netPts} net pts · ${metaTeamName}`,
    },
  };
}

export default async function FighterPage({
  params,
}: {
  params: { slug: string };
}) {
  const result = await getFighterBySlug(params.slug);
  if (!result) notFound();

  const { fighter, regular, playoffs, history, streak, warRank } = result;

  // matchIndex → playoff round label ("Quarterfinals" / "Semifinals" /
  // "MegaBrawl"), so playoff bouts read the round instead of a week number.
  const roundLabels = Object.fromEntries(
    playoffRoundLabelsByMatch(getBracketContext(await getAllData()).bracket)
  );

  // Season WPA for this fighter: per-phase totals for the hero's Advanced
  // strip, plus a per-round map (keyed matchIndex:roundId) for the fight
  // history column and the best/worst-round highlights.
  const fighterWpa = (await getWpaData()).byFighter.get(params.slug) ?? null;
  const wpaProp = (() => {
    if (!fighterWpa) return null;
    const regularRounds = fighterWpa.perRound.filter((p) => p.phase !== 'playoffs').length;
    const playoffRounds = fighterWpa.rounds - regularRounds;
    const rate = (total: number, rounds: number) => (rounds > 0 ? total / rounds : 0);
    return {
      all: {
        total: fighterWpa.wpa,
        perRound: rate(fighterWpa.wpa, fighterWpa.rounds),
        avgLi: fighterWpa.avgLi,
        liRounds: fighterWpa.liRounds,
        clutch: fighterWpa.clutch,
      },
      regular: {
        total: fighterWpa.wpaRegular,
        perRound: rate(fighterWpa.wpaRegular, regularRounds),
        avgLi: rate(fighterWpa.liSumRegular, fighterWpa.liRoundsRegular),
        liRounds: fighterWpa.liRoundsRegular,
        clutch: fighterWpa.clutchRegular,
      },
      playoffs: {
        total: fighterWpa.wpaPlayoffs,
        perRound: rate(fighterWpa.wpaPlayoffs, playoffRounds),
        avgLi: rate(fighterWpa.liSumPlayoffs, fighterWpa.liRoundsPlayoffs),
        liRounds: fighterWpa.liRoundsPlayoffs,
        clutch: fighterWpa.clutchPlayoffs,
      },
    };
  })();
  const wpaRoundKey = (matchIndex: number, roundId: number | undefined, round: number) =>
    `${matchIndex}:${roundId ?? `r${round}`}`;
  const wpaByRound: Record<string, number> = {};
  const liByRound: Record<string, number> = {};
  let bestKey: string | undefined;
  let worstKey: string | undefined;
  if (fighterWpa) {
    let best = 0;
    let worst = 0;
    for (const p of fighterWpa.perRound) {
      const key = wpaRoundKey(p.matchIndex, p.roundId, p.round);
      wpaByRound[key] = p.wpa;
      if (!p.isDq) liByRound[key] = p.li;
      if (p.wpa > best) {
        best = p.wpa;
        bestKey = key;
      }
      if (p.wpa < worst) {
        worst = p.wpa;
        worstKey = key;
      }
    }
  }

  // Last 10 results, oldest → newest, for the hero's form strip. `history` is
  // newest-first.
  const form = [...history].slice(0, 10).reverse().map((h) => h.result);

  const teamSlug = fighter.team
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  const fullTeamName = getFullTeamName(teamSlug);

  const BASE = 'https://tblstats.com';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'TBL Stats', item: BASE },
          { '@type': 'ListItem', position: 2, name: 'Fighter Stats', item: `${BASE}/fighters` },
          { '@type': 'ListItem', position: 3, name: fighter.name, item: `${BASE}/fighters/${fighter.slug}` },
        ],
      },
      {
        '@type': 'Person',
        name: fighter.name,
        sport: 'Boxing',
        url: `${BASE}/fighters/${fighter.slug}`,
        memberOf: {
          '@type': 'SportsTeam',
          name: fullTeamName,
          sport: 'Boxing',
          url: `${BASE}/teams/${teamSlug}`,
          memberOf: {
            '@type': 'SportsOrganization',
            name: 'Team Boxing League',
            url: 'https://teamboxingleague.com',
          },
        },
        ...(fighter.instagram ? { sameAs: [fighter.instagram] } : {}),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <FighterHero
        season={fighter}
        regular={regular}
        playoffs={playoffs}
        streak={streak}
        warRank={warRank}
        wpa={wpaProp}
        form={form}
      />

      <FightHistory
        history={history}
        roundLabels={roundLabels}
        wpaByRound={wpaByRound}
        liByRound={liByRound}
        wpaBestKey={bestKey}
        wpaWorstKey={worstKey}
      />
    </>
  );
}
