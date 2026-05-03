// src/lib/fantasyData.ts
// Server-only adapter that turns real TBL fighter data (from getAllData →
// Google Sheets, the same source the rest of the site uses) into the
// FantasyFighter shape our /fantasy preview pages render.
//
// Real fields:        name, team, weightClass, gender, season stats
// Synthesized fields: avg (NPPR), owned %
//                     (percentile of net points), status (active),
//                     lineup matchup labels, recent-pick attribution.
//
// League-level state that has no real data source yet (standings,
// draft state, trade offers structure, scoring rules) stays in
// fantasyMock.ts and is composed in by the page components.

import { getAllData } from './data';
import { getCityName } from './teams';
import type { FighterStat } from '@/types';
import type {
  FantasyFighter,
  RosterSlot,
  BenchEntry,
  DraftPick,
  ScoringRow,
  TradeOffer,
} from './fantasyMock';

const FEMALE_FANTASY_CLASSES = new Set([
  'Super Lightweight',
  'Bantamweight',
  'Featherweight',
]);

/** Split "Light Heavyweight, Cruiserweight" into ['Light Heavyweight', 'Cruiserweight']. */
function splitClasses(raw: string): string[] {
  return raw
    .split(/[,/]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function fighterMatchesAny(f: FighterStat, classes: string[]): boolean {
  const split = splitClasses(f.weightClass);
  return split.some((c) => classes.includes(c));
}

function toFantasyFighter(f: FighterStat, percentile: number): FantasyFighter {
  const avg = Number.isFinite(f.nppr) ? Math.max(0, f.nppr) : 0;
  // Synthesize ownership %: top fighter ~99%, bottom ~5%, scaled by their
  // net-points percentile. Pure mock until a "rostered_in_n_leagues" feed
  // exists.
  const owned = Math.max(5, Math.min(99, Math.round(5 + percentile * 94)));
  const gender: 'Male' | 'Female' = f.gender === 'Female' ? 'Female' : 'Male';
  return {
    id: f.slug,
    name: f.name,
    team: f.team,
    city: getCityName(f.team),
    weightClass: splitClasses(f.weightClass)[0] || 'Unknown',
    gender,
    avg: +avg.toFixed(1),
    owned,
    status: 'active',
  };
}

/** Pick a fighter that matches `predicate` and hasn't been claimed yet. */
function makePicker(pool: FantasyFighter[], realByPool: Map<string, FighterStat>) {
  const taken = new Set<string>();
  return {
    pick(predicate: (f: FantasyFighter, real: FighterStat) => boolean): FantasyFighter | null {
      for (const f of pool) {
        if (taken.has(f.id)) continue;
        const real = realByPool.get(f.id);
        if (!real) continue;
        if (predicate(f, real)) {
          taken.add(f.id);
          return f;
        }
      }
      return null;
    },
    isTaken: (id: string) => taken.has(id),
    take: (id: string) => taken.add(id),
  };
}

interface FantasyData {
  pool: FantasyFighter[];
  lineup: RosterSlot[];
  bench: BenchEntry[];
  freeAgents: FantasyFighter[];
  recentPicks: DraftPick[];
  draftAvailable: FantasyFighter[];
  scoringLast: ScoringRow[];
  trades: TradeOffer[];
}

const RECENT_PICK_TEAMS = [
  'Headgear Heroes',
  'Speed Bag Society',
  'Cornermen United',
  'Knockout Equity',
  'Slip & Counter',
  'Spit Bucket Bandits',
  'Snipers Inc.',
];

const BENCH_MATCHUPS = [
  'San Antonio Snipers',
  'LA Elite',
  'Miami Assassins',
  'NYC Attitude',
  'Boston Butchers',
  'Atlanta Attack',
  'Las Vegas Hustle',
  'Phoenix Fury',
];

export async function getFantasyData(): Promise<FantasyData> {
  const data = await getAllData();
  const fighters = data.fighters.filter((f) => f.rounds > 0); // require ≥1 bout

  // Rank by net points to drive ownership % + draft ordering.
  const byNet = [...fighters].sort((a, b) => b.netPts - a.netPts);
  const total = byNet.length || 1;

  // Build real → fantasy map alongside a lookup back to the real row so
  // the lineup picker can re-check multi-class eligibility.
  const realByPool = new Map<string, FighterStat>();
  const pool: FantasyFighter[] = byNet.map((f, i) => {
    const ff = toFantasyFighter(f, 1 - i / total);
    realByPool.set(ff.id, f);
    return ff;
  });

  const picker = makePicker(pool, realByPool);

  // ── My active lineup (7 slots) ─────────────────────────────────────────
  const lineup: RosterSlot[] = [
    {
      slot: 'Female',
      fighter: picker.pick(
        (_, real) =>
          real.gender === 'Female' &&
          fighterMatchesAny(real, [...FEMALE_FANTASY_CLASSES])
      ),
      opponent: 'Phoenix Fury',
      fight: 'Sat 4/25 · 7:00 ET',
    },
    {
      slot: 'Light',
      fighter: picker.pick(
        (_, real) =>
          real.gender === 'Male' &&
          fighterMatchesAny(real, ['Featherweight', 'Lightweight'])
      ),
      opponent: 'Boston Butchers',
      fight: 'Fri 4/24 · 8:00 ET',
    },
    {
      slot: 'Welter',
      fighter: picker.pick(
        (_, real) =>
          real.gender === 'Male' &&
          fighterMatchesAny(real, ['Welterweight', 'Super Welterweight'])
      ),
      opponent: 'LA Elite',
      fight: 'Fri 4/24 · 8:00 ET',
    },
    {
      slot: 'Middle',
      fighter: picker.pick(
        (_, real) =>
          real.gender === 'Male' &&
          fighterMatchesAny(real, ['Middleweight', 'Super Middleweight'])
      ),
      opponent: 'NYC Attitude',
      fight: 'Fri 4/24 · 8:00 ET',
    },
    {
      slot: 'Heavy',
      fighter: picker.pick(
        (_, real) =>
          real.gender === 'Male' &&
          fighterMatchesAny(real, ['Light Heavyweight', 'Cruiserweight', 'Heavyweight'])
      ),
      opponent: 'Houston Hitmen',
      fight: 'Sat 4/25 · 9:30 ET',
    },
    {
      slot: 'FLEX1',
      fighter: picker.pick(() => true),
      opponent: 'Boston Butchers',
      fight: 'Fri 4/24 · 8:00 ET',
    },
    {
      slot: 'FLEX2',
      fighter: picker.pick(() => true),
      opponent: 'Houston Hitmen',
      fight: 'Sat 4/25 · 9:30 ET',
    },
  ];

  // ── Bench (8 reserves) — next-best fighters not already in lineup ──────
  const bench: BenchEntry[] = [];
  for (const f of pool) {
    if (bench.length >= 8) break;
    if (picker.isTaken(f.id)) continue;
    picker.take(f.id);
    bench.push({
      fighter: f,
      opponent: BENCH_MATCHUPS[bench.length % BENCH_MATCHUPS.length],
    });
  }

  const myRosterIds = new Set<string>([
    ...lineup.map((l) => l.fighter?.id).filter(Boolean) as string[],
    ...bench.map((b) => b.fighter.id),
  ]);

  // ── "Other team" rosters — claim the next ~70 fighters as draft-locked ─
  const otherOwned = new Set<string>();
  const TARGET_OTHER_OWNED = Math.min(70, pool.length - myRosterIds.size);
  for (const f of pool) {
    if (otherOwned.size >= TARGET_OTHER_OWNED) break;
    if (myRosterIds.has(f.id)) continue;
    otherOwned.add(f.id);
  }

  // Recent picks: the seven highest-ranked fighters who are owned by
  // someone else. We attribute them to mock teams in round 3 of the draft.
  const recentPicksSrc = pool.filter(
    (f) => !myRosterIds.has(f.id) && otherOwned.has(f.id)
  ).slice(0, 7);
  const recentPicks: DraftPick[] = recentPicksSrc.map((f, idx) => ({
    round: 3,
    pick: 26 - idx,
    team: RECENT_PICK_TEAMS[idx % RECENT_PICK_TEAMS.length],
    fighter: f.name,
    weightClass: f.weightClass,
  }));

  // ── Free agents = real fighters not on any roster (lower-tier) ─────────
  const freeAgents: FantasyFighter[] = pool
    .filter((f) => !myRosterIds.has(f.id) && !otherOwned.has(f.id))
    .map((f) => ({ ...f, status: 'free' as const }))
    .slice(0, 30);

  // ── Draft available = pool minus my roster minus the picks already shown
  //    in the recent log. Other already-owned fighters can still appear
  //    here (the draft is "in progress" so several teams' rosters are
  //    incomplete) — we just remove the just-picked seven for realism.
  const recentPickNames = new Set(recentPicks.map((p) => p.fighter));
  const draftAvailable = pool
    .filter((f) => !myRosterIds.has(f.id) && !recentPickNames.has(f.name))
    .map((f, _i, arr) => ({ ...f, owned: Math.min(f.owned, 80 + (arr.length % 5)) }));

  // ── Last week scoring derived from my lineup ───────────────────────────
  const scoringMethods: ScoringRow['method'][] = [
    'KO/TKO',
    'KD',
    'Decision',
    '2KD',
    'Decision',
    'KD',
    'KD',
  ];
  const scoringResults: ScoringRow['result'][] = ['W', 'W', 'L', 'W', 'W', 'W', 'L'];
  const POINTS: Record<`${'W' | 'L'}-${ScoringRow['method']}`, number> = {
    'W-Decision': 1,
    'W-KD': 2,
    'W-2KD': 3,
    'W-KO/TKO': 4,
    'L-Decision': 0,
    'L-KD': -1,
    'L-2KD': -2,
    'L-KO/TKO': -3,
  };
  const scoringLast: ScoringRow[] = lineup.map((l, i) => {
    const result = scoringResults[i] ?? 'W';
    const method = scoringMethods[i] ?? 'Decision';
    const opponentName = recentPicksSrc[i]?.name ?? 'Opponent';
    return {
      slot: l.slot,
      fighter: l.fighter?.name ?? '—',
      result,
      method,
      points: POINTS[`${result}-${method}`],
      bout: `vs ${opponentName} · R3`,
    };
  });

  // ── Trade offers (mock structure, real fighter names from the pool) ────
  const benchByCity = bench.map((b) => b.fighter);
  const otherOwnedFighters = pool.filter((f) => otherOwned.has(f.id));
  const otherWelter = otherOwnedFighters.find((f) =>
    ['Welterweight', 'Super Welterweight'].includes(f.weightClass)
  );
  const otherLightHeavy = otherOwnedFighters.find((f) =>
    ['Light Heavyweight', 'Cruiserweight'].includes(f.weightClass)
  );
  const otherMiddle = otherOwnedFighters.find((f) => f.weightClass === 'Middleweight');
  const myWelter = lineup.find((l) => l.slot === 'Welter')?.fighter ?? benchByCity[0];
  const myMiddle = lineup.find((l) => l.slot === 'Middle')?.fighter ?? benchByCity[0];
  const myBenchHeavy = benchByCity.find((f) =>
    ['Light Heavyweight', 'Cruiserweight', 'Heavyweight'].includes(f.weightClass)
  ) ?? benchByCity[0];

  const trades: TradeOffer[] = [
    {
      id: 't1',
      direction: 'incoming',
      partner: 'Glove Mafia',
      partnerOwner: 'rachael',
      youGet: [
        otherWelter && { name: otherWelter.name, weightClass: otherWelter.weightClass },
        otherLightHeavy && {
          name: otherLightHeavy.name,
          weightClass: otherLightHeavy.weightClass,
        },
      ].filter(Boolean) as { name: string; weightClass: string }[],
      theyGet:
        myWelter
          ? [{ name: myWelter.name, weightClass: myWelter.weightClass }]
          : [],
      status: 'pending',
      ageHours: 7,
    },
    {
      id: 't2',
      direction: 'outgoing',
      partner: 'Headgear Heroes',
      partnerOwner: 'devon',
      youGet:
        otherMiddle
          ? [{ name: otherMiddle.name, weightClass: otherMiddle.weightClass }]
          : [],
      theyGet: [
        myMiddle && { name: myMiddle.name, weightClass: myMiddle.weightClass },
        myBenchHeavy && { name: myBenchHeavy.name, weightClass: myBenchHeavy.weightClass },
      ].filter(Boolean) as { name: string; weightClass: string }[],
      status: 'pending',
      ageHours: 22,
    },
    {
      id: 't3',
      direction: 'incoming',
      partner: 'Snipers Inc.',
      partnerOwner: 'tomh',
      youGet:
        otherLightHeavy
          ? [{ name: otherLightHeavy.name, weightClass: otherLightHeavy.weightClass }]
          : [],
      theyGet:
        myBenchHeavy
          ? [{ name: myBenchHeavy.name, weightClass: myBenchHeavy.weightClass }]
          : [],
      status: 'declined',
      ageHours: 53,
    },
  ];

  return {
    pool,
    lineup,
    bench,
    freeAgents,
    recentPicks,
    draftAvailable,
    scoringLast,
    trades,
  };
}

// ─── Persistent (Supabase) helpers ──────────────────────────────────────────
// Server-only. Keep these out of client bundles by only importing into
// route handlers and server components.
import { createClient as createServerSupabase } from './supabase/server';
import { getGameStartUTC } from './gameTime';
import type { ScheduleEntry, FightHistory } from '@/types';

const FANTASY_ROSTER_SIZE_TARGET = 10; // matches the mock-draft default
const STARTER_COUNT = 7;

/** Build a FantasyFighter array from a list of raw fighter slugs. Filters out
 *  any slug that doesn't resolve to a current fighter (e.g. data drift). */
function poolToFighters(
  slugs: string[],
  pool: FantasyFighter[]
): FantasyFighter[] {
  const byId = new Map(pool.map((f) => [f.id, f]));
  return slugs
    .map((s) => byId.get(s))
    .filter((f): f is FantasyFighter => !!f);
}

/** Read the current user's persisted fantasy roster. Returns null when no
 *  draft has been completed yet (caller redirects to /fantasy/draft). */
export async function getMyRoster(userId: string): Promise<{
  slugs: string[];
  fighters: FantasyFighter[];
  teamName: string | null;
} | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('fantasy_rosters')
    .select('fighter_slugs, team_name')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.error('[getMyRoster]', error);
    return null;
  }
  if (!data || !Array.isArray(data.fighter_slugs) || data.fighter_slugs.length === 0) {
    return null;
  }
  const { pool } = await getFantasyData();
  const fighters = poolToFighters(data.fighter_slugs as string[], pool);
  const teamName =
    typeof data.team_name === 'string' && data.team_name.length > 0
      ? data.team_name
      : null;
  return { slugs: data.fighter_slugs as string[], fighters, teamName };
}

