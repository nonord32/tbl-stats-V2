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
  ScheduleEntry,
  HighlightEntry,
  ParsedSheetData,
  MethodSplits,
  PhasePerformance,
  H2HRecord,
} from '@/types';

// ─── Sheet URLs ────────────────────────────────────────────────────────────────
const SHEETS = {
  fighters:
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vTDpxOV--xewT8SdQckLWo70ZEeupxHRcyOYui9nEPQwvbvE2bc5nkOs0JN-XUVpIXwjn3WauVLdeJw/pub?gid=1927967888&single=true&output=csv',
  teams:
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vTDpxOV--xewT8SdQckLWo70ZEeupxHRcyOYui9nEPQwvbvE2bc5nkOs0JN-XUVpIXwjn3WauVLdeJw/pub?gid=1404001793&single=true&output=csv',
  matches:
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vTDpxOV--xewT8SdQckLWo70ZEeupxHRcyOYui9nEPQwvbvE2bc5nkOs0JN-XUVpIXwjn3WauVLdeJw/pub?gid=0&single=true&output=csv',
  schedule:
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vTDpxOV--xewT8SdQckLWo70ZEeupxHRcyOYui9nEPQwvbvE2bc5nkOs0JN-XUVpIXwjn3WauVLdeJw/pub?gid=1716719705&single=true&output=csv',
  highlights:
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vTDpxOV--xewT8SdQckLWo70ZEeupxHRcyOYui9nEPQwvbvE2bc5nkOs0JN-XUVpIXwjn3WauVLdeJw/pub?gid=1508158260&single=true&output=csv',
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
  const res = await fetch(url, { next: { revalidate: 120 } });
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
  // Extract Last Updated from row 2 (index 1).
  // Use timeZone: 'UTC' when formatting to avoid the date shifting back one day
  // when the ISO string is later rendered in a US timezone on the client.
  let lastUpdated = '';
  try {
    if (rows[1] && rows[1][0]) {
      const dateStr = rows[1][0].replace(/last updated:?/i, '').trim();
      if (dateStr) {
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
          lastUpdated = parsed.toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
          });
        }
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
      const roundNum = safeInt(
        f1Row['Round Num'] || f1Row['Round #'] || f1Row['Round Number'] ||
        f1Row['Rnd'] || f1Row['Round'] || f1Row['Bout'] || f1Row['Bout #']
      );
      const weightClass = (f1Row['Weight Class'] || '').trim();
      const gender = (f1Row['Gender'] || '').trim();

      // Result: "W - Decision", "L - Decision", "W - KO", etc.
      const result1Raw = (f1Row['Result'] || '').trim();
      const result2Raw = (f2Row['Result'] || '').trim();
      const isWin1 = result1Raw.toUpperCase().startsWith('W');
      const isLoss1 = result1Raw.toUpperCase().startsWith('L');

      // Extract method (e.g. "Decision", "KO", "TKO") — same for both fighters in the bout
      const CAPS_TERMS = new Set(['KO', 'TKO', 'RSC', 'RTD', 'DQ']);
      const extractMethod = (raw: string): string => {
        const dashIdx = raw.indexOf('-');
        if (dashIdx < 0) return '';
        return raw.slice(dashIdx + 1).trim().split(' ').map((word) => {
          const up = word.toUpperCase();
          return CAPS_TERMS.has(up) ? up : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        }).join(' ');
      };
      const resultMethod = extractMethod(result1Raw) || extractMethod(result2Raw);

      // Points Earned = actual score, Net Points = pts earned minus pts allowed
      const pts1 = safeNum(f1Row['Points Earned'] || f1Row['Points'] || f1Row['Score'] || f1Row['Pts']);
      const pts2 = safeNum(f2Row['Points Earned'] || f2Row['Points'] || f2Row['Score'] || f2Row['Pts']);
      const netPts1 = safeNum(f1Row['Net Points'] || f1Row['Diff'] || f1Row['Point Diff']);
      const netPts2 = safeNum(f2Row['Net Points'] || f2Row['Diff'] || f2Row['Point Diff']);

      const winner = isWin1 ? fighter1 : isLoss1 ? fighter2 : '';
      if (isWin1) wins1++;
      else if (isLoss1) wins2++;

      boxScore.push({ round: roundNum, phase, fighter1, fighter2, score1: pts1, score2: pts2, winner, weightClass });

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
          resultMethod: resultMethod || undefined,
          netPts,
          matchIndex: safeInt(matchId),
        });
      };

      addHistory(fighter1, fighter2, team2, r1, netPts1);
      addHistory(fighter2, fighter1, team1, r2, netPts2);
    });

    boxScore.sort((a, b) => a.round - b.round);

    // Use Match Result column directly — it reflects the actual team-level outcome
    // (TBL decides winners by total points, not bout count, so counting round wins is wrong).
    // Fall back to round-win count only if the column is missing.
    const team1AnyRow = matchRows.find((r) => r['Team'] === team1);
    const team2AnyRow = matchRows.find((r) => r['Team'] === team2);

    const mr1Raw = (team1AnyRow?.['Match Result'] || '').trim().toUpperCase();
    const mr2Raw = (team2AnyRow?.['Match Result'] || '').trim().toUpperCase();

    const result1: 'W' | 'L' | 'D' = mr1Raw === 'W' ? 'W' : mr1Raw === 'L' ? 'L'
      : (wins1 > wins2 ? 'W' : wins1 < wins2 ? 'L' : 'D');
    const result2: 'W' | 'L' | 'D' = mr2Raw === 'W' ? 'W' : mr2Raw === 'L' ? 'L'
      : (wins2 > wins1 ? 'W' : wins2 < wins1 ? 'L' : 'D');

    // Use Match PF/PA for accurate total points (these are pre-aggregated in the sheet)
    const rawPF1 = safeNum(team1AnyRow?.['Match PF'] || '');
    const rawPF2 = safeNum(team2AnyRow?.['Match PF'] || '');
    const pf1 = rawPF1 || boxScore.reduce((s, r) => s + r.score1, 0);
    const pf2 = rawPF2 || boxScore.reduce((s, r) => s + r.score2, 0);

    // Store a version of the boxScore oriented from each team's perspective
    // (score1 always = "our" team, score2 = opponent) so displays are never inverted.
    const flippedBoxScore = boxScore.map((r) => ({
      ...r,
      score1: r.score2,
      score2: r.score1,
      fighter1: r.fighter2,
      fighter2: r.fighter1,
    }));

    const addTeamMatch = (team: string, opp: string, result: 'W' | 'L' | 'D', pf: number, pa: number, bs: BoxScoreRound[]) => {
      if (!teamMatches[team]) teamMatches[team] = [];
      const exists = teamMatches[team].some((m) => m.date === date && m.opponent === opp);
      if (!exists) {
        teamMatches[team].push({ date, opponent: opp, result, pf, pa, boxScore: bs, matchIndex: safeInt(matchId) });
      }
    };

    addTeamMatch(team1, team2, result1, pf1, pf2, boxScore);
    addTeamMatch(team2, team1, result2, pf2, pf1, flippedBoxScore);
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

