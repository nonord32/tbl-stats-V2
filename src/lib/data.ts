// src/lib/data.ts
// All data fetching & parsing — column names matched to actual sheet headers.

import Papa from 'papaparse';
import type {
  FighterStat,
  TeamStanding,
  TeamMatch,
  FightHistory,
  BoxScoreRound,
  MatchResult,
  ParsedSheetData,
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

// Fetch raw CSV rows as string arrays (no automatic header parsing)
// so we can handle sheets with title rows before the real header
async function fetchRawCSV(url: string): Promise<string[][]> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch CSV: ${url}`);
  const text = await res.text();
  const result = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: true,
  });
  return result.data;
}

function safeNum(val: string | undefined, fallback = 0): number {
  if (!val || val.trim() === '') return fallback;
  const cleaned = val.replace(/,/g, '').replace(/%$/, '').trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? fallback : n;
}

function safeInt(val: string | undefined, fallback = 0): number {
  if (!val || val.trim() === '') return fallback;
  const n = parseInt(val.replace(/,/g, '').trim(), 10);
  return isNaN(n) ? fallback : n;
}

// Convert raw rows + a header row index into array of objects
function toObjects(rows: string[][], headerRowIndex: number): Record<string, string>[] {
  if (headerRowIndex >= rows.length) return [];
  const headers = rows[headerRowIndex].map((h) => h.trim());
  return rows.slice(headerRowIndex + 1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = (row[i] || '').trim();
    });
    return obj;
  });
}

// ─── Fighter Stats Parser ──────────────────────────────────────────────────────
// Leaderboard tab layout:
//   Row 1: Title ("Team Boxing League – Fighter Rankings")
//   Row 2: "Last Updated: 4/13/2026"
//   Rows 3-6: Description text
//   Row 7: Headers → Rank | Fighter | Team | Gender | Weight | Fighter WAR | NPPR | Total Net Points | Record | Win % | Rounds | Instagram
//   Row 8+: Data

function cleanInstagramUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  try {
    // Accept bare usernames like "@username" or "username"
    if (!trimmed.startsWith('http')) {
      const username = trimmed.replace(/^@/, '');
      return `https://www.instagram.com/${username}/`;
    }
    const url = new URL(trimmed);
    // Keep only origin + pathname, strip query/hash
    const clean = url.origin + url.pathname.replace(/\/?$/, '/');
    return clean;
  } catch {
    return '';
  }
}
function parseFighters(rows: string[][]): { fighters: FighterStat[]; lastUpdated: string } {
  // Extract Last Updated from row 2 (index 1)
  let lastUpdated = new Date().toISOString();
  try {
    if (rows[1] && rows[1][0]) {
      const dateStr = rows[1][0].replace(/last updated:?/i, '').trim();
      if (dateStr) {
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) lastUpdated = parsed.toISOString();
      }
    }
  } catch {}

  // Find the header row by scanning for a row that contains "Fighter"
  let headerRowIndex = 6; // default guess
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    if (rows[i].some((cell) => cell.trim() === 'Fighter')) {
      headerRowIndex = i;
      break;
    }
  }

  const objects = toObjects(rows, headerRowIndex);

  const fighters: FighterStat[] = objects
    .filter((r) => r['Fighter'] && r['Fighter'].trim() !== '' && r['Fighter'] !== 'Fighter')
    .map((r) => {
      const name = r['Fighter'].trim();
      const recordStr = (r['Record'] || '0-0').trim();
      const parts = recordStr.split('-');
      const wins = safeInt(parts[0]);
      const losses = safeInt(parts[1]);

      // Win % stored as "100%" — convert to 0-1 decimal
      const winPctRaw = safeNum(r['Win %'] || r['Win%'] || '0');
      const winPct = winPctRaw > 1 ? winPctRaw / 100 : winPctRaw;

      const instagramRaw = r['Instagram'] || r['Instagram URL'] || r['IG'] || r['Instagram Handle'] || '';
      const instagram = cleanInstagramUrl(instagramRaw) || undefined;

      return {
        name,
        team: (r['Team'] || '').trim(),
        weightClass: (r['Weight'] || '').trim(),
        gender: (r['Gender'] || '').trim(),
        wins,
        losses,
        record: recordStr,
        war: safeNum(r['Fighter WAR']),
        nppr: safeNum(r['NPPR']),
        netPts: safeNum(r['Total Net Points']),
        winPct,
        rounds: safeInt(r['Rounds Fought'] || r['Rounds'] || r['Round'] || r['Total Rounds'] || r['# Rounds'] || r['Num Rounds']),
        slug: toSlug(name),
        instagram,
      } satisfies FighterStat;
    })
    .filter((f) => f.name !== '');

  return { fighters, lastUpdated };
}

