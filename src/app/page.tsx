// src/app/page.tsx
// Home: dark hero with a framed screenshot → this week → top six → standings →
// recent results → hall of champions → advanced stats. Styles live in ./home.css.
import type { Metadata } from 'next';
import './home.css';
import Link from 'next/link';
import { getAllData, extractUniqueMatches } from '@/lib/data';
import { getBracketContext } from '@/lib/bracketData';
import { playoffRoundLabelsByMatch } from '@/lib/playoffs';
import { getDisplayedCurrentWeek } from '@/lib/week';
import { sortStandings } from '@/lib/standings';
import {
  aggregateFightersByPhase,
  aggregateTeamStandingsByPhase,
  filterTeamMatchesByPhase,
} from '@/lib/phaseStats';
import { getGameStartUTC } from '@/lib/gameTime';
import { getFullTeamName, getTeamLogoPathByName, getCityName } from '@/lib/teams';
import { HallOfChampions } from '@/components/home/HallOfChampions';
import { Reveal } from '@/components/home/Reveal';
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

const SITE_URL = 'https://tblstats.com';

// ─── Small, page-local helpers ───────────────────────────────────────────────
function firstName(name: string): string {
  return name.split(' ')[0] ?? name;
}
function lastName(name: string): string {
  const parts = name.split(' ');
  return parts.slice(1).join(' ') || '';
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

// Compact 2–3 letter abbreviation for narrow cards (mobile result tiles,
// hero banner). Mirrors the mapping used on the Schedule page.
function shortAbbr(team: string): string {
  const city = getCityName(team).toUpperCase();
  const map: Record<string, string> = {
    'NEW YORK': 'NYC',
    NYC: 'NYC',
    'LOS ANGELES': 'LA',
    'LAS VEGAS': 'LV',
    'SAN ANTONIO': 'SA',
    ATLANTA: 'ATL',
    BOSTON: 'BOS',
    DALLAS: 'DAL',
    HOUSTON: 'HOU',
    MIAMI: 'MIA',
    NASHVILLE: 'NSH',
    PHILADELPHIA: 'PHI',
    PHOENIX: 'PHX',
  };
  return map[city] ?? city.slice(0, 3);
}

// Poster shown in the top-left box when there's no upcoming match: the most
// recent result, framed as a MegaBrawl champion crowning when that result is
// the final.
interface HeroResult {
  eyebrow: string;
  winnerName: string;
  winnerTeam: string;
  loserName: string;
  loserTeam: string;
  scoreLine: string;
  href: string;
  isChampion: boolean;
  verb: string; // "def." for a win, "drew" for a draw
}


interface ResultCard {
  matchIndex: number;
  date: string;
  team1: string;
  team2: string;
  s1: number;
  s2: number;
  phase?: string;
}

const signed = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(0)}`;

// ─── Section heading: eyebrow, serif title, short grey intro ─────────────────
function SectionHead({
  eyebrow,
  title,
  intro,
  more,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  more?: { label: string; href: string };
}) {
  return (
    <div className="hm-head">
      <div>
        <div className="hm-eyebrow">{eyebrow}</div>
        <h2 className="hm-head__title">{title}</h2>
        {intro && <p className="hm-head__intro">{intro}</p>}
      </div>
      {more && (
        <Link href={more.href} className="hm-more">
          {more.label} →
        </Link>
      )}
    </div>
  );
}

function Section({
  tint,
  first,
  children,
}: {
  tint?: boolean;
  first?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`hm-section${tint ? ' hm-section--tint' : ''}${first ? ' hm-section--first' : ''}`}
    >
      <Reveal className="hm-wrap">{children}</Reveal>
    </section>
  );
}

// ─── Hero ────────────────────────────────────────────────────────────────────
function Hero({
  featured,
  heroResult,
}: {
  featured: ScheduleEntry | null;
  heroResult: HeroResult | null;
}) {
  // One live line under the intro: the next match, or the latest result.
  const live = featured
    ? {
        tag: 'Next',
        text: `${getCityName(featured.team1)} vs ${getCityName(featured.team2)} · ${featured.date}`,
        href: featured.matchIndex ? `/matches/${featured.matchIndex}` : '/schedule',
      }
    : heroResult
    ? {
        tag: heroResult.isChampion ? 'Champion' : 'Final',
        text: `${heroResult.winnerName} ${heroResult.verb} ${heroResult.loserName} ${heroResult.scoreLine}`,
        href: heroResult.href,
      }
    : null;

  return (
    <div className="hm-hero">
      <div className="hm-wrap">
        <div className="hm-hero__copy">
          <div className="hm-eyebrow">Team Boxing League · 2026 Season</div>
          <h1 className="hm-hero__title">
            Every round. Every fighter. <em>Every team.</em>
          </h1>
          <p className="hm-hero__intro">
            Independent stats, standings and results for Team Boxing League.
          </p>
          {live && (
            <Link href={live.href} className="hm-hero__live">
              <span className="hm-hero__live-tag">{live.tag}</span>
              {live.text}
            </Link>
          )}
        </div>
        <Link href="/stats" className="hm-device" aria-label="How the Stats Work page">
          <div className="hm-device__bar" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/home/stats-page.webp"
            alt="The How the Stats Work page on TBL Stats, defining WAR, Stakes Faced and Timing."
            width={1600}
            height={1000}
            fetchPriority="high"
          />
        </Link>
      </div>
    </div>
  );
}

// ─── This week: featured match (or latest result) + fighter in focus ────────
function ThisWeek({
  featured,
  focus,
  alsoThisWeek,
  heroResult,
  teamRecords,
}: {
  featured: ScheduleEntry | null;
  focus: FighterStat | null;
  alsoThisWeek: ScheduleEntry[];
  heroResult: HeroResult | null;
  teamRecords: Map<string, string>;
}) {
  const team1 = featured ? featured.team1 : heroResult?.winnerTeam;
  const team2 = featured ? featured.team2 : heroResult?.loserTeam;
  if (!team1 || !team2) return null;
  const [winScore, loseScore] = (heroResult?.scoreLine ?? '').split('–');
  const href = featured
    ? featured.matchIndex
      ? `/matches/${featured.matchIndex}`
      : '/schedule'
    : heroResult?.href ?? '/results';

  return (
    <Section first>
      <SectionHead
        eyebrow={featured ? 'Next up' : heroResult?.eyebrow ?? 'Latest result'}
        title={featured ? 'This week' : heroResult?.isChampion ? 'The champions' : 'Last time out'}
        intro={
          featured
            ? 'The next match on the schedule, and the top fighter on either side of it.'
            : 'The most recent result, and the fighter leading the league in net points.'
        }
        more={{ label: 'Full schedule', href: '/schedule' }}
      />
      <div className="hm-week">
        <Link href={href} className="hm-card hm-match">
          <div className="hm-match__teams">
            {[team1, team2].map((t, i) => (
              <div key={t} className="hm-match__team" style={{ order: i === 0 ? 0 : 2 }}>
                {getTeamLogoPathByName(t) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={getTeamLogoPathByName(t)} alt="" />
                )}
                <div className="hm-match__name">{getFullTeamName(teamSlug(t))}</div>
                {teamRecords.get(t) && <div className="hm-label">{teamRecords.get(t)}</div>}
              </div>
            ))}
            <div className="hm-match__mid" style={{ order: 1 }}>
              {!featured && winScore && loseScore ? (
                <span className="hm-num hm-match__score">
                  {winScore}–{loseScore}
                </span>
              ) : (
                'vs'
              )}
            </div>
          </div>
          <div className="hm-match__meta">
            {featured
              ? [featured.date, featured.time, featured.venueName, featured.venueCity]
                  .filter(Boolean)
                  .join(' · ')
              : heroResult?.isChampion
              ? 'MegaBrawl IV · Final'
              : 'Final'}
          </div>
          {alsoThisWeek.length > 0 && (
            <div className="hm-also">
              <div className="hm-label">Also this week</div>
              {alsoThisWeek.slice(0, 3).map((m) => (
                <div key={`${m.date}-${m.team1}-${m.team2}`} className="hm-also__row">
                  <span>{m.date}</span>
                  <span>
                    {m.team1} vs {m.team2}
                  </span>
                  <span>{m.time}</span>
                </div>
              ))}
            </div>
          )}
        </Link>

        {focus && (
          <div className="hm-card hm-focus">
            <div className="hm-focus__top">
              <div>
                <div className="hm-eyebrow">Fighter in focus</div>
                <Link href={`/fighters/${focus.slug}`} className="hm-focus__name">
                  {focus.name}
                </Link>
                <div className="hm-focus__meta">
                  {getFullTeamName(teamSlug(focus.team))} · {focus.weightClass}
                </div>
              </div>
              <div className="hm-focus__net">
                <div className="hm-num">{signed(focus.netPts)}</div>
                <div className="hm-label">Net pts</div>
              </div>
            </div>
            <div className="hm-stats">
              {[
                { l: 'Rec', v: focus.record },
                { l: 'WAR', v: focus.war.toFixed(2) },
                { l: 'NPPR', v: focus.nppr.toFixed(2) },
                { l: 'Win%', v: `${(focus.winPct * 100).toFixed(0)}` },
                { l: 'Rnds', v: String(focus.rounds) },
              ].map((s) => (
                <div key={s.l}>
                  <div className="hm-label">{s.l}</div>
                  <div className="hm-num">{s.v}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}

// ─── Top six fighters ────────────────────────────────────────────────────────
function TopSix({ fighters }: { fighters: FighterStat[] }) {
  if (fighters.length === 0) return null;
  return (
    <Section tint>
      <SectionHead
        eyebrow="Pound for pound"
        title="The top six"
        intro="Regular-season leaders by net points."
        more={{ label: 'All fighters', href: '/fighters' }}
      />
      <div className="hm-six">
        {fighters.slice(0, 6).map((f, i) => (
          <Link
            key={f.slug}
            href={`/fighters/${f.slug}`}
            className={`hm-card hm-fighter${i === 0 ? ' is-top' : ''}`}
          >
            <div className="hm-num hm-fighter__rank">{String(i + 1).padStart(2, '0')}</div>
            {getTeamLogoPathByName(f.team) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={getTeamLogoPathByName(f.team)} alt="" className="hm-fighter__logo" />
            )}
            <div>
              <div className="hm-fighter__name">{f.name}</div>
              <div className="hm-fighter__meta">
                {getCityName(f.team)} · {f.weightClass}
              </div>
              <div className="hm-fighter__nums">
                <div>
                  <div className="hm-label">Net</div>
                  <div className="hm-num is-net">{signed(f.netPts)}</div>
                </div>
                <div>
                  <div className="hm-label">Rec</div>
                  <div className="hm-num">{f.record}</div>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </Section>
  );
}

// ─── Standings ───────────────────────────────────────────────────────────────
function Standings({ teams }: { teams: TeamStanding[] }) {
  if (teams.length === 0) return null;
  const half = Math.ceil(teams.length / 2);
  return (
    <Section>
      <SectionHead
        eyebrow="Standings"
        title={`${teams.length} clubs, one table`}
        intro="Regular-season record, points for and against, and current streak."
        more={{ label: 'Full table', href: '/teams' }}
      />
      <div className="hm-card hm-table-card">
        <div className="hm-table-cols">
          {[teams.slice(0, half), teams.slice(half)].map((col, c) => (
            <table key={c} className="hm-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Club</th>
                  <th>W–L</th>
                  <th className="hide-sm">PF</th>
                  <th className="hide-sm">PA</th>
                  <th>Diff</th>
                  <th>Strk</th>
                </tr>
              </thead>
              <tbody>
                {col.map((t, i) => {
                  const streakColor = t.streak.startsWith('W')
                    ? 'var(--tbl-green)'
                    : t.streak.startsWith('D')
                    ? 'var(--hm-grey)'
                    : 'var(--tbl-red)';
                  return (
                    <tr key={t.slug}>
                      <td>{c * half + i + 1}</td>
                      <td>
                        <Link href={`/teams/${t.slug}`} className="hm-table__team">
                          {getTeamLogoPathByName(t.team) && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={getTeamLogoPathByName(t.team)} alt="" />
                          )}
                          {getFullTeamName(t.slug)}
                        </Link>
                      </td>
                      <td>{t.record}</td>
                      <td className="is-muted hide-sm">{Math.round(t.pf)}</td>
                      <td className="is-muted hide-sm">{Math.round(t.pa)}</td>
                      <td style={{ color: t.diff >= 0 ? 'var(--tbl-green)' : 'var(--tbl-red)' }}>
                        {signed(t.diff)}
                      </td>
                      <td style={{ color: streakColor }}>{t.streak}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ─── Recent results ──────────────────────────────────────────────────────────
function RecentResults({ results }: { results: ResultCard[] }) {
  if (results.length === 0) return null;
  return (
    <Section tint>
      <SectionHead
        eyebrow="Recent results"
        title="From the weekend"
        intro="The latest matches. Open one for its full box score."
        more={{ label: 'All results', href: '/results' }}
      />
      <div className="hm-results">
        {results.slice(0, 6).map((r, i) => {
          const isDraw = Math.abs(r.s1 - r.s2) < 0.0001;
          const t1Won = !isDraw && r.s1 > r.s2;
          const t2Won = !isDraw && r.s2 > r.s1;
          const side = (team: string, lost: boolean, left: boolean, sub?: string) => (
            <div className={`hm-result__side${left ? ' is-left' : ''}${lost ? ' is-lost' : ''}`}>
              {!left && getTeamLogoPathByName(team) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={getTeamLogoPathByName(team)} alt="" />
              )}
              <div>
                <div className="hm-result__name">
                  <span className="full">{getFullTeamName(teamSlug(team))}</span>
                  <span className="abbr">{shortAbbr(team)}</span>
                </div>
                {sub && <div className="hm-result__sub">{sub}</div>}
              </div>
              {left && getTeamLogoPathByName(team) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={getTeamLogoPathByName(team)} alt="" />
              )}
            </div>
          );
          return (
            <Link
              key={`${i}-${r.team1}-${r.team2}`}
              href={`/matches/${r.matchIndex}`}
              className="hm-card hm-result"
            >
              {side(r.team1, t2Won, true, r.date.replace(/\/\d{4}$/, '').replace(/^\d{4}-/, ''))}
              <div className="hm-num hm-result__score">
                <span className={t1Won ? 'is-win' : undefined}>{r.s1.toFixed(1)}</span>
                <span className="sep">–</span>
                <span className={t2Won ? 'is-win' : undefined}>{r.s2.toFixed(1)}</span>
              </div>
              {side(r.team2, t1Won, false, r.phase)}
            </Link>
          );
        })}
      </div>
    </Section>
  );
}

// ─── Advanced stats ──────────────────────────────────────────────────────────
// Each advanced stat has its own public page; this section is the front door.
function AdvancedStats({ tint }: { tint: boolean }) {
  const cards: { title: string; blurb: string; links: { label: string; href: string }[] }[] = [
    {
      title: 'Advanced stats',
      blurb: 'The biggest rounds of the season, a leaderboard for every advanced stat, and the biggest comebacks.',
      links: [
        { label: 'Biggest rounds', href: '/advanced' },
        { label: 'Fighter leaderboard', href: '/advanced?view=fighters' },
      ],
    },
    {
      title: 'How the stats work',
      blurb:
        'Win Probability, Stakes, Timing, Comebacks, Adjusted NPPR, Schedule and WAR, in plain English.',
      links: [{ label: 'Every stat explained', href: '/stats' }],
    },
  ];
  return (
    <Section tint={tint}>
      <SectionHead
        eyebrow="Beyond the box score"
        title="Advanced stats"
        intro="Numbers built from every round, not just the final score."
      />
      <div className="hm-adv">
        {cards.map((c) => (
          <div key={c.title} className="hm-card hm-adv__card">
            <div className="hm-adv__title">{c.title}</div>
            <p>{c.blurb}</p>
            <div className="hm-adv__links">
              {c.links.map((l) => (
                <Link key={l.href} href={l.href} className="hm-more">
                  {l.label} →
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default async function HomePage() {
  const { fighters, fightersByPhase, fighterHistory, teams, schedule, teamMatches, awards } =
    await getAllData();
  // Hall-of-Champions links resolve against the full roster (incl. playoff-only
  // fighters), so keep this from the joint fighter list.
  const fighterSlugs = new Set(fighters.map((f) => f.slug));

  // Home leaders and standings default to REGULAR-SEASON stats (not full
  // season), matching the default view on the Fighters / Rankings / Teams
  // pages. During the regular season this equals the full-season data; it only
  // diverges once playoff games are tagged, keeping playoff results out of the
  // home snippets.
  const regularFighters = aggregateFightersByPhase(
    fighters,
    fightersByPhase,
    fighterHistory,
    'regular',
  );
  const regularTeams = aggregateTeamStandingsByPhase(teams, teamMatches, 'regular');
  const regularTeamMatches = filterTeamMatchesByPhase(teamMatches, 'regular');

  const currentWeek = getDisplayedCurrentWeek(schedule);
  // "Upcoming" stays on the schedule entry until results are entered, so a
  // game in progress (or one that started a few hours ago and just hasn't
  // been finalized yet) would otherwise still be the featured match. Pick
  // the next genuinely-future match across the entire schedule, not just
  // the current week, so the hero advances the moment kickoff passes —
  // even if it has to roll forward into next week.
  const now = Date.now();
  const isStillFuture = (s: ScheduleEntry) => {
    if (s.status !== 'Upcoming') return false;
    const start = getGameStartUTC(s.date, s.time, s.venueCity);
    if (!start || isNaN(start.getTime())) return true; // fail open
    return start.getTime() > now;
  };
  const allFuture = [...schedule]
    .filter(isStillFuture)
    .sort((a, b) => {
      const aStart = getGameStartUTC(a.date, a.time, a.venueCity)?.getTime() ?? 0;
      const bStart = getGameStartUTC(b.date, b.time, b.venueCity)?.getTime() ?? 0;
      return aStart - bStart;
    });
  const featured = allFuture[0] ?? null;
  // "Also this week" only lists matches in the same week as the featured
  // game (or the displayed current week if none is featured).
  const referenceWeek = featured ? Number(featured.week) : currentWeek;
  const alsoThisWeek = allFuture
    .slice(1)
    .filter((s) => referenceWeek != null && Number(s.week) === referenceWeek);

  // Sort by Net Points — drives "Top Six" and the league-wide leaderboard.
  const fightersByNetPts = [...regularFighters].sort((a, b) => b.netPts - a.netPts);
  const topSix = fightersByNetPts.slice(0, 6);

  // Fighter in Focus: top net-points fighter from either side of the
  // featured matchup, so the right-rail spotlight matches the upcoming
  // event on the left. Falls back to the league leader when there's no
  // upcoming match (offseason / between weeks).
  const focus = (() => {
    if (!featured) return fightersByNetPts[0] ?? null;
    const slug1 = teamSlug(featured.team1);
    const slug2 = teamSlug(featured.team2);
    const fromMatch = fightersByNetPts.find((f) => {
      const fs = teamSlug(f.team);
      return fs === slug1 || fs === slug2;
    });
    return fromMatch ?? fightersByNetPts[0] ?? null;
  })();

  // Use the shared standings sorter so the home snippet matches the Teams page
  // row-for-row, including the head-to-head tiebreaker for two-team ties. Both
  // use the regular-season standings.
  const topTeams = sortStandings(regularTeams, regularTeamMatches);

  // Map each completed match back to its schedule week so result cards can
  // show "Week 3" etc. instead of the boxScore's scoring-phase label.
  const weekByMatchIndex = new Map<number, number>();
  schedule.forEach((s) => {
    if (s.matchIndex != null) weekByMatchIndex.set(s.matchIndex, s.week);
  });

  // Bracket context: playoff round labels for result cards, and the MegaBrawl
  // champion for the hero poster below.
  const { bracket } = getBracketContext(await getAllData());
  const playoffLabels = playoffRoundLabelsByMatch(bracket);

  // Real match results from the teamMatches data (same source the /results
  // page uses), sorted newest-first and capped at 6 cards. Playoff games are
  // labeled by round (Quarterfinals / Semifinals / MegaBrawl IV), never
  // "Week 0".
  const completed: ResultCard[] = extractUniqueMatches(teamMatches)
    .slice(0, 6)
    .map((m: MatchResult) => {
      const wk = weekByMatchIndex.get(m.matchIndex);
      const phase =
        m.phase === 'playoffs'
          ? playoffLabels.get(m.matchIndex) ?? 'Playoffs'
          : wk != null && wk > 0
          ? `Week ${wk}`
          : undefined;
      return {
        matchIndex: m.matchIndex,
        date: m.date,
        team1: m.team1,
        team2: m.team2,
        s1: m.score1,
        s2: m.score2,
        phase,
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

  // Quick team→record lookup for the mobile hero banner (regular-season record).
  const teamRecords = new Map<string, string>();
  regularTeams.forEach((t) => {
    teamRecords.set(t.team, t.record);
    teamRecords.set(getFullTeamName(t.slug), t.record);
    teamRecords.set(getCityName(t.team), t.record);
  });
  const lastCompleted = completed[0] ?? null;

  // MegaBrawl champion — only once the final has been played. Derived from the
  // live bracket (computed above), with the winner's score shown first.
  const finalMatch = bracket.final;
  const champSeed =
    finalMatch.status === 'played'
      ? finalMatch.a?.team.slug === finalMatch.winnerSlug
        ? finalMatch.a
        : finalMatch.b
      : undefined;
  const runnerSeed = champSeed
    ? champSeed === finalMatch.a
      ? finalMatch.b
      : finalMatch.a
    : undefined;
  const champScoreLine =
    champSeed && finalMatch.score
      ? finalMatch.a?.team.slug === finalMatch.winnerSlug
        ? `${finalMatch.score[0]}–${finalMatch.score[1]}`
        : `${finalMatch.score[1]}–${finalMatch.score[0]}`
      : null;

  // Top-left poster when there's no upcoming game: the most recent result,
  // framed as the MegaBrawl champion crowning when that result is the final.
  const heroResult: HeroResult | null = (() => {
    if (champSeed) {
      return {
        eyebrow: 'MegaBrawl IV · Champion',
        winnerName: getFullTeamName(champSeed.team.slug),
        winnerTeam: champSeed.team.team,
        loserName: runnerSeed ? getFullTeamName(runnerSeed.team.slug) : '',
        loserTeam: runnerSeed?.team.team ?? '',
        scoreLine: champScoreLine ?? '',
        href: '/playoffs',
        isChampion: true,
        verb: 'def.',
      };
    }
    if (lastCompleted) {
      const isDraw = Math.abs(lastCompleted.s1 - lastCompleted.s2) < 0.0001;
      const t1Won = lastCompleted.s1 >= lastCompleted.s2;
      const winner = t1Won ? lastCompleted.team1 : lastCompleted.team2;
      const loser = t1Won ? lastCompleted.team2 : lastCompleted.team1;
      const ws = t1Won ? lastCompleted.s1 : lastCompleted.s2;
      const ls = t1Won ? lastCompleted.s2 : lastCompleted.s1;
      const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
      return {
        eyebrow: `Latest Result · ${lastCompleted.date}`,
        winnerName: getFullTeamName(teamSlug(winner)),
        winnerTeam: winner,
        loserName: getFullTeamName(teamSlug(loser)),
        loserTeam: loser,
        scoreLine: `${fmt(ws)}–${fmt(ls)}`,
        href: `/matches/${lastCompleted.matchIndex}`,
        isChampion: false,
        verb: isDraw ? 'drew' : 'def.',
      };
    }
    return null;
  })();

  return (
    <div className="hm">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Hero featured={featured} heroResult={heroResult} />
      {/* Room for the screenshot hanging out of the hero. */}
      <div className="hm-overhang" aria-hidden="true" />
      <ThisWeek
        featured={featured}
        focus={focus}
        alsoThisWeek={alsoThisWeek}
        heroResult={heroResult}
        teamRecords={teamRecords}
      />
      <TopSix fighters={topSix} />
      <Standings teams={topTeams} />
      <RecentResults results={completed} />
      {awards.length > 0 && (
        <Section>
          <SectionHead
            eyebrow="Past MVPs & trophies"
            title="Hall of champions"
            intro="Every season's award winners."
            more={{ label: 'All awards', href: '/awards' }}
          />
          <HallOfChampions awards={awards} fighterSlugs={fighterSlugs} />
        </Section>
      )}
      {/* Keep the white/tint alternation whether or not the awards block shows. */}
      <AdvancedStats tint={awards.length > 0} />
    </div>
  );
}
