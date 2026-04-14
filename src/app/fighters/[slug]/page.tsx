// src/app/fighters/[slug]/page.tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getAllData, getFighterBySlug, calcFighterStreak } from '@/lib/data';
import { LogoImage } from '@/components/LogoImage';
import type { FightHistory } from '@/types';

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
  return {
    title: `${fighter.name} — ${fighter.team}`,
    description: `${fighter.name} TBL stats: ${fighter.record} record, WAR ${fighter.war.toFixed(2)}, NPPR ${fighter.nppr.toFixed(3)}, Net Points ${fighter.netPts.toFixed(1)}. ${fighter.weightClass} · ${fighter.gender}.`,
    openGraph: {
      title: `${fighter.name} | TBL Stats`,
      description: `${fighter.record} · WAR ${fighter.war.toFixed(2)} · ${fighter.team}`,
    },
  };
}

export default async function FighterPage({ params }: { params: { slug: string } }) {
  const result = await getFighterBySlug(params.slug);
  if (!result) notFound();

  const { fighter, history, streak } = result;

  const isWStreak = streak.startsWith('W');

  return (
    <div className="page">
      <div className="container">
        {/* Breadcrumb */}
        <div style={{ marginBottom: 16, fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: 'var(--text-muted)' }}>
          <Link href="/" style={{ color: 'var(--text-muted)' }}>Home</Link>
          {' / '}
          <Link href="/fighters" style={{ color: 'var(--text-muted)' }}>Fighters</Link>
          {' / '}
          <span style={{ color: 'var(--text)' }}>{fighter.name}</span>
        </div>

        {/* SEO intro */}
        <p className="page-intro">
          {fighter.name} is a {fighter.weightClass} fighter competing for the {fighter.team} in Team Boxing League.
          View their stats, performance, and results from the current season.
        </p>

        {/* Hero card */}
        <div className="card fighter-hero" style={{ marginBottom: 24 }}>
          <LogoImage
            src={`/logos/${fighter.team.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}.png`}
            alt={fighter.team}
            className="fighter-hero-logo"
          />
          <div className="fighter-hero-info">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ margin: 0 }}>{fighter.name}</h1>
              {fighter.instagram && (
                <a
                  href={fighter.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${fighter.name} on Instagram`}
                  title="Instagram"
                  style={{ color: 'var(--text-muted)', lineHeight: 0, flexShrink: 0 }}
                  className="ig-link"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                    <circle cx="12" cy="12" r="4"/>
                    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
                  </svg>
                </a>
              )}
            </div>
            <div className="fighter-hero-meta">
              <span className="badge">{fighter.team}</span>
              <span className="badge">{fighter.weightClass}</span>
              <span className="badge">{fighter.gender}</span>
              {streak && (
                <span className={`badge ${isWStreak ? 'badge-win' : 'badge-loss'}`}>
                  {isWStreak ? '🔥' : ''} {streak} Streak
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <span className="card-title">Career Stats</span>
            <span className="last-updated">2026 TBL Season</span>
          </div>
          <div className="stat-grid">
            <div className="stat-box">
              <span className="label">Record</span>
              <span className="value">{fighter.record}</span>
            </div>
            <div className="stat-box">
              <span className="label">WAR</span>
              <span className="value accent">{fighter.war.toFixed(2)}</span>
            </div>
            <div className="stat-box">
              <span className="label">NPPR</span>
              <span className="value">{fighter.nppr.toFixed(3)}</span>
            </div>
            <div className="stat-box">
              <span className="label">Net Pts</span>
              <span className="value" style={{ color: fighter.netPts >= 0 ? 'var(--result-w)' : 'var(--result-l)' }}>
                {fighter.netPts >= 0 ? '+' : ''}{fighter.netPts.toFixed(1)}
              </span>
            </div>
            <div className="stat-box">
              <span className="label">Win%</span>
              <span className="value">{(fighter.winPct * 100).toFixed(1)}%</span>
            </div>
            <div className="stat-box">
              <span className="label">Rounds</span>
              <span className="value">{fighter.rounds}</span>
            </div>
            <div className="stat-box">
              <span className="label">Wins</span>
              <span className="value" style={{ color: 'var(--result-w)' }}>{fighter.wins}</span>
            </div>
            <div className="stat-box">
              <span className="label">Losses</span>
              <span className="value" style={{ color: 'var(--result-l)' }}>{fighter.losses}</span>
            </div>
            {streak && (
              <div className="stat-box">
                <span className="label">Streak</span>
                <span className="value" style={{ color: isWStreak ? 'var(--result-w)' : 'var(--result-l)' }}>
                  {streak}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Fight history */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Fight History</span>
            <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--text-muted)' }}>
              {history.length} round{history.length !== 1 ? 's' : ''}
            </span>
          </div>
          {history.length === 0 ? (
            <div className="loading">No fight data available</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Opponent</th>
                    <th>Opp. Team</th>
                    <th>Weight</th>
                    <th>Round</th>
                    <th>Phase</th>
                    <th>Result</th>
                    <th className="num-cell">Net Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h: FightHistory, i: number) => (
                    <tr key={i}>
                      <td className="mono" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{h.date}</td>
                      <td style={{ fontWeight: 500 }}>
                        <Link href={`/fighters/${h.opponent.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-')}`} style={{ color: 'var(--accent)' }}>
                          {h.opponent}
                        </Link>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        <Link href={`/teams/${h.opponentTeam.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-')}`} style={{ color: 'var(--text-muted)' }}>
                          {h.opponentTeam}
                        </Link>
                      </td>
                      <td style={{ fontSize: 12 }}>{h.weightClass}</td>
                      <td className="mono" style={{ fontSize: 12 }}>{h.round}</td>
                      <td style={{ fontSize: 12 }}>{h.roundPhase}</td>
                      <td>
                        <span className={`result-${h.result.toLowerCase()}`}>{h.result}</span>
                      </td>
                      <td
                        className="num-cell mono"
                        style={{ color: h.netPts >= 0 ? 'var(--result-w)' : 'var(--result-l)' }}
                      >
                        {h.netPts >= 0 ? '+' : ''}{h.netPts.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Back link */}
        <div style={{ marginTop: 20 }}>
          <Link
            href="/fighters"
            style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: 'var(--text-muted)' }}
          >
            ← Back to Fighter Stats
          </Link>
        </div>
      </div>
    </div>
  );
}
