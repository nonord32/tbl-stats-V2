// src/app/matches/[matchIndex]/page.tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getMatchByIndex, toSlug } from '@/lib/data';
import { getFullTeamName, getTeamColor } from '@/lib/teams';
import { LogoImage } from '@/components/LogoImage';

export const revalidate = 300;
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: { matchIndex: string };
}): Promise<Metadata> {
  const mi = parseInt(params.matchIndex, 10);
  if (isNaN(mi)) return { title: 'Match Not Found' };
  const match = await getMatchByIndex(mi);
  if (!match) return { title: 'Match Not Found' };
  const t1 = getFullTeamName(toSlug(match.team1));
  const t2 = getFullTeamName(toSlug(match.team2));
  return {
    title: `${t1} vs ${t2} — Box Score`,
    description: `${t1} ${match.score1.toFixed(1)} – ${match.score2.toFixed(1)} ${t2}. Full round-by-round box score from the 2026 TBL Season.`,
    openGraph: {
      url: `https://tblstats.com/matches/${mi}`,
      title: `${t1} vs ${t2} | TBL Stats`,
      description: `${t1} ${match.score1.toFixed(1)} – ${match.score2.toFixed(1)} ${t2}`,
      images: [{ url: '/og-image.png', width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${t1} vs ${t2} | TBL Stats`,
      description: `${t1} ${match.score1.toFixed(1)} – ${match.score2.toFixed(1)} ${t2}`,
      images: ['/og-image.png'],
    },
  };
}

export default async function MatchPage({
  params,
}: {
  params: { matchIndex: string };
}) {
  const mi = parseInt(params.matchIndex, 10);
  if (isNaN(mi)) notFound();

  const match = await getMatchByIndex(mi);
  if (!match) notFound();

  const team1Slug = toSlug(match.team1);
  const team2Slug = toSlug(match.team2);
  const team1Name = getFullTeamName(team1Slug);
  const team2Name = getFullTeamName(team2Slug);
  const team1Color = getTeamColor(team1Slug);
  const team2Color = getTeamColor(team2Slug);

  const team1Won = match.result === 'W';
  const team2Won = match.result === 'L';
  const isDraw = match.result === 'D';

  const phases = Array.from(new Set(match.boxScore.map((r) => r.phase).filter(Boolean)));
  const phaseTotals = phases.map((phase) => {
    const rows = match.boxScore.filter((r) => r.phase === phase);
    return {
      phase,
      score1: rows.reduce((s, r) => s + r.score1, 0),
      score2: rows.reduce((s, r) => s + r.score2, 0),
    };
  });

  const total1 = match.score1;
  const total2 = match.score2;

  const formattedDate = (() => {
    try {
      return new Date(match.date).toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      });
    } catch { return match.date; }
  })();

  const BASE = 'https://tblstats.com';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'TBL Stats', item: BASE },
          { '@type': 'ListItem', position: 2, name: 'Results', item: `${BASE}/results` },
          { '@type': 'ListItem', position: 3, name: `${team1Name} vs ${team2Name}`, item: `${BASE}/matches/${mi}` },
        ],
      },
      {
        '@type': 'SportsEvent',
        name: `${team1Name} vs ${team2Name}`,
        startDate: match.date,
        endDate: match.date,
        eventStatus: 'https://schema.org/EventCompleted',
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        sport: 'Boxing',
        url: `${BASE}/matches/${mi}`,
        image: `${BASE}/og-image.png`,
        description: `${team1Name} ${total1.toFixed(1)} – ${total2.toFixed(1)} ${team2Name}${team1Won ? `. ${team1Name} wins.` : team2Won ? `. ${team2Name} wins.` : ' · Draw.'}`,
        organizer: { '@type': 'SportsOrganization', name: 'Team Boxing League', url: 'https://teamboxingleague.com' },
        competitor: [
          { '@type': 'SportsTeam', name: team1Name },
          { '@type': 'SportsTeam', name: team2Name },
        ],
        ...(team1Won
          ? { winner: { '@type': 'SportsTeam', name: team1Name } }
          : team2Won
          ? { winner: { '@type': 'SportsTeam', name: team2Name } }
          : {}),
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
        <div className="container">
          {/* Breadcrumb */}
          <div style={{ marginBottom: 16, fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: 'var(--text-muted)' }}>
            <Link href="/" style={{ color: 'var(--text-muted)' }}>Home</Link>
            {' / '}
            <Link href="/results" style={{ color: 'var(--text-muted)' }}>Results</Link>
            {' / '}
            <span style={{ color: 'var(--text)' }}>{team1Name} vs {team2Name}</span>
          </div>

          {/* Hero matchup card */}
          <div className="card" style={{ marginBottom: 24 }}>
            <div style={{ padding: '8px 0 20px', textAlign: 'center' }}>
              <div style={{
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: 11,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 20,
              }}>
                {formattedDate} · 2026 TBL Season
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, flexWrap: 'wrap' }}>
                {/* Team 1 */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, minWidth: 120 }}>
                  <LogoImage
                    src={`/logos/${team1Slug}.png`}
                    alt={team1Name}
                    style={{ width: 64, height: 64, objectFit: 'contain' }}
                  />
                  <Link
                    href={`/teams/${team1Slug}`}
                    style={{ fontWeight: 700, fontSize: 15, color: team1Color || 'var(--accent)', textAlign: 'center' }}
                  >
                    {team1Name}
                  </Link>
                  {team1Won && <span className="badge badge-win" style={{ fontSize: 11 }}>WIN</span>}
                  {isDraw && !team1Won && <span className="badge" style={{ fontSize: 11 }}>DRAW</span>}
                </div>

                {/* Score */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    fontFamily: 'IBM Plex Mono, monospace',
                    fontSize: 'clamp(28px, 6vw, 44px)',
                    fontWeight: 700,
                    lineHeight: 1,
                    letterSpacing: '-0.02em',
                  }}>
                    <span style={{ color: team1Won ? 'var(--result-w)' : team2Won ? 'var(--result-l)' : 'var(--text)' }}>
                      {total1.toFixed(1)}
                    </span>
                    <span style={{ color: 'var(--text-muted)', margin: '0 10px', fontWeight: 400 }}>–</span>
                    <span style={{ color: team2Won ? 'var(--result-w)' : team1Won ? 'var(--result-l)' : 'var(--text)' }}>
                      {total2.toFixed(1)}
                    </span>
                  </div>
                  <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                    {isDraw ? 'Draw' : `Rounds ${match.wins1}–${match.wins2}`}
                  </div>
                </div>

                {/* Team 2 */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, minWidth: 120 }}>
                  <LogoImage
                    src={`/logos/${team2Slug}.png`}
                    alt={team2Name}
                    style={{ width: 64, height: 64, objectFit: 'contain' }}
                  />
                  <Link
                    href={`/teams/${team2Slug}`}
                    style={{ fontWeight: 700, fontSize: 15, color: team2Color || 'var(--accent)', textAlign: 'center' }}
                  >
                    {team2Name}
                  </Link>
                  {team2Won && <span className="badge badge-win" style={{ fontSize: 11 }}>WIN</span>}
                  {isDraw && !team2Won && <span className="badge" style={{ fontSize: 11 }}>DRAW</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Phase scorecard strip */}
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header">
              <span className="card-title">Box Score</span>
            </div>
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
                    { label: team1Name, scores: phaseTotals.map((pt) => pt.score1), oppScores: phaseTotals.map((pt) => pt.score2), total: total1, oppTotal: total2 },
                    { label: team2Name, scores: phaseTotals.map((pt) => pt.score2), oppScores: phaseTotals.map((pt) => pt.score1), total: total2, oppTotal: total1 },
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
          </div>

          {/* Round-by-round breakdown */}
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header">
              <span className="card-title">Round-by-Round</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                {match.boxScore.length} bout{match.boxScore.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="results-phases">
              {phases.length > 0 ? (
                phases.map((phase) => {
                  const rows = match.boxScore.filter((r) => r.phase === phase);
                  const sub1 = rows.reduce((s, r) => s + r.score1, 0);
                  const sub2 = rows.reduce((s, r) => s + r.score2, 0);
                  return (
                    <div key={phase} className="results-phase-section">
                      <div className="results-phase-header">{phase || 'Rounds'}</div>
                      <div className="results-boxscore">
                        <table>
                          <thead>
                            <tr>
                              <th>Rnd</th>
                              <th>{team1Name}</th>
                              <th>{team2Name}</th>
                              <th className="num-cell">Score</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((row, i) => {
                              const home = row.score1 > row.score2;
                              const away = row.score2 > row.score1;
                              return (
                                <tr key={i}>
                                  <td className="mono" style={{ fontSize: 12, color: 'var(--text-muted)', width: 36 }}>{row.round}</td>
                                  <td style={{ fontWeight: home ? 700 : 400, fontSize: 13 }}>
                                    <Link href={`/fighters/${toSlug(row.fighter1)}`} style={{ color: home ? 'var(--accent)' : 'var(--text)' }}>
                                      {row.fighter1}
                                    </Link>
                                  </td>
                                  <td style={{ fontWeight: away ? 700 : 400, fontSize: 13 }}>
                                    <Link href={`/fighters/${toSlug(row.fighter2)}`} style={{ color: away ? 'var(--accent)' : 'var(--text)' }}>
                                      {row.fighter2}
                                    </Link>
                                  </td>
                                  <td className="num-cell mono" style={{ fontSize: 12 }}>
                                    <span style={{ color: home ? 'var(--result-w)' : 'var(--text-muted)' }}>{row.score1.toFixed(1)}</span>
                                    {' – '}
                                    <span style={{ color: away ? 'var(--result-w)' : 'var(--text-muted)' }}>{row.score2.toFixed(1)}</span>
                                  </td>
                                </tr>
                              );
                            })}
                            <tr className="results-phase-subtotal">
                              <td className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>SUB</td>
                              <td /><td />
                              <td className="num-cell mono" style={{ fontSize: 12 }}>
                                <span style={{ color: sub1 > sub2 ? 'var(--result-w)' : sub1 < sub2 ? 'var(--result-l)' : 'var(--text-muted)' }}>{sub1.toFixed(1)}</span>
                                {' – '}
                                <span style={{ color: sub2 > sub1 ? 'var(--result-w)' : sub2 < sub1 ? 'var(--result-l)' : 'var(--text-muted)' }}>{sub2.toFixed(1)}</span>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })
              ) : (
                // Fallback: no phase data
                <div className="results-boxscore">
                  <table>
                    <thead>
                      <tr>
                        <th>Rnd</th>
                        <th>{team1Name}</th>
                        <th>{team2Name}</th>
                        <th className="num-cell">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {match.boxScore.map((row, i) => {
                        const home = row.score1 > row.score2;
                        const away = row.score2 > row.score1;
                        return (
                          <tr key={i}>
                            <td className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{row.round}</td>
                            <td style={{ fontWeight: home ? 700 : 400 }}>
                              <Link href={`/fighters/${toSlug(row.fighter1)}`} style={{ color: home ? 'var(--accent)' : 'var(--text)' }}>{row.fighter1}</Link>
                            </td>
                            <td style={{ fontWeight: away ? 700 : 400 }}>
                              <Link href={`/fighters/${toSlug(row.fighter2)}`} style={{ color: away ? 'var(--accent)' : 'var(--text)' }}>{row.fighter2}</Link>
                            </td>
                            <td className="num-cell mono" style={{ fontSize: 12 }}>
                              <span style={{ color: home ? 'var(--result-w)' : 'var(--text-muted)' }}>{row.score1.toFixed(1)}</span>
                              {' – '}
                              <span style={{ color: away ? 'var(--result-w)' : 'var(--text-muted)' }}>{row.score2.toFixed(1)}</span>
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

          {/* Navigation */}
          <div style={{ marginTop: 20, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <Link href="/results" style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: 'var(--text-muted)' }}>
              ← Back to Results
            </Link>
            <Link href={`/teams/${team1Slug}`} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: 'var(--accent)' }}>
              {team1Name} →
            </Link>
            <Link href={`/teams/${team2Slug}`} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: 'var(--accent)' }}>
              {team2Name} →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
