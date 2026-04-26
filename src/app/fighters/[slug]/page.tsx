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
import { SectionRule } from '@/components/chrome/SectionRule';

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
    description: `${fighter.name} TBL stats: ${fighter.record} record, WAR ${fighter.war.toFixed(2)}, NPPR ${fighter.nppr.toFixed(2)}, Net Points ${fighter.netPts.toFixed(0)}. ${fighter.weightClass} · ${fighter.gender}.`,
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

export default async function FighterPage({
  params,
}: {
  params: { slug: string };
}) {
  const result = await getFighterBySlug(params.slug);
  if (!result) notFound();

  const { fighter, history, streak, warRank } = result;
  // Last 10 bouts in chronological order (oldest → newest) for the form strip.
  const formLast10 = [...history].slice(0, 10).reverse();

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

      {/* Form · Last 10 — desktop-only strip of W/L pills (oldest → newest). */}
      {formLast10.length > 0 && (
        <div className="gz-fighter-form" style={{ padding: '20px 32px 4px' }}>
          <SectionRule
            left={`Form · Last ${formLast10.length}`}
            right={`Streak ${streak || '—'}`}
          />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {formLast10.map((h, i) => {
              const isWin = h.result === 'W';
              return (
                <div
                  key={i}
                  className="tbl-display"
                  style={{
                    width: 36,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isWin ? 'var(--tbl-green)' : 'var(--tbl-red)',
                    color: '#fff',
                    fontSize: 16,
                    fontWeight: 900,
                  }}
                  title={`${h.date} · ${h.opponent} · ${h.result}`}
                >
                  {h.result}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Body: Fight History */}
      <div>
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
            <>
              {/* Mobile: card-list view (hidden on desktop) */}
              <div className="gz-fighter-history-cards">
                {history.map((h, i) => {
                  const oppLogo = getTeamLogoPathByName(h.opponentTeam);
                  const isWin = h.result === 'W';
                  const roundLabel = String(h.round).startsWith('R')
                    ? String(h.round)
                    : `R${h.round}`;
                  return (
                    <div key={i} className="gz-fighter-history-row">
                      <div
                        className={`gz-fighter-history-row__badge${
                          isWin ? ' is-win' : ' is-loss'
                        }`}
                      >
                        {h.result}
                      </div>
                      {oppLogo && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={oppLogo}
                          alt=""
                          className="gz-fighter-history-row__logo"
                        />
                      )}
                      <div className="gz-fighter-history-row__body">
                        <div className="gz-fighter-history-row__name">
                          {h.opponent}
                        </div>
                        <div className="gz-fighter-history-row__meta">
                          {h.date} · {roundLabel}
                        </div>
                      </div>
                      <div
                        className="gz-fighter-history-row__net"
                        style={{
                          color:
                            h.netPts >= 0 ? 'var(--tbl-green)' : 'var(--tbl-red)',
                        }}
                      >
                        {h.netPts >= 0 ? '+' : ''}
                        {h.netPts.toFixed(0)}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop: full table (hidden on mobile) */}
              <div className="gz-fighter-history-table" style={{ overflowX: 'auto' }}>
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
                          {h.netPts.toFixed(0)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
