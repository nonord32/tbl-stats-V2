// src/app/fighters/[slug]/page.tsx
// Gazette profile: big serif name + eyebrow rank + 6-stat hero strip,
// then 2-col body (Career Averages left, Fight History right).
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getFighterBySlug, getAllData } from '@/lib/data';
import { getBracketContext } from '@/lib/bracketData';
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

      {/* Breadcrumb */}
      <div
        style={{
          padding: '14px 32px 0',
          fontFamily: 'var(--tbl-font-mono)',
          fontSize: 11,
          letterSpacing: '0.12em',
          color: 'var(--tbl-ink-soft)',
          textTransform: 'uppercase',
        }}
      >
        <Link href="/" style={{ color: 'var(--tbl-ink-soft)', textDecoration: 'none' }}>
          Home
        </Link>
        {' / '}
        <Link href="/fighters" style={{ color: 'var(--tbl-ink-soft)', textDecoration: 'none' }}>
          Fighters
        </Link>
        {' / '}
        <span style={{ color: 'var(--tbl-ink)' }}>{fighter.name}</span>
      </div>

      <FighterHero
        season={fighter}
        regular={regular}
        playoffs={playoffs}
        streak={streak}
        warRank={warRank}
      />

      <FightHistory history={history} roundLabels={roundLabels} />
    </>
  );
}
