// src/app/teams/[slug]/page.tsx
// Gazette team profile: dark hero (logo + team name + 2x2 stats) over
// a 2-col body of Roster (left) and Recent Matches (right).
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getTeamBySlug, calcTeamStreak, toSlug } from '@/lib/data';
import {
  getTeamLogoPath,
  getFullTeamName,
  getCityName,
} from '@/lib/teams';
import { SectionRule } from '@/components/chrome/SectionRule';
import { HighlightsSection } from '@/components/HighlightsSection';
import type { TeamMatch, FighterStat, ScheduleEntry } from '@/types';

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

// Split a full team name "NYC Attitude" → ["NYC", "Attitude"] for the hero.
function splitName(full: string): [string, string] {
  const parts = full.split(' ');
  if (parts.length < 2) return [full, ''];
  return [parts.slice(0, -1).join(' '), parts[parts.length - 1]];
}

interface MatchCardProps {
  match: TeamMatch;
  teamName: string;
}
function MatchCard({ match, teamName: _teamName }: MatchCardProps) {
  const winSquare = match.result === 'W' ? 'var(--tbl-green)' : 'var(--tbl-red)';
  const oppSlug = toSlug(match.opponent);
  const oppFull = getFullTeamName(oppSlug) || match.opponent;
  const oppLogo = `/logos/${oppSlug}.png`;
  // Surface the first KO scored by the team (matches the handoff's "KO: name" chip).
  const koRound = match.boxScore.find((r) => r.winner && r.winner !== '' && r.score2 === 0);
  const koName = koRound ? koRound.fighter1 : null;

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

  return (
    <Link
      href={`/matches/${match.matchIndex}`}
      style={{
        background: 'var(--tbl-paper)',
        border: '1.5px solid var(--tbl-ink)',
        padding: '10px 14px',
        display: 'grid',
        gridTemplateColumns: 'auto auto 1fr auto',
        alignItems: 'center',
        gap: 14,
        color: 'var(--tbl-ink)',
        textDecoration: 'none',
      }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: winSquare,
          color: '#fff',
          fontFamily: 'var(--tbl-font-serif)',
          fontSize: 18,
          fontWeight: 900,
        }}
      >
        {match.result}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={oppLogo} alt="" style={{ width: 30, height: 30, objectFit: 'contain' }} />
      <div style={{ minWidth: 0 }}>
        <div
          className="tbl-display"
          style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2 }}
        >
          vs {oppFull}
        </div>
        <div
          style={{
            fontFamily: 'var(--tbl-font-mono)',
            fontSize: 10,
            color: 'var(--tbl-ink-soft)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginTop: 2,
          }}
        >
          {formattedDate}
          {koName && ` · KO: ${koName.split(' ').slice(-1)[0]}`}
        </div>
      </div>
      <div
        className="tbl-display"
        style={{ fontSize: 22, fontWeight: 900, whiteSpace: 'nowrap' }}
      >
        <span style={{ color: match.result === 'W' ? 'var(--tbl-accent)' : 'var(--tbl-ink)' }}>
          {match.pf.toFixed(0)}
        </span>
        <span style={{ color: 'var(--tbl-ink-mute)', margin: '0 4px', fontStyle: 'italic' }}>
          —
        </span>
        <span style={{ color: match.result === 'L' ? 'var(--tbl-accent)' : 'var(--tbl-ink)' }}>
          {match.pa.toFixed(0)}
        </span>
      </div>
    </Link>
  );
}

interface NextMatchInlineProps {
  entry: ScheduleEntry;
  teamName: string;
}
function NextMatchInline({ entry, teamName }: NextMatchInlineProps) {
  const opp = entry.team1.toLowerCase().includes(teamName.split(' ')[0].toLowerCase())
    ? entry.team2
    : entry.team1;
  const oppSlug = toSlug(opp);
  const oppFull = getFullTeamName(oppSlug) || opp;
  const formattedDate = (() => {
    try {
      return new Date(entry.date).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return entry.date;
    }
  })();
  return (
    <div
      style={{
        background: 'var(--tbl-paper)',
        border: '1.5px solid var(--tbl-ink)',
        padding: '10px 14px',
        display: 'flex',
        gap: 14,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--tbl-font-mono)',
          fontSize: 10,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--tbl-accent)',
          fontWeight: 700,
        }}
      >
        Next Match
      </span>
      <div className="tbl-display" style={{ fontSize: 15, fontWeight: 700 }}>
        vs{' '}
        <Link
          href={`/teams/${oppSlug}`}
          style={{ color: 'var(--tbl-accent)', textDecoration: 'none' }}
        >
          {oppFull}
        </Link>
      </div>
      <span
        style={{
          fontFamily: 'var(--tbl-font-mono)',
          fontSize: 11,
          color: 'var(--tbl-ink-soft)',
        }}
      >
        {formattedDate}
        {entry.time ? ` · ${entry.time}` : ''}
        {entry.venueName ? ` · ${entry.venueName}` : ''}
      </span>
    </div>
  );
}

