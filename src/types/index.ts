// src/types/index.ts

// Season phase a game belongs to. Blank/unknown in the source sheet is
// treated as 'regular' so nothing changes until playoff games are tagged.
export type GamePhase = 'regular' | 'playoffs';

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

// Fighter identity (name/team/gender) derived from the Data tab, used to
// rebuild the fighter roster without the Fighter Stats tabs.
export interface FighterIdentity {
  name: string;
  team: string;          // most-frequent team overall (used for the season view)
  gender: string;
  regularTeam?: string;  // most-frequent team among regular-season bouts
  playoffTeam?: string;  // most-frequent team among playoff bouts
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
  phase: GamePhase;
  week?: number;    // schedule week the bout took place in; joined from the Schedule tab by Match ID
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
  method?: string;
}

export interface TeamMatch {
  date: string;
  opponent: string;
  result: 'W' | 'L' | 'D';
  pf: number;
  pa: number;
  boxScore: BoxScoreRound[];
  matchIndex: number;
  phase: GamePhase;
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
  phase: GamePhase;
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

// Pre-aggregated, phase-scoped fighter stats. Each array is parsed from its
// own dedicated sheet tab ("Fighter Stats - Regular" / "Fighter Stats -
// Playoffs"). WAR is carried over from the joint tab (see getAllData).
export type FightersByPhase = Record<'regular' | 'playoffs', FighterStat[]>;

export interface ParsedSheetData {
  fighters: FighterStat[];
  // Phase-scoped fighter stats pulled from the dedicated per-phase tabs.
  // Empty arrays when those tabs are unpublished/missing — callers fall back
  // to recomputing from fighterHistory in that case.
  fightersByPhase: FightersByPhase;
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

// ─── Bracket Challenge types ──────────────────────────────────────────────────
// One predicted playoff bracket per user. Winners are team slugs aligned to the
// fixed bracket slots (see supabase/schema.sql for slot ordering).
export interface BracketEntry {
  user_id: string;
  qf_winners: string[];       // length 4, aligned to QF slots [1v8, 4v5, 3v6, 2v7]
  sf_winners: string[];       // length 2, aligned to SF slots [top, bottom]
  champion: string | null;    // predicted Final winner (team slug)
  final_total: number | null; // tiebreaker: predicted combined score of the Final
  created_at: string;
  updated_at: string;
}

export interface BracketLeaderRow {
  user_id: string;
  username: string;
  display_name: string | null;
  points: number;
  qf_correct: number;
  sf_correct: number;
  champ_correct: boolean;
  final_total: number | null;   // this entrant's tiebreaker guess
  tiebreak_diff: number | null; // |guess − actual| once the Final is played
  rank: number;
}