// ─── Per-fighter aggregations over FightHistory ───────────────────────────────
// Pure functions over a fighter's history. No fetching, no side effects — same
// shape contract as calcFighterStreak.

// The match parser title-cases methods except for a small set of caps terms
// (KO, TKO, RSC, RTD, DQ). So "ko" -> "KO", "decision" -> "Decision",
// "knockdown" -> "Knockdown", "kd" -> "Kd". Classify case-insensitively.
type MethodBucket = 'ko' | 'kd' | 'decision' | 'other';
function classifyMethod(method: string | undefined): MethodBucket {
  const m = (method || '').trim().toUpperCase();
  if (!m) return 'other';
  if (m === 'KO' || m === 'TKO' || m === 'RSC' || m === 'RTD') return 'ko';
  if (m === 'KD' || m === 'KNOCKDOWN') return 'kd';
  if (m === 'DECISION') return 'decision';
  return 'other';
}

export function computeMethodSplits(history: FightHistory[]): MethodSplits {
  const wins = history.filter((h) => h.result === 'W');
  const totalWins = wins.length;
  let koWins = 0;
  let kdWins = 0;
  let decisionWins = 0;
  let otherWins = 0;
  for (const w of wins) {
    switch (classifyMethod(w.resultMethod)) {
      case 'ko': koWins++; break;
      case 'kd': kdWins++; break;
      case 'decision': decisionWins++; break;
      default: otherWins++;
    }
  }
  const pct = (n: number) => (totalWins > 0 ? n / totalWins : 0);
  return {
    totalWins,
    koWins,
    kdWins,
    decisionWins,
    otherWins,
    koPct: pct(koWins),
    kdPct: pct(kdWins),
    decisionPct: pct(decisionWins),
    finishPct: pct(koWins + kdWins),
  };
}

const PHASE_ORDER = ['Qualifying', 'Launch', 'Middle', 'Money', 'Final'];