interface RosterTableProps {
  fighters: FighterStat[];
}
function RosterTable({ fighters }: RosterTableProps) {
  if (fighters.length === 0) return null;
  const sorted = [...fighters].sort((a, b) => b.war - a.war);
  return (
    <table
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontFamily: 'var(--tbl-font-mono)',
        fontSize: 12,
      }}
    >
      <thead>
        <tr style={{ borderBottom: '1.5px solid var(--tbl-ink)' }}>
          {[
            { label: 'Fighter', align: 'left' as const },
            { label: 'Weight', align: 'left' as const },
            { label: 'Rec', align: 'right' as const },
            { label: 'WAR', align: 'right' as const },
            { label: 'NPPR', align: 'right' as const },
            { label: 'Net', align: 'right' as const },
          ].map((h) => (
            <th
              key={h.label}
              style={{
                textAlign: h.align,
                padding: '6px 6px',
                fontWeight: 700,
                letterSpacing: '0.12em',
                fontSize: 10,
                textTransform: 'uppercase',
                color: 'var(--tbl-ink-soft)',
              }}
            >
              {h.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sorted.map((f) => (
          <tr key={f.slug} style={{ borderBottom: '1px dotted rgba(20,17,11,0.3)' }}>
            <td
              style={{
                padding: '9px 6px',
                fontFamily: 'var(--tbl-font-serif)',
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              <Link
                href={`/fighters/${f.slug}`}
                style={{ color: 'var(--tbl-accent)', textDecoration: 'none' }}
              >
                {f.name}
              </Link>
            </td>
            <td style={{ padding: '9px 6px', color: 'var(--tbl-ink-soft)' }}>
              {f.weightClass}
            </td>
            <td style={{ padding: '9px 6px', textAlign: 'right', fontWeight: 600 }}>
              {f.record}
            </td>
            <td
              style={{
                padding: '9px 6px',
                textAlign: 'right',
                fontWeight: 700,
                color: 'var(--tbl-accent)',
              }}
            >
              {f.war.toFixed(2)}
            </td>
            <td style={{ padding: '9px 6px', textAlign: 'right' }}>{f.nppr.toFixed(2)}</td>
            <td
              style={{
                padding: '9px 6px',
                textAlign: 'right',
                color: f.netPts >= 0 ? 'var(--tbl-green)' : 'var(--tbl-red)',
              }}
            >
              {f.netPts >= 0 ? '+' : ''}
              {f.netPts.toFixed(0)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function TeamPage({
  params,
}: {
  params: { slug: string };
}) {
  const result = await getTeamBySlug(params.slug);
  if (!result) notFound();

  const { team, matches, roster, nextMatch, highlights } = result;
  const streak = team.streak || calcTeamStreak(matches);
  const isWStreak = streak.startsWith('W');
  const teamLogoPath = getTeamLogoPath(team.slug);
  const city = getCityName(team.team) || team.team;
  const fullName = getFullTeamName(team.slug) || team.team;
  const [front, back] = splitName(fullName);

  // Rank in standings — 1 is the leader; fallback to null if not found.
  // Sort the same way the home standings do so the rank lines up.
  // We need data.teams, but getTeamBySlug returns team only; pass through data.
  // Quick local recompute using the one team we have.
  // NOTE: We could fetch getAllData again, but that's an extra Google Sheets round-trip;
  // the rank string on the hero is a nice-to-have and is omitted here.

  const BASE = 'https://tblstats.com';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'TBL Stats', item: BASE },
          { '@type': 'ListItem', position: 2, name: 'Team Standings', item: `${BASE}/teams` },
          { '@type': 'ListItem', position: 3, name: team.team, item: `${BASE}/teams/${team.slug}` },
        ],
      },
      {
        '@type': 'SportsTeam',
        name: team.team,
        sport: 'Boxing',
        url: `${BASE}/teams/${team.slug}`,
        memberOf: {
          '@type': 'SportsOrganization',
          name: 'Team Boxing League',
          url: 'https://teamboxingleague.com',
        },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Dark team hero */}
      <div
        className="gz-team-hero"
        style={{
          background: 'var(--tbl-ink)',
          color: 'var(--tbl-bg)',
          padding: '40px 40px 36px',
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto',
          alignItems: 'center',
          gap: 32,
          borderBottom: '3px double var(--tbl-ink)',
        }}
      >
        {teamLogoPath && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={teamLogoPath}
            alt=""
            style={{ width: 140, height: 140, objectFit: 'contain' }}
          />
        )}
        <div style={{ minWidth: 0 }}>
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
            Team Profile
            {streak && (
              <>
                {' · '}
                <span
                  style={{
                    color: isWStreak ? 'var(--tbl-accent-bright)' : 'rgba(244,237,224,0.6)',
                  }}
                >
                  Streak {streak}
                </span>
              </>
            )}
          </div>
          <div
            className="tbl-display"
            style={{ fontSize: 72, lineHeight: 0.9, marginTop: 10 }}
          >
            {front}
            {back && (
              <>
                {' '}
                <span style={{ opacity: 0.7 }}>{back}</span>
              </>
            )}
          </div>
          <div
            style={{
              fontFamily: 'var(--tbl-font-mono)',
              fontSize: 12,
              letterSpacing: '0.18em',
              color: 'rgba(244,237,224,0.65)',
              textTransform: 'uppercase',
              marginTop: 8,
            }}
          >
            {city} · {roster.length} {roster.length === 1 ? 'Fighter' : 'Fighters'}
          </div>
        </div>
        <div
          className="gz-team-hero__stats"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, auto)',
            gap: 22,
            borderLeft: '1px solid rgba(244,237,224,0.25)',
            paddingLeft: 28,
          }}
        >
          {[
            { l: 'Record', v: team.record },
            { l: 'PF', v: team.pf.toFixed(1) },
            { l: 'PA', v: team.pa.toFixed(1) },
            {
              l: 'Diff',
              v: `${team.diff >= 0 ? '+' : ''}${team.diff.toFixed(1)}`,
              accent: true,
            },
          ].map((s) => (
            <div key={s.l}>
              <div
                style={{
                  fontFamily: 'var(--tbl-font-mono)',
                  fontSize: 9,
                  letterSpacing: '0.24em',
                  color: 'rgba(244,237,224,0.55)',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                }}
              >
                {s.l}
              </div>
              <div
                className="tbl-display"
                style={{
                  fontSize: 36,
                  lineHeight: 1,
                  marginTop: 2,
                  color: s.accent ? 'var(--tbl-accent-bright)' : 'var(--tbl-bg)',
                }}
              >
                {s.v}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Body: roster + recent matches */}
      <div
        className="gz-team-body"
        style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 0 }}
      >
        <div
          className="gz-team-body__left"
          style={{
            padding: '26px 32px',
            borderRight: '1px solid rgba(20,17,11,0.2)',
          }}
        >
          <SectionRule left="Roster · 2026 Season" right="Sorted by WAR" />
          {roster.length > 0 ? (
            <RosterTable fighters={roster} />
          ) : (
            <p style={{ fontFamily: 'var(--tbl-font-mono)', fontSize: 12, color: 'var(--tbl-ink-soft)' }}>
              No roster data yet.
            </p>
          )}
        </div>

        <div style={{ padding: '26px 32px' }}>
          {nextMatch && (
            <>
              <SectionRule left="Next Match" />
              <NextMatchInline entry={nextMatch} teamName={team.team} />
              <div style={{ height: 20 }} />
            </>
          )}
          <SectionRule left="Recent Matches" right="Click for box score" />
          {matches.length === 0 ? (
            <p style={{ fontFamily: 'var(--tbl-font-mono)', fontSize: 12, color: 'var(--tbl-ink-soft)' }}>
              No match data available.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {matches.slice(0, 6).map((m, i) => (
                <MatchCard key={i} match={m} teamName={team.team} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Highlights */}
      {highlights.length > 0 && (
        <div style={{ padding: '26px 32px' }}>
          <HighlightsSection highlights={highlights} />
        </div>
      )}

      {/* Footer nav */}
      <div
        style={{
          padding: '0 32px 48px',
          fontFamily: 'var(--tbl-font-mono)',
          fontSize: 12,
        }}
      >
        <Link href="/teams" style={{ color: 'var(--tbl-ink-soft)', textDecoration: 'none' }}>
          ← Back to Team Standings
        </Link>
      </div>
    </>
  );
}
