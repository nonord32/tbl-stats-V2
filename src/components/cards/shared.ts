// src/components/cards/shared.ts
// Shared types for the weekly IG card components. Both Gazette and Neon
// style sets accept the same props so the admin can swap them with a single
// `style` switch.

export type FinishMethod = 'KO' | 'TKO' | 'DEC';

export interface Card1Fighter {
  name: string;
  team: string;
  pts: string; // pre-formatted, e.g. "+24"
  method: string; // one or more methods joined with "/" — e.g. "KO" or "KO/DEC"
}
export interface Card1Data {
  week: number;
  fighters: Card1Fighter[];
}

export interface Card2Fighter {
  name: string;
  team: string;
  pts: number[]; // length 5, most-recent-last
}
export interface Card2Data {
  fighters: Card2Fighter[]; // expected length 6
}

export interface Card3Fighter {
  name: string;
  team: string;
  finishRate: number; // 0-1
  totalFights: number;
}
export interface Card3Data {
  fighters: Card3Fighter[]; // expected length 6
}

export interface Card4Side {
  name: string;
  team: string;
  record: string;
  netPts: number;
  roundWinPct: number;
  last3: ('w' | 'l')[];
}
export interface Card4Data {
  week: number;
  a: Card4Side;
  b: Card4Side;
}

export interface CardsPayload {
  week: number;
  card1: Card1Data;
  card2: Card2Data;
  card3: Card3Data;
  card4: Card4Data;
  // Per-week top-performers ranking (highest → lowest) so the admin can
  // pick a different week and reslice without refetching.
  topPerformersByWeek: Record<number, Card1Fighter[]>;
  availableWeeks: number[];
  // Desired card 1 list length — admin can grow or shrink this freely.
  card1Count: number;
}

export type CardStyle = 'A' | 'B'; // A = Gazette, B = Neon
