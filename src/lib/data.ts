// src/lib/data.ts
// All data fetching & parsing. Called server-side (Next.js RSC / getStaticProps pattern).

import Papa from 'papaparse';
import type {
  FighterStat,
  TeamStanding,
  TeamMatch,
  FightHistory,
  BoxScoreRound,
  ParsedSheetData,
  MatchRow,
} from '@/types';

// ─── Sheet URLs ────────────────────────────────────────────────────────────────
const SHEETS = {
  fighters:
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vTDpxOV--xewT8SdQckLWo70ZEeupxHRcyOYui9nEPQwvbvE2bc5nkOs0JN-XUVpIXwjn3WauVLdeJw/pub?gid=1927967888&single=true&output=csv',
  teams:
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vTDpxOV--xewT8SdQckLWo70ZEeupxHRcyOYui9nEPQwvbvE2bc5nkOs0JN-XUVpIXwjn3WauVLdeJw/pub?gid=1404001793&single=true&output=csv',
  matches:
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vTDpxOV--xewT8SdQckLWo70ZEeupxHRcyOYui9nEPQwvbvE2bc5nkOs0JN-XUVpIXwjn3WauVLdeJw/pub?gid=0&single=true&output=csv',
};

// ─── Utility ───────────────────────────────────────────────────────────────────
export function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

async function fetchCSV(url: string): Promise<Record<string, string>[]> {
  const res = await fetch(url, { next: { revalidate: 300 } }); // 5-min cache
  if (!res.ok) throw new Error(`Failed to fetch CSV: ${url}`);
  const text = await res.text();
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });
  return result.data;
}

function safeNum(val: string | undefined, fallback = 0): number {
  if (!val) return fallback;
  const n = parseFloat(val.replace(/,/g, ''));
  return isNaN(n) ? fallback : n;
}

function safeInt(val: string | undefined, fallback = 0): number {
  if (!val) return fallback;
  const n = parseInt(val.replace(/,/g, ''), 10);
  return isNaN(n) ? fallback : n;
}

// ─── Fighter Stats Parser ──────────────────────────────────────────────────────
// Expected columns (case-insensitive): Name, Team, Weight Class, Gender,
// W, L, WAR, NPPR, Net Pts, Win%, Rounds
function parseFighters(rows: Record<string, string>[]): FighterStat[] {
  return rows
    .filter((r) => r['Name'] || r['name'])
    .map((r) => {
      const name = (r['Name'] || r['name'] || '').trim();
      const wins = safeInt(r['W'] || r['Wins'] || r['wins']);
      const losses = safeInt(r['L'] || r['Losses'] || r['losses']);
      const winPct = safeNum(r['Win%'] || r['WinPct'] || r['Win Pct']);
      return {
        name,
        team: (r['Team'] || r['team'] || '').trim(),
        weightClass: (r['Weight Class'] || r['WeightClass'] || r['weight_class'] || '').trim(),
        gender: (r['Gender'] || r['gender'] || '').trim(),
        wins,
        losses,
        record: `${wins}-${losses}`,
        war: safeNum(r['WAR'] || r['war']),
        nppr: safeNum(r['NPPR'] || r['nppr']),
        netPts: safeNum(r['Net Pts'] || r['NetPts'] || r['net_pts']),
        winPct,
        rounds: safeInt(r['Rounds'] || r['rounds']),
        slug: toSlug(name),
      } satisfies FighterStat;
    })
    .filter((f) => f.name !== '');
}

// ─── Team Standings Parser ─────────────────────────────────────────────────────
// Expected columns: Team, W, L, PF, PA, Diff
function parseTeams(rows: Record<string, string>[]): TeamStanding[] {
  return rows
    .filter((r) => r['Team'] || r['team'])
    .map((r) => {
      const team = (r['Team'] || r['team'] || '').trim();
      const wins = safeInt(r['W'] || r['Wins']);
      const losses = safeInt(r['L'] || r['Losses']);
      const pf = safeNum(r['PF'] || r['Points For']);
      const pa = safeNum(r['PA'] || r['Points Against']);
      return {
        team,
        wins,
        losses,
        record: `${wins}-${losses}`,
        pf,
        pa,
        diff: safeNum(r['Diff'] || r['Differential']) || pf - pa,
        streak: r['Streak'] || r['streak'] || '',
        slug: toSlug(team),
      } satisfies TeamStanding;
    })
    .filter((t) => t.team !== '');
}

