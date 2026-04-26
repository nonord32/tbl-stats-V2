// src/lib/fantasyData.ts
// Server-only adapter that turns real TBL fighter data (from getAllData →
// Google Sheets, the same source the rest of the site uses) into the
// FantasyFighter shape our /fantasy preview pages render.
//
// Real fields:        name, team, weightClass, gender, season stats
// Synthesized fields: projected (NPPR + small bias), avg (NPPR), owned %
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
  // "Projected" for the next event = season avg (NPPR) plus a tiny shooter's
  // bias (~10%). Fully synthesized — replace with a real projection model
  // once one exists.
  const projected = +(avg * 1.1).toFixed(1);
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
    projected,
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

  // Rank by net points to drive ownership %, projected ordering, etc.
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

  // Recent picks: the seven highest-projected fighters who are owned by
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