export function computePhasePerformance(history: FightHistory[]): PhasePerformance[] {
  const map = new Map<string, { bouts: number; wins: number; netPtsSum: number }>();
  for (const h of history) {
    const phase = (h.roundPhase || '').trim();
    if (!phase) continue;
    const e = map.get(phase) ?? { bouts: 0, wins: 0, netPtsSum: 0 };
    e.bouts++;
    if (h.result === 'W') e.wins++;
    e.netPtsSum += h.netPts;
    map.set(phase, e);
  }
  const toRow = (phase: string, e: { bouts: number; wins: number; netPtsSum: number }): PhasePerformance => ({
    phase,
    bouts: e.bouts,
    wins: e.wins,
    winPct: e.bouts ? e.wins / e.bouts : 0,
    avgNetPts: e.bouts ? e.netPtsSum / e.bouts : 0,
  });
  const known = PHASE_ORDER.filter((p) => map.has(p)).map((p) => toRow(p, map.get(p)!));
  // Preserve any out-of-canon phases (sheet typos / new phases) at the end.
  const extras: PhasePerformance[] = [];
  map.forEach((e, p) => { if (!PHASE_ORDER.includes(p)) extras.push(toRow(p, e)); });
  return [...known, ...extras];
}

export function computeRepeatOpponents(history: FightHistory[]): H2HRecord[] {
  const groups = new Map<string, FightHistory[]>();
  for (const h of history) {
    const opp = (h.opponent || '').trim();
    if (!opp) continue;
    const list = groups.get(opp) ?? [];
    list.push(h);
    groups.set(opp, list);
  }
  const records: H2HRecord[] = [];
  groups.forEach((list, opp) => {
    if (list.length < 2) return;
    let wins = 0;
    let losses = 0;
    let draws = 0;
    for (const h of list) {
      if (h.result === 'W') wins++;
      else if (h.result === 'L') losses++;
      else draws++;
    }
    // Most recent first by date so [0] is the latest meeting.
    const sorted = [...list].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    records.push({ opponent: opp, wins, losses, draws, total: list.length, lastResult: sorted[0].result });
  });
  records.sort((a, b) => b.total - a.total || a.opponent.localeCompare(b.opponent));
  return records;
}

export function computeSOS(history: FightHistory[], allFighters: FighterStat[]): number | null {
  const byName = new Map(allFighters.map((f) => [f.name.trim().toLowerCase(), f]));
  let sum = 0;
  let count = 0;
  for (const h of history) {
    const opp = byName.get((h.opponent || '').trim().toLowerCase());
    if (!opp) continue;
    sum += opp.war;
    count++;
  }
  return count > 0 ? sum / count : null;
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

// ─── Schedule Parser ──────────────────────────────────────────────────────────
// Expected columns: Week | Date | Time | Team 1 | Team 2 | Venue Name | Venue City | Status | Match ID
function parseSchedule(rows: string[][]): ScheduleEntry[] {
  if (rows.length === 0) return [];

  // Find header row (contains "Date" or "Team 1")
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    if (rows[i].some((c) => /date/i.test(c) || /team/i.test(c))) {
      headerRowIndex = i;
      break;
    }
  }

  const objects = toObjects(rows, headerRowIndex);

  return objects
    .filter((r) => {
      // Skip completely empty rows
      const vals = Object.values(r).map((v) => v.trim()).filter(Boolean);
      return vals.length > 0;
    })
    .map((r) => {
      const team1Raw = (r['Team 1'] || r['Team1'] || '').trim();
      const team2Raw = (r['Team 2'] || r['Team2'] || '').trim();
      const matchIdRaw = (r['Match ID'] || r['MatchID'] || r['Match Id'] || '').trim();
      return {
        week: safeInt(r['Week'] || r['Wk'] || '0'),
        date: (r['Date'] || '').trim(),
        time: (r['Time'] || '').trim(),
        team1: team1Raw,
        team2: team2Raw,
        venueName: (r['Venue Name'] || r['Venue'] || '').trim(),
        venueCity: (r['Venue City'] || r['City'] || '').trim(),
        status: (r['Status'] || 'Upcoming').trim(),
        matchIndex: matchIdRaw ? safeInt(matchIdRaw) || null : null,
      } satisfies ScheduleEntry;
    })
    .filter((e) => e.team1 || e.team2); // must have at least one team
}

// ─── Highlights Parser ────────────────────────────────────────────────────────
// Expected columns: Page | Label | URL | Type
// Page: team slug (e.g. "dallas"), matchIndex as string (e.g. "7"), or "home"
function parseHighlights(rows: string[][]): HighlightEntry[] {
  if (rows.length === 0) return [];
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    if (rows[i].some((c) => /page|label|url|type/i.test(c))) {
      headerRowIndex = i;
      break;
    }
  }
  const objects = toObjects(rows, headerRowIndex);
  return objects
    .filter((r) => r['URL'] && r['URL'].trim())
    .map((r) => ({
      page:  (r['Page']  || '').trim().toLowerCase(),
      label: (r['Label'] || '').trim(),
      url:   (r['URL']   || '').trim(),
      type:  (r['Type']  || '').trim().toLowerCase(),
    } satisfies HighlightEntry));
}

