// src/app/matches/[matchIndex]/page.tsx
// Gazette match page: dark hero with Winner / Loser + big serif team names,
// followed by a bout-by-bout box score with a weight-class column.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getMatchByIndex, toSlug } from '@/lib/data';
import { getFullTeamName, getTeamLogoPathByName } from '@/lib/teams';
import { SectionRule } from '@/components/chrome/SectionRule';
import { HighlightsSection } from '@/components/HighlightsSection';

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: { matchIndex: string };
}): Promise<Metadata> {
  const mi = parseInt(params.matchIndex, 10);
  if (isNaN(mi)) return { title: 'Match Not Found' };
  const result = await getMatchByIndex(mi);
  if (!result) return { title: 'Match Not Found' };
  const { match } = result;
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

// Short team label used in column headers.
function teamShort(team: string): string {
  const map: Record<string, string> = {
    nyc: 'NYC',
    'new york': 'NYC',
    'los angeles': 'LA',
    'las vegas': 'LV',
    'san antonio': 'SA',
    atlanta: 'ATL',
    boston: 'BOS',
    dallas: 'DAL',
    houston: 'HOU',
    miami: 'MIA',
    nashville: 'NSH',
    philadelphia: 'PHI',
    phoenix: 'PHX',
  };
  const key = team.toLowerCase().trim();
  return map[key] ?? team.slice(0, 3).toUpperCase();
}

// Compact weight-class abbreviation for the dense desktop table.
// Full name is still used on the mobile cards where there's room.
function shortenWeight(name: string | undefined): string {
  if (!name) return '—';
  const k = name.toLowerCase().trim();
  const map: Record<string, string> = {
    bantamweight: 'BW',
    featherweight: 'FW',
    lightweight: 'LW',
    welterweight: 'WW',
    middleweight: 'MW',
    'light heavyweight': 'LH',
    'light heavy': 'LH',
    heavyweight: 'HW',
    female: 'F',
    money: 'MNY',
  };
  return map[k] ?? name;
}

export default async function MatchPage({
  params,
}: {
  params: { matchIndex: string };
}) {
  const mi = parseInt(params.matchIndex, 10);
  if (isNaN(mi)) notFound();

  const result = await getMatchByIndex(mi);
  if (!result) notFound();

  const { match, scheduleEntry, highlights } = result!;

  const team1Slug = toSlug(match.team1);
  const team2Slug = toSlug(match.team2);
  const team1Full = getFullTeamName(team1Slug);
  const team2Full = getFullTeamName(team2Slug);
  const team1Logo = getTeamLogoPathByName(match.team1);
  const team2Logo = getTeamLogoPathByName(match.team2);
  const team1Abbr = teamShort(match.team1);
  const team2Abbr = teamShort(match.team2);

  // Split "Boston Butchers" → name "Boston" / mascot "Butchers" so the hero
  // echoes the handoff look (two-tone big serif). Falls back to the whole
  // string when we only have one word.
  const splitName = (full: string): [string, string] => {
    const parts = full.split(' ');
    if (parts.length < 2) return [full, ''];
    return [parts.slice(0, -1).join(' '), parts[parts.length - 1]];
  };
  const [team1Front, team1Back] = splitName(team1Full);
  const [team2Front, team2Back] = splitName(team2Full);

  const totalA = match.score1;
  const totalB = match.score2;

  // Treat equal totals as a draw, regardless of whatever Match Result was
  // recorded upstream — the scoreboard is the source of truth on the page.
  const isDraw = match.result === 'D' || Math.abs(totalA - totalB) < 0.0001;
  const team1Won = !isDraw && match.result === 'W';
  const team2Won = !isDraw && match.result === 'L';

  // Phase breakdown for the Box Score strip (Qualifying / Rounds / Final / etc.)
  const phases = Array.from(new Set(match.boxScore.map((r) => r.phase).filter(Boolean)));
  const phaseTotals = phases.map((phase) => {
    const rows = match.boxScore.filter((r) => r.phase === phase);
    return {
      phase,
      s1: rows.reduce((s, r) => s + r.score1, 0),
      s2: rows.reduce((s, r) => s + r.score2, 0),
    };
  });

  const formattedDate = (() => {
    try {
      return new Date(match.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return match.date;
    }
  })();
  const longDate = (() => {
    try {
      return new Date(match.date).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return match.date;
    }
  })();

  const heroStatus = [
    team1Won || team2Won || isDraw ? 'Final' : 'Scheduled',
    scheduleEntry?.week ? `Week ${scheduleEntry.week}` : null,
    formattedDate,
    scheduleEntry?.venueName
      ? `${scheduleEntry.venueName}${scheduleEntry.venueCity ? ` · ${scheduleEntry.venueCity}` : ''}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const BASE = 'https://tblstats.com';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'TBL Stats', item: BASE },
          { '@type': 'ListItem', position: 2, name: 'Results', item: `${BASE}/results` },
          {
            '@type': 'ListItem',
            position: 3,
            name: `${team1Full} vs ${team2Full}`,
            item: `${BASE}/matches/${mi}`,
          },
        ],
      },
      {
        '@type': 'SportsEvent',
        name: `${team1Full} vs ${team2Full}`,
        startDate: match.date,
        endDate: match.date,
        eventStatus: 'https://schema.org/EventCompleted',
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        sport: 'Boxing',
        url: `${BASE}/matches/${mi}`,
        image: `${BASE}/og-image.png`,
        description: `${team1Full} ${totalA.toFixed(1)} – ${totalB.toFixed(1)} ${team2Full}${team1Won ? `. ${team1Full} wins.` : team2Won ? `. ${team2Full} wins.` : ' · Draw.'}`,
        organizer: {
          '@type': 'SportsOrganization',
          name: 'Team Boxing League',
          url: 'https://teamboxingleague.com',
        },
        competitor: [
          { '@type': 'SportsTeam', name: team1Full },
          { '@type': 'SportsTeam', name: team2Full },
        ],
        ...(team1Won
          ? { winner: { '@type': 'SportsTeam', name: team1Full } }
          : team2Won
          ? { winner: { '@type': 'SportsTeam', name: team2Full } }
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

      {/* Dark hero */}
      <div
        className="gz-match-hero-band"
        style={{
          background: 'var(--tbl-ink)',
          color: 'var(--tbl-bg)',
          padding: '34px 40px 30px',
          borderBottom: '3px double var(--tbl-ink)',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--tbl-font-mono)',
            fontSize: 11,
            letterSpacing: '0.28em',
            color: 'var(--tbl-accent-bright)',
            textTransform: 'uppercase',
            fontWeight: 700,
            textAlign: 'center',
          }}
        >
          {heroStatus || longDate}
        </div>
        <div
          className="gz-match-hero"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            gap: 40,
            marginTop: 18,
          }}
        >
          {/* Team 1 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, justifyContent: 'flex-end' }}>
            <Link
              href={`/teams/${team1Slug}`}
              style={{ textDecoration: 'none', color: 'inherit', textAlign: 'right' }}
            >
              <div
                className="gz-match-hero__abbr"
                style={{
                  fontFamily: 'var(--tbl-font-mono)',
                  fontSize: 10,
                  letterSpacing: '0.24em',
                  color: 'rgba(244,237,224,0.6)',
                  textTransform: 'uppercase',
                }}
              >
                {team1Abbr}
              </div>
              <div
                className="tbl-display gz-match-hero__name"
                style={{ fontSize: 44, lineHeight: 1, marginTop: 2 }}
              >
                {team1Front}
                {team1Back && (
                  <>
                    {' '}
                    <span style={{ opacity: 0.7 }}>{team1Back}</span>
                  </>
                )}
              </div>
              <div
                className="gz-match-hero__result"
                style={{
                  fontFamily: 'var(--tbl-font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  marginTop: 6,
                  color: team1Won
                    ? 'var(--tbl-accent-bright)'
                    : isDraw
                    ? 'rgba(244,237,224,0.75)'
                    : 'rgba(244,237,224,0.5)',
                }}
              >
                {team1Won ? 'Winner' : team2Won ? 'Loser' : isDraw ? 'Draw' : ' '}
              </div>
            </Link>
            {team1Logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={team1Logo}
                alt=""
                className="gz-match-hero__logo"
                style={{ width: 84, height: 84, objectFit: 'contain', flexShrink: 0 }}
              />
            )}
          </div>

          {/* Score */}
          <div
            className="tbl-display gz-match-hero__score"
            style={{ fontSize: 84, lineHeight: 1, textAlign: 'center', whiteSpace: 'nowrap' }}
          >
            <span style={{ color: team1Won ? 'var(--tbl-accent-bright)' : 'inherit' }}>
              {totalA.toFixed(0)}
            </span>
            <span style={{ margin: '0 14px', fontStyle: 'italic', opacity: 0.35 }}>—</span>
            <span style={{ color: team2Won ? 'var(--tbl-accent-bright)' : 'inherit' }}>
              {totalB.toFixed(0)}
            </span>
          </div>

          {/* Team 2 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {team2Logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={team2Logo}
                alt=""
                className="gz-match-hero__logo"
                style={{ width: 84, height: 84, objectFit: 'contain', flexShrink: 0 }}
              />
            )}
            <Link
              href={`/teams/${team2Slug}`}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div
                className="gz-match-hero__abbr"
                style={{
                  fontFamily: 'var(--tbl-font-mono)',
                  fontSize: 10,
                  letterSpacing: '0.24em',
                  color: 'rgba(244,237,224,0.6)',
                  textTransform: 'uppercase',
                }}
              >
                {team2Abbr}
              </div>
              <div
                className="tbl-display gz-match-hero__name"
                style={{ fontSize: 44, lineHeight: 1, marginTop: 2 }}
              >
                {team2Front}
                {team2Back && (
                  <>
                    {' '}
                    <span style={{ opacity: 0.7 }}>{team2Back}</span>
                  </>
                )}
              </div>
              <div
                style={{
                  fontFamily: 'var(--tbl-font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  marginTop: 6,
                  color: team2Won
                    ? 'var(--tbl-accent-bright)'
                    : isDraw
                    ? 'rgba(244,237,224,0.75)'
                    : 'rgba(244,237,224,0.5)',
                }}
              >
                {team2Won ? 'Winner' : team1Won ? 'Loser' : isDraw ? 'Draw' : ' '}
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Box Score — phase scorecard strip */}
      {phases.length > 0 && (
        <div style={{ padding: '26px 32px 14px' }}>
          <SectionRule
            left="Box Score"
            right={phases.join(' · ')}
          />
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontFamily: 'var(--tbl-font-mono)',
                fontSize: 13,
              }}
            >
              <thead>
                <tr style={{ borderBottom: '2px solid var(--tbl-ink)' }}>
                  <th
                    style={{
                      padding: '8px',
                      textAlign: 'left',
                      fontSize: 10,
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      color: 'var(--tbl-ink-soft)',
                      fontWeight: 700,
                    }}
                  >
                    Team
                  </th>
                  {phases.map((p) => (
                    <th
                      key={p}
                      style={{
                        padding: '8px',
                        textAlign: 'center',
                        fontSize: 10,
                        letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                        color: 'var(--tbl-ink-soft)',
                        fontWeight: 700,
                      }}
                    >
                      {p}
                    </th>
                  ))}
                  <th
                    style={{
                      padding: '8px',
                      textAlign: 'center',
                      fontSize: 10,
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      color: 'var(--tbl-ink)',
                      fontWeight: 700,
                    }}
                  >
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    label: team1Full,
                    scores: phaseTotals.map((pt) => pt.s1),
                    opp: phaseTotals.map((pt) => pt.s2),
                    total: totalA,
                    oppTotal: totalB,
                  },
                  {
                    label: team2Full,
                    scores: phaseTotals.map((pt) => pt.s2),
                    opp: phaseTotals.map((pt) => pt.s1),
                    total: totalB,
                    oppTotal: totalA,
                  },
                ].map(({ label, scores, opp, total, oppTotal }) => (
                  <tr key={label} style={{ borderBottom: '1px dotted rgba(20,17,11,0.3)' }}>
                    <td
                      style={{
                        padding: '12px 8px',
                        fontFamily: 'var(--tbl-font-serif)',
                        fontSize: 15,
                        fontWeight: 700,
                      }}
                    >
                      {label}
                    </td>
                    {scores.map((s, i) => {
                      const win = s > opp[i];
                      return (
                        <td
                          key={i}
                          style={{
                            padding: '12px 8px',
                            textAlign: 'center',
                            fontFamily: 'var(--tbl-font-serif)',
                            fontSize: 16,
                            fontWeight: win ? 900 : 500,
                            color: win ? 'var(--tbl-green)' : 'var(--tbl-ink-soft)',
                          }}
                        >
                          {s.toFixed(0)}
                        </td>
                      );
                    })}
                    <td
                      style={{
                        padding: '12px 8px',
                        textAlign: 'center',
                        fontFamily: 'var(--tbl-font-serif)',
                        fontSize: 20,
                        fontWeight: 900,
                        color: total > oppTotal ? 'var(--tbl-accent)' : 'var(--tbl-ink)',
                      }}
                    >
                      {total.toFixed(0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Round-by-Round — desktop table + mobile fight-card list */}
      {(() => {
        const orderedRows = [...match.boxScore]
          .sort((a, b) => a.round - b.round)
          .map((row) => {
            const isNoContest =
              (!row.fighter1 || row.fighter1.trim().toUpperCase() === 'N/A') &&
              (!row.fighter2 || row.fighter2.trim().toUpperCase() === 'N/A');
            const win1 = !isNoContest && row.score1 > row.score2;
            const win2 = !isNoContest && row.score2 > row.score1;
            return { row, isNoContest, win1, win2 };
          });

        const scoreBoxBase = {
          padding: '6px 10px',
          textAlign: 'center' as const,
          fontFamily: 'var(--tbl-font-serif)',
          fontSize: 18,
          fontWeight: 900 as const,
          whiteSpace: 'nowrap' as const,
          minWidth: 36,
        };
        const winBox = {
          ...scoreBoxBase,
          background: 'var(--tbl-accent)',
          color: 'var(--tbl-paper)',
        };
        const loseBox = {
          ...scoreBoxBase,
          color: 'var(--tbl-ink-mute)',
        };
        const neutralBox = {
          ...scoreBoxBase,
          color: 'var(--tbl-ink-soft)',
        };

        return (
          <div style={{ padding: '18px 32px 36px' }}>
            <SectionRule left="Round-by-Round" right={`${match.boxScore.length} rounds`} />

            {/* ── Desktop table ────────────────────────────────────────── */}
            <div className="match-rbr-desktop" style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontFamily: 'var(--tbl-font-mono)',
                  fontSize: 13,
                }}
              >
                <thead>
                  {/* Team-banner row — groups the fighter+pts cells under each team */}
                  <tr style={{ borderBottom: '1px solid rgba(20,17,11,0.18)' }}>
                    <th colSpan={2} />
                    <th colSpan={2} style={{ padding: '8px 4px', textAlign: 'center' }}>
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                          fontFamily: 'var(--tbl-font-mono)',
                          fontSize: 11,
                          letterSpacing: '0.18em',
                          textTransform: 'uppercase',
                          fontWeight: 700,
                          color: 'var(--tbl-ink)',
                        }}
                      >
                        {team1Logo && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={team1Logo}
                            alt=""
                            style={{ width: 22, height: 22, objectFit: 'contain' }}
                          />
                        )}
                        <span>{team1Abbr}</span>
                      </div>
                    </th>
                    <th colSpan={2} style={{ padding: '8px 4px', textAlign: 'center' }}>
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                          fontFamily: 'var(--tbl-font-mono)',
                          fontSize: 11,
                          letterSpacing: '0.18em',
                          textTransform: 'uppercase',
                          fontWeight: 700,
                          color: 'var(--tbl-ink)',
                        }}
                      >
                        {team2Logo && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={team2Logo}
                            alt=""
                            style={{ width: 22, height: 22, objectFit: 'contain' }}
                          />
                        )}
                        <span>{team2Abbr}</span>
                      </div>
                    </th>
                    <th />
                  </tr>
                  <tr style={{ borderBottom: '2px solid var(--tbl-ink)' }}>
                    {[
                      { label: 'Rd', align: 'left' as const },
                      { label: 'Wt', align: 'left' as const },
                      { label: 'Fighter', align: 'right' as const },
                      { label: 'Pts', align: 'center' as const },
                      { label: 'Pts', align: 'center' as const },
                      { label: 'Fighter', align: 'left' as const },
                      { label: 'Method', align: 'left' as const },
                    ].map((h, idx) => (
                      <th
                        key={idx}
                        style={{
                          padding: '6px 8px',
                          textAlign: h.align,
                          fontSize: 10,
                          letterSpacing: '0.14em',
                          textTransform: 'uppercase',
                          color: 'var(--tbl-ink-soft)',
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orderedRows.map(({ row, isNoContest, win1, win2 }, i) => {
                    const stripe = i % 2 === 0 ? 'transparent' : 'rgba(20,17,11,0.025)';
                    const cellBase = { padding: '10px 8px' };
                    return (
                      <tr
                        key={i}
                        style={{
                          borderBottom: '1px dotted rgba(20,17,11,0.3)',
                          background: stripe,
                        }}
                      >
                        <td style={{ ...cellBase, fontWeight: 700, color: 'var(--tbl-ink)' }}>
                          {row.round}
                        </td>
                        <td style={{ ...cellBase, color: 'var(--tbl-ink-soft)', fontWeight: 700 }}>
                          {shortenWeight(row.weightClass || row.phase)}
                        </td>
                        <td
                          style={{
                            ...cellBase,
                            textAlign: 'right',
                            fontFamily: 'var(--tbl-font-serif)',
                            fontSize: 15,
                            fontWeight: 700,
                            color: win1
                              ? 'var(--tbl-accent)'
                              : isNoContest
                              ? 'var(--tbl-ink-soft)'
                              : 'var(--tbl-ink)',
                          }}
                        >
                          {isNoContest ? (
                            row.fighter1 || '—'
                          ) : (
                            <Link
                              href={`/fighters/${toSlug(row.fighter1)}`}
                              style={{ color: 'inherit', textDecoration: 'none' }}
                            >
                              {row.fighter1}
                            </Link>
                          )}
                        </td>
                        <td style={win1 ? winBox : win2 ? loseBox : neutralBox}>
                          {row.score1.toFixed(1)}
                        </td>
                        <td style={win2 ? winBox : win1 ? loseBox : neutralBox}>
                          {row.score2.toFixed(1)}
                        </td>
                        <td
                          style={{
                            ...cellBase,
                            fontFamily: 'var(--tbl-font-serif)',
                            fontSize: 15,
                            fontWeight: 700,
                            color: win2
                              ? 'var(--tbl-accent)'
                              : isNoContest
                              ? 'var(--tbl-ink-soft)'
                              : 'var(--tbl-ink)',
                          }}
                        >
                          {isNoContest ? (
                            row.fighter2 || '—'
                          ) : (
                            <Link
                              href={`/fighters/${toSlug(row.fighter2)}`}
                              style={{ color: 'inherit', textDecoration: 'none' }}
                            >
                              {row.fighter2}
                            </Link>
                          )}
                        </td>
                        <td
                          style={{
                            ...cellBase,
                            fontFamily: 'var(--tbl-font-mono)',
                            fontSize: 10,
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase',
                            color: 'var(--tbl-ink-mute)',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {isNoContest ? 'No Contest' : row.method || '—'}
                        </td>
                      </tr>
                    );
                  })}
                  <tr style={{ background: 'var(--tbl-ink)', color: 'var(--tbl-bg)' }}>
                    <td
                      colSpan={3}
                      style={{
                        padding: '14px 8px',
                        fontFamily: 'var(--tbl-font-mono)',
                        fontSize: 10,
                        letterSpacing: '0.22em',
                        textTransform: 'uppercase',
                        fontWeight: 700,
                      }}
                    >
                      Match Total ({team1Abbr} vs {team2Abbr})
                    </td>
                    <td
                      style={{
                        padding: '14px 8px',
                        textAlign: 'center',
                        fontFamily: 'var(--tbl-font-serif)',
                        fontWeight: 900,
                        fontSize: 18,
                        whiteSpace: 'nowrap',
                        color: team1Won ? 'var(--tbl-accent-bright)' : 'inherit',
                      }}
                    >
                      {totalA.toFixed(1)}
                    </td>
                    <td
                      style={{
                        padding: '14px 8px',
                        textAlign: 'center',
                        fontFamily: 'var(--tbl-font-serif)',
                        fontWeight: 900,
                        fontSize: 18,
                        whiteSpace: 'nowrap',
                        color: team2Won ? 'var(--tbl-accent-bright)' : 'inherit',
                      }}
                    >
                      {totalB.toFixed(1)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ── Mobile fight-card list ───────────────────────────────── */}
            <div className="match-rbr-mobile">
              {orderedRows.map(({ row, isNoContest, win1, win2 }, i) => (
                <div
                  key={i}
                  style={{
                    background: 'var(--tbl-paper)',
                    border: '1.5px solid var(--tbl-ink)',
                    padding: '10px 12px',
                  }}
                >
                  {/* Meta strip: round · weight · method */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      fontFamily: 'var(--tbl-font-mono)',
                      fontSize: 10,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: 'var(--tbl-ink-soft)',
                      fontWeight: 700,
                      marginBottom: 8,
                    }}
                  >
                    <span>
                      R{row.round} · {row.weightClass || row.phase || '—'}
                    </span>
                    <span style={{ color: isNoContest ? 'var(--tbl-ink-mute)' : 'var(--tbl-ink-soft)' }}>
                      {isNoContest ? 'No Contest' : row.method || '—'}
                    </span>
                  </div>
                  {/* Bout: fighter — scores — fighter */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto 1fr',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <div style={{ minWidth: 0, textAlign: 'right' }}>
                      <div
                        style={{
                          fontFamily: 'var(--tbl-font-serif)',
                          fontSize: 15,
                          fontWeight: 700,
                          lineHeight: 1.15,
                          color: win1
                            ? 'var(--tbl-accent)'
                            : isNoContest
                            ? 'var(--tbl-ink-soft)'
                            : 'var(--tbl-ink)',
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {isNoContest ? (
                          row.fighter1 || '—'
                        ) : (
                          <Link
                            href={`/fighters/${toSlug(row.fighter1)}`}
                            style={{ color: 'inherit', textDecoration: 'none' }}
                          >
                            {row.fighter1}
                          </Link>
                        )}
                      </div>
                      <div
                        style={{
                          fontFamily: 'var(--tbl-font-mono)',
                          fontSize: 9,
                          letterSpacing: '0.16em',
                          color: 'var(--tbl-ink-soft)',
                          marginTop: 2,
                        }}
                      >
                        {team1Abbr}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={win1 ? winBox : win2 ? loseBox : neutralBox}>
                        {row.score1.toFixed(1)}
                      </span>
                      <span
                        style={{
                          color: 'var(--tbl-ink-mute)',
                          fontStyle: 'italic',
                          fontFamily: 'var(--tbl-font-serif)',
                        }}
                      >
                        —
                      </span>
                      <span style={win2 ? winBox : win1 ? loseBox : neutralBox}>
                        {row.score2.toFixed(1)}
                      </span>
                    </div>
                    <div style={{ minWidth: 0, textAlign: 'left' }}>
                      <div
                        style={{
                          fontFamily: 'var(--tbl-font-serif)',
                          fontSize: 15,
                          fontWeight: 700,
                          lineHeight: 1.15,
                          color: win2
                            ? 'var(--tbl-accent)'
                            : isNoContest
                            ? 'var(--tbl-ink-soft)'
                            : 'var(--tbl-ink)',
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {isNoContest ? (
                          row.fighter2 || '—'
                        ) : (
                          <Link
                            href={`/fighters/${toSlug(row.fighter2)}`}
                            style={{ color: 'inherit', textDecoration: 'none' }}
                          >
                            {row.fighter2}
                          </Link>
                        )}
                      </div>
                      <div
                        style={{
                          fontFamily: 'var(--tbl-font-mono)',
                          fontSize: 9,
                          letterSpacing: '0.16em',
                          color: 'var(--tbl-ink-soft)',
                          marginTop: 2,
                        }}
                      >
                        {team2Abbr}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {/* Match total card */}
              <div
                style={{
                  background: 'var(--tbl-ink)',
                  color: 'var(--tbl-bg)',
                  padding: '12px 14px',
                  marginTop: 4,
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--tbl-font-mono)',
                    fontSize: 10,
                    letterSpacing: '0.22em',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    color: 'rgba(244,237,224,0.7)',
                    marginBottom: 6,
                  }}
                >
                  Match Total
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto 1fr',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      textAlign: 'right',
                      fontFamily: 'var(--tbl-font-serif)',
                      fontWeight: 900,
                      fontSize: 22,
                      color: team1Won ? 'var(--tbl-accent-bright)' : 'inherit',
                    }}
                  >
                    {totalA.toFixed(1)}
                  </div>
                  <div
                    style={{
                      color: 'rgba(244,237,224,0.4)',
                      fontStyle: 'italic',
                      fontFamily: 'var(--tbl-font-serif)',
                      fontSize: 18,
                    }}
                  >
                    —
                  </div>
                  <div
                    style={{
                      textAlign: 'left',
                      fontFamily: 'var(--tbl-font-serif)',
                      fontWeight: 900,
                      fontSize: 22,
                      color: team2Won ? 'var(--tbl-accent-bright)' : 'inherit',
                    }}
                  >
                    {totalB.toFixed(1)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Highlights */}
      {highlights.length > 0 && (
        <div style={{ padding: '0 32px 36px' }}>
          <HighlightsSection highlights={highlights} title="Match Highlights" />
        </div>
      )}

      {/* Footer nav */}
      <div
        style={{
          padding: '0 32px 48px',
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
          alignItems: 'center',
          fontFamily: 'var(--tbl-font-mono)',
          fontSize: 12,
        }}
      >
        <Link href="/results" style={{ color: 'var(--tbl-ink-soft)', textDecoration: 'none' }}>
          ← Back to Results
        </Link>
        <Link href={`/teams/${team1Slug}`} style={{ color: 'var(--tbl-accent)', textDecoration: 'none' }}>
          {team1Full} →
        </Link>
        <Link href={`/teams/${team2Slug}`} style={{ color: 'var(--tbl-accent)', textDecoration: 'none' }}>
          {team2Full} →
        </Link>
      </div>
    </>
  );
}
