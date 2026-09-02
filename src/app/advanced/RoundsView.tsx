'use client';
// src/app/advanced/RoundsView.tsx
// The biggest rounds of the season, ranked by Leverage Index — how much win
// probability a round was capable of swinging before it was fought. A computed
// ranking, not an asserted one. Lifted from the old /moments page.

import Link from 'next/link';
import { SectionRule } from '@/components/chrome/SectionRule';
import type { RoundItem } from './types';

function TeamTag({ city, logo }: { city: string; logo: string | null }) {
  return (
    <>
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" style={{ width: 14, height: 14, objectFit: 'contain' }} />
      )}
      <span>{city}</span>
    </>
  );
}

export function RoundsView({ rounds }: { rounds: RoundItem[] }) {
  return (
    <div style={{ padding: '20px 32px 40px' }}>
      <SectionRule left={`Top ${rounds.length} Rounds`} right="Biggest first" />

      {rounds.length === 0 ? (
        <p style={{ fontFamily: 'var(--tbl-font-mono)', fontSize: 12, color: 'var(--tbl-ink-soft)' }}>
          No rounds yet.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rounds.map((r, i) => (
            <div
              key={r.key}
              className="moments-row"
              style={{
                background: 'var(--tbl-paper)',
                border: '1.5px solid var(--tbl-ink)',
                padding: '12px 14px',
                display: 'grid',
                gridTemplateColumns: 'auto auto 1fr auto',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <div
                className="tbl-display"
                style={{
                  fontSize: 26,
                  lineHeight: 1,
                  color: 'rgba(20,17,11,0.28)',
                  minWidth: 34,
                  textAlign: 'right',
                }}
              >
                {i + 1}
              </div>

              <div style={{ textAlign: 'center', minWidth: 62 }}>
                <div
                  className="tbl-display"
                  style={{ fontSize: 30, lineHeight: 1, color: 'var(--tbl-accent)' }}
                >
                  {r.li.toFixed(2)}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--tbl-font-mono)',
                    fontSize: 8,
                    letterSpacing: '0.22em',
                    color: 'var(--tbl-ink-soft)',
                    fontWeight: 700,
                    marginTop: 2,
                  }}
                >
                  AT STAKE
                </div>
              </div>

              <div style={{ minWidth: 0 }}>
                <div className="tbl-display" style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.25 }}>
                  <Link
                    href={`/fighters/${r.slug1}`}
                    style={{
                      color: r.f1Won ? 'var(--tbl-accent)' : 'var(--tbl-ink)',
                      textDecoration: 'none',
                    }}
                  >
                    {r.fighter1 || '—'}
                  </Link>
                  <span style={{ color: 'var(--tbl-ink-mute)', fontWeight: 400, fontStyle: 'italic' }}>
                    {' '}
                    vs{' '}
                  </span>
                  <Link
                    href={`/fighters/${r.slug2}`}
                    style={{
                      color: r.f2Won ? 'var(--tbl-accent)' : 'var(--tbl-ink)',
                      textDecoration: 'none',
                    }}
                  >
                    {r.fighter2 || '—'}
                  </Link>
                </div>
                <div
                  style={{
                    fontFamily: 'var(--tbl-font-mono)',
                    fontSize: 10,
                    letterSpacing: '0.1em',
                    color: 'var(--tbl-ink-soft)',
                    textTransform: 'uppercase',
                    marginTop: 4,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    flexWrap: 'wrap',
                  }}
                >
                  <TeamTag city={r.team1} logo={r.logo1} />
                  <span style={{ color: 'var(--tbl-ink-mute)' }}>vs</span>
                  <TeamTag city={r.team2} logo={r.logo2} />
                  <span style={{ color: 'var(--tbl-ink-mute)' }}>·</span>
                  <Link
                    href={`/matches/${r.matchIndex}`}
                    style={{ color: 'var(--tbl-accent)', textDecoration: 'none' }}
                  >
                    {r.whenLabel} · Rd {r.round}
                  </Link>
                  <span style={{ color: 'var(--tbl-ink-mute)' }}>
                    · {r.diffBefore === 0 ? 'level' : `${r.diffBefore > 0 ? '+' : ''}${r.diffBefore}`} with{' '}
                    {r.toGo} to go
                  </span>
                </div>
              </div>

              <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                {r.isDq ? (
                  <>
                    <div className="tbl-display" style={{ fontSize: 18, color: 'var(--tbl-ink-mute)' }}>
                      {r.swing.toFixed(3)}
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--tbl-font-mono)',
                        fontSize: 8,
                        letterSpacing: '0.14em',
                        color: 'var(--tbl-ink-mute)',
                        textTransform: 'uppercase',
                        fontWeight: 700,
                        marginTop: 2,
                      }}
                    >
                      DQ · uncredited
                    </div>
                  </>
                ) : (
                  <>
                    <div className="tbl-display" style={{ fontSize: 18, color: 'var(--tbl-ink)' }}>
                      {r.score1.toFixed(0)}–{r.score2.toFixed(0)}
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--tbl-font-mono)',
                        fontSize: 8,
                        letterSpacing: '0.14em',
                        color: 'var(--tbl-ink-soft)',
                        textTransform: 'uppercase',
                        fontWeight: 700,
                        marginTop: 2,
                      }}
                    >
                      Swung {r.swing.toFixed(3)}
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
