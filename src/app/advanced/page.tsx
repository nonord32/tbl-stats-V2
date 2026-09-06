// src/app/advanced/page.tsx
//
// One page for every advanced stat, replacing what used to be four separate
// leaderboards (/wpa, /ratings, /comebacks, /moments). The content genuinely
// comes in three shapes, so the page has three views rather than one table:
//
//   Rounds   — the biggest single rounds of the season, as cards. THE DEFAULT,
//              because it is the only view that teaches a first-time visitor
//              what these numbers mean without an explainer.
//   Fighters — the sortable leaderboard, with a picker for which stat set to
//              rank by.
//   Matches  — the comebacks feed: featured cards plus every decided match.
//
// Everything is computed here and handed down, so switching views is instant
// and needs no round trip. The ?view= and ?stat= params are read in the client
// rather than here on purpose: reading searchParams on the server would opt the
// whole page out of static generation, so every visitor would pay for the ridge
// solve (~90ms, see src/lib/ratings) instead of one render per revalidation.
import type { Metadata } from 'next';
import { getAllData, toSlug } from '@/lib/data';
import { getBracketContext } from '@/lib/bracketData';
import { playoffRoundLabelsByMatch } from '@/lib/playoffs';
import { getWpaData, getComebackData, WPA_MODEL_VERSION, COMEBACK_THRESHOLD } from '@/lib/wpa';
import { getRatingsData, RATINGS_MODEL } from '@/lib/ratings';
import { getTeamLogoPathByName, getCityName } from '@/lib/teams';
import { AdvancedClient } from './AdvancedClient';
import type { RoundItem, FighterRow, MatchRow } from './types';

export const revalidate = 300;

const TOP_ROUNDS = 50;
const FEATURED_MATCHES = 5;

export const metadata: Metadata = {
  title: 'Advanced Stats — Biggest Rounds, Fighter Ratings & Comebacks',
  description:
    'The biggest rounds of the TBL season by what was at stake, a sortable fighter leaderboard across every advanced stat, and every comeback win ranked by how close the winner came to losing.',
  openGraph: {
    url: 'https://tblstats.com/advanced',
    title: 'Advanced Stats | TBL Stats',
    description:
      'The rounds where the most was on the line, the fighters who swung the season, and the biggest comebacks.',
  },
};

