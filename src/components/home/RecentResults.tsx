// src/components/home/RecentResults.tsx
// The most recent completed matches as score cards. This component was always
// shared between the desktop and mobile trees — it only moved out of the page.

import Link from 'next/link';
import { getFullTeamName, getTeamLogoPathByName } from '@/lib/teams';
import { shortAbbr, teamSlug, type ResultCard } from './shared';

export function RecentResults({ results }: { results: ResultCard[] }) {
  if (results.length === 0) return null;
  return (
    <div style={{ padding: '30px 32px 40px' }}>
      <div className="tbl-section-rule">
        <span>Latest Results</span>
        <Link href="/results" style={{ color: 'var(--tbl-ink-soft)', textDecoration: 'none' }}>
          View all results →
        </Link>
      </div>

      <div
        className="gz-results-grid"
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
      >
        {results.slice(0, 6).map((r, i) => {
          const isDraw = Math.abs(r.s1 - r.s2) < 0.0001;
          const team1Won = !isDraw && r.s1 > r.s2;
          const team2Won = !isDraw && r.s2 > r.s1;
          return (
            <Link
              key={`${i}-${r.team1}-${r.team2}`}
              href={`/matches/${r.matchIndex}`}
              className="gz-result-card"
              style={{
                background: 'var(--tbl-paper)',
                border: '1.5px solid var(--tbl-ink)',
                padding: '14px 16px',
                display: 'grid',
                gridTemplateColumns: '1fr auto 1fr',
                alignItems: 'center',
                gap: 14,
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  justifyContent: 'flex-end',
                }}
              >
                <div style={{ textAlign: 'right' }}>
                  <div
                    className="tbl-display"
                    style={{
                      fontSize: 17,
                      lineHeight: 1.05,
                      fontWeight: team1Won ? 900 : 700,
                      color: team1Won || isDraw ? 'var(--tbl-ink)' : 'var(--tbl-ink-mute)',
                    }}
                  >
                    <span className="gz-result-name-full">{getFullTeamName(teamSlug(r.team1))}</span>
                    <span className="gz-result-name-abbr">{shortAbbr(r.team1)}</span>
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--tbl-font-mono)',
                      fontSize: 9,
                      color: 'var(--tbl-ink-soft)',
                      letterSpacing: '0.12em',
                      marginTop: 2,
                    }}
                  >
                    {r.date.replace(/\/\d{4}$/, '').replace(/^\d{4}-/, '')}
                  </div>
                </div>
                {getTeamLogoPathByName(r.team1) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={getTeamLogoPathByName(r.team1)}
                    alt=""
                    style={{
                      width: 34,
                      height: 34,
                      objectFit: 'contain',
                      opacity: team1Won || isDraw ? 1 : 0.55,
                    }}
                  />
                )}
              </div>
              <div
                className="tbl-display gz-result-score"
                style={{
                  fontSize: 30,
                  lineHeight: 1,
                  padding: '0 10px',
                  borderLeft: '1px solid rgba(20,17,11,0.2)',
                  borderRight: '1px solid rgba(20,17,11,0.2)',
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ color: team1Won ? 'var(--tbl-accent)' : 'var(--tbl-ink)' }}>
                  {r.s1.toFixed(1)}
                </span>
                <span
                  style={{
                    color: 'var(--tbl-ink-mute)',
                    margin: '0 6px',
                    fontSize: 22,
                    fontStyle: 'italic',
                    fontWeight: 400,
                  }}
                >
                  —
                </span>
                <span style={{ color: team2Won ? 'var(--tbl-accent)' : 'var(--tbl-ink)' }}>
                  {r.s2.toFixed(1)}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {getTeamLogoPathByName(r.team2) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={getTeamLogoPathByName(r.team2)}
                    alt=""
                    style={{
                      width: 34,
                      height: 34,
                      objectFit: 'contain',
                      opacity: team2Won || isDraw ? 1 : 0.55,
                    }}
                  />
                )}
                <div>
                  <div
                    className="tbl-display"
                    style={{
                      fontSize: 17,
                      lineHeight: 1.05,
                      fontWeight: team2Won ? 900 : 700,
                      color: team2Won || isDraw ? 'var(--tbl-ink)' : 'var(--tbl-ink-mute)',
                    }}
                  >
                    <span className="gz-result-name-full">{getFullTeamName(teamSlug(r.team2))}</span>
                    <span className="gz-result-name-abbr">{shortAbbr(r.team2)}</span>
                  </div>
                  {r.phase && (
                    <div
                      style={{
                        fontFamily: 'var(--tbl-font-mono)',
                        fontSize: 9,
                        color: 'var(--tbl-ink-soft)',
                        letterSpacing: '0.12em',
                        marginTop: 2,
                      }}
                    >
                      {r.phase}
                    </div>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
