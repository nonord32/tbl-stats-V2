// src/lib/fantasyMock.ts
// Mock data for the /fantasy preview. No backend yet — every value here
// is hand-rolled so the UI demos correctly. Keep this file isolated from
// the rest of the app so it's trivial to swap for real Supabase queries
// later.

export type FantasySlot =
  | 'Female'
  | 'Light'
  | 'Welter'
  | 'Middle'
  | 'Heavy'
  | 'FLEX1'
  | 'FLEX2';

export const SLOT_LABELS: Record<FantasySlot, string> = {
  Female: 'Female',
  Light: 'Light',
  Welter: 'Welter',
  Middle: 'Middle',
  Heavy: 'Heavy',
  FLEX1: 'FLEX',
  FLEX2: 'FLEX',
};

export const SLOT_RULES: Record<FantasySlot, string> = {
  Female: 'Super Lightweight · Bantamweight · Featherweight',
  Light: 'Featherweight · Lightweight',
  Welter: 'Welterweight · Super Welterweight',
  Middle: 'Middleweight · Super Middleweight',
  Heavy: 'Light Heavyweight · Cruiserweight · Heavyweight',
  FLEX1: 'Any division',
  FLEX2: 'Any division',
};

export interface FantasyFighter {
  id: string;
  name: string;
  team: string;
  city: string;
  weightClass: string;
  gender: 'Male' | 'Female';
  projected: number;   // projected fantasy points this event
  avg: number;         // season avg fantasy points
  owned: number;       // % of leagues that own this fighter
  status: 'active' | 'questionable' | 'out' | 'free';
}

export interface RosterSlot {
  slot: FantasySlot;
  fighter: FantasyFighter | null;
  opponent?: string;
  fight?: string;
}

export interface BenchEntry {
  fighter: FantasyFighter;
  opponent?: string;
}

export interface LeagueStanding {
  rank: number;
  team: string;
  owner: string;
  record: string;
  pf: number;
  pa: number;
  streak: string;
  isYou?: boolean;
}

export interface DraftPick {
  round: number;
  pick: number;
  team: string;
  fighter: string;
  weightClass: string;
}

export interface TradeOffer {
  id: string;
  direction: 'incoming' | 'outgoing';
  partner: string;
  partnerOwner: string;
  youGet: { name: string; weightClass: string }[];
  theyGet: { name: string; weightClass: string }[];
  status: 'pending' | 'expired' | 'accepted' | 'declined';
  ageHours: number;
}

export interface ScoringRow {
  slot: FantasySlot;
  fighter: string;
  result: 'W' | 'L';
  method: 'Decision' | 'KD' | '2KD' | 'KO/TKO';
  points: number;
  bout: string;
}

