// src/app/playoffs/page.tsx
// "If the playoffs started today" — top-8 single-elimination bracket seeded
// from the current standings. Quarterfinals are the only round we can fill
// in (we know who the seeds are); semifinals and the final show TBD slots.
import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllData } from '@/lib/data';
import { getFullTeamName, getTeamLogoPathByName } from '@/lib/teams';
import { getLastCompletedWeek } from '@/lib/week';
import { sortStandings, getH2HTiebreakerWinners } from '@/lib/standings';
import type { TeamStanding } from '@/types';

export const revalidate = 1800;

export const metadata: Metadata = {
  title: 'Playoff Picture — TBL Stats',
  description:
    'A live bracket projection: if the TBL playoffs started today, here is what the field would look like.',
};

const PLAYOFF_SPOTS = 8;

interface Seed {
  seed: number;
  team: TeamStanding;
}

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

export default async function PlayoffsPage() {
  const { teams, teamMatches, schedule } = await getAllData();

  const standings = sortStandings(teams, teamMatches);
  const h2hWinners = getH2HTiebreakerWinners(teams, teamMatches);

  const seeds: Seed[] = standings.slice(0, PLAYOFF_SPOTS).map((team, i) => ({
    seed: i + 1,
    team,
  }));
  const inHunt = standings.slice(PLAYOFF_SPOTS, PLAYOFF_SPOTS + 4);

  // Standard 8-team bracket pairings: 1v8, 4v5, 3v6, 2v7.
  // Top half = (1v8) → (4v5) → SF1 → Final; bottom half = (3v6) → (2v7) → SF2.
  const bySeed = new Map(seeds.map((s) => [s.seed, s] as const));
  const qfPairs: Array<[Seed | undefined, Seed | undefined]> = [
    [bySeed.get(1), bySeed.get(8)],
    [bySeed.get(4), bySeed.get(5)],
    [bySeed.get(3), bySeed.get(6)],
    [bySeed.get(2), bySeed.get(7)],
  ];

  const lastWeek = getLastCompletedWeek(schedule);

  return (
    <main>
      <div className="tbl-page-body po-root">
        <header className="po-header">
          <div>
            <div className="tbl-eyebrow">Postseason · Live Projection</div>
            <h1 className="tbl-page-header__title po-title">Playoff Picture</h1>
            <div className="po-header__sub">
              If the playoffs started today
              {lastWeek != null && <> · Through Week {lastWeek}</>}
              <> · Top {PLAYOFF_SPOTS} seeds · Single elimination</>
            </div>
          </div>
          <div className="po-header__legend">
            <Link href="/teams" className="po-legend__link">
              Full standings →
            </Link>
          </div>
        </header>

        <div className="po-bracket">
          {/* Quarterfinals — top half */}
          <div className="po-col po-col--qf">
            <div className="po-round-rule">Quarterfinals</div>
            {qfPairs.slice(0, 2).map((p, i) => (
              <Match key={`qf-top-${i}`} a={p[0]} b={p[1]} hostHigh h2hWinners={h2hWinners} />
            ))}
          </div>

          {/* Semifinals — top half */}
          <div className="po-col po-col--sf">
            <div className="po-round-rule">Semifinal</div>
            <TBDMatch />
          </div>

          {/* Final */}
          <div className="po-col po-col--f">
            <div className="po-round-rule">Final</div>
            <FinalMatch />
          </div>

          {/* Semifinals — bottom half */}
          <div className="po-col po-col--sf po-col--sf-bottom">
            <div className="po-round-rule">Semifinal</div>
            <TBDMatch />
          </div>

          {/* Quarterfinals — bottom half */}
          <div className="po-col po-col--qf po-col--qf-bottom">
            <div className="po-round-rule">Quarterfinals</div>
            {qfPairs.slice(2, 4).map((p, i) => (
              <Match key={`qf-bot-${i}`} a={p[0]} b={p[1]} hostHigh h2hWinners={h2hWinners} />
            ))}
          </div>

          {/* Mobile-only summary in place of the empty SF/F columns */}
          <div className="po-bracket__mobile-tbd" aria-hidden="true">
            <span className="po-bracket__mobile-tbd-label">Semifinals · MegaBrawl IV</span>
            <span className="po-bracket__mobile-tbd-text">Filled in as winners advance</span>
          </div>
        </div>

        {/* Seed list + bubble */}
        <div className="po-grid">
          <section className="po-card">
            <div className="tbl-section-rule">
              <span>The Field · 1 through {PLAYOFF_SPOTS}</span>
              <span>{seeds.length === PLAYOFF_SPOTS ? 'Locked positions' : 'Provisional'}</span>
            </div>
            <SeedTable seeds={seeds} h2hWinners={h2hWinners} />
          </section>

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
  a,
  b,
  hostHigh,
  h2hWinners,
}: {
  a: Seed | undefined;
  b: Seed | undefined;
  hostHigh?: boolean;
  h2hWinners: Map<string, string[]>;
}) {
  if (!a || !b) {
    return <TBDMatch />;
  }
  // Lower seed = higher seed line (gets host designation)
  const host = a.seed < b.seed ? a : b;
  const visitor = a.seed < b.seed ? b : a;
  return (
    <div className="po-match">
      <SeedRow seed={host} highlight={!!hostHigh} h2hWinners={h2hWinners} />
      <div className="po-match__rule">vs</div>
      <SeedRow seed={visitor} h2hWinners={h2hWinners} />
    </div>
  );
}

function SeedRow({
  seed,
  highlight,
  h2hWinners,
}: {
  seed: Seed;
  highlight?: boolean;
  h2hWinners: Map<string, string[]>;
}) {
  const logo = getTeamLogoPathByName(seed.team.team);
  const name = getFullTeamName(seed.team.slug);
  const beaten = h2hWinners.get(seed.team.slug);
  return (
    <Link
      href={`/teams/${seed.team.slug}`}
      className={highlight ? 'po-seed po-seed--high' : 'po-seed'}
    >
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

function FinalMatch() {
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
}: {
  seeds: Seed[];
  bubble?: boolean;
  h2hWinners: Map<string, string[]>;
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
        const isWStreak = (s.team.streak || '').startsWith('W');
        const beaten = h2hWinners.get(s.team.slug);
        return (
          <Link key={s.team.slug} href={`/teams/${s.team.slug}`} className="po-table__row">
            <span className="po-table__seed">{s.seed}</span>
            <span className="po-table__team">
              {logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="" className="po-table__logo" />
              )}
              <span className="po-table__name">
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
            </span>
            <span className="po-table__num">{s.team.record}</span>
            <span
              className="po-table__num"
              style={{ color: s.team.diff >= 0 ? 'var(--tbl-green)' : 'var(--tbl-red)' }}
            >
              {s.team.diff >= 0 ? '+' : ''}
              {s.team.diff.toFixed(1)}
            </span>
            <span
              className="po-table__num"
              style={{ color: isWStreak ? 'var(--tbl-green)' : 'var(--tbl-red)' }}
            >
              {s.team.streak || '—'}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
