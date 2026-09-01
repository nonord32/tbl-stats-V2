// src/app/moments/page.tsx
// "Biggest Moments" — the highest-Leverage-Index rounds of the season,
// leaguewide. LI measures how much win probability was at stake BEFORE the
// round was fought, so this is a computed ranking of the most important rounds
// in TBL history rather than an asserted one.
import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllData, toSlug } from '@/lib/data';
import { getBracketContext } from '@/lib/bracketData';
import { playoffRoundLabelsByMatch } from '@/lib/playoffs';
import { getWpaData, WPA_MODEL_VERSION } from '@/lib/wpa';
import { getTeamLogoPathByName, getCityName } from '@/lib/teams';
import { SectionRule } from '@/components/chrome/SectionRule';

export const revalidate = 300;

const TOP_N = 50;

export const metadata: Metadata = {
  title: 'Biggest Moments — The Highest-Stakes Rounds in TBL',
  description:
    'The most important rounds of the season, ranked by Leverage Index — how much win probability was on the line before the bell. Computed, not asserted.',
  openGraph: {
    url: 'https://tblstats.com/moments',
    title: 'Biggest Moments | TBL Stats',
    description: 'The highest-stakes rounds in TBL, ranked by Leverage Index.',
  },
};

export default async function MomentsPage() {
  const [data, season] = await Promise.all([getAllData(), getWpaData()]);
  const roundLabels = playoffRoundLabelsByMatch(getBracketContext(data).bracket);

  const all = [...season.byMatch.values()].flatMap((m) =>
    m.rounds.map((r) => ({ m, r })),
  );
  all.sort((a, b) => b.r.li - a.r.li);
  const top = all.slice(0, TOP_N);

  return (
    <div style={{ padding: '22px 32px 48px' }}>
      <div className="tbl-eyebrow">Ranked by Leverage Index · Model {WPA_MODEL_VERSION}</div>
      <h1 className="tbl-display" style={{ fontSize: 54, lineHeight: 0.95, margin: '4px 0 0' }}>
        Biggest Moments
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
        The rounds where the most was on the line. Leverage Index measures how much win
        probability a round was capable of swinging <em>before the bell</em> — 1.00 is an
        average TBL round, and the ceiling is 6.63 (tied match, one round to go).{' '}
        <Link href="/stats/leverage" style={{ color: 'var(--tbl-accent)' }}>
          How leverage works →
        </Link>
      </p>

      <div style={{ marginTop: 26 }}>
        <SectionRule left={`Top ${top.length} Rounds`} right="Highest leverage first" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {top.map(({ m, r }, i) => {
            const label =
              m.phase === 'playoffs' ? roundLabels.get(m.matchIndex) ?? 'Playoffs' : null;
            const f1Won = r.score1 > r.score2;
            const f2Won = r.score2 > r.score1;
            const swing = Math.abs(r.teamWpa);
            return (
              <div
                key={`${m.matchIndex}-${r.round}`}
                style={{
                  background: 'var(--tbl-paper)',
                  border: '1.5px solid var(--tbl-ink)',
                  padding: '12px 14px',
                  display: 'grid',
                  gridTemplateColumns: 'auto auto 1fr auto',
                  alignItems: 'center',
                  gap: 16,
                }}
                className="moments-row"
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
                  <div className="tbl-display" style={{ fontSize: 30, lineHeight: 1, color: 'var(--tbl-accent)' }}>
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
                    LI
                  </div>
                </div>

                <div style={{ minWidth: 0 }}>
                  <div
                    className="tbl-display"
                    style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.25 }}
                  >
                    <Link
                      href={`/fighters/${toSlug(r.fighter1)}`}
                      style={{ color: f1Won ? 'var(--tbl-accent)' : 'var(--tbl-ink)', textDecoration: 'none' }}
                    >
                      {r.fighter1 || '—'}
                    </Link>
                    <span style={{ color: 'var(--tbl-ink-mute)', fontWeight: 400, fontStyle: 'italic' }}> vs </span>
                    <Link
                      href={`/fighters/${toSlug(r.fighter2)}`}
                      style={{ color: f2Won ? 'var(--tbl-accent)' : 'var(--tbl-ink)', textDecoration: 'none' }}
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
                    {getTeamLogoPathByName(m.team1) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={getTeamLogoPathByName(m.team1)} alt="" style={{ width: 14, height: 14, objectFit: 'contain' }} />
                    )}
                    <span>{getCityName(m.team1)}</span>
                    <span style={{ color: 'var(--tbl-ink-mute)' }}>vs</span>
                    {getTeamLogoPathByName(m.team2) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={getTeamLogoPathByName(m.team2)} alt="" style={{ width: 14, height: 14, objectFit: 'contain' }} />
                    )}
                    <span>{getCityName(m.team2)}</span>
                    <span style={{ color: 'var(--tbl-ink-mute)' }}>·</span>
                    <Link href={`/matches/${m.matchIndex}`} style={{ color: 'var(--tbl-accent)', textDecoration: 'none' }}>
                      {label ?? m.date} · Rd {r.round}
                    </Link>
                    <span style={{ color: 'var(--tbl-ink-mute)' }}>
                      · {r.diffBefore === 0 ? 'level' : `${r.diffBefore > 0 ? '+' : ''}${r.diffBefore}`} with{' '}
                      {m.scheduledRounds - r.round + 1} to go
                    </span>
                  </div>
                </div>

                <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {r.isDq ? (
                    <>
                      <div className="tbl-display" style={{ fontSize: 18, color: 'var(--tbl-ink-mute)' }}>
                        {swing.toFixed(3)}
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
                      <div
                        className="tbl-display"
                        style={{ fontSize: 18, color: 'var(--tbl-ink)' }}
                      >
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
                        {swing.toFixed(3)} WPA
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {top.length === 0 && (
          <p style={{ fontFamily: 'var(--tbl-font-mono)', fontSize: 12, color: 'var(--tbl-ink-soft)' }}>
            No rounds yet.
          </p>
        )}
      </div>
    </div>
  );
}
