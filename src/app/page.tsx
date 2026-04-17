// src/app/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllData, toSlug } from '@/lib/data';
import { getTeamLogoPath } from '@/lib/teams';
import { LogoImage } from '@/components/LogoImage';

export const metadata: Metadata = {
  // absolute bypasses the layout template so we don't get double-suffix
  title: { absolute: 'Team Boxing League | Rankings, Leaders, & Results' },
  description:
    'Independent stats, standings, and fight results for Team Boxing League. Track fighter performance, team trends, and match outcomes all season long.',
  openGraph: {
    url: 'https://tblstats.com',
    title: 'TBL Stats | Rankings, Leaders, & Results',
    description: 'Independent stats, standings, and fight results for Team Boxing League.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'TBL Stats' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TBL Stats | Rankings, Leaders, & Results',
    description: 'Independent stats, standings, and fight results for Team Boxing League.',
    images: ['/og-image.png'],
  },
};

export const revalidate = 300;
export const dynamic = 'force-dynamic';

const SITE_URL = 'https://tblstats.com';

export default async function HomePage() {
  const data = await getAllData();
  const { fighters, teams } = data;

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
        description: 'Independent stats, standings, and fight results for Team Boxing League.',
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

  const topFighters = [...fighters]
    .sort((a, b) => b.war - a.war)
    .slice(0, 5);

  const sortedTeams = [...teams].sort((a, b) => b.wins - a.wins || b.diff - a.diff);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* ── Hero ── */}
      <section className="home-hero">
        <div className="container">
          {/* TBLStats wordmark */}
          <div style={{ marginBottom: 24 }}>
            <span style={{
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: 'clamp(40px, 8vw, 72px)',
              fontWeight: 700,
              color: '#fff',
              letterSpacing: '-0.02em',
              lineHeight: 1,
            }}>
              TBL<span style={{ color: 'var(--accent)' }}>Stats</span>
            </span>
          </div>
          <h1>
            Team Boxing League | Rankings, Leaders, &amp; Results
          </h1>
          <p>
            Independent stats, standings, and fight results for Team Boxing League.
            Track fighter performance, team trends, and match outcomes all season long.
          </p>
        </div>
      </section>

      {/* ── Quick Nav Cards ── */}
      <section className="page">
        <div className="container">
          {/* ── Standings + Top Fighters ── */}
          <div className="home-main-grid">
            {/* Full Standings Table */}
            <div className="card home-standings-card">
              <div className="card-header">
                <span className="card-title">Team Standings</span>
                <Link href="/teams" style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--accent)', letterSpacing: '0.04em' }}>
                  Full page →
                </Link>
              </div>
              <div className="table-wrap">
                <table className="home-standings-table">
                  <thead>
                    <tr>
                      <th style={{ width: 28 }}>#</th>
                      <th>Team</th>
                      <th className="num-cell">W</th>
                      <th className="num-cell">L</th>
                      <th className="num-cell">PF</th>
                      <th className="num-cell">PA</th>
                      <th className="num-cell">Diff</th>
                      <th className="num-cell">Str</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTeams.map((t, i) => {
                      const isWStreak = t.streak?.startsWith('W');
                      return (
                        <tr key={t.slug}>
                          <td className="rank-cell">{i + 1}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <LogoImage
                                src={getTeamLogoPath(t.slug)}
                                alt={t.team}
                                style={{ width: 20, height: 20, objectFit: 'contain', flexShrink: 0 }}
                              />
                              <Link href={`/teams/${t.slug}`} style={{ color: 'var(--text)', fontWeight: 600, fontSize: 13 }}>
                                {t.team}
                              </Link>
                            </div>
                          </td>
                          <td className="num-cell mono" style={{ color: 'var(--result-w)', fontWeight: 700 }}>{t.wins}</td>
                          <td className="num-cell mono" style={{ color: 'var(--result-l)' }}>{t.losses}</td>
                          <td className="num-cell mono">{t.pf.toFixed(1)}</td>
                          <td className="num-cell mono">{t.pa.toFixed(1)}</td>
                          <td className="num-cell mono" style={{ color: t.diff >= 0 ? 'var(--result-w)' : 'var(--result-l)', fontWeight: 600 }}>
                            {t.diff >= 0 ? '+' : ''}{t.diff.toFixed(1)}
                          </td>
                          <td className="num-cell mono" style={{ fontSize: 11, color: isWStreak ? 'var(--result-w)' : t.streak ? 'var(--result-l)' : 'var(--text-muted)' }}>
                            {t.streak || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Fighters by WAR */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Top Fighters</span>
                <Link href="/fighters" style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--accent)', letterSpacing: '0.04em' }}>
                  View all →
                </Link>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 28 }}>#</th>
                      <th>Fighter</th>
                      <th className="num-cell">WAR</th>
                      <th className="num-cell">W-L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topFighters.map((f, i) => (
                      <tr key={f.slug}>
                        <td className="rank-cell">{i + 1}</td>
                        <td>
                          <Link href={`/fighters/${f.slug}`} style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 13 }}>
                            {f.name}
                          </Link>
                          <br />
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{f.team}</span>
                        </td>
                        <td className="num-cell mono">{f.war.toFixed(2)}</td>
                        <td className="num-cell mono">{f.record}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ── About TBL ── */}
          <div className="about-section">
            <div className="about-grid">
              <div className="card about-card">
                <h2>About Team Boxing League</h2>
                <p>
                  Team Boxing League (TBL) is a competitive boxing organization where fighters
                  compete as members of 12 teams across multiple weight classes, in both men&apos;s
                  and women&apos;s divisions. Each match contributes to team standings through
                  round-by-round scoring.
                </p>
                <p style={{ marginTop: 12 }}>
                  <a href="https://teamboxingleague.com" target="_blank" rel="noopener noreferrer">
                    teamboxingleague.com ↗
                  </a>
                  {' '}·{' '}
                  <a href="https://instagram.com/teamboxingleague" target="_blank" rel="noopener noreferrer">
                    Instagram ↗
                  </a>
                </p>
              </div>
              <div className="card about-card">
                <h2>Stat Glossary</h2>
                <ul>
                  <li><strong>WAR</strong> — Wins Above Replacement</li>
                  <li><strong>NPPR</strong> — Net Points Per Round</li>
                  <li><strong>Net Pts</strong> — Total net points scored across all rounds</li>
                  <li><strong>Win%</strong> — Round win percentage</li>
                  <li><strong>PF / PA</strong> — Points For / Points Against (team)</li>
                  <li><strong>Diff</strong> — Point differential (PF − PA)</li>
                  <li><strong>Streak</strong> — Current win/loss streak (W3 = 3-win streak)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
