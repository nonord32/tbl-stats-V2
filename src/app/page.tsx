// src/app/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllData } from '@/lib/data';

export const metadata: Metadata = {
  title: 'TBL Stats — Official Stats of Team Boxing League',
  description:
    'Official Fighter Rankings, Team Standings, WAR, NPPR, and full fight history for Team Boxing League (TBL). Updated live from the official data sheet.',
};

export const revalidate = 300;
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const data = await getAllData();
  const { fighters, teams, lastUpdated } = data;

  const topFighters = [...fighters]
    .sort((a, b) => b.war - a.war)
    .slice(0, 5);

  const topTeams = [...teams]
    .sort((a, b) => b.wins - a.wins || b.diff - a.diff)
    .slice(0, 5);

  const updatedStr = new Date(lastUpdated).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  return (
    <>
      {/* ── Hero ── */}
      <section className="home-hero">
        <div className="container">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/tbl-logo.png"
            alt="Team Boxing League"
            style={{ height: 72, marginBottom: 20, objectFit: 'contain' }}
          />
          <h1>
            Official Stats of{' '}
            <span>Team Boxing League</span>
          </h1>
          <p>
            Fighter rankings, WAR, NPPR, team standings, and full fight history for
            every round of the 2026 TBL season.
          </p>
          <div className="home-hero-btns">
            <Link href="/fighters" className="btn btn-primary">
              Fighter Stats
            </Link>
            <Link href="/teams" className="btn btn-outline">
              Team Standings
            </Link>
            <a
              href="https://teamboxingleague.com"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline"
            >
              TBL Official Site ↗
            </a>
          </div>
          <p style={{ marginTop: 20, fontSize: 11, opacity: 0.45, fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.05em' }}>
            Last updated: {updatedStr}
          </p>
        </div>
      </section>

      {/* ── Quick Nav Cards ── */}
      <section className="page">
        <div className="container">
          <div className="quick-nav">
            <Link href="/fighters" className="card quick-nav-card">
              <h3>Fighter Stats</h3>
              <p>
                Individual rankings by WAR, NPPR, Net Points, Win%, and more.
                Filter by weight class, team, or gender. Click any fighter for
                full fight history.
              </p>
              <p style={{ marginTop: 12, fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--accent)' }}>
                {fighters.length} fighters →
              </p>
            </Link>
            <Link href="/teams" className="card quick-nav-card">
              <h3>Team Standings</h3>
              <p>
                Team records, Points For / Against, differential, and streaks.
                Click any team for full round-by-round box scores.
              </p>
              <p style={{ marginTop: 12, fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--accent)' }}>
                {teams.length} teams →
              </p>
            </Link>
          </div>

          {/* ── Top Performers Preview ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 40 }}>
            {/* Top Fighters by WAR */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Top Fighters by WAR</span>
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
                      <th className="num-cell">WAR</th>
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
                        <td className="num-cell mono">{f.war.toFixed(2)}</td>
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
