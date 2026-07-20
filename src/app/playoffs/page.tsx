// src/app/playoffs/page.tsx
// Live playoff bracket. Before any playoff game is played this is a projection
// ("if the playoffs started today") seeded from the final regular-season
// standings. Once games tagged Game Phase = Playoffs land in the sheet, the
// bracket advances winners round by round and eventually crowns a champion.
import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllData, extractUniqueMatches } from '@/lib/data';
import { getFullTeamName, getTeamLogoPathByName } from '@/lib/teams';
import { getLastCompletedWeek } from '@/lib/week';
import { sortStandings, getH2HTiebreakerWinners } from '@/lib/standings';
import { buildBracket, type Seed, type BracketMatch } from '@/lib/playoffs';
import type { TeamMatch } from '@/types';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Playoff Bracket — TBL Stats',
  description:
    'The TBL playoff bracket: MegaBrawl IV. Live single-elimination results as winners advance to the final.',
};

const PLAYOFF_SPOTS = 8;

function shortAbbr(slug: string, fallback: string): string {
  const map: Record<string, string> = {
    nyc: 'NYC',
    'los-angeles': 'LA',
    'las-vegas': 'LV',
    'san-antonio': 'SA',
    atlanta: 'ATL',
    boston: 'BOS',
    dallas: 'DAL',
    houston: 'HOU',
    miami: 'MIA',
    nashville: 'NSH',
    philadelphia: 'PHI',
    phoenix: 'PHX',
  };
  return map[slug] ?? fallback.slice(0, 3).toUpperCase();
}

// Keep only each team's regular-season matches. Seeds must reflect the final
// regular-season table, so playoff games can't perturb the standings or the
// head-to-head tiebreakers.
function regularSeasonMatches(
  teamMatches: Record<string, TeamMatch[]>
): Record<string, TeamMatch[]> {
  const out: Record<string, TeamMatch[]> = {};
  for (const [team, matches] of Object.entries(teamMatches)) {
    out[team] = matches.filter((m) => m.phase === 'regular');
  }
  return out;
}