// ─── Team Standings Parser ─────────────────────────────────────────────────────
// Standings tab layout:
//   Row 1: Headers → Team | Record | Points Scored | Points Allowed | Point Differential
//   Row 2+: Data
// Note: column headers may be truncated to ~12 chars in CSV export
function parseTeams(rows: string[][]): TeamStanding[] {
  // Header is row 1 (index 0)
  const objects = toObjects(rows, 0);

  return objects
    .filter((r) => r['Team'] && r['Team'].trim() !== '' && r['Team'] !== 'Team')
    .map((r) => {
      const team = r['Team'].trim();
      const recordStr = (r['Record'] || '0-0').trim();
      const parts = recordStr.split('-');
      const wins = safeInt(parts[0]);
      const losses = safeInt(parts[1]);

      // Try all possible truncated column name variants
      const pfVal = r['Points Scored'] || r['Points Scor'] || r['Points For'] || r['PF'] || '0';
      const paVal = r['Points Allowed'] || r['Points Allow'] || r['Points Against'] || r['PA'] || '0';
      const diffVal = r['Point Differential'] || r['Point Differ'] || r['Point Different'] || r['Diff'] || '0';

      const pf = safeNum(pfVal);
      const pa = safeNum(paVal);
      const diff = safeNum(diffVal) || (pf - pa);

      return {
        team,
        wins,
        losses,
        record: recordStr,
        pf,
        pa,
        diff,
        streak: (r['Streak'] || '').trim(),
        slug: toSlug(team),
      } satisfies TeamStanding;
    })
    .filter((t) => t.team !== '');
}

// ─── Match Data Parser ─────────────────────────────────────────────────────────
// Data tab layout:
//   Row 1: Headers → Fighter Name | Team | Gender | Weight Class | Date of Fight |
//                    Round Num | Match ID | Round ID | Opponent Name | Round Phase | Result | ...
//   Row 2+: Data
//
// Structure: each row = one fighter's perspective for one round.
// Two rows share the same Match ID + Round ID (one per fighter).
function parseMatchData(rows: string[][]): {
  teamMatches: Record<string, TeamMatch[]>;
  fighterHistory: Record<string, FightHistory[]>;
} {
  const objects = toObjects(rows, 0);
  const teamMatches: Record<string, TeamMatch[]> = {};
  const fighterHistory: Record<string, FightHistory[]> = {};

  // Group all rows by Match ID
  const matchGroups: Map<string, Record<string, string>[]> = new Map();
  objects.forEach((row) => {
    const matchId = (row['Match ID'] || '').trim();
    if (!matchId) return;
    if (!matchGroups.has(matchId)) matchGroups.set(matchId, []);
    matchGroups.get(matchId)!.push(row);
  });

  matchGroups.forEach((matchRows, matchId) => {
    if (matchRows.length === 0) return;

    const firstRow = matchRows[0];
    const date = firstRow['Date of Fight'] || '';

    // Get the two teams in this match
    const teamsInMatch = Array.from(new Set(matchRows.map((r) => r['Team']).filter(Boolean)));
    if (teamsInMatch.length < 2) return;
    const team1 = teamsInMatch[0];
    const team2 = teamsInMatch[1];

    // Group rows by Round ID to build box score
    const roundGroups: Map<string, Record<string, string>[]> = new Map();
    matchRows.forEach((row) => {
      // Group by Round ID (unique per bout) but display Round Num
      const roundId = (row['Round ID'] || '').trim();
      if (!roundGroups.has(roundId)) roundGroups.set(roundId, []);
      roundGroups.get(roundId)!.push(row);
    });

    const boxScore: BoxScoreRound[] = [];
    let wins1 = 0;
    let wins2 = 0;

    roundGroups.forEach((roundRows) => {
      // Find the row for each team in this round
      const f1Row = roundRows.find((r) => r['Team'] === team1);
      const f2Row = roundRows.find((r) => r['Team'] === team2);
      if (!f1Row || !f2Row) return;

      const fighter1 = (f1Row['Fighter Name'] || '').trim();
      const fighter2 = (f2Row['Fighter Name'] || '').trim();
      const phase = (f1Row['Round Phase'] || '').trim();
      const roundNum = safeInt(f1Row['Round Num']);
      const weightClass = (f1Row['Weight Class'] || '').trim();
      const gender = (f1Row['Gender'] || '').trim();

      // Result: "W - Decision", "L - Decision", "W - Unanimous", etc.
      const result1Raw = (f1Row['Result'] || '').trim().toUpperCase();
      const isWin1 = result1Raw.startsWith('W');
      const isLoss1 = result1Raw.startsWith('L');

      // Points Earned = actual score, Net Points = pts earned minus pts allowed
      const pts1 = safeNum(f1Row['Points Earned'] || f1Row['Points'] || f1Row['Score'] || f1Row['Pts']);
      const pts2 = safeNum(f2Row['Points Earned'] || f2Row['Points'] || f2Row['Score'] || f2Row['Pts']);
      const netPts1 = safeNum(f1Row['Net Points'] || f1Row['Diff'] || f1Row['Point Diff']);
      const netPts2 = safeNum(f2Row['Net Points'] || f2Row['Diff'] || f2Row['Point Diff']);

      const winner = isWin1 ? fighter1 : isLoss1 ? fighter2 : '';
      if (isWin1) wins1++;
      else if (isLoss1) wins2++;

      boxScore.push({ round: roundNum, phase, fighter1, fighter2, score1: pts1, score2: pts2, winner });

      // Add to fighter history
      const r1: 'W' | 'L' | 'D' = isWin1 ? 'W' : isLoss1 ? 'L' : 'D';
      const r2: 'W' | 'L' | 'D' = isWin1 ? 'L' : isLoss1 ? 'W' : 'D';

      const addHistory = (
        fighter: string,
        opponent: string,
        oppTeam: string,
        result: 'W' | 'L' | 'D',
        netPts: number
      ) => {
        if (!fighter) return;
        const slug = toSlug(fighter);
        if (!fighterHistory[slug]) fighterHistory[slug] = [];
        fighterHistory[slug].push({
          date,
          opponent,
          opponentTeam: oppTeam,
          weightClass,
          gender,
          round: String(roundNum),
          roundPhase: phase,
          result,
          netPts,
          matchIndex: safeInt(matchId),
        });
      };

      addHistory(fighter1, fighter2, team2, r1, netPts1);
      addHistory(fighter2, fighter1, team1, r2, netPts2);
    });

    boxScore.sort((a, b) => a.round - b.round);

    const pf1 = boxScore.reduce((s, r) => s + r.score1, 0);
    const pf2 = boxScore.reduce((s, r) => s + r.score2, 0);
    const result1: 'W' | 'L' | 'D' = wins1 > wins2 ? 'W' : wins1 < wins2 ? 'L' : 'D';
    const result2: 'W' | 'L' | 'D' = wins2 > wins1 ? 'W' : wins2 < wins1 ? 'L' : 'D';

    const addTeamMatch = (team: string, opp: string, result: 'W' | 'L' | 'D', pf: number, pa: number) => {
      if (!teamMatches[team]) teamMatches[team] = [];
      const exists = teamMatches[team].some((m) => m.date === date && m.opponent === opp);
      if (!exists) {
        teamMatches[team].push({ date, opponent: opp, result, pf, pa, boxScore, matchIndex: safeInt(matchId) });
      }
    };

    addTeamMatch(team1, team2, result1, pf1, pf2);
    addTeamMatch(team2, team1, result2, pf2, pf1);
  });

  // Sort by date desc
  Object.keys(fighterHistory).forEach((slug) => {
    fighterHistory[slug].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  });
  Object.keys(teamMatches).forEach((team) => {
    teamMatches[team].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  });

  return { teamMatches, fighterHistory };
}