// ─── Match Data Parser ─────────────────────────────────────────────────────────
// Expected columns: Date, Team 1, Team 2, Fighter 1, Fighter 2,
// Weight Class, Gender, Round, Phase, Winner, Net Pts
// May also have per-round score cols

function parseMatchData(rows: Record<string, string>[]): {
  teamMatches: Record<string, TeamMatch[]>;
  fighterHistory: Record<string, FightHistory[]>;
  lastUpdated: string;
} {
  const teamMatches: Record<string, TeamMatch[]> = {};
  const fighterHistory: Record<string, FightHistory[]> = {};

  // Group rows by match index (same date + team1 + team2 = same match)
  // We track per-match accumulation for team box scores
  const matchGroups: Map<string, { rows: Record<string, string>[]; idx: number }> = new Map();
  let matchCounter = 0;

  rows.forEach((row) => {
    const date = (row['Date'] || row['date'] || '').trim();
    const team1 = (row['Team 1'] || row['Team1'] || row['team1'] || '').trim();
    const team2 = (row['Team 2'] || row['Team2'] || row['team2'] || '').trim();
    if (!date || !team1 || !team2) return;

    const key = `${date}|${team1}|${team2}`;
    if (!matchGroups.has(key)) {
      matchGroups.set(key, { rows: [], idx: matchCounter++ });
    }
    matchGroups.get(key)!.rows.push(row);
  });

  // Process each match group
  matchGroups.forEach(({ rows: matchRows, idx }, key) => {
    const [date, team1, team2] = key.split('|');

    // Build box score from individual bout rows
    const boxScore: BoxScoreRound[] = matchRows.map((r, i) => {
      const fighter1 = (r['Fighter 1'] || r['Fighter1'] || '').trim();
      const fighter2 = (r['Fighter 2'] || r['Fighter2'] || '').trim();
      // Score columns: try "Score 1"/"Score 2", "Pts 1"/"Pts 2", or "Net Pts" from each fighter's perspective
      const score1 = safeNum(r['Score 1'] || r['Score1'] || r['Pts 1'] || r['Pts1']);
      const score2 = safeNum(r['Score 2'] || r['Score2'] || r['Pts 2'] || r['Pts2']);
      const winner = (r['Winner'] || r['winner'] || '').trim();
      const phase = (r['Phase'] || r['Round Phase'] || r['phase'] || '').trim();
      const roundNum = safeInt(r['Round'] || r['round']) || i + 1;
      return { round: roundNum, phase, fighter1, fighter2, score1, score2, winner };
    });

    // Calculate team totals for this match
    let pf1 = 0, pf2 = 0, wins1 = 0, wins2 = 0;
    boxScore.forEach((b) => {
      pf1 += b.score1;
      pf2 += b.score2;
      if (b.winner === team1 || b.winner === b.fighter1) wins1++;
      else if (b.winner === team2 || b.winner === b.fighter2) wins2++;
    });

    const result1: 'W' | 'L' | 'D' = wins1 > wins2 ? 'W' : wins1 < wins2 ? 'L' : 'D';
    const result2: 'W' | 'L' | 'D' = wins2 > wins1 ? 'W' : wins2 < wins1 ? 'L' : 'D';

    // Add to team match history
    const addTeamMatch = (team: string, opponent: string, result: 'W' | 'L' | 'D', pf: number, pa: number) => {
      if (!teamMatches[team]) teamMatches[team] = [];
      teamMatches[team].push({ date, opponent, result, pf, pa, boxScore, matchIndex: idx });
    };
    if (team1) addTeamMatch(team1, team2, result1, pf1, pf2);
    if (team2) addTeamMatch(team2, team1, result2, pf2, pf1);

    // Build fighter histories from this match
    matchRows.forEach((r) => {
      const fighter1 = (r['Fighter 1'] || r['Fighter1'] || '').trim();
      const fighter2 = (r['Fighter 2'] || r['Fighter2'] || '').trim();
      const winner = (r['Winner'] || r['winner'] || '').trim();
      const round = (r['Round'] || r['round'] || '').toString().trim();
      const phase = (r['Phase'] || r['Round Phase'] || r['phase'] || '').trim();
      const netPts = safeNum(r['Net Pts'] || r['NetPts'] || r['net_pts']);
      const weightClass = (r['Weight Class'] || r['WeightClass'] || '').trim();
      const gender = (r['Gender'] || r['gender'] || '').trim();

      const addFighterHistory = (
        fighter: string,
        opponent: string,
        opponentTeam: string,
        result: 'W' | 'L' | 'D',
        pts: number
      ) => {
        if (!fighter) return;
        const slug = toSlug(fighter);
        if (!fighterHistory[slug]) fighterHistory[slug] = [];
        fighterHistory[slug].push({
          date,
          opponent,
          opponentTeam,
          weightClass,
          gender,
          round,
          roundPhase: phase,
          result,
          netPts: pts,
          matchIndex: idx,
        });
      };

      // Determine individual bout result
      let r1: 'W' | 'L' | 'D' = 'D';
      let r2: 'W' | 'L' | 'D' = 'D';
      if (winner === fighter1 || winner === team1) { r1 = 'W'; r2 = 'L'; }
      else if (winner === fighter2 || winner === team2) { r1 = 'L'; r2 = 'W'; }

      if (fighter1) addFighterHistory(fighter1, fighter2, team2, r1, netPts);
      if (fighter2) addFighterHistory(fighter2, fighter1, team1, r2, -netPts);
    });
  });

  // Sort all histories by date desc
  Object.keys(fighterHistory).forEach((slug) => {
    fighterHistory[slug].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  });
  Object.keys(teamMatches).forEach((team) => {
    teamMatches[team].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  });

  const lastUpdated = new Date().toISOString();
  return { teamMatches, fighterHistory, lastUpdated };
}

