// src/app/teams/[slug]/page.tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getAllData, getTeamBySlug, calcTeamStreak } from '@/lib/data';
import { getTeamColor, getTeamLogoPath } from '@/lib/teams';
import { LogoImage } from '@/components/LogoImage';
import type { TeamMatch, BoxScoreRound } from '@/types';

export const revalidate = 300;
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const result = await getTeamBySlug(params.slug);
  if (!result) return { title: 'Team Not Found' };
  const { team } = result;
  return {
    title: `${team.team} — Team Standings`,
    description: `${team.team} TBL record: ${team.record}, PF ${team.pf.toFixed(1)}, PA ${team.pa.toFixed(1)}, Diff ${team.diff >= 0 ? '+' : ''}${team.diff.toFixed(1)}. Full box scores and round-by-round breakdown.`,
    openGraph: {
      title: `${team.team} | TBL Stats`,
      description: `${team.record} · ${team.pf.toFixed(1)} PF · ${team.pa.toFixed(1)} PA`,
    },
  };
}

function MatchCard({ match, teamName }: { match: TeamMatch; teamName: string }) {
  const totalHome = match.boxScore.reduce((s, r) => s + r.score1, 0);
  const totalAway = match.boxScore.reduce((s, r) => s + r.score2, 0);

  return (
    <div className="match-card" style={{ marginBottom: 24 }}>
      <div className="match-card-header">
        <div>
          <span className="matchup">
            {teamName} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>vs</span> {match.opponent}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span
            className={`result-${match.result.toLowerCase()}`}
            style={{ fontSize: 15, fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace' }}
          >
            {match.result === 'W' ? 'WIN' : match.result === 'L' ? 'LOSS' : 'DRAW'}
          </span>
          <span className="badge">
            {match.pf.toFixed(1)} – {match.pa.toFixed(1)}
          </span>
          <span className="match-date">{match.date}</span>
        </div>
      </div>

      <div
        className="table-wrap"
        style={{
          border: '1px solid var(--border)',
          borderTop: 'none',
          borderRadius: '0 0 var(--radius) var(--radius)',
        }}
      >
        <table>
          <thead>
            <tr>
              <th>Rnd</th>
              <th>Phase</th>
              <th>{teamName}</th>
              <th>{match.opponent}</th>
              <th className="num-cell">Score</th>
              <th>Winner</th>
            </tr>
          </thead>
          <tbody>
            {match.boxScore.map((row: BoxScoreRound, ri: number) => {
              const homeWon = row.score1 > row.score2;
              const awayWon = row.score2 > row.score1;
              return (
                <tr key={ri}>
                  <td className="mono" style={{ fontSize: 12 }}>{row.round}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{row.phase}</td>
                  <td style={{ fontWeight: homeWon ? 700 : 400 }}>
                    <Link
                      href={`/fighters/${row.fighter1.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-')}`}
                      style={{ color: homeWon ? 'var(--accent)' : 'var(--text)' }}
                    >
                      {row.fighter1}
                    </Link>
                  </td>
                  <td style={{ fontWeight: awayWon ? 700 : 400 }}>
                    <Link
                      href={`/fighters/${row.fighter2.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-')}`}
                      style={{ color: awayWon ? 'var(--accent)' : 'var(--text)' }}
                    >
                      {row.fighter2}
                    </Link>
                  </td>
                  <td className="num-cell mono" style={{ fontSize: 12 }}>
                    <span style={{ color: homeWon ? 'var(--result-w)' : 'var(--text-muted)' }}>
                      {row.score1.toFixed(1)}
                    </span>
                    {' – '}
                    <span style={{ color: awayWon ? 'var(--result-w)' : 'var(--text-muted)' }}>
                      {row.score2.toFixed(1)}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{row.winner}</td>
                </tr>
              );
            })}
            {/* Totals row */}
            <tr style={{ background: 'var(--bg-table-alt)', fontWeight: 700 }}>
              <td colSpan={2} className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                TOTAL
              </td>
              <td />
              <td />
              <td className="num-cell mono" style={{ fontSize: 13 }}>
                <span style={{ color: totalHome > totalAway ? 'var(--result-w)' : totalHome < totalAway ? 'var(--result-l)' : 'var(--text)' }}>
                  {totalHome.toFixed(1)}
                </span>
                {' – '}
                <span style={{ color: totalAway > totalHome ? 'var(--result-w)' : totalAway < totalHome ? 'var(--result-l)' : 'var(--text)' }}>
                  {totalAway.toFixed(1)}
                </span>
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function TeamPage({ params }: { params: { slug: string } }) {
  const result = await getTeamBySlug(params.slug);
  if (!result) notFound();

  const { team, matches } = result;
  const streak = team.streak || calcTeamStreak(matches);
  const isWStreak = streak.startsWith('W');

  const teamColor = getTeamColor(team.slug);
  const teamLogoPath = getTeamLogoPath(team.slug);

  const BASE = 'https://tblstats.com';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'TBL Stats',       item: BASE },
          { '@type': 'ListItem', position: 2, name: 'Team Standings',  item: `${BASE}/teams` },
          { '@type': 'ListItem', position: 3, name: team.team,         item: `${BASE}/teams/${team.slug}` },
        ],
      },
      {
        '@type': 'SportsTeam',
        name: team.team,
        sport: 'Boxing',
        url: `${BASE}/teams/${team.slug}`,
        memberOf: { '@type': 'SportsOrganization', name: 'Team Boxing League', url: 'https://teamboxingleague.com' },
      },
    ],
  };

  return (
    <>
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
    <div className="page">
      <div className="container-wide">
        {/* Breadcrumb */}
        <div
          style={{
            marginBottom: 16,
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: 12,
            color: 'var(--text-muted)',
          }}
        >
          <Link href="/" style={{ color: 'var(--text-muted)' }}>Home</Link>
          {' / '}
          <Link href="/teams" style={{ color: 'var(--text-muted)' }}>Teams</Link>
          {' / '}
          <span style={{ color: 'var(--text)' }}>{team.team}</span>
        </div>

        {/* SEO intro */}
        <p className="page-intro">
          The {team.team} are a Team Boxing League team with a {team.record} record this season.
          View their recent match results and overall performance throughout the season.
        </p>

        {/* Hero */}
        <div
          className="card team-hero"
          style={{
            marginBottom: 24,
            borderTop: teamColor ? `4px solid ${teamColor}` : undefined,
          }}
        >
          <LogoImage
            src={teamLogoPath}
            alt={team.team}
            className="team-hero-logo"
          />
          <div>
            <h1>{team.team}</h1>
            <div className="team-stat-row">
              <div className="team-stat">
                <span className="label">Record</span>
                <span className="value">{team.record}</span>
              </div>
              <div className="team-stat">
                <span className="label">PF</span>
                <span className="value">{team.pf.toFixed(1)}</span>
              </div>
              <div className="team-stat">
                <span className="label">PA</span>
                <span className="value">{team.pa.toFixed(1)}</span>
              </div>
              <div className="team-stat">
                <span className="label">Diff</span>
                <span
                  className="value"
                  style={{ color: team.diff >= 0 ? 'var(--result-w)' : 'var(--result-l)' }}
                >
                  {team.diff >= 0 ? '+' : ''}{team.diff.toFixed(1)}
                </span>
              </div>
              {streak && (
                <div className="team-stat">
                  <span className="label">Streak</span>
                  <span
                    className="value"
                    style={{
                      color: isWStreak ? 'var(--result-w)' : 'var(--result-l)',
                      fontSize: 18,
                    }}
                  >
                    {streak}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Match history */}
        <div className="page-header" style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: 18 }}>Match Box Scores</h1>
          <div className="subtitle">
            {matches.length} match{matches.length !== 1 ? 'es' : ''} · 2026 TBL Season
          </div>
        </div>

        {matches.length === 0 ? (
          <div className="card">
            <div className="loading">No match data available</div>
          </div>
        ) : (
          matches.map((match: TeamMatch, i: number) => (
            <MatchCard key={i} match={match} teamName={team.team} />
          ))
        )}

        {/* Back link */}
        <div style={{ marginTop: 20 }}>
          <Link
            href="/teams"
            style={{
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: 12,
              color: 'var(--text-muted)',
            }}
          >
            ← Back to Team Standings
          </Link>
        </div>
      </div>
    </div>
    </>
  );
}
