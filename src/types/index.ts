// src/types/index.ts

export interface FighterStat {
  name: string;
  team: string;
  weightClass: string;
  gender: string;
  wins: number;
  losses: number;
  record: string;
  war: number;
  nppr: number;
  netPts: number;
  winPct: number;
  rounds: number;
  slug: string;
  instagram?: string;
}

export interface MatchRow {
  date: string;
  team1: string;
  team2: string;
  fighter1: string;
  fighter2: string;
  weightClass: string;
  gender: string;
  rounds: number;
  winner: string;
  // Round-by-round scoring
  [key: string]: string | number;
}

export interface FightHistory {
  date: string;
  opponent: string;
  opponentTeam: string;
  weightClass: string;
  gender: string;
  round: string;
  roundPhase: string;
  result: 'W' | 'L' | 'D';
  netPts: number;
  matchIndex: number;
}

export interface TeamStanding {
  team: string;
  wins: number;
  losses: number;
  record: string;
  pf: number;
  pa: number;
  diff: number;
  streak: string;
  slug: string;
}

export interface BoxScoreRound {
  round: number;
  phase: string;
  fighter1: string;
  fighter2: string;
  score1: number;
  score2: number;
  winner: string;
}

export interface TeamMatch {
  date: string;
  opponent: string;
  result: 'W' | 'L' | 'D';
  pf: number;
  pa: number;
  boxScore: BoxScoreRound[];
  matchIndex: number;
}

export interface MatchResult {
  matchIndex: number;
  date: string;
  team1: string;
  team2: string;
  score1: number;
  score2: number;
  wins1: number;
  wins2: number;
  result: 'W' | 'L' | 'D'; // from team1's perspective
  boxScore: BoxScoreRound[];
}

export interface ScheduleEntry {
  week: number;
  date: string;
  time: string;
  team1: string;
  team2: string;
  venueName: string;
  venueCity: string;
  status: 'Upcoming' | 'Completed' | 'Cancelled' | string;
  matchIndex: number | null; // links to match detail for Completed rows
}

export interface ParsedSheetData {
  fighters: FighterStat[];
  teams: TeamStanding[];
  teamMatches: Record<string, TeamMatch[]>;
  fighterHistory: Record<string, FightHistory[]>;
  schedule: ScheduleEntry[];
  lastUpdated: string;
}
