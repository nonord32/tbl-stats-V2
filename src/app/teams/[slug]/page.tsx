// src/app/teams/[slug]/page.tsx
// Gazette team profile: dark hero (logo + team name + 2x2 stats) over
// a 2-col body of Roster (left) and Recent Matches (right).
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getAllData, getTeamBySlug, calcTeamStreak, toSlug } from '@/lib/data';
import { sortStandings } from '@/lib/standings';
import {
  getTeamLogoPath,
  getFullTeamName,
  getCityName,
} from '@/lib/teams';
import { SectionRule } from '@/components/chrome/SectionRule';
import { getComebackData } from '@/lib/wpa';
import { HighlightsSection } from '@/components/HighlightsSection';
import { RosterTable } from './RosterTable';
import { RecentMatches } from './RecentMatches';
import type { ScheduleEntry } from '@/types';

export const revalidate = 300;

// 1 → "1st", 2 → "2nd", 11 → "11th", etc.
function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  // getAllData is React-cached, so this shares the fetch with the page render.
  const data = await getAllData();
  const team = data.teams.find((t) => t.slug === params.slug);
  if (!team) return { title: 'Team Not Found' };
  // "Standing" = the team's 1-based rank in the resolved league standings.
  const ordered = sortStandings(data.teams, data.teamMatches);
  const rank = ordered.findIndex((t) => t.slug === params.slug) + 1;
  const netPts = `${team.diff >= 0 ? '+' : ''}${team.diff.toFixed(1)}`;
  const standing =
    rank > 0 ? `sit ${ordinal(rank)} in the TBL standings` : 'compete in the TBL';
  return {
    title: `${team.team} — TBL Roster, Standings & Team Stats`,
    description: `${team.team} ${standing} at ${team.record} with ${netPts} net points (${team.pf.toFixed(1)} PF / ${team.pa.toFixed(1)} PA). Full roster, results, and round-by-round team stats from the 2026 Team Boxing League season.`,
    openGraph: {
      // og:image / twitter:image are supplied by the sibling opengraph-image.tsx.
      url: `https://tblstats.com/teams/${params.slug}`,
      title: `${team.team} | TBL Stats`,
      description: `${team.record} · ${netPts} net pts · ${team.pf.toFixed(1)} PF / ${team.pa.toFixed(1)} PA`,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${team.team} | TBL Stats`,
      description: `${team.record} · ${netPts} net pts · ${team.pf.toFixed(1)} PF / ${team.pa.toFixed(1)} PA`,
    },
  };
}

// Split a full team name "NYC Attitude" → ["NYC", "Attitude"] for the hero.
function splitName(full: string): [string, string] {
  const parts = full.split(' ');
  if (parts.length < 2) return [full, ''];
  return [parts.slice(0, -1).join(' '), parts[parts.length - 1]];
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


export default async function TeamPage({
  params,
}: {
  params: { slug: string };
}) {
  const result = await getTeamBySlug(params.slug);
  if (!result) notFound();

  const { team, matches, roster, nextMatch, highlights } = result;

  // Comeback wins / blown leads for this club, off the stored win probabilities.
  const cb = (await getComebackData()).byTeam.get(team.slug) ?? null;
  const streak = team.streak || calcTeamStreak(matches);
  const streakHeroColor = streak.startsWith('W')
    ? 'var(--tbl-accent-bright)'
    : streak.startsWith('D')
    ? 'rgba(244,237,224,0.85)'
    : 'rgba(244,237,224,0.6)';
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
                    color: streakHeroColor,
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
          <SectionRule left="Roster · 2026 Season" right="Click any column to sort" />
          {roster.length > 0 ? (
            <RosterTable fighters={roster} />
          ) : (
            <p style={{ fontFamily: 'var(--tbl-font-mono)', fontSize: 12, color: 'var(--tbl-ink-soft)' }}>
              No roster data yet.
            </p>
          )}
        </div>

        <div className="gz-team-body__right" style={{ padding: '26px 32px' }}>
          {nextMatch && (
            <>
              <SectionRule left="Next Match" />
              <NextMatchInline entry={nextMatch} teamName={team.team} />
              <div style={{ height: 20 }} />
            </>
          )}
          {cb && (cb.comebackWins > 0 || cb.blownLeads > 0) && (
            <>
              <SectionRule left="Comebacks" right="Win probability" />
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  border: '1px solid rgba(20,17,11,0.18)',
                  marginBottom: 20,
                }}
              >
                {[
                  {
                    l: 'Comeback Wins',
                    v: String(cb.comebackWins),
                    sub:
                      cb.deepestHole != null
                        ? `from as low as ${(cb.deepestHole * 100).toFixed(1)}%`
                        : undefined,
                    color: 'var(--tbl-green)',
                  },
                  {
                    l: 'Blown Leads',
                    v: String(cb.blownLeads),
                    sub:
                      cb.highestLeadBlown != null
                        ? `from as high as ${(cb.highestLeadBlown * 100).toFixed(1)}%`
                        : undefined,
                    color: 'var(--tbl-red)',
                  },
                ].map((c, i) => (
                  <div
                    key={c.l}
                    style={{ padding: '12px 14px', borderLeft: i > 0 ? '1px solid rgba(20,17,11,0.18)' : 'none' }}
                  >
                    <div
                      style={{
                        fontFamily: 'var(--tbl-font-mono)',
                        fontSize: 9,
                        letterSpacing: '0.2em',
                        textTransform: 'uppercase',
                        color: 'var(--tbl-ink-soft)',
                        fontWeight: 700,
                      }}
                    >
                      {c.l}
                    </div>
                    <div
                      className="tbl-display"
                      style={{ fontSize: 30, lineHeight: 1, marginTop: 3, color: c.v === '0' ? 'var(--tbl-ink-mute)' : c.color }}
                    >
                      {c.v}
                    </div>
                    {c.sub && (
                      <div
                        style={{
                          fontFamily: 'var(--tbl-font-mono)',
                          fontSize: 9,
                          color: 'var(--tbl-ink-soft)',
                          marginTop: 3,
                        }}
                      >
                        {c.sub}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
          <RecentMatches matches={matches} />
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
