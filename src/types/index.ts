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
  resultMethod?: string;  // e.g. "Decision", "KO", "Knockdown"
  netPts: number;
  matchIndex: number;
  roundId: number;  // unique, monotonic across the season; used for stable sort
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
  weightClass?: string;
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

export interface HighlightEntry {
  page: string;      // team slug, matchIndex as string, or 'home'
  label: string;
  url: string;
  type: 'instagram' | 'youtube' | string;
}

export interface AwardEntry {
  season: number;
  award: string;   // e.g. "MVP"
  winner: string;
  team: string;
  notes: string;
}

export interface ParsedSheetData {
  fighters: FighterStat[];
  teams: TeamStanding[];
  teamMatches: Record<string, TeamMatch[]>;
  fighterHistory: Record<string, FightHistory[]>;
  schedule: ScheduleEntry[];
  highlights: HighlightEntry[];
  awards: AwardEntry[];
  lastUpdated: string;
}

// ─── Pick'em types ────────────────────────────────────────────────────────────
export type DiffBand = 'close' | 'medium' | 'comfortable' | 'dominant';

export interface UserPick {
  id: string;
  user_id: string;
  match_index: number;
  picked_team: string;
  diff_band: DiffBand;
  is_correct_winner: boolean | null;
  is_correct_band: boolean | null;
  points_earned: number;
  resolved_at: string | null;
  created_at: string;
}

export interface LeaderboardEntry {
  user_id: string;
  username: string;
  display_name: string | null;
  total_picks: number;
  total_points: number;
  correct_winners: number;
  exact_picks: number;
  win_pct: number | null;
}