// ─── Streak Calculators ────────────────────────────────────────────────────────
// Fighter streak: round-based (each bout row = 1 round)
export function calcFighterStreak(history: FightHistory[]): string {
  if (!history.length) return '';
  const sorted = [...history].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const first = sorted[0].result;
  let count = 0;
  for (const h of sorted) {
    if (h.result === first) count++;
    else break;
  }
  return `${first}${count}`;
}

// Team streak: match-based
export function calcTeamStreak(matches: TeamMatch[]): string {
  if (!matches.length) return '';
  const sorted = [...matches].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const first = sorted[0].result;
  let count = 0;
  for (const m of sorted) {
    if (m.result === first) count++;
    else break;
  }
  return `${first}${count}`;
}

// ─── Main export ───────────────────────────────────────────────────────────────
let cache: ParsedSheetData | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getAllData(): Promise<ParsedSheetData> {
  const now = Date.now();
  if (cache && now - cacheTime < CACHE_TTL) return cache;

  const [fighterRows, teamRows, matchRows] = await Promise.all([
    fetchCSV(SHEETS.fighters),
    fetchCSV(SHEETS.teams),
    fetchCSV(SHEETS.matches),
  ]);

  const fighters = parseFighters(fighterRows);
  const teams = parseTeams(teamRows);
  const { teamMatches, fighterHistory, lastUpdated } = parseMatchData(matchRows);

  // Enrich teams with match-based streak (from Data tab)
  teams.forEach((t) => {
    const matches = teamMatches[t.team] || [];
    if (!t.streak) t.streak = calcTeamStreak(matches);
  });

  cache = { fighters, teams, teamMatches, fighterHistory, lastUpdated };
  cacheTime = now;
  return cache;
}

export async function getFighterBySlug(slug: string) {
  const data = await getAllData();
  const fighter = data.fighters.find((f) => f.slug === slug);
  if (!fighter) return null;
  const history = data.fighterHistory[slug] || [];
  const streak = calcFighterStreak(history);
  return { fighter, history, streak };
}

export async function getTeamBySlug(slug: string) {
  const data = await getAllData();
  const team = data.teams.find((t) => t.slug === slug);
  if (!team) return null;
  const matches = data.teamMatches[team.team] || [];
  const streak = team.streak || calcTeamStreak(matches);
  return { team: { ...team, streak }, matches };
}