// ─── Streak Calculators ────────────────────────────────────────────────────────
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

// ─── Results extractor ────────────────────────────────────────────────────────
// Deduplicate teamMatches (each match is stored once per team) into a flat
// list of unique match results, sorted by date descending.
export function extractUniqueMatches(teamMatches: Record<string, TeamMatch[]>): MatchResult[] {
  const seen = new Set<number>();
  const results: MatchResult[] = [];

  Object.entries(teamMatches).forEach(([team, matches]) => {
    matches.forEach((match) => {
      if (seen.has(match.matchIndex)) return;
      seen.add(match.matchIndex);

      const wins1 = match.boxScore.filter((r) => r.winner === r.fighter1).length;
      const wins2 = match.boxScore.filter((r) => r.winner === r.fighter2).length;

      results.push({
        matchIndex: match.matchIndex,
        date: match.date,
        team1: team,
        team2: match.opponent,
        score1: match.pf,
        score2: match.pa,
        wins1,
        wins2,
        result: match.result,
        boxScore: match.boxScore,
      });
    });
  });

  return results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// ─── Main export ───────────────────────────────────────────────────────────────
export async function getAllData(): Promise<ParsedSheetData> {
  const [fighterRawRows, teamRawRows, matchRawRows] = await Promise.all([
    fetchRawCSV(SHEETS.fighters),
    fetchRawCSV(SHEETS.teams),
    fetchRawCSV(SHEETS.matches),
  ]);

  const { fighters, lastUpdated } = parseFighters(fighterRawRows);
  const teams = parseTeams(teamRawRows);
  const { teamMatches, fighterHistory } = parseMatchData(matchRawRows);

  // Enrich teams with streak from match data if not in sheet
  teams.forEach((t) => {
    if (!t.streak) {
      t.streak = calcTeamStreak(teamMatches[t.team] || []);
    }
  });

  return { fighters, teams, teamMatches, fighterHistory, lastUpdated };
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
