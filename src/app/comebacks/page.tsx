// src/app/comebacks/page.tsx
// "Biggest Comebacks" — every decided match ranked by how close the winner came
// to losing, read off the win probabilities WPA already stores.
import type { Metadata } from 'next';
import Link from 'next/link';
import { getComebackData, COMEBACK_THRESHOLD } from '@/lib/wpa';
import { getTeamLogoPathByName, getCityName } from '@/lib/teams';
import { SectionRule } from '@/components/chrome/SectionRule';
import { ComebacksClient, type ComebackRow } from './ComebacksClient';

export const revalidate = 300;

const FEATURED = 5;

export const metadata: Metadata = {
  title: 'Biggest Comebacks — How Close Every Winner Came to Losing',
  description:
    'Every TBL match ranked by the winner’s lowest win probability. Miami fell to 7.3% against Las Vegas and won by four — the biggest comeback of 2026.',
  openGraph: {
    url: 'https://tblstats.com/comebacks',
    title: 'Biggest Comebacks | TBL Stats',
    description: 'How close every winner came to losing, measured round by round.',
  },
};

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

export default async function ComebacksPage() {
  const cb = await getComebackData();
  const featured = cb.matches.slice(0, FEATURED);

  const rows: ComebackRow[] = cb.matches.map((m) => ({
    matchIndex: m.matchIndex,
    date: m.date,
    winnerTeam: m.winnerTeam,
    loserTeam: m.loserTeam,
    comebackLow: m.comebackLow,
    lowRound: m.lowRound,
    deficitAtLow: m.deficitAtLow,
    finalMargin: m.finalMargin,
    isComeback: m.isComeback,
    footnote: m.footnote,
  }));

  return (
    <>
      <div style={{ padding: '22px 32px 0' }}>
        <div className="tbl-eyebrow">
          {cb.totals.comebacks} of {cb.totals.decidedMatches} matches
        </div>
        <h1 className="tbl-display" style={{ fontSize: 54, lineHeight: 0.95, margin: '4px 0 0' }}>
          Biggest Comebacks
        </h1>
        <p
          style={{
            fontFamily: 'var(--tbl-font-mono)',
            fontSize: 12,
            lineHeight: 1.7,
            color: 'var(--tbl-ink-soft)',
            maxWidth: 660,
            margin: '14px 0 0',
          }}
        >
          Every match has a moment where one team was closest to losing. We take the winner&apos;s
          win probability at the end of every round and find the lowest it ever got. Below{' '}
          {(COMEBACK_THRESHOLD * 100).toFixed(0)}% counts as a comeback win — and, from the other
          side, a blown lead.{' '}
          <Link href="/stats/comebacks" style={{ color: 'var(--tbl-accent)' }}>
            How it works →
          </Link>
        </p>
      </div>

      {featured.length > 0 && (
        <div style={{ padding: '26px 32px 0' }}>
          <SectionRule left="The Ones That Got Away" right="Winner’s lowest point" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {featured.map((m, i) => (
              <Link
                key={m.matchIndex}
                href={`/matches/${m.matchIndex}`}
                style={{
                  background: 'var(--tbl-paper)',
                  border: '1.5px solid var(--tbl-ink)',
                  padding: '12px 14px',
                  display: 'grid',
                  gridTemplateColumns: 'auto auto 1fr auto',
                  alignItems: 'center',
                  gap: 16,
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <div
                  className="tbl-display"
                  style={{ fontSize: 26, lineHeight: 1, color: 'rgba(20,17,11,0.28)', minWidth: 30, textAlign: 'right' }}
                >
                  {i + 1}
                </div>
                <div style={{ textAlign: 'center', minWidth: 70 }}>
                  <div className="tbl-display" style={{ fontSize: 28, lineHeight: 1, color: 'var(--tbl-accent)' }}>
                    {pct(m.comebackLow)}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--tbl-font-mono)',
                      fontSize: 8,
                      letterSpacing: '0.2em',
                      color: 'var(--tbl-ink-soft)',
                      fontWeight: 700,
                      marginTop: 2,
                    }}
                  >
                    LOW WP
                  </div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="tbl-display" style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.25 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {getTeamLogoPathByName(m.winnerTeam) && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={getTeamLogoPathByName(m.winnerTeam)} alt="" style={{ width: 18, height: 18, objectFit: 'contain' }} />
                      )}
                      {getCityName(m.winnerTeam)}
                    </span>
                    <span style={{ color: 'var(--tbl-ink-mute)', fontWeight: 400, fontStyle: 'italic' }}> over </span>
                    {getCityName(m.loserTeam)}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--tbl-font-mono)',
                      fontSize: 10,
                      letterSpacing: '0.1em',
                      color: 'var(--tbl-ink-soft)',
                      textTransform: 'uppercase',
                      marginTop: 4,
                    }}
                  >
                    {m.date} · down {Math.abs(m.deficitAtLow)} after round {m.lowRound} · won by{' '}
                    {m.finalMargin}
                    {m.footnote ? ' ·  †' : ''}
                  </div>
                </div>
                <div
                  style={{
                    fontFamily: 'var(--tbl-font-mono)',
                    fontSize: 10,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: 'var(--tbl-accent)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Match →
                </div>
              </Link>
            ))}
          </div>
          {featured.some((m) => m.footnote) && (
            <p
              style={{
                margin: '10px 0 0',
                fontFamily: 'var(--tbl-font-mono)',
                fontSize: 10,
                lineHeight: 1.6,
                color: 'var(--tbl-ink-soft)',
                maxWidth: 720,
              }}
            >
              {featured
                .filter((m) => m.footnote)
                .map((m) => `† Match ${m.matchIndex}: ${m.footnote}`)
                .join('  ')}
            </p>
          )}
        </div>
      )}

      <ComebacksClient rows={rows} threshold={COMEBACK_THRESHOLD} />
    </>
  );
}
