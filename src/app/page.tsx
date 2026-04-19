// src/app/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllData } from '@/lib/data';
import { HighlightsSection } from '@/components/HighlightsSection';
import { HighlightsMarquee } from '@/components/HighlightsMarquee';

export const metadata: Metadata = {
  // absolute bypasses the layout template so we don't get double-suffix
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
export const dynamic = 'force-dynamic';

const SITE_URL = 'https://tblstats.com';

export default async function HomePage() {
  const data = await getAllData();
  const { fighters, teams, highlights } = data;
  const homeHighlights = highlights.filter((h) => h.page === 'home');

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
    .sort((a, b) => b.netPts - a.netPts)
    .slice(0, 5);

  const topTeams = [...teams]
    .sort((a, b) => b.wins - a.wins || b.diff - a.diff)
    .slice(0, 8);

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
            Every Round. Every Fighter. Every Team.
          </h1>
          <p>
            Independent stats, standings, and fight results for Team Boxing League.
            Track fighter performance, team trends, and match outcomes all season long.
          </p>
        </div>
      </section>

      {/* ── Highlights Marquee ── */}
      {homeHighlights.length > 0 && <HighlightsMarquee highlights={homeHighlights} />}

      {/* ── Pick'em Banner ── */}
      <section style={{ padding: '16px 0 0' }}>
        <div className="container">
          <Link href="/picks" style={{ textDecoration: 'none', display: 'block' }}>
            <div style={{
              background: 'linear-gradient(135deg, #1a0a00 0%, #2d1200 60%, #1a0a00 100%)',
              border: '1px solid rgba(230,60,0,0.4)',
              borderRadius: 'var(--radius)',
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <path d="M9 12l2 2 4-4"/>
                  </svg>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent)' }}>
                    Pick&apos;em — Week 5
                  </span>
                </div>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: '#fff', margin: 0 }}>
                  Make your picks for the upcoming matches
                </p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: '4px 0 0' }}>
                  1pt for correct winner · 2pts for exact margin
                </p>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--accent)', whiteSpace: 'nowrap' }}>
                Pick now →
              </span>
            </div>
          </Link>
        </div>
      </section>

      {/* ── Quick Nav Cards ── */}
      <section className="page" style={{ paddingTop: 24 }}>
        <div className="container">
          {/* ── Top Performers Preview ── */}
          <div className="home-stats-grid">
            {/* Top Fighters by Net Points */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Top Fighters by Net Pts</span>
                <Link
                  href="/fighters"
                  style={{
                    fontFamily: 'IBM Plex Mono, monospace',
                    fontSize: 11,
                    color: 'var(--accent)',
                    letterSpacing: '0.04em',
                  }}
                >
                  View all →
                </Link>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 28 }}>#</th>
                      <th>Fighter</th>
                      <th className="num-cell">Net Pts</th>
                      <th className="num-cell">Record</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topFighters.map((f, i) => (
                      <tr key={f.slug}>
                        <td className="rank-cell">{i + 1}</td>
                        <td>
                          <Link href={`/fighters/${f.slug}`} style={{ color: 'var(--accent)', fontWeight: 600 }}>
                            {f.name}
                          </Link>
                          <br />
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{f.team}</span>
                        </td>
                        <td className="num-cell mono" style={{ color: f.netPts >= 0 ? 'var(--result-w)' : 'var(--result-l)' }}>
                          {f.netPts >= 0 ? '+' : ''}{f.netPts.toFixed(1)}
                        </td>
                        <td className="num-cell mono">{f.record}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Teams */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Team Standings</span>
                <Link
                  href="/teams"
                  style={{
                    fontFamily: 'IBM Plex Mono, monospace',
                    fontSize: 11,
                    color: 'var(--accent)',
                    letterSpacing: '0.04em',
                  }}
                >
                  View all →
                </Link>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 28 }}>#</th>
                      <th>Team</th>
                      <th className="num-cell">W-L</th>
                      <th className="num-cell">Diff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topTeams.map((t, i) => (
                      <tr key={t.slug}>
                        <td className="rank-cell">{i + 1}</td>
                        <td>
                          <Link href={`/teams/${t.slug}`} style={{ color: 'var(--accent)', fontWeight: 600 }}>
                            {t.team}
                          </Link>
                        </td>
                        <td className="num-cell mono">{t.record}</td>
                        <td className="num-cell mono" style={{ color: t.diff >= 0 ? 'var(--result-w)' : 'var(--result-l)' }}>
                          {t.diff >= 0 ? '+' : ''}{t.diff.toFixed(1)}
                        </td>
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
