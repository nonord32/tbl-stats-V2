// src/app/teams/[slug]/page.tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getTeamBySlug, calcTeamStreak, toSlug } from '@/lib/data';
import { getTeamColor, getTeamLogoPath, getFullTeamName } from '@/lib/teams';
import { LogoImage } from '@/components/LogoImage';
import { HighlightsSection } from '@/components/HighlightsSection';
import type { TeamMatch, BoxScoreRound, FighterStat, ScheduleEntry } from '@/types';

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
      url: `https://tblstats.com/teams/${params.slug}`,
      title: `${team.team} | TBL Stats`,
      description: `${team.record} · ${team.pf.toFixed(1)} PF · ${team.pa.toFixed(1)} PA`,
      images: [{ url: '/og-image.png', width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${team.team} | TBL Stats`,
      description: `${team.team} · ${team.record} · ${team.pf.toFixed(1)} PF · ${team.pa.toFixed(1)} PA`,
      images: ['/og-image.png'],
    },
  };
}

function MatchSummaryCard({ match, teamName }: { match: TeamMatch; teamName: string }) {
  const phases = Array.from(new Set(match.boxScore.map((r: BoxScoreRound) => r.phase).filter(Boolean)));
  const phaseTotals = phases.map((phase) => {
    const rows = match.boxScore.filter((r: BoxScoreRound) => r.phase === phase);
    return {
      phase,
      score1: rows.reduce((s: number, r: BoxScoreRound) => s + r.score1, 0),
      score2: rows.reduce((s: number, r: BoxScoreRound) => s + r.score2, 0),
    };
  });

  const total1 = match.pf;
  const total2 = match.pa;
  const opponentSlug = toSlug(match.opponent);
  const opponentFullName = getFullTeamName(opponentSlug);

  const formattedDate = (() => {
    try {
      return new Date(match.date).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      });
    } catch { return match.date; }
  })();

  return (
    <div className="match-card" style={{ marginBottom: 20 }}>
      <div className="match-card-header">
        <div>
          <span className="matchup">
            {teamName} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>vs</span>{' '}
            <Link href={`/teams/${opponentSlug}`} style={{ color: 'var(--accent)' }}>
              {opponentFullName}
            </Link>
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
          <span className="match-date">{formattedDate}</span>
        </div>
      </div>

      {/* Phase scorecard strip */}
      <div style={{ border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 var(--radius) var(--radius)', overflow: 'hidden' }}>
        <div className="results-scorecard-wrap">
          <table className="results-scorecard">
            <thead>
              <tr>
                <th className="results-scorecard-team-col">Team</th>
                {phaseTotals.map((pt) => (
                  <th key={pt.phase} className="results-scorecard-phase-col">{pt.phase || 'Rounds'}</th>
                ))}
                <th className="results-scorecard-total-col">Total</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: teamName, scores: phaseTotals.map((pt) => pt.score1), oppScores: phaseTotals.map((pt) => pt.score2), total: total1, oppTotal: total2 },
                { label: opponentFullName, scores: phaseTotals.map((pt) => pt.score2), oppScores: phaseTotals.map((pt) => pt.score1), total: total2, oppTotal: total1 },
              ].map(({ label, scores, oppScores, total, oppTotal }) => (
                <tr key={label}>
                  <td className="results-scorecard-team-name">{label}</td>
                  {scores.map((score, i) => {
                    const opp = oppScores[i];
                    const color = score > opp ? 'var(--result-w)' : score < opp ? 'var(--result-l)' : 'var(--text)';
                    return (
                      <td key={i} className="results-scorecard-cell" style={{ color, fontWeight: score > opp ? 700 : 400 }}>
                        {score.toFixed(1)}
                      </td>
                    );
                  })}
                  <td
                    className="results-scorecard-cell results-scorecard-total"
                    style={{
                      color: total > oppTotal ? 'var(--result-w)' : total < oppTotal ? 'var(--result-l)' : 'var(--text)',
                      fontWeight: 700,
                    }}
                  >
                    {total.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Link to full match detail */}
        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', textAlign: 'right' }}>
          <Link
            href={`/matches/${match.matchIndex}`}
            style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--accent)' }}
          >
            Full match breakdown →
          </Link>
        </div>
      </div>
    </div>
  );
}

function NextMatchCard({ entry, teamName }: { entry: ScheduleEntry; teamName: string }) {
  const formattedDate = (() => {
    try {
      return new Date(entry.date).toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
      });
    } catch { return entry.date; }
  })();

  const opponent = entry.team1.toLowerCase().includes(teamName.split(' ')[0].toLowerCase())
    ? entry.team2
    : entry.team1;
  const opponentSlug = toSlug(opponent);
  const opponentFullName = getFullTeamName(opponentSlug);

  return (
    <div className="card" style={{ marginBottom: 24, borderLeft: '4px solid var(--accent)', padding: '14px 20px' }}>
      <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 8 }}>
        Next Match
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px', alignItems: 'baseline' }}>
        <span style={{ fontWeight: 700, fontSize: 15 }}>
          vs{' '}
          <Link href={`/teams/${opponentSlug}`} style={{ color: 'var(--accent)' }}>
            {opponentFullName}
          </Link>
        </span>
        <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: 'var(--text-muted)' }}>{formattedDate}</span>
        {entry.time && <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: 'var(--text-muted)' }}>{entry.time}</span>}
        {entry.venueName && (
          <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: 'var(--text-muted)' }}>
            {entry.venueName}{entry.venueCity ? `, ${entry.venueCity}` : ''}
          </span>
        )}
      </div>
    </div>
  );
}

function RosterSection({ fighters }: { fighters: FighterStat[] }) {
  if (fighters.length === 0) return null;
  const sorted = [...fighters].sort((a, b) => b.war - a.war);
  return (
    <div style={{ marginBottom: 32 }}>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 18 }}>Roster</h2>
        <div className="subtitle">{sorted.length} fighter{sorted.length !== 1 ? 's' : ''}</div>
      </div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ textAlign: 'left', padding: '10px 16px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Fighter</th>
              <th style={{ textAlign: 'left', padding: '10px 8px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Weight</th>
              <th style={{ textAlign: 'center', padding: '10px 8px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Record</th>
              <th style={{ textAlign: 'right', padding: '10px 16px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>WAR</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((f, i) => (
              <tr key={f.slug} style={{ borderBottom: i < sorted.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <td style={{ padding: '10px 16px' }}>
                  <Link href={`/fighters/${f.slug}`} style={{ fontWeight: 600, color: 'var(--text)' }}>
                    {f.name}
                  </Link>
                </td>
                <td style={{ padding: '10px 8px', fontSize: 13, color: 'var(--text-muted)' }}>{f.weightClass}</td>
                <td style={{ padding: '10px 8px', textAlign: 'center', fontFamily: 'IBM Plex Mono, monospace', fontSize: 13 }}>{f.record}</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>{f.war.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function TeamPage({ params }: { params: { slug: string } }) {
  const result = await getTeamBySlug(params.slug);
  if (!result) notFound();

  const { team, matches, roster, nextMatch, highlights } = result;
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

        {/* Next match callout */}
        {nextMatch && <NextMatchCard entry={nextMatch} teamName={team.team} />}

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
            <MatchSummaryCard key={i} match={match} teamName={team.team} />
          ))
        )}

        {/* Highlights */}
        <HighlightsSection highlights={highlights} />

        {/* Roster */}
        <RosterSection fighters={roster} />

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