// ── Fighter pool ────────────────────────────────────────────────────────────
export const POOL: FantasyFighter[] = [
  { id: 'f01', name: 'Kye Brooks',      team: 'NYC Attitude',      city: 'NYC',          weightClass: 'Lightweight',         gender: 'Male',   projected: 9.4, avg: 8.6,  owned: 99, status: 'active' },
  { id: 'f02', name: 'Marcus Valdez',   team: 'NYC Attitude',      city: 'NYC',          weightClass: 'Welterweight',        gender: 'Male',   projected: 7.2, avg: 6.9,  owned: 98, status: 'active' },
  { id: 'f03', name: 'Jordan Reyes',    team: 'Boston Butchers',   city: 'Boston',       weightClass: 'Middleweight',        gender: 'Male',   projected: 6.8, avg: 6.4,  owned: 96, status: 'active' },
  { id: 'f04', name: 'Declan O’Hara',  team: 'Dallas Enforcers',  city: 'Dallas',       weightClass: 'Heavyweight',         gender: 'Male',   projected: 5.9, avg: 5.7,  owned: 92, status: 'active' },
  { id: 'f05', name: 'Isaiah Crane',    team: 'Las Vegas Hustle',  city: 'Las Vegas',    weightClass: 'Lightweight',         gender: 'Male',   projected: 5.6, avg: 5.4,  owned: 88, status: 'questionable' },
  { id: 'f06', name: 'Amani Okafor',    team: 'NYC Attitude',      city: 'NYC',          weightClass: 'Featherweight',       gender: 'Male',   projected: 5.4, avg: 5.1,  owned: 84, status: 'active' },
  { id: 'f07', name: 'Luca Bianchi',    team: 'Miami Assassins',   city: 'Miami',        weightClass: 'Welterweight',        gender: 'Male',   projected: 4.9, avg: 4.7,  owned: 79, status: 'active' },
  { id: 'f08', name: 'Nia Thompson',    team: 'Atlanta Attack',    city: 'Atlanta',      weightClass: 'Featherweight',       gender: 'Female', projected: 5.2, avg: 4.8,  owned: 91, status: 'active' },
  { id: 'f09', name: 'Rafael Silva',    team: 'Dallas Enforcers',  city: 'Dallas',       weightClass: 'Middleweight',        gender: 'Male',   projected: 4.6, avg: 4.3,  owned: 71, status: 'active' },
  { id: 'f10', name: 'Jalen Wright',    team: 'Houston Hitmen',    city: 'Houston',      weightClass: 'Heavyweight',         gender: 'Male',   projected: 4.0, avg: 3.9,  owned: 65, status: 'active' },
  { id: 'f11', name: 'Briana Carrera',  team: 'Dallas Enforcers',  city: 'Dallas',       weightClass: 'Super Lightweight',   gender: 'Female', projected: 4.4, avg: 4.0,  owned: 73, status: 'active' },
  { id: 'f12', name: 'Tariq Whitaker',  team: 'NYC Attitude',      city: 'NYC',          weightClass: 'Super Welterweight',  gender: 'Male',   projected: 4.2, avg: 3.8,  owned: 60, status: 'active' },
  { id: 'f13', name: 'Money Powell',    team: 'Atlanta Attack',    city: 'Atlanta',      weightClass: 'Light Heavyweight',   gender: 'Male',   projected: 5.1, avg: 4.7,  owned: 70, status: 'active' },
  { id: 'f14', name: 'Ariele Davis',    team: 'Atlanta Attack',    city: 'Atlanta',      weightClass: 'Super Lightweight',   gender: 'Female', projected: 4.3, avg: 4.0,  owned: 68, status: 'active' },
  { id: 'f15', name: 'Yosidel Napoles', team: 'Miami Assassins',   city: 'Miami',        weightClass: 'Lightweight',         gender: 'Male',   projected: 4.7, avg: 4.4,  owned: 81, status: 'active' },
  { id: 'f16', name: 'Erika Voss',      team: 'Los Angeles Elite', city: 'Los Angeles',  weightClass: 'Bantamweight',        gender: 'Female', projected: 3.9, avg: 3.6,  owned: 52, status: 'active' },
  { id: 'f17', name: 'Connor Mulligan', team: 'Boston Butchers',   city: 'Boston',       weightClass: 'Lightweight',         gender: 'Male',   projected: 3.4, avg: 3.2,  owned: 41, status: 'active' },
  { id: 'f18', name: 'Tomás Arnaud',    team: 'NYC Attitude',      city: 'NYC',          weightClass: 'Middleweight',        gender: 'Male',   projected: 3.7, avg: 3.5,  owned: 47, status: 'active' },
  { id: 'f19', name: 'Eli Whelan',      team: 'Boston Butchers',   city: 'Boston',       weightClass: 'Light Heavyweight',   gender: 'Male',   projected: 3.0, avg: 2.8,  owned: 33, status: 'free' },
  { id: 'f20', name: 'Jeovanny Estela', team: 'Miami Assassins',   city: 'Miami',        weightClass: 'Middleweight',        gender: 'Male',   projected: 3.2, avg: 3.0,  owned: 38, status: 'free' },
  { id: 'f21', name: 'Kayla Ortiz',     team: 'Atlanta Attack',    city: 'Atlanta',      weightClass: 'Bantamweight',        gender: 'Female', projected: 3.1, avg: 2.9,  owned: 27, status: 'free' },
  { id: 'f22', name: 'Rashad Pierre',   team: 'Philadelphia Smoke',city: 'Philadelphia', weightClass: 'Featherweight',       gender: 'Male',   projected: 2.8, avg: 2.6,  owned: 18, status: 'free' },
  { id: 'f23', name: 'Tierra Volk',     team: 'Phoenix Fury',      city: 'Phoenix',      weightClass: 'Featherweight',       gender: 'Female', projected: 2.6, avg: 2.4,  owned: 11, status: 'free' },
  { id: 'f24', name: 'Sami Pereira',    team: 'NYC Attitude',      city: 'NYC',          weightClass: 'Light Heavyweight',   gender: 'Male',   projected: 3.5, avg: 3.3,  owned: 44, status: 'out' },
];

export function findFighter(id: string): FantasyFighter {
  const f = POOL.find((p) => p.id === id);
  if (!f) throw new Error(`Mock fighter ${id} missing`);
  return f;
}