export default async function PlayoffsPage() {
  const { teams, teamMatches, schedule } = await getAllData();

  const regularMatches = regularSeasonMatches(teamMatches);
  const standings = sortStandings(teams, regularMatches);
  const h2hWinners = getH2HTiebreakerWinners(teams, regularMatches);

  const seeds: Seed[] = standings.slice(0, PLAYOFF_SPOTS).map((team, i) => ({
    seed: i + 1,
    team,
  }));
  const inHunt = standings.slice(PLAYOFF_SPOTS, PLAYOFF_SPOTS + 4);

  const playoffResults = extractUniqueMatches(teamMatches).filter(
    (m) => m.phase === 'playoffs'
  );
  const bracket = buildBracket(seeds, playoffResults);
  const { anyPlayed, championSlug } = bracket;
  const champion = championSlug
    ? seeds.find((s) => s.team.slug === championSlug)?.team
    : undefined;

  const lastWeek = getLastCompletedWeek(schedule);

  return (
    <main>
      <div className="tbl-page-body po-root">
        <header className="po-header">
          <div>
            <div className="tbl-eyebrow">
              {anyPlayed ? 'Postseason · MegaBrawl IV' : 'Postseason · Live Projection'}
            </div>
            <h1 className="tbl-page-header__title po-title">
              {anyPlayed ? 'Playoff Bracket' : 'Playoff Picture'}
            </h1>
            <div className="po-header__sub">
              {champion ? (
                <>Champions: {getFullTeamName(champion.slug)}</>
              ) : anyPlayed ? (
                <>Single elimination · Winners advance</>
              ) : (
                <>If the playoffs started today</>
              )}
              {lastWeek != null && <> · Through Week {lastWeek}</>}
              <> · Top {PLAYOFF_SPOTS} seeds</>
            </div>
          </div>
          <div className="po-header__legend">
            <Link href="/teams" className="po-legend__link">
              Full standings →
            </Link>
          </div>
        </header>

        {/* Horizontally scrollable on mobile; the wrapper preserves the true
            left-to-right bracket instead of collapsing/hiding rounds. */}
        <div className="po-bracket-scroll">
          <div className="po-bracket">
            {/* Quarterfinals — top half */}
            <div className="po-col po-col--qf">
              <div className="po-round-rule">Quarterfinals</div>
              <Match match={bracket.qf[0]} hostHigh h2hWinners={h2hWinners} />
              <Match match={bracket.qf[1]} hostHigh h2hWinners={h2hWinners} />
            </div>

            {/* Semifinals — top half */}
            <div className="po-col po-col--sf">
              <div className="po-round-rule">Semifinal</div>
              <Match match={bracket.sf[0]} h2hWinners={h2hWinners} />
            </div>

            {/* Final */}
            <div className="po-col po-col--f">
              <div className="po-round-rule">Final</div>
              <FinalMatch match={bracket.final} h2hWinners={h2hWinners} />
            </div>

            {/* Semifinals — bottom half */}
            <div className="po-col po-col--sf po-col--sf-bottom">
              <div className="po-round-rule">Semifinal</div>
              <Match match={bracket.sf[1]} h2hWinners={h2hWinners} />
            </div>

            {/* Quarterfinals — bottom half */}
            <div className="po-col po-col--qf po-col--qf-bottom">
              <div className="po-round-rule">Quarterfinals</div>
              <Match match={bracket.qf[2]} hostHigh h2hWinners={h2hWinners} />
              <Match match={bracket.qf[3]} hostHigh h2hWinners={h2hWinners} />
            </div>
          </div>
        </div>

        {/* Seed list + bubble */}
        <div className="po-grid">
          <section className="po-card">
            <div className="tbl-section-rule">
              <span>The Field · 1 through {PLAYOFF_SPOTS}</span>
              <span>{seeds.length === PLAYOFF_SPOTS ? 'Locked positions' : 'Provisional'}</span>
            </div>
            <SeedTable seeds={seeds} h2hWinners={h2hWinners} championSlug={championSlug} />
          </section>

          {!anyPlayed && (
            <section className="po-card">
              <div className="tbl-section-rule">
                <span>On the Bubble</span>
                <span>{inHunt.length} clubs</span>
              </div>
              {inHunt.length === 0 ? (
                <div className="po-empty">All clubs are in the field — wait until later in the season.</div>
              ) : (
                <SeedTable
                  seeds={inHunt.map((team, i) => ({
                    seed: PLAYOFF_SPOTS + i + 1,
                    team,
                  }))}
                  bubble
                  h2hWinners={h2hWinners}
                />
              )}
            </section>
          )}
        </div>

        {h2hWinners.size > 0 && (
          <div className="po-h2h-note">
            {Array.from(h2hWinners.entries()).map(([slug, beaten]) => {
              const winnerTeam = teams.find((t) => t.slug === slug)?.team ?? slug;
              return (
                <div key={slug}>
                  <span className="po-h2h-note__star">*</span> {winnerTeam} wins tiebreaker over {beaten.join(', ')} via head-to-head record
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

// ── Match cell ───────────────────────────────────────────────────────────────
function Match({
  match,
  hostHigh,
  h2hWinners,
}: {
  match: BracketMatch;
  hostHigh?: boolean;
  h2hWinners: Map<string, string[]>;
}) {
  const { a, b, status } = match;
  if (!a || !b) {
    return <TBDMatch />;
  }
  // Lower seed = higher seed line (gets host designation).
  const host = a.seed < b.seed ? a : b;
  const visitor = a.seed < b.seed ? b : a;
  const decided = status === 'played';
  const hostScore = match.score?.[a.seed < b.seed ? 0 : 1];
  const visitorScore = match.score?.[a.seed < b.seed ? 1 : 0];
  return (
    <div className={`po-match${decided ? ' po-match--played' : ''}`}>
      <SeedRow
        seed={host}
        highlight={!!hostHigh && !decided}
        winner={decided && match.winnerSlug === host.team.slug}
        eliminated={decided && match.winnerSlug !== host.team.slug}
        score={hostScore}
        h2hWinners={h2hWinners}
      />
      <div className="po-match__rule">vs</div>
      <SeedRow
        seed={visitor}
        winner={decided && match.winnerSlug === visitor.team.slug}
        eliminated={decided && match.winnerSlug !== visitor.team.slug}
        score={visitorScore}
        h2hWinners={h2hWinners}
      />
    </div>
  );
}

function SeedRow({
  seed,
  highlight,
  winner,
  eliminated,
  score,
  h2hWinners,
}: {
  seed: Seed;
  highlight?: boolean;
  winner?: boolean;
  eliminated?: boolean;
  score?: number;
  h2hWinners: Map<string, string[]>;
}) {
  const logo = getTeamLogoPathByName(seed.team.team);
  const name = getFullTeamName(seed.team.slug);
  const beaten = h2hWinners.get(seed.team.slug);
  const cls = [
    'po-seed',
    highlight ? 'po-seed--high' : '',
    winner ? 'po-seed--winner' : '',
    eliminated ? 'po-seed--out' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <Link href={`/teams/${seed.team.slug}`} className={cls}>
      <span className="po-seed__num">{seed.seed}</span>
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className="po-seed__logo" />
      )}
      <span className="po-seed__body">
        <span className="po-seed__name">
          {name}
          {beaten && (
            <span
              className="po-seed__h2h"
              title={`Wins tiebreaker over ${beaten.join(', ')} via head-to-head record`}
            >
              *
            </span>
          )}
        </span>
        <span className="po-seed__abbr">{shortAbbr(seed.team.slug, seed.team.team)}</span>
        <span className="po-seed__rec">{seed.team.record}</span>
      </span>
      {score != null && <span className="po-seed__score">{score}</span>}
    </Link>
  );
}

function TBDMatch() {
  return (
    <div className="po-match po-match--tbd">
      <div className="po-tbd">TBD</div>
      <div className="po-match__rule">vs</div>
      <div className="po-tbd">TBD</div>
    </div>
  );
}

function FinalMatch({
  match,
  h2hWinners,
}: {
  match: BracketMatch;
  h2hWinners: Map<string, string[]>;
}) {
  const { a, b, status } = match;
  const decided = status === 'played';
  const champion = decided
    ? a?.team.slug === match.winnerSlug
      ? a
      : b
    : undefined;

  if (champion) {
    const logo = getTeamLogoPathByName(champion.team.team);
    const scoreLine = match.score ? `${match.score[0]}–${match.score[1]}` : null;
    return (
      <div className="po-match po-match--final po-match--champion">
        <div className="po-final__ribbon">Champion</div>
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="po-champion__logo" />
        )}
        <div className="po-final__line">{getFullTeamName(champion.team.slug)}</div>
        <div className="po-final__meta">MegaBrawl IV{scoreLine ? ` · ${scoreLine}` : ''}</div>
      </div>
    );
  }

  // Finalists set but not yet played, or still awaiting semifinal winners.
  if (a && b) {
    return (
      <div className="po-match po-match--final">
        <div className="po-final__line">MegaBrawl IV</div>
        <Match match={match} h2hWinners={h2hWinners} />
      </div>
    );
  }

  return (
    <div className="po-match po-match--final">
      <div className="po-final__line">MegaBrawl IV</div>
      <div className="po-tbd">TBD</div>
      <div className="po-match__rule">vs</div>
      <div className="po-tbd">TBD</div>
    </div>
  );
}

// ── Seed list / bubble table ─────────────────────────────────────────────────
function SeedTable({
  seeds,
  bubble,
  h2hWinners,
  championSlug,
}: {
  seeds: Seed[];
  bubble?: boolean;
  h2hWinners: Map<string, string[]>;
  championSlug?: string;
}) {
  return (
    <div className="po-table">
      <div className="po-table__head">
        <span className="po-table__h po-table__h--seed">{bubble ? 'Pos' : 'Seed'}</span>
        <span className="po-table__h">Club</span>
        <span className="po-table__h po-table__h--num">W–L</span>
        <span className="po-table__h po-table__h--num">Diff</span>
        <span className="po-table__h po-table__h--num">Strk</span>
      </div>
      {seeds.map((s) => {
        const logo = getTeamLogoPathByName(s.team.team);
        const name = getFullTeamName(s.team.slug);
        const streakStr = s.team.streak || '';
        const streakColor = streakStr.startsWith('W')
          ? 'var(--tbl-green)'
          : streakStr.startsWith('D')
          ? 'var(--tbl-ink-soft)'
          : 'var(--tbl-red)';
        const beaten = h2hWinners.get(s.team.slug);
        const isChampion = championSlug === s.team.slug;
        return (
          <Link
            key={s.team.slug}
            href={`/teams/${s.team.slug}`}
            className={`po-table__row${isChampion ? ' po-table__row--champion' : ''}`}
          >
            <span className="po-table__seed">{s.seed}</span>
            <span className="po-table__team">
              {logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="" className="po-table__logo" />
              )}
              <span className="po-table__name">
                {name}
                {isChampion && <span className="po-table__champ" title="Champion">★</span>}
                {beaten && (
                  <span
                    className="po-seed__h2h"
                    title={`Wins tiebreaker over ${beaten.join(', ')} via head-to-head record`}
                  >
                    *
                  </span>
                )}
              </span>
            </span>
            <span className="po-table__num">{s.team.record}</span>
            <span
              className="po-table__num"
              style={{ color: s.team.diff >= 0 ? 'var(--tbl-green)' : 'var(--tbl-red)' }}
            >
              {s.team.diff >= 0 ? '+' : ''}
              {Math.round(s.team.diff)}
            </span>
            <span className="po-table__num" style={{ color: streakColor }}>
              {s.team.streak || '—'}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
