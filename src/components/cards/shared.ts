// src/components/cards/shared.ts
// Shared types for the weekly IG card components. Both Gazette and Neon
// style sets accept the same props so the admin can swap them with a single
// `style` switch.

export type FinishMethod = 'KO' | 'TKO' | 'DEC';

export interface Card1Fighter {
  name: string;
  team: string;
  pts: string; // pre-formatted, e.g. "+24.6"
  method: FinishMethod;
}
export interface Card1Data {
  week: number;
  fighters: Card1Fighter[]; // expected length 6
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
}

export type CardStyle = 'A' | 'B'; // A = Gazette, B = Neon