// ── My team ────────────────────────────────────────────────────────────────
export const ME = {
  user: { displayName: 'You', handle: 'youhandle' },
  team: { name: 'Throwing Hands FC', record: '6-3', rank: 4, totalPoints: 312.4 },
};

export const MY_LINEUP: RosterSlot[] = [
  { slot: 'Female', fighter: findFighter('f08'), opponent: 'Phoenix Fury',     fight: 'Sat 4/25 · 7:00 ET' },
  { slot: 'Light',  fighter: findFighter('f01'), opponent: 'Boston Butchers',  fight: 'Fri 4/24 · 8:00 ET' },
  { slot: 'Welter', fighter: findFighter('f02'), opponent: 'LA Elite',         fight: 'Fri 4/24 · 8:00 ET' },
  { slot: 'Middle', fighter: findFighter('f03'), opponent: 'NYC Attitude',     fight: 'Fri 4/24 · 8:00 ET' },
  { slot: 'Heavy',  fighter: findFighter('f04'), opponent: 'Houston Hitmen',   fight: 'Sat 4/25 · 9:30 ET' },
  { slot: 'FLEX1',  fighter: findFighter('f06'), opponent: 'Boston Butchers',  fight: 'Fri 4/24 · 8:00 ET' },
  { slot: 'FLEX2',  fighter: findFighter('f11'), opponent: 'Houston Hitmen',   fight: 'Sat 4/25 · 9:30 ET' },
];

export const MY_BENCH: BenchEntry[] = [
  { fighter: findFighter('f05'), opponent: 'San Antonio Snipers' },
  { fighter: findFighter('f12'), opponent: 'LA Elite' },
  { fighter: findFighter('f13'), opponent: 'Miami Assassins' },
  { fighter: findFighter('f17'), opponent: 'NYC Attitude' },
  { fighter: findFighter('f18'), opponent: 'Boston Butchers' },
  { fighter: findFighter('f24'), opponent: 'Boston Butchers' },
  { fighter: findFighter('f15'), opponent: 'Atlanta Attack' },
  { fighter: findFighter('f22'), opponent: 'Las Vegas Hustle' },
];

// ── League standings ──────────────────────────────────────────────────────
export const STANDINGS: LeagueStanding[] = [
  { rank: 1, team: 'Snipers Inc.',         owner: 'tomh',        record: '8-1', pf: 412.6, pa: 271.2, streak: 'W4' },
  { rank: 2, team: 'Glove Mafia',          owner: 'rachael',     record: '7-2', pf: 388.4, pa: 295.7, streak: 'W2' },
  { rank: 3, team: 'Assassin Yacht Club',  owner: 'priya',       record: '7-2', pf: 376.9, pa: 302.5, streak: 'L1' },
  { rank: 4, team: 'Throwing Hands FC',    owner: ME.user.handle,record: '6-3', pf: 312.4, pa: 308.1, streak: 'W2', isYou: true },
  { rank: 5, team: 'Headgear Heroes',      owner: 'devon',       record: '5-4', pf: 304.2, pa: 311.8, streak: 'L2' },
  { rank: 6, team: 'Speed Bag Society',    owner: 'jess',        record: '5-4', pf: 297.0, pa: 314.6, streak: 'W1' },
  { rank: 7, team: 'Cornermen United',     owner: 'lopez',       record: '4-5', pf: 281.5, pa: 320.4, streak: 'L1' },
  { rank: 8, team: 'Knockout Equity',      owner: 'amir',        record: '4-5', pf: 274.1, pa: 318.3, streak: 'W1' },
  { rank: 9, team: 'Slip & Counter',       owner: 'mason',       record: '3-6', pf: 252.9, pa: 332.7, streak: 'L3' },
  { rank: 10, team: 'Spit Bucket Bandits', owner: 'lake',        record: '2-7', pf: 224.6, pa: 354.0, streak: 'L4' },
];

// ── Draft ──────────────────────────────────────────────────────────────────
export const DRAFT_STATE = {
  round: 3,
  pick: 27,
  totalRounds: 16,
  totalPicks: 160,
  onTheClock: 'Throwing Hands FC',
  timer: '00:54',
  isYourPick: true,
};