/** Earliest kickoff time (UTC) across a week's schedule entries. Returns
 *  null when no entry has a parseable date/time/venue. */
function firstKickoffUTC(entries: ScheduleEntry[]): Date | null {
  const stamps: number[] = [];
  for (const e of entries) {
    const d = getGameStartUTC(e.date, e.time, e.venueCity);
    if (d && !isNaN(d.getTime())) stamps.push(d.getTime());
  }
  if (stamps.length === 0) return null;
  return new Date(Math.min(...stamps));
}

// Tiny deterministic hash so the AI opponent's lineup is reproducible per
// (user, week) — no need to persist a seed.
function hashSeed(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function deterministicShuffle<T>(arr: T[], seed: number): T[] {
  const out = arr.slice();
  let s = seed || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Auto-pick the best lineup of 7 starters from a roster, matching slot
 *  eligibility rules. FLEX slots take whoever's left (highest season avg). */
function pickStarters(roster: FantasyFighter[]): FantasyFighter[] {
  const taken = new Set<string>();
  const result: FantasyFighter[] = [];
  const sorted = [...roster].sort((a, b) => b.avg - a.avg);
  const RULES: ((f: FantasyFighter) => boolean)[] = [
    (f) => f.gender === 'Female' && FEMALE_FANTASY_CLASSES.has(f.weightClass),
    (f) => f.gender === 'Male' && ['Featherweight', 'Lightweight'].includes(f.weightClass),
    (f) => f.gender === 'Male' && ['Welterweight', 'Super Welterweight'].includes(f.weightClass),
    (f) => f.gender === 'Male' && ['Middleweight', 'Super Middleweight'].includes(f.weightClass),
    (f) => f.gender === 'Male' && ['Light Heavyweight', 'Cruiserweight', 'Heavyweight'].includes(f.weightClass),
  ];
  for (const ok of RULES) {
    const found = sorted.find((f) => !taken.has(f.id) && ok(f));
    if (found) {
      taken.add(found.id);
      result.push(found);
    }
  }
  // FLEX × 2: best remaining
  for (const f of sorted) {
    if (result.length >= STARTER_COUNT) break;
    if (taken.has(f.id)) continue;
    taken.add(f.id);
    result.push(f);
  }
  return result;
}

export interface FantasyWeekRow {
  week: number;
  starterSlugs: string[];
  opponentStarterSlugs: string[];
  userPoints: number | null;
  opponentPoints: number | null;
  resolvedAt: string | null;
  locksAt: string;        // ISO
  isLocked: boolean;
}

/** Get-or-create the user's fantasy week. On first read of a week we lock
 *  in their starting 7 (best-eligible from their roster) plus a determ-
 *  inistic AI opponent lineup drawn from undrafted fighters. */
export async function getOrCreateWeek(
  userId: string,
  week: number,
  schedule: ScheduleEntry[]
): Promise<FantasyWeekRow | null> {
  const supabase = await createServerSupabase();
  const existing = await supabase
    .from('fantasy_weeks')
    .select('week, starter_slugs, opponent_starter_slugs, user_points, opponent_points, resolved_at, locks_at')
    .eq('user_id', userId)
    .eq('week', week)
    .maybeSingle();

  if (existing.data) {
    const locksAtISO = existing.data.locks_at as string;
    return {
      week,
      starterSlugs: (existing.data.starter_slugs as string[]) ?? [],
      opponentStarterSlugs: (existing.data.opponent_starter_slugs as string[]) ?? [],
      userPoints: existing.data.user_points as number | null,
      opponentPoints: existing.data.opponent_points as number | null,
      resolvedAt: existing.data.resolved_at as string | null,
      locksAt: locksAtISO,
      isLocked: new Date(locksAtISO).getTime() <= Date.now(),
    };
  }

  // No row yet — build one. Need the user's roster + the full pool to draw
  // an opponent from undrafted fighters.
  const roster = await getMyRoster(userId);
  if (!roster) return null;
  const { pool } = await getFantasyData();
  const rosterIds = new Set(roster.slugs);
  const undrafted = pool.filter((f) => !rosterIds.has(f.id));

  const starters = pickStarters(roster.fighters);

  // Opponent: deterministic shuffle of undrafted, then run starter picker.
  const seed = hashSeed(`${userId}:${week}`);
  const aiPool = deterministicShuffle(undrafted, seed)
    .slice(0, FANTASY_ROSTER_SIZE_TARGET);
  const aiStarters = pickStarters(aiPool);

  // Locks at first kickoff that week.
  const weekEntries = schedule.filter((s) => Number(s.week) === week);
  const lockDate = firstKickoffUTC(weekEntries) ?? new Date(Date.now() + 7 * 24 * 3600 * 1000);

  const insert = await supabase
    .from('fantasy_weeks')
    .insert({
      user_id: userId,
      week,
      starter_slugs: starters.map((f) => f.id),
      opponent_starter_slugs: aiStarters.map((f) => f.id),
      locks_at: lockDate.toISOString(),
    })
    .select('week, starter_slugs, opponent_starter_slugs, user_points, opponent_points, resolved_at, locks_at')
    .single();

  if (insert.error || !insert.data) {
    console.error('[getOrCreateWeek] insert failed', insert.error);
    return null;
  }
  const locksAtISO = insert.data.locks_at as string;
  return {
    week,
    starterSlugs: (insert.data.starter_slugs as string[]) ?? [],
    opponentStarterSlugs: (insert.data.opponent_starter_slugs as string[]) ?? [],
    userPoints: insert.data.user_points as number | null,
    opponentPoints: insert.data.opponent_points as number | null,
    resolvedAt: insert.data.resolved_at as string | null,
    locksAt: locksAtISO,
    isLocked: new Date(locksAtISO).getTime() <= Date.now(),
  };
}

// ─── Scoring engine ─────────────────────────────────────────────────────────
export interface ScoredBout {
  fighterSlug: string;
  fighterName: string;
  result: 'W' | 'L' | 'D';
  method: string;       // raw resultMethod (Decision / KO / TKO / …)
  points: number;       // fantasy points awarded
  date: string;
  opponent: string;
  matchIndex: number;
}

/** Map a (result, method) pair to fantasy points using the +1/+2/+3/+4
 *  / 0/-1/-2/-3 spec. Unknown methods default to Decision-style. */
export function methodToPoints(result: 'W' | 'L' | 'D', method: string | undefined): number {
  if (result === 'D') return 0;
  const m = (method ?? '').toLowerCase();
  // KO / TKO / RSC (referee stops contest) / RTD (retirement) → highest
  if (/(^|\s)(ko|tko|rsc|rtd)(\s|$)/.test(m)) return result === 'W' ? 4 : -3;
  if (m.includes('double')) return result === 'W' ? 3 : -2;
  if (m.includes('knock')) return result === 'W' ? 2 : -1;
  if (m.includes('decision')) return result === 'W' ? 1 : 0;
  // Disqualification / unknown → no fantasy impact
  return 0;
}

/** Score every starter for one week. Pulls from fighterHistory (keyed by
 *  fighter slug) and matchIndexToWeek to find the bout. A starter who
 *  didn't fight that week scores 0. */
export function scoreLineup(
  starterSlugs: string[],
  pool: FantasyFighter[],
  fighterHistory: Record<string, FightHistory[]>,
  matchIndexToWeek: Map<number, number>,
  week: number
): { total: number; bouts: ScoredBout[] } {
  const byId = new Map(pool.map((f) => [f.id, f]));
  const bouts: ScoredBout[] = [];
  let total = 0;
  for (const slug of starterSlugs) {
    const f = byId.get(slug);
    if (!f) continue;
    const history = fighterHistory[slug] ?? [];
    // Sum across every bout they had in this week (often 1, sometimes 0)
    const weekBouts = history.filter((h) => matchIndexToWeek.get(h.matchIndex) === week);
    if (weekBouts.length === 0) {
      bouts.push({
        fighterSlug: slug,
        fighterName: f.name,
        result: 'D',
        method: '— did not fight —',
        points: 0,
        date: '',
        opponent: '',
        matchIndex: -1,
      });
      continue;
    }
    for (const h of weekBouts) {
      const pts = methodToPoints(h.result, h.resultMethod);
      total += pts;
      bouts.push({
        fighterSlug: slug,
        fighterName: f.name,
        result: h.result,
        method: h.resultMethod ?? 'Decision',
        points: pts,
        date: h.date,
        opponent: h.opponent,
        matchIndex: h.matchIndex,
      });
    }
  }
  return { total, bouts };
}
