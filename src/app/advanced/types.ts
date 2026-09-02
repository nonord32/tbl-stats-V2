// src/app/advanced/types.ts
// Shared payload shapes for /advanced. Everything is pre-formatted on the
// server (team city names, logo paths, playoff round labels) so the view
// components stay presentational and the client bundle carries no lookup
// tables.

export type View = 'rounds' | 'fighters' | 'matches';
export type StatSet = 'wpa' | 'leverage' | 'ratings' | 'schedule' | 'war';
export type Phase = 'regular' | 'playoffs' | 'all';

/** One round, for the Rounds feed. Ranked by Leverage Index. */
export interface RoundItem {
  key: string;
  li: number;
  fighter1: string;
  fighter2: string;
  slug1: string;
  slug2: string;
  f1Won: boolean;
  f2Won: boolean;
  team1: string;
  team2: string;
  logo1: string | null;
  logo2: string | null;
  matchIndex: number;
  /** playoff round name, or the date for regular-season matches */
  whenLabel: string;
  round: number;
  diffBefore: number;
  toGo: number;
  score1: number;
  score2: number;
  swing: number;
  isDq: boolean;
}

/** The phase-scoped half of a fighter row: WPA, Leverage and Clutch. */
export interface PhaseStats {
  matches: number;
  rounds: number;
  roundWins: number;
  wpa: number;
  wpaPerRound: number;
  avgLi: number;
  liRounds: number;
  clutch: number;
}

export interface FighterRow {
  slug: string;
  name: string;
  team: string;
  teamCity: string;
  teamLogo: string | null;
  weightClass: string;
  gender: string;
  all: PhaseStats;
  regular: PhaseStats;
  playoffs: PhaseStats;
  // ── Full season only, no phase split ──
  seasonRounds: number;
  nppr: number;
  netPts: number;
  war: number;
  sos: number | null;
  anppr: number;
  delta: number;
  bootSd: number;
  lo: number;
  hi: number;
  uncertain: boolean;
  hasRating: boolean;
}

export interface MatchRow {
  matchIndex: number;
  date: string;
  winnerTeam: string;
  loserTeam: string;
  winnerLogo: string | null;
  comebackLow: number;
  lowRound: number;
  deficitAtLow: number;
  finalMargin: number;
  isComeback: boolean;
  footnote?: string;
}

export interface AdvancedMeta {
  modelVersion: string;
  minRounds: number;
  meaningfulDiff: number;
  flagBootSd: number;
  comebackThreshold: number;
  comebackCount: number;
  decidedMatches: number;
}
