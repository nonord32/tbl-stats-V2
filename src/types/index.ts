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

export interface ParsedSheetData {
  fighters: FighterStat[];
  teams: TeamStanding[];
  teamMatches: Record<string, TeamMatch[]>;
  fighterHistory: Record<string, FightHistory[]>;
  lastUpdated: string;
}
