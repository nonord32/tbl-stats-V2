// src/app/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { extractUniqueMatches, getAllData } from '@/lib/data';
import { createClient } from '@/lib/supabase/server';
import { isPickOpen } from '@/lib/gameTime';
import {
  getCurrentWeek,
  getDisplayedCurrentWeek,
  getLastCompletedWeek,
} from '@/lib/week';
import { HighlightsSection } from '@/components/HighlightsSection';
import { HighlightsMarquee } from '@/components/HighlightsMarquee';
import { WeekBanner } from '@/components/home/WeekBanner';
import { UserPickSummary } from '@/components/home/UserPickSummary';
import { ThisWeekMatchups } from '@/components/home/ThisWeekMatchups';
import { LastWeekRecap } from '@/components/home/LastWeekRecap';
import type { UserPick } from '@/types';

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
  const supabase = await createClient();

  const [data, userResult] = await Promise.all([
    getAllData(),
    supabase.auth.getUser(),
  ]);
  const user = userResult.data.user;

  const { fighters, teams, teamMatches, schedule, highlights } = data;
  const homeHighlights = highlights.filter((h) => h.page === 'home');

  // Week detection: picks-open (strict) drives openMatchCount & banner copy,
  // displayed falls back to the earliest Upcoming week so the homepage still
  // shows "Week N" once picks have locked but results aren't published yet.
  const openCurrentWeek = getCurrentWeek(schedule);
  const displayedCurrentWeek = openCurrentWeek ?? getDisplayedCurrentWeek(schedule);
  const lastWeek = getLastCompletedWeek(schedule);

  // This week's matchups — all Upcoming rows for the displayed week
  const thisWeekMatchups = displayedCurrentWeek !== null
    ? schedule.filter(
        (s) => s.status === 'Upcoming' && Number(s.week) === displayedCurrentWeek
      )
    : [];

  // Count of matches still open for picks (drives banner + user strip copy)
  const openMatchCount = thisWeekMatchups.filter(
    (s) => s.matchIndex !== null && isPickOpen(s.date, s.time, s.venueCity)
  ).length;

  // Last week recap — completed schedule rows joined to MatchResult for scores
  const lastWeekScheduleIndexes = new Set(
    lastWeek !== null
      ? schedule
          .filter(
            (s) =>
              s.status === 'Completed' &&
              Number(s.week) === lastWeek &&
              s.matchIndex !== null
          )
          .map((s) => s.matchIndex as number)
      : []
  );
  const lastWeekMatches =
    lastWeekScheduleIndexes.size > 0
      ? extractUniqueMatches(teamMatches).filter((m) =>
          lastWeekScheduleIndexes.has(m.matchIndex)
        )
      : [];

  // User picks (only fetched if logged in)
  let picks: UserPick[] = [];
  if (user) {
    const { data: picksData } = await supabase
      .from('picks')
      .select('*')
      .eq('user_id', user.id);
    picks = (picksData ?? []) as UserPick[];
  }

  const thisWeekMatchIndexes = new Set(
    thisWeekMatchups
      .filter((s) => s.matchIndex !== null)
      .map((s) => s.matchIndex as number)
  );
  const pickedThisWeekIndexes = new Set(
    picks
      .filter((p) => thisWeekMatchIndexes.has(p.match_index))
      .map((p) => p.match_index)
  );

  const pointsLastWeek = user
    ? picks
        .filter((p) => lastWeekScheduleIndexes.has(p.match_index))
        .reduce((sum, p) => sum + (p.points_earned ?? 0), 0)
    : null;

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
      <WeekBanner week={openCurrentWeek} openMatchCount={openMatchCount} />

      {/* ── Logged-in user strip ── */}
      <UserPickSummary
        isSignedIn={!!user}
        currentWeek={displayedCurrentWeek}
        lastWeek={lastWeek}
        openMatchCount={openMatchCount}
        picksThisWeekCount={pickedThisWeekIndexes.size}
        pointsLastWeek={pointsLastWeek}
      />

      {/* ── Quick Nav Cards ── */}
      <section className="page" style={{ paddingTop: 24 }}>
        <div className="container">
          {/* ── This Week + Last Week Recap ── */}
          {displayedCurrentWeek !== null && (
            <ThisWeekMatchups
              week={displayedCurrentWeek}
              matches={thisWeekMatchups}
              pickedMatchIndexes={pickedThisWeekIndexes}
            />
          )}
          {lastWeek !== null && (
            <LastWeekRecap
              week={lastWeek}
              matches={lastWeekMatches}
              inProgress={lastWeek === displayedCurrentWeek}
            />
          )}

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