// ─── Main export ───────────────────────────────────────────────────────────────
export async function getAllData(): Promise<ParsedSheetData> {
  const [fighterRawRows, teamRawRows, matchRawRows, scheduleRawRows, highlightsRawRows] = await Promise.all([
    fetchRawCSV(SHEETS.fighters),
    fetchRawCSV(SHEETS.teams),
    fetchRawCSV(SHEETS.matches),
    fetchRawCSV(SHEETS.schedule).catch(() => [] as string[][]),
    fetchRawCSV(SHEETS.highlights).catch(() => [] as string[][]),
  ]);

  const { fighters, lastUpdated } = parseFighters(fighterRawRows);
  const teams = parseTeams(teamRawRows);
  const { teamMatches, fighterHistory } = parseMatchData(matchRawRows);
  let schedule: ReturnType<typeof parseSchedule> = [];
  try { schedule = parseSchedule(scheduleRawRows); } catch { schedule = []; }
  let highlights: HighlightEntry[] = [];
  try { highlights = parseHighlights(highlightsRawRows); } catch { highlights = []; }

  // Always recompute streak from match data — never trust the sheet's Streak column
  // since it can be stale or manually entered incorrectly.
  // Use fuzzy name matching in case the match data uses abbreviated team names
  // (e.g. "NYC" vs "NYC Attitude").
  teams.forEach((t) => {
    let matches = teamMatches[t.team];
    if (!matches || matches.length === 0) {
      const key = Object.keys(teamMatches).find(
        (k) => k === t.team || t.team.startsWith(k) || k.startsWith(t.team)
      );
      matches = key ? teamMatches[key] : [];
    }
    const computed = calcTeamStreak(matches);
    t.streak = computed; // override sheet value entirely
  });

  return { fighters, teams, teamMatches, fighterHistory, schedule, highlights, lastUpdated };
}

export async function getFighterBySlug(slug: string) {
  const data = await getAllData();
  const fighter = data.fighters.find((f) => f.slug === slug);
  if (!fighter) return null;
  const history = data.fighterHistory[slug] || [];
  const streak = calcFighterStreak(history);

  // Resolve full team name: the Leaderboard tab may store abbreviated names
  // (e.g. "Las Vegas") while the Standings tab has the full name ("Las Vegas Hustle").
  const fullTeamName =
    data.teams.find(
      (t) =>
        t.team === fighter.team ||
        t.team.startsWith(fighter.team) ||
        fighter.team.startsWith(t.team)
    )?.team ?? fighter.team;

  return { fighter, history, streak, fullTeamName };
}

export async function getTeamBySlug(slug: string) {
  const data = await getAllData();
  const team = data.teams.find((t) => t.slug === slug);
  if (!team) return null;
  const matches = data.teamMatches[team.team] || [];
  const streak = team.streak || calcTeamStreak(matches);

  // Roster: fighters whose team matches (handles abbreviated names like "Las Vegas" vs "Las Vegas Hustle")
  const roster = data.fighters.filter(
    (f) =>
      f.team === team.team ||
      team.team.startsWith(f.team) ||
      f.team.startsWith(team.team)
  );

  // Next upcoming match from schedule
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const teamNameLower = team.team.toLowerCase();
  const nextMatch = data.schedule
    .filter((s) => {
      if (s.status.toLowerCase() !== 'upcoming') return false;
      const t1 = s.team1.toLowerCase();
      const t2 = s.team2.toLowerCase();
      return (
        teamNameLower.startsWith(t1) || t1.startsWith(teamNameLower.split(' ')[0]) ||
        teamNameLower.startsWith(t2) || t2.startsWith(teamNameLower.split(' ')[0])
      );
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0] ?? null;

  const teamHighlights = data.highlights.filter((h) => h.page === slug || h.page === team.slug);

  return { team: { ...team, streak }, matches, roster, nextMatch, highlights: teamHighlights };
}

export async function getMatchByIndex(matchIndex: number) {
  const data = await getAllData();
  const allMatches = extractUniqueMatches(data.teamMatches);
  const match = allMatches.find((m) => m.matchIndex === matchIndex) ?? null;
  if (!match) return null;
  const scheduleEntry = data.schedule.find((s) => s.matchIndex === matchIndex) ?? null;
  const highlights = data.highlights.filter((h) => h.page === String(matchIndex));
  return { match, scheduleEntry, highlights };
}