export const RECENT_PICKS: DraftPick[] = [
  { round: 3, pick: 26, team: 'Headgear Heroes',      fighter: 'Yosidel Napoles', weightClass: 'Lightweight'       },
  { round: 3, pick: 25, team: 'Speed Bag Society',    fighter: 'Tariq Whitaker',  weightClass: 'Super Welterweight' },
  { round: 3, pick: 24, team: 'Cornermen United',     fighter: 'Money Powell',    weightClass: 'Light Heavyweight'  },
  { round: 3, pick: 23, team: 'Knockout Equity',      fighter: 'Briana Carrera',  weightClass: 'Super Lightweight'  },
  { round: 3, pick: 22, team: 'Slip & Counter',       fighter: 'Erika Voss',      weightClass: 'Bantamweight'       },
  { round: 3, pick: 21, team: 'Spit Bucket Bandits',  fighter: 'Connor Mulligan', weightClass: 'Lightweight'        },
  { round: 2, pick: 20, team: 'Snipers Inc.',         fighter: 'Sami Pereira',    weightClass: 'Light Heavyweight'  },
];

export const DRAFT_BOARD = [
  'Snipers Inc.', 'Glove Mafia', 'Assassin Yacht Club', 'Throwing Hands FC',
  'Headgear Heroes', 'Speed Bag Society', 'Cornermen United', 'Knockout Equity',
  'Slip & Counter', 'Spit Bucket Bandits',
];

// ── Trades ─────────────────────────────────────────────────────────────────
export const TRADES: TradeOffer[] = [
  {
    id: 't1',
    direction: 'incoming',
    partner: 'Glove Mafia',
    partnerOwner: 'rachael',
    youGet: [
      { name: 'Luca Bianchi',  weightClass: 'Welterweight' },
      { name: 'Money Powell',  weightClass: 'Light Heavyweight' },
    ],
    theyGet: [
      { name: 'Marcus Valdez', weightClass: 'Welterweight' },
    ],
    status: 'pending',
    ageHours: 7,
  },
  {
    id: 't2',
    direction: 'outgoing',
    partner: 'Headgear Heroes',
    partnerOwner: 'devon',
    youGet: [
      { name: 'Rafael Silva',  weightClass: 'Middleweight' },
    ],
    theyGet: [
      { name: 'Tomás Arnaud',  weightClass: 'Middleweight' },
      { name: 'Sami Pereira',  weightClass: 'Light Heavyweight' },
    ],
    status: 'pending',
    ageHours: 22,
  },
  {
    id: 't3',
    direction: 'incoming',
    partner: 'Snipers Inc.',
    partnerOwner: 'tomh',
    youGet: [{ name: 'Eli Whelan',     weightClass: 'Light Heavyweight' }],
    theyGet: [{ name: 'Tariq Whitaker', weightClass: 'Super Welterweight' }],
    status: 'declined',
    ageHours: 53,
  },
];

// ── Scoring (last event) ──────────────────────────────────────────────────
export const SCORING_LAST: ScoringRow[] = [
  { slot: 'Female', fighter: 'Nia Thompson',   result: 'W', method: 'KO/TKO',   points: 4,  bout: 'vs Tierra Volk · R3' },
  { slot: 'Light',  fighter: 'Kye Brooks',     result: 'W', method: 'KD',       points: 2,  bout: 'vs Connor Mulligan · R3' },
  { slot: 'Welter', fighter: 'Marcus Valdez',  result: 'L', method: 'Decision', points: 0,  bout: 'vs Sami Pereira · R3' },
  { slot: 'Middle', fighter: 'Jordan Reyes',   result: 'W', method: '2KD',      points: 3,  bout: 'vs Tomás Arnaud · R3' },
  { slot: 'Heavy',  fighter: 'Declan O’Hara', result: 'W', method: 'Decision', points: 1,  bout: 'vs Jalen Wright · R3' },
  { slot: 'FLEX1',  fighter: 'Amani Okafor',   result: 'W', method: 'KD',       points: 2,  bout: 'vs Rashad Pierre · R3' },
  { slot: 'FLEX2',  fighter: 'Briana Carrera', result: 'L', method: 'KD',       points: -1, bout: 'vs Ariele Davis · R3' },
];

export const SCORING_OPP_TOTAL = 9;

export const SCORING_RULES = [
  { label: 'Win · Decision',      pts: '+1' },
  { label: 'Win · Knockdown',     pts: '+2' },
  { label: 'Win · Double KD',     pts: '+3' },
  { label: 'Win · KO / TKO',      pts: '+4' },
  { label: 'Loss · Decision',     pts:  '0' },
  { label: 'Loss · Knockdown',    pts: '-1' },
  { label: 'Loss · Double KD',    pts: '-2' },
  { label: 'Loss · KO / TKO',     pts: '-3' },
];
