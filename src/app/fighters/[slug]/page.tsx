// src/app/fighters/[slug]/page.tsx
// Gazette profile: big serif name + eyebrow rank + 6-stat hero strip,
// then 2-col body (Career Averages left, Fight History right).
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getFighterBySlug } from '@/lib/data';
import {
  getTeamLogoPathByName,
  getFullTeamName,
} from '@/lib/teams';
import { FightHistory } from './FightHistory';

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

  const { fighter, history, streak, warRank } = result;

  const teamSlug = fighter.team
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  const fullTeamName = getFullTeamName(teamSlug);
  const teamLogo = getTeamLogoPathByName(fighter.team);
  const isWStreak = streak.startsWith('W');

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

  const heroStats = [
    { l: 'Record', v: fighter.record },
    { l: 'WAR', v: fighter.war.toFixed(2), accent: true },
    { l: 'NPPR', v: fighter.nppr.toFixed(2) },
    {
      l: 'Net Pts',
      v: `${fighter.netPts >= 0 ? '+' : ''}${fighter.netPts.toFixed(0)}`,
    },
    { l: 'Win%', v: `${(fighter.winPct * 100).toFixed(0)}%` },
    { l: 'Rounds', v: String(fighter.rounds) },
  ];

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

      {/* Hero */}
      <div style={{ padding: '22px 32px 26px', borderBottom: '3px double var(--tbl-ink)' }}>
        <div className="tbl-eyebrow">
          Fighter
          {warRank > 0 && <> · #{warRank} WAR</>}
          {streak && <> · Streak {streak}</>}
        </div>
        <div
          className="gz-fighter-hero"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            alignItems: 'flex-end',
            gap: 32,
            marginTop: 10,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              className="tbl-display gz-fighter-name"
              style={{ fontSize: 96, lineHeight: 0.88, letterSpacing: '-0.02em' }}
            >
              {fighter.name}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginTop: 14,
                flexWrap: 'wrap',
              }}
            >
              {teamLogo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={teamLogo}
                  alt=""
                  style={{ width: 36, height: 36, objectFit: 'contain' }}
                />
              )}
              <Link
                href={`/teams/${teamSlug}`}
                className="tbl-display gz-fighter-team-link"
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: 'var(--tbl-accent)',
                  textDecoration: 'none',
                }}
              >
                {fullTeamName}
              </Link>
              <span
                style={{
                  fontFamily: 'var(--tbl-font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.18em',
                  color: 'var(--tbl-ink-soft)',
                  textTransform: 'uppercase',
                }}
              >
                · {fighter.weightClass} · {fighter.gender}
                {streak && (
                  <>
                    {' · '}
                    <span
                      style={{
                        color: isWStreak ? 'var(--tbl-green)' : 'var(--tbl-red)',
                        fontWeight: 700,
                      }}
                    >
                      Streak {streak}
                    </span>
                  </>
                )}
              </span>
              {fighter.instagram && (
                <a
                  href={fighter.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${fighter.name} on Instagram`}
                  title="Instagram"
                  style={{ lineHeight: 0 }}
                  className="ig-link"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <defs>
                      <linearGradient id="ig-grad-profile" x1="0%" y1="100%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#f09433" />
                        <stop offset="25%" stopColor="#e6683c" />
                        <stop offset="50%" stopColor="#dc2743" />
                        <stop offset="75%" stopColor="#cc2366" />
                        <stop offset="100%" stopColor="#bc1888" />
                      </linearGradient>
                    </defs>
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" stroke="url(#ig-grad-profile)" />
                    <circle cx="12" cy="12" r="4" stroke="url(#ig-grad-profile)" />
                    <circle cx="17.5" cy="6.5" r="1" fill="url(#ig-grad-profile)" stroke="none" />
                  </svg>
                </a>
              )}
            </div>
          </div>
          <div
            className="gz-hero-stats"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, auto)',
              gap: '16px 28px',
              borderLeft: '2px solid var(--tbl-ink)',
              paddingLeft: 28,
            }}
          >
            {heroStats.map((s) => (
              <div key={s.l}>
                <div
                  style={{
                    fontFamily: 'var(--tbl-font-mono)',
                    fontSize: 9,
                    letterSpacing: '0.24em',
                    color: 'var(--tbl-ink-soft)',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                  }}
                >
                  {s.l}
                </div>
                <div
                  className="tbl-display"
                  style={{
                    fontSize: 32,
                    lineHeight: 1,
                    color: s.accent ? 'var(--tbl-accent)' : 'var(--tbl-ink)',
                    marginTop: 2,
                  }}
                >
                  {s.v}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <FightHistory history={history} />
    </>
  );
}