export default async function AdvancedPage() {
  const [data, season, ratings, comebacks] = await Promise.all([
    getAllData(),
    getWpaData(),
    getRatingsData(),
    getComebackData(),
  ]);

  // ── Rounds: every round leaguewide, ranked by what was at stake ──
  const roundLabels = playoffRoundLabelsByMatch(getBracketContext(data).bracket);
  const everyRound = [...season.byMatch.values()].flatMap((m) => m.rounds.map((r) => ({ m, r })));
  everyRound.sort((a, b) => b.r.li - a.r.li);

  const rounds: RoundItem[] = everyRound.slice(0, TOP_ROUNDS).map(({ m, r }) => ({
    key: `${m.matchIndex}-${r.round}`,
    li: r.li,
    fighter1: r.fighter1,
    fighter2: r.fighter2,
    slug1: toSlug(r.fighter1),
    slug2: toSlug(r.fighter2),
    f1Won: r.score1 > r.score2,
    f2Won: r.score2 > r.score1,
    team1: getCityName(m.team1),
    team2: getCityName(m.team2),
    logo1: getTeamLogoPathByName(m.team1) ?? null,
    logo2: getTeamLogoPathByName(m.team2) ?? null,
    matchIndex: m.matchIndex,
    whenLabel: (m.phase === 'playoffs' ? roundLabels.get(m.matchIndex) ?? 'Playoffs' : m.date) || m.date,
    round: r.round,
    diffBefore: r.diffBefore,
    toGo: m.scheduledRounds - r.round + 1,
    score1: r.score1,
    score2: r.score2,
    swing: Math.abs(r.teamWpa),
    isDq: r.isDq,
  }));

  // ── Fighters: WPA/Leverage (phase-aware) joined to the full-season ratings ──
  const teamBySlug = new Map(data.fighters.map((f) => [f.slug, f.team]));
  const statBySlug = new Map(data.fighters.map((f) => [f.slug, f]));
  const rate = (total: number, n: number) => (n > 0 ? total / n : 0);

  const fighters: FighterRow[] = [...season.byFighter.values()].map((f) => {
    const rating = ratings.byFighter.get(f.slug);
    const base = statBySlug.get(f.slug);
    return {
      slug: f.slug,
      name: f.name,
      team: teamBySlug.get(f.slug) ?? '',
      teamCity: getCityName(teamBySlug.get(f.slug) ?? '') || '',
      teamLogo: getTeamLogoPathByName(teamBySlug.get(f.slug) ?? '') ?? null,
      weightClass: rating?.weightClass ?? base?.weightClass ?? '',
      gender: rating?.gender ?? base?.gender ?? '',
      // Phase-scoped — WPA, Stakes and Timing all split by phase.
      all: {
        matches: f.matches,
        rounds: f.rounds,
        roundWins: f.roundWins,
        wpa: f.wpa,
        wpaPerRound: rate(f.wpa, f.rounds),
        avgLi: f.avgLi,
        liRounds: f.liRounds,
        clutch: f.clutch,
      },
      regular: {
        matches: f.matchesRegular,
        rounds: f.roundsRegular,
        roundWins: f.roundWinsRegular,
        wpa: f.wpaRegular,
        wpaPerRound: rate(f.wpaRegular, f.roundsRegular),
        avgLi: rate(f.liSumRegular, f.liRoundsRegular),
        liRounds: f.liRoundsRegular,
        clutch: f.clutchRegular,
      },
      playoffs: {
        matches: f.matchesPlayoffs,
        rounds: f.roundsPlayoffs,
        roundWins: f.roundWinsPlayoffs,
        wpa: f.wpaPlayoffs,
        wpaPerRound: rate(f.wpaPlayoffs, f.roundsPlayoffs),
        avgLi: rate(f.liSumPlayoffs, f.liRoundsPlayoffs),
        liRounds: f.liRoundsPlayoffs,
        clutch: f.clutchPlayoffs,
      },
      // Full season only — the ridge fit has no phase split, and WAR is a
      // season-level figure. The Fighters view hides the phase control when
      // one of these stat sets is showing.
      seasonRounds: rating?.rounds ?? base?.rounds ?? 0,
      nppr: rating?.nppr ?? base?.nppr ?? 0,
      netPts: base?.netPts ?? 0,
      war: base?.war ?? 0,
      sos: rating?.sos ?? null,
      anppr: rating?.anppr ?? 0,
      delta: rating?.delta ?? 0,
      bootSd: rating?.bootSd ?? 0,
      lo: rating?.lo ?? 0,
      hi: rating?.hi ?? 0,
      uncertain: rating?.uncertain ?? false,
      hasRating: !!rating,
    };
  });

  // ── Matches: every decided match by how close the winner came to losing ──
  const matches: MatchRow[] = comebacks.matches.map((m) => ({
    matchIndex: m.matchIndex,
    date: m.date,
    winnerTeam: getCityName(m.winnerTeam) || m.winnerTeam,
    loserTeam: getCityName(m.loserTeam) || m.loserTeam,
    winnerLogo: getTeamLogoPathByName(m.winnerTeam) ?? null,
    comebackLow: m.comebackLow,
    lowRound: m.lowRound,
    deficitAtLow: m.deficitAtLow,
    finalMargin: m.finalMargin,
    isComeback: m.isComeback,
    footnote: m.footnote,
  }));

  return (
    <AdvancedClient
      rounds={rounds}
      fighters={fighters}
      matches={matches}
      featured={matches.slice(0, FEATURED_MATCHES)}
      lastUpdated={data.lastUpdated}
      meta={{
        modelVersion: WPA_MODEL_VERSION,
        minRounds: RATINGS_MODEL.minRounds,
        meaningfulDiff: RATINGS_MODEL.meaningfulDiff,
        flagBootSd: RATINGS_MODEL.flagBootSd,
        comebackThreshold: COMEBACK_THRESHOLD,
        comebackCount: comebacks.totals.comebacks,
        decidedMatches: comebacks.totals.decidedMatches,
      }}
    />
  );
}
