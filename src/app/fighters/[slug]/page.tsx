// src/app/fighters/[slug]/page.tsx
// Gazette profile: big serif name + eyebrow rank + 6-stat hero strip,
// then 2-col body (Career Averages left, Fight History right).
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getAllData, getFighterBySlug } from '@/lib/data';
import {
  getTeamLogoPathByName,
  getFullTeamName,
} from '@/lib/teams';
import { SectionRule } from '@/components/chrome/SectionRule';
import type { FightHistory, BoxScoreRound } from '@/types';

export const revalidate = 300;
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const result = await getFighterBySlug(params.slug);
  if (!result) return { title: 'Fighter Not Found' };
  const { fighter } = result;
  const tSlug = fighter.team
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  const metaTeamName = getFullTeamName(tSlug);
  return {
    title: `${fighter.name} — ${metaTeamName}`,
    description: `${fighter.name} TBL stats: ${fighter.record} record, WAR ${fighter.war.toFixed(2)}, NPPR ${fighter.nppr.toFixed(3)}, Net Points ${fighter.netPts.toFixed(1)}. ${fighter.weightClass} · ${fighter.gender}.`,
    openGraph: {
      url: `https://tblstats.com/fighters/${params.slug}`,
      title: `${fighter.name} | TBL Stats`,
      description: `${fighter.record} · WAR ${fighter.war.toFixed(2)} · ${metaTeamName}`,
      images: [{ url: '/og-image.png', width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${fighter.name} | TBL Stats`,
      description: `${fighter.record} · WAR ${fighter.war.toFixed(2)} · ${metaTeamName}`,
      images: ['/og-image.png'],
    },
  };
}

// Compute per-round raw points by joining FightHistory with teamMatches'
// boxScore rows (matched by matchIndex + opponent + round number). Returns
// { ptsPerRound, oppPtsPerRound, roundKOs, shutouts } as best-effort averages.
function deriveCareerAverages(
  fighterName: string,
  history: FightHistory[],
  teamMatches: Record<string, { matchIndex: number; boxScore: BoxScoreRound[] }[]>
) {
  let ownScoreSum = 0;
  let oppScoreSum = 0;
  let roundCount = 0;
  let shutouts = 0;
  let roundKOs = 0;

  // Build a lookup: matchIndex -> box score rounds (from either team's side).
  const matchBoxScores = new Map<number, BoxScoreRound[]>();
  Object.values(teamMatches).forEach((rows) => {
    rows.forEach((m) => {
      if (!matchBoxScores.has(m.matchIndex)) matchBoxScores.set(m.matchIndex, m.boxScore);
    });
  });

  for (const h of history) {
    if (h.resultMethod === 'KO' && h.result === 'W') roundKOs++;
    const rounds = matchBoxScores.get(h.matchIndex) ?? [];
    const row = rounds.find(
      (r) =>
        (r.fighter1 === fighterName || r.fighter2 === fighterName) &&
        String(r.round) === String(h.round)
    );
    if (!row) continue;
    const isF1 = row.fighter1 === fighterName;
    const own = isF1 ? row.score1 : row.score2;
    const opp = isF1 ? row.score2 : row.score1;
    ownScoreSum += own;
    oppScoreSum += opp;
    roundCount++;
    if (opp === 0) shutouts++;
  }

  return {
    ptsPerRound: roundCount ? ownScoreSum / roundCount : 0,
    oppPtsPerRound: roundCount ? oppScoreSum / roundCount : 0,
    roundKOs,
    shutouts,
    roundsJoined: roundCount,
  };
}

export default async function FighterPage({
  params,
}: {
  params: { slug: string };
}) {
  const result = await getFighterBySlug(params.slug);
  if (!result) notFound();

  const { fighter, history, streak } = result;
  const { teamMatches } = await getAllData();

  const teamSlug = fighter.team
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  const fullTeamName = getFullTeamName(teamSlug);
  const teamLogo = getTeamLogoPathByName(fighter.team);
  const isWStreak = streak.startsWith('W');

  const averages = deriveCareerAverages(fighter.name, history, teamMatches);

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
    { l: 'NPPR', v: fighter.nppr.toFixed(3) },
    {
      l: 'Net Pts',
      v: `${fighter.netPts >= 0 ? '+' : ''}${fighter.netPts.toFixed(1)}`,
    },
    { l: 'Win%', v: `${(fighter.winPct * 100).toFixed(1)}%` },
    { l: 'Rounds', v: String(fighter.rounds) },
  ];

  const averageCards =
    averages.roundsJoined > 0
      ? [
          { l: 'Pts/Round', v: averages.ptsPerRound.toFixed(2) },
          { l: 'Opp Pts/R', v: averages.oppPtsPerRound.toFixed(2) },
          { l: 'Round KOs', v: String(averages.roundKOs) },
          { l: 'Shutouts', v: String(averages.shutouts) },
        ]
      : null;

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
          Fighter Profile · {fighter.instagram ? 'Verified' : fighter.weightClass}
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
              className="tbl-display"
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
                className="tbl-display"
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

      {/* Body: Career Averages + Fight History */}
      <div
        className="gz-fighter-body"
        style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 0 }}
      >
        <div
          className="gz-fighter-left"
          style={{
            padding: '24px 32px',
            borderRight: '1px solid rgba(20,17,11,0.2)',
          }}
        >
          <SectionRule left="Career Averages" />
          {averageCards ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {averageCards.map((s) => (
                <div
                  key={s.l}
                  style={{
                    background: 'var(--tbl-paper)',
                    border: '1.5px solid var(--tbl-ink)',
                    padding: 14,
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'var(--tbl-font-mono)',
                      fontSize: 9,
                      letterSpacing: '0.22em',
                      color: 'var(--tbl-ink-soft)',
                      textTransform: 'uppercase',
                      fontWeight: 700,
                    }}
                  >
                    {s.l}
                  </div>
                  <div
                    className="tbl-display"
                    style={{ fontSize: 28, lineHeight: 1, marginTop: 4 }}
                  >
                    {s.v}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p
              style={{
                fontFamily: 'var(--tbl-font-mono)',
                fontSize: 12,
                color: 'var(--tbl-ink-soft)',
              }}
            >
              Round-by-round data unavailable.
            </p>
          )}
        </div>

        <div style={{ padding: '24px 32px' }}>
          <SectionRule
            left="Fight History · 2026 Season"
            right={`${history.length} ${history.length === 1 ? 'bout' : 'bouts'} shown`}
          />
          {history.length === 0 ? (
            <p
              style={{
                fontFamily: 'var(--tbl-font-mono)',
                fontSize: 12,
                color: 'var(--tbl-ink-soft)',
              }}
            >
              No fight data available.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontFamily: 'var(--tbl-font-mono)',
                  fontSize: 12,
                }}
              >
                <thead>
                  <tr style={{ borderBottom: '1.5px solid var(--tbl-ink)' }}>
                    {['Date', 'Opponent', 'Team', 'Round', 'Result', 'Net'].map((h, i) => (
                      <th
                        key={h}
                        style={{
                          textAlign: i < 3 ? 'left' : 'right',
                          padding: '6px 6px',
                          fontWeight: 700,
                          letterSpacing: '0.12em',
                          fontSize: 10,
                          textTransform: 'uppercase',
                          color: 'var(--tbl-ink-soft)',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((h, i) => {
                    const oppSlug = h.opponentTeam
                      .toLowerCase()
                      .replace(/\s+/g, '-')
                      .replace(/[^a-z0-9-]/g, '');
                    const oppLogo = getTeamLogoPathByName(h.opponentTeam);
                    const winBg = h.result === 'W' ? 'var(--tbl-green)' : 'var(--tbl-red)';
                    return (
                      <tr key={i} style={{ borderBottom: '1px dotted rgba(20,17,11,0.3)' }}>
                        <td style={{ padding: '10px 6px', color: 'var(--tbl-ink-soft)' }}>
                          {h.date}
                        </td>
                        <td
                          style={{
                            padding: '10px 6px',
                            fontFamily: 'var(--tbl-font-serif)',
                            fontSize: 14,
                            fontWeight: 700,
                          }}
                        >
                          {h.opponent}
                        </td>
                        <td style={{ padding: '10px 6px' }}>
                          <Link
                            href={`/teams/${oppSlug}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              color: 'var(--tbl-ink-soft)',
                              textDecoration: 'none',
                            }}
                          >
                            {oppLogo && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={oppLogo}
                                alt=""
                                style={{ width: 18, height: 18, objectFit: 'contain' }}
                              />
                            )}
                            <span style={{ fontSize: 11 }}>{h.opponentTeam.toUpperCase()}</span>
                          </Link>
                        </td>
                        <td style={{ padding: '10px 6px', textAlign: 'right' }}>
                          {String(h.round).startsWith('R') ? h.round : `R${h.round}`}
                        </td>
                        <td style={{ padding: '10px 6px', textAlign: 'right' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '1px 8px',
                              minWidth: 22,
                              background: winBg,
                              color: '#fff',
                              fontFamily: 'var(--tbl-font-serif)',
                              fontWeight: 900,
                              fontSize: 14,
                            }}
                          >
                            {h.result}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: '10px 6px',
                            textAlign: 'right',
                            fontWeight: 700,
                            color: h.netPts >= 0 ? 'var(--tbl-green)' : 'var(--tbl-red)',
                          }}
                        >
                          {h.netPts >= 0 ? '+' : ''}
                          {h.netPts.toFixed(1)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
