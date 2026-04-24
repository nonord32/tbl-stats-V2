// src/app/page.tsx
// Gazette-direction home: FightCard hero → Top Six → Standings (2-col) → Weekend Results.
import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllData, extractUniqueMatches } from '@/lib/data';
import { getCurrentWeek, getDisplayedCurrentWeek, scheduleForWeek } from '@/lib/week';
import { getFullTeamName, getTeamLogoPathByName, getCityName } from '@/lib/teams';
import { HallOfChampions } from '@/components/home/HallOfChampions';
import { PickemPromo } from '@/components/home/PickemPromo';
import type { FighterStat, ScheduleEntry, TeamStanding, MatchResult } from '@/types';

export const metadata: Metadata = {
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

// ─── Small, page-local helpers ───────────────────────────────────────────────
function firstName(name: string): string {
  return name.split(' ')[0] ?? name;
}
function lastName(name: string): string {
  const parts = name.split(' ');
  return parts.slice(1).join(' ') || '';
}
function teamAbbr(teamName: string): string {
  // "NYC Attitude" → "NYC"; "Las Vegas Hustle" → "LAS VEGAS"; fall back to first word.
  const first = teamName.split(' ')[0] ?? teamName;
  return first.toUpperCase();
}
// Map a team display name (as stored in CSVs — often short like "NYC" or "Dallas")
// to our canonical city slug. Mirrors the mapping in src/lib/teams.ts but simpler.
function teamSlug(name: string): string {
  const s = name.toLowerCase().trim();
  if (s === 'nyc') return 'nyc';
  if (s === 'las vegas' || s === 'lv') return 'las-vegas';
  if (s === 'los angeles' || s === 'la' || s === 'lax') return 'los-angeles';
  if (s === 'san antonio') return 'san-antonio';
  return s.replace(/\s+/g, '-');
}

// ─── Hero: featured fight card + fighter in focus ────────────────────────────
function FightCardHero({
  featured,
  focus,
  alsoThisWeek,
}: {
  featured: ScheduleEntry | null;
  focus: FighterStat | null;
  alsoThisWeek: ScheduleEntry[];
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1.15fr 1fr',
        borderBottom: '3px double var(--tbl-ink)',
      }}
      className="gz-fight-card"
    >
      {/* Poster side */}
      <div
        style={{
          background: 'var(--tbl-ink)',
          color: 'var(--tbl-bg)',
          padding: '32px 36px',
          position: 'relative',
          overflow: 'hidden',
          minHeight: 340,
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'radial-gradient(circle, rgba(255,60,0,0.35) 1.5px, transparent 1.5px)',
            backgroundSize: '10px 10px',
            opacity: 0.12,
          }}
        />
        <div style={{ position: 'relative' }}>
          <div
            style={{
              fontFamily: 'var(--tbl-font-mono)',
              fontSize: 11,
              letterSpacing: '0.28em',
              color: 'var(--tbl-accent-bright)',
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            {featured
              ? `Next Event · ${featured.date}${featured.time ? ' · ' + featured.time : ''}`
              : 'Team Boxing League · 2026 Season'}
          </div>
          {featured ? (
            <>
              <div
                className="tbl-display gz-hero-team"
                style={{ fontSize: 96, lineHeight: 0.9, marginTop: 16 }}
              >
                {teamAbbr(featured.team1)}
                <span
                  className="gz-hero-vs"
                  style={{
                    display: 'inline-block',
                    transform: 'rotate(-2deg)',
                    margin: '0 12px',
                    fontSize: 60,
                    color: 'var(--tbl-accent-bright)',
                    fontStyle: 'italic',
                    fontWeight: 900,
                  }}
                >
                  vs
                </span>
              </div>
              <div
                className="tbl-display gz-hero-team"
                style={{ fontSize: 96, lineHeight: 0.9, marginTop: -4 }}
              >
                {teamAbbr(featured.team2)}
              </div>
              {featured.venueName && (
                <div
                  style={{
                    marginTop: 22,
                    fontFamily: 'var(--tbl-font-mono)',
                    fontSize: 11,
                    letterSpacing: '0.18em',
                    color: 'rgba(244,237,224,0.55)',
                    textTransform: 'uppercase',
                  }}
                >
                  {featured.venueName}
                  {featured.venueCity && ` · ${featured.venueCity}`}
                </div>
              )}
            </>
          ) : (
            <div className="tbl-display gz-hero-team" style={{ fontSize: 84, lineHeight: 0.9, marginTop: 16 }}>
              TBL
            </div>
          )}
        </div>

        {featured && (
          <div
            className="gz-hero-logos"
            style={{
              position: 'absolute',
              bottom: 28,
              right: 28,
              display: 'flex',
              gap: 16,
              alignItems: 'center',
            }}
          >
            {getTeamLogoPathByName(featured.team1) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={getTeamLogoPathByName(featured.team1)}
                alt=""
                style={{ width: 60, height: 60, objectFit: 'contain' }}
              />
            )}
            <div
              className="gz-hero-x"
              style={{
                color: 'var(--tbl-accent-bright)',
                fontFamily: 'var(--tbl-font-serif)',
                fontStyle: 'italic',
                fontSize: 32,
                fontWeight: 900,
              }}
            >
              ×
            </div>
            {getTeamLogoPathByName(featured.team2) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={getTeamLogoPathByName(featured.team2)}
                alt=""
                style={{ width: 60, height: 60, objectFit: 'contain' }}
              />
            )}
          </div>
        )}
      </div>

      {/* Fighter in focus */}
      <div
        style={{
          padding: '32px 36px',
          position: 'relative',
          borderLeft: '3px solid var(--tbl-ink)',
        }}
      >
        {focus ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div>
                <div className="tbl-eyebrow">Fighter in Focus · #1 Net Pts</div>
                <Link
                  href={`/fighters/${focus.slug}`}
                  className="tbl-display gz-hero-focus-name"
                  style={{
                    fontSize: 60,
                    lineHeight: 0.95,
                    marginTop: 12,
                    color: 'var(--tbl-ink)',
                    display: 'block',
                    textDecoration: 'none',
                  }}
                >
                  {firstName(focus.name)}
                  <br />
                  {lastName(focus.name)}
                </Link>
                <div
                  style={{
                    fontFamily: 'var(--tbl-font-mono)',
                    fontSize: 12,
                    letterSpacing: '0.18em',
                    color: 'var(--tbl-ink-soft)',
                    textTransform: 'uppercase',
                    marginTop: 10,
                  }}
                >
                  {getFullTeamName(teamSlug(focus.team))} · {focus.weightClass}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div
                  className="tbl-display gz-hero-net"
                  style={{ fontSize: 80, lineHeight: 0.9, color: 'var(--tbl-accent)' }}
                >
                  {focus.netPts >= 0 ? '+' : ''}
                  {focus.netPts.toFixed(0)}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--tbl-font-mono)',
                    fontSize: 10,
                    letterSpacing: '0.3em',
                    color: 'var(--tbl-ink-soft)',
                    fontWeight: 700,
                    marginTop: 4,
                  }}
                >
                  NET PTS
                </div>
              </div>
            </div>

            {/* Stat strip */}
            <div
              style={{
                marginTop: 18,
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                borderTop: '2px solid var(--tbl-ink)',
                borderBottom: '2px solid var(--tbl-ink)',
              }}
            >
              {[
                { l: 'REC', v: focus.record },
                { l: 'WAR', v: focus.war.toFixed(2) },
                { l: 'NPPR', v: focus.nppr.toFixed(2) },
                { l: 'WIN%', v: `${(focus.winPct * 100).toFixed(0)}` },
                { l: 'RNDS', v: String(focus.rounds) },
              ].map((s, i) => (
                <div
                  key={s.l}
                  style={{
                    padding: '10px 6px',
                    textAlign: 'center',
                    borderRight: i < 4 ? '1px solid rgba(20,17,11,0.18)' : 'none',
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'var(--tbl-font-mono)',
                      fontSize: 9,
                      letterSpacing: '0.24em',
                      color: 'var(--tbl-ink-soft)',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                    }}
                  >
                    {s.l}
                  </div>
                  <div
                    className="tbl-display"
                    style={{ fontSize: 24, lineHeight: 1, color: 'var(--tbl-ink)', marginTop: 4 }}
                  >
                    {s.v}
                  </div>
                </div>
              ))}
            </div>

            {/* Also this week */}
            {alsoThisWeek.length > 0 && (
              <div style={{ marginTop: 22 }}>
                <div
                  style={{
                    fontFamily: 'var(--tbl-font-mono)',
                    fontSize: 10,
                    letterSpacing: '0.22em',
                    color: 'var(--tbl-ink-soft)',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    marginBottom: 10,
                  }}
                >
                  Also This Week
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {alsoThisWeek.slice(0, 3).map((m, i, arr) => (
                    <div
                      key={`${m.date}-${m.team1}-${m.team2}`}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '88px 1fr auto',
                        alignItems: 'center',
                        gap: 12,
                        padding: '7px 0',
                        borderBottom:
                          i < arr.length - 1 ? '1px dotted rgba(20,17,11,0.3)' : 'none',
                      }}
                    >
                      <div
                        style={{
                          fontFamily: 'var(--tbl-font-mono)',
                          fontSize: 10,
                          letterSpacing: '0.14em',
                          color: 'var(--tbl-ink-soft)',
                          textTransform: 'uppercase',
                        }}
                      >
                        {m.date}
                      </div>
                      <div
                        className="tbl-display"
                        style={{ fontSize: 15, fontWeight: 700, color: 'var(--tbl-ink)' }}
                      >
                        {m.team1}{' '}
                        <span style={{ fontStyle: 'italic', fontWeight: 400, color: 'var(--tbl-ink-soft)' }}>
                          vs
                        </span>{' '}
                        {m.team2}
                      </div>
                      <div
                        style={{
                          fontFamily: 'var(--tbl-font-mono)',
                          fontSize: 10,
                          color: 'var(--tbl-ink-soft)',
                          letterSpacing: '0.08em',
                        }}
                      >
                        {m.time}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div
            style={{
              fontFamily: 'var(--tbl-font-mono)',
              fontSize: 12,
              color: 'var(--tbl-ink-soft)',
              padding: '80px 0',
              textAlign: 'center',
            }}
          >
            Fighter data unavailable.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Top Six fighters grid ───────────────────────────────────────────────────
function TopSix({ fighters }: { fighters: FighterStat[] }) {
  if (fighters.length === 0) return null;
  return (
    <div style={{ padding: '32px 32px 24px', borderBottom: '3px double var(--tbl-ink)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 20,
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div className="tbl-eyebrow">Pound for Pound</div>
          <div className="tbl-display" style={{ fontSize: 38, lineHeight: 1, marginTop: 4 }}>
            The Top Six
          </div>
        </div>
        <Link
          href="/fighters"
          style={{
            fontFamily: 'var(--tbl-font-mono)',
            fontSize: 11,
            letterSpacing: '0.18em',
            color: 'var(--tbl-ink-soft)',
            textTransform: 'uppercase',
            textDecoration: 'none',
          }}
        >
          Sorted by Net Points · View all →
        </Link>
      </div>

      <div
        className="gz-topsix-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          borderTop: '2px solid var(--tbl-ink)',
          borderLeft: '1px solid rgba(20,17,11,0.15)',
        }}
      >
        {fighters.slice(0, 6).map((f, i) => {
          const slug = teamSlug(f.team);
          const isTop = i === 0;
          return (
            <Link
              key={f.slug}
              href={`/fighters/${f.slug}`}
              style={{
                padding: 14,
                borderRight: '1px solid rgba(20,17,11,0.15)',
                borderBottom: '1px solid rgba(20,17,11,0.15)',
                background: isTop ? 'var(--tbl-ink)' : 'var(--tbl-paper)',
                color: isTop ? 'var(--tbl-bg)' : 'var(--tbl-ink)',
                position: 'relative',
                minHeight: 210,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                textDecoration: 'none',
              }}
            >
              <div>
                <div
                  className="tbl-display"
                  style={{
                    fontSize: 64,
                    lineHeight: 0.85,
                    color: isTop ? 'var(--tbl-accent-bright)' : 'rgba(20,17,11,0.18)',
                    letterSpacing: '-0.03em',
                  }}
                >
                  {String(i + 1).padStart(2, '0')}
                </div>
                {getTeamLogoPathByName(f.team) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={getTeamLogoPathByName(f.team)}
                    alt=""
                    style={{
                      position: 'absolute',
                      top: 12,
                      right: 12,
                      width: 28,
                      height: 28,
                      objectFit: 'contain',
                    }}
                  />
                )}
              </div>
              <div>
                <div
                  className="tbl-display"
                  style={{
                    fontSize: 18,
                    lineHeight: 1.05,
                    fontWeight: 800,
                    color: isTop ? 'var(--tbl-bg)' : 'var(--tbl-ink)',
                  }}
                >
                  {f.name}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--tbl-font-mono)',
                    fontSize: 10,
                    letterSpacing: '0.16em',
                    color: isTop ? 'rgba(244,237,224,0.6)' : 'var(--tbl-ink-soft)',
                    marginTop: 4,
                    textTransform: 'uppercase',
                  }}
                >
                  {getCityName(f.team)} · {f.weightClass}
                </div>
                <div
                  style={{
                    marginTop: 10,
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 6,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontFamily: 'var(--tbl-font-mono)',
                        fontSize: 9,
                        letterSpacing: '0.18em',
                        color: isTop ? 'rgba(244,237,224,0.5)' : 'var(--tbl-ink-mute)',
                        textTransform: 'uppercase',
                      }}
                    >
                      NET
                    </div>
                    <div
                      className="tbl-display"
                      style={{
                        fontSize: 18,
                        lineHeight: 1,
                        color: isTop ? 'var(--tbl-accent-bright)' : 'var(--tbl-accent)',
                      }}
                    >
                      {f.netPts >= 0 ? '+' : ''}{f.netPts.toFixed(0)}
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontFamily: 'var(--tbl-font-mono)',
                        fontSize: 9,
                        letterSpacing: '0.18em',
                        color: isTop ? 'rgba(244,237,224,0.5)' : 'var(--tbl-ink-mute)',
                        textTransform: 'uppercase',
                      }}
                    >
                      REC
                    </div>
                    <div
                      className="tbl-display"
                      style={{
                        fontSize: 18,
                        lineHeight: 1,
                        color: isTop ? 'var(--tbl-bg)' : 'var(--tbl-ink)',
                      }}
                    >
                      {f.record}
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ─── Standings (two-column) ──────────────────────────────────────────────────
function StandingsTwoCol({ teams }: { teams: TeamStanding[] }) {
  if (teams.length === 0) return null;
  return (
    <div style={{ padding: '30px 32px 28px', borderBottom: '3px double var(--tbl-ink)' }}>
      <div className="tbl-section-rule">
        <span>The Standings · {teams.length} Clubs</span>
        <Link
          href="/teams"
          style={{ color: 'var(--tbl-ink-soft)', textDecoration: 'none' }}
        >
          Full table →
        </Link>
      </div>

      <div
        className="gz-standings-cols"
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 30, marginTop: 4 }}
      >
        {[0, 1].map((col) => (
          <table
            key={col}
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontFamily: 'var(--tbl-font-mono)',
              fontSize: 12,
            }}
          >
            <thead>
              <tr style={{ borderBottom: '1.5px solid var(--tbl-ink)' }}>
                {['#', 'Club', 'W–L', 'PF', 'PA', 'Diff', 'Strk'].map((h, i) => (
                  <th
                    key={h}
                    style={{
                      textAlign: i < 2 ? 'left' : 'right',
                      padding: '7px 4px',
                      fontWeight: 700,
                      letterSpacing: '0.12em',
                      fontSize: 10,
                      textTransform: 'uppercase',
                      width: h === '#' ? 26 : undefined,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teams.slice(col * 6, col * 6 + 6).map((t, i) => {
                const rank = col * 6 + i + 1;
                const isTop = rank === 1;
                const isWStreak = t.streak.startsWith('W');
                return (
                  <tr
                    key={t.slug}
                    style={{ borderBottom: '1px dotted rgba(20,17,11,0.35)' }}
                  >
                    <td style={{ padding: '9px 4px', color: 'var(--tbl-ink-soft)', fontWeight: 700 }}>
                      {rank}.
                    </td>
                    <td style={{ padding: '9px 4px' }}>
                      <Link
                        href={`/teams/${t.slug}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          textDecoration: 'none',
                          color: 'var(--tbl-ink)',
                        }}
                      >
                        {getTeamLogoPathByName(t.team) && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={getTeamLogoPathByName(t.team)}
                            alt=""
                            style={{ width: 22, height: 22, objectFit: 'contain' }}
                          />
                        )}
                        <span
                          className="tbl-display"
                          style={{ fontSize: 15, fontWeight: isTop ? 900 : 700 }}
                        >
                          {getFullTeamName(t.slug)}
                        </span>
                      </Link>
                    </td>
                    <td style={{ padding: '9px 4px', textAlign: 'right', fontWeight: 600 }}>
                      {t.record}
                    </td>
                    <td style={{ padding: '9px 4px', textAlign: 'right', color: 'var(--tbl-ink-soft)' }}>
                      {t.pf.toFixed(1)}
                    </td>
                    <td style={{ padding: '9px 4px', textAlign: 'right', color: 'var(--tbl-ink-soft)' }}>
                      {t.pa.toFixed(1)}
                    </td>
                    <td
                      style={{
                        padding: '9px 4px',
                        textAlign: 'right',
                        fontWeight: 700,
                        color: t.diff >= 0 ? 'var(--tbl-green)' : 'var(--tbl-red)',
                      }}
                    >
                      {t.diff >= 0 ? '+' : ''}
                      {t.diff.toFixed(1)}
                    </td>
                    <td
                      style={{
                        padding: '9px 4px',
                        textAlign: 'right',
                        fontWeight: 700,
                        color: isWStreak ? 'var(--tbl-green)' : 'var(--tbl-red)',
                      }}
                    >
                      {t.streak}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ))}
      </div>
    </div>
  );
}

// ─── Weekend Results (recent completed matches) ─────────────────────────────
interface ResultCard {
  matchIndex: number;
  date: string;
  team1: string;
  team2: string;
  s1: number;
  s2: number;
  phase?: string;
}
function WeekendResults({ results }: { results: ResultCard[] }) {
  if (results.length === 0) return null;
  return (
    <div style={{ padding: '30px 32px 40px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 20,
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div className="tbl-eyebrow">Recent Results</div>
          <div className="tbl-display" style={{ fontSize: 34, lineHeight: 1, marginTop: 4 }}>
            From the Weekend
          </div>
        </div>
        <Link
          href="/results"
          style={{
            fontFamily: 'var(--tbl-font-mono)',
            fontSize: 11,
            letterSpacing: '0.18em',
            color: 'var(--tbl-ink-soft)',
            textTransform: 'uppercase',
            textDecoration: 'none',
          }}
        >
          View all results →
        </Link>
      </div>

      <div
        className="gz-results-grid"
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
      >
        {results.slice(0, 6).map((r, i) => {
          const team1Won = r.s1 > r.s2;
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
                      color: team1Won ? 'var(--tbl-ink)' : 'var(--tbl-ink-mute)',
                    }}
                  >
                    {getFullTeamName(teamSlug(r.team1))}
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
                    {r.date}
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
                      opacity: team1Won ? 1 : 0.55,
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
                <span style={{ color: !team1Won ? 'var(--tbl-accent)' : 'var(--tbl-ink)' }}>
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
                      opacity: !team1Won ? 1 : 0.55,
                    }}
                  />
                )}
                <div>
                  <div
                    className="tbl-display"
                    style={{
                      fontSize: 17,
                      lineHeight: 1.05,
                      fontWeight: !team1Won ? 900 : 700,
                      color: !team1Won ? 'var(--tbl-ink)' : 'var(--tbl-ink-mute)',
                    }}
                  >
                    {getFullTeamName(teamSlug(r.team2))}
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

// ─── Page ────────────────────────────────────────────────────────────────────
export default async function HomePage() {
  const { fighters, teams, schedule, teamMatches, awards } = await getAllData();
  const fighterSlugs = new Set(fighters.map((f) => f.slug));

  const currentWeek = getDisplayedCurrentWeek(schedule);
  const weekMatches =
    currentWeek !== null ? scheduleForWeek(schedule, currentWeek) : [];
  const upcoming = weekMatches.filter((s) => s.status === 'Upcoming');
  const featured = upcoming[0] ?? null;
  const alsoThisWeek = upcoming.slice(1);

  // Pick'em promo — only surfaced when there's actually an open pick window.
  const pickemWeek = getCurrentWeek(schedule);
  const pickemMatches =
    pickemWeek !== null
      ? scheduleForWeek(schedule, pickemWeek).filter((s) => s.status === 'Upcoming')
      : [];

  // Sort by Net Points for both "Fighter in Focus" and "Top Six".
  const fightersByNetPts = [...fighters].sort((a, b) => b.netPts - a.netPts);
  const focus = fightersByNetPts[0] ?? null;
  const topSix = fightersByNetPts.slice(0, 6);

  // Tiebreakers (in order): wins ↓, losses ↑, point differential ↓, points for ↓,
  // then name asc as a stable final key. Mirrors the Teams page logic so the home
  // snippet and the full standings agree row-for-row.
  const topTeams = [...teams].sort(
    (a, b) =>
      b.wins - a.wins ||
      a.losses - b.losses ||
      b.diff - a.diff ||
      b.pf - a.pf ||
      a.team.localeCompare(b.team)
  );

  // Map each completed match back to its schedule week so result cards can
  // show "Week 3" etc. instead of the boxScore's scoring-phase label.
  const weekByMatchIndex = new Map<number, number>();
  schedule.forEach((s) => {
    if (s.matchIndex != null) weekByMatchIndex.set(s.matchIndex, s.week);
  });

  // Real match results from the teamMatches data (same source the /results
  // page uses), sorted newest-first and capped at 6 cards.
  const completed: ResultCard[] = extractUniqueMatches(teamMatches)
    .slice(0, 6)
    .map((m: MatchResult) => {
      const wk = weekByMatchIndex.get(m.matchIndex);
      return {
        matchIndex: m.matchIndex,
        date: m.date,
        team1: m.team1,
        team2: m.team2,
        s1: m.score1,
        s2: m.score2,
        phase: wk != null ? `Week ${wk}` : undefined,
      };
    });

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
        description:
          'Independent stats, standings, and fight results for Team Boxing League.',
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

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <FightCardHero featured={featured} focus={focus} alsoThisWeek={alsoThisWeek} />
      <TopSix fighters={topSix} />
      <StandingsTwoCol teams={topTeams} />
      {pickemWeek !== null && pickemMatches.length > 0 && (
        <PickemPromo week={pickemWeek} matches={pickemMatches} />
      )}
      <WeekendResults results={completed} />
      {awards.length > 0 && (
        <div style={{ padding: '0 32px 40px' }}>
          <div style={{ marginBottom: 16 }}>
            <div className="tbl-eyebrow">Past MVPs & Trophies</div>
            <div
              className="tbl-display"
              style={{ fontSize: 34, lineHeight: 1, marginTop: 4 }}
            >
              Hall of Champions
            </div>
          </div>
          <HallOfChampions awards={awards} fighterSlugs={fighterSlugs} />
        </div>
      )}
    </>
  );
}
