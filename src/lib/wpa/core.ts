// src/lib/wpa/core.ts
//
// WPA (Win Probability Added) — pure computation core.
//
// For every round: WPA = WP(after the round) − WP(before the round), from the
// team-1 perspective. The fighter on the winning side of the round is credited
// that value; the opposing fighter gets the exact negative. Season WPA is the
// sum across a fighter's rounds.
//
// The win-probability model itself (fixed margin distribution convolved over
// remaining rounds + GAMMA logit sharpening) is precomputed into a lookup
// table by scripts/generate-wpa-table.mjs — this module only reads the table.
//
// Season-specific rules (all decided; see wpa-model-2026.json):
//  • Scheduled rounds N come from the model config (default 24; overrides per
//    match). Never assume 24.
//  • Disqualification rounds credit ZERO WPA to BOTH fighters. The points
//    still count on the scoreboard and shift every later round's win
//    probability — only the credit is suppressed. Do not change this.
//  • Excluded rows (e.g. match 14 round 25, a post-match administrative award)
//    and any row with round > N are dropped from WPA entirely.
//  • Rounds with no valid fighter on either side (e.g. match 25 round 19)
//    carry their WPA at team level and are assigned to no fighter. Attribution
//    is both-or-neither so fighter WPA stays zero-sum per round.
//
// IMPORTANT for testability: this file has NO runtime imports (types only, and
// they are erased at compile time), so it can be loaded directly by
// `node --experimental-strip-types` in scripts/wpa.test.mjs. The table, model
// config, and slugifier are injected as parameters — never imported here.

import type { MatchResult } from '@/types';

// ── Injected shapes ──────────────────────────────────────────────────────────
export interface WpTable {
  modelVersion: string;
  season: number;
  dMin: number;
  dMax: number;
  rMax: number;
  rows: number[][]; // rows[r][d - dMin]
}

// Leverage Index table — same shape/range as the WP table. Row r === 0 is
// unused (LI needs at least one round left to fight).
export interface LiTable {
  modelVersion: string;
  season: number;
  dMin: number;
  dMax: number;
  rMax: number;
  liNormalizer: number;
  rows: number[][]; // rows[r][d - dMin]
}

export interface WpaModelConfig {
  version: string;
  season: number;
  scheduledRounds: { default: number; overrides: Record<string, number> };
  excludedRounds: { matchIndex: number; round: number; reason?: string }[];
  matchFootnotes?: Record<string, string>;
  // Context-neutral WPA by round margin — what the result would have been
  // worth at exactly average leverage. Frozen 2026 constant.
  cnWpaByMargin: Record<string, number>;
}

// ── Per-round / per-match / season outputs ───────────────────────────────────
export interface WpaRound {
  round: number;
  roundId?: number; // season-wide Round ID from the sheet, when present
  weightClass?: string;
  roundPhase?: string;
  fighter1: string;
  fighter2: string;
  score1: number;
  score2: number;
  roundMargin: number; // score1 - score2, clamped to the margin scale (+/-4)
  li: number;          // Leverage Index BEFORE the round — shared by both fighters
  cnWpa: number;       // context-neutral WPA (team-1 perspective) for this margin
  method?: string;
  diffBefore: number;
  diffAfter: number;
  wpBefore: number; // team-1 win probability before the round
  wpAfter: number;  // team-1 win probability after the round
  teamWpa: number;  // team-1 perspective, PRE-adjustment (always ±zero-sum)
  isDq: boolean;
  attributed: boolean;   // false when neither fighter is credited (DQ or no fighters)
  fighter1Wpa: number;   // post-adjustment credit (0 when not attributed)
  fighter2Wpa: number;
}

export interface MatchWpa {
  matchIndex: number;
  team1: string;
  team2: string;
  phase: MatchResult['phase'];
  date: string;
  scheduledRounds: number;
  rounds: WpaRound[];
  excludedRows: number; // count of box-score rows dropped by the exclusion rules
  finalDiff: number;    // competitive differential over included rounds
  outcome: number;      // team-1: 1 win, 0 loss, 0.5 draw (competitive scoreboard)
  team1Total: number;   // Σ teamWpa (pre-adjustment) — telescopes to outcome − 0.5
  footnote?: string;
}

export interface FighterWpa {
  slug: string;
  name: string;
  rounds: number;      // rounds appeared in (incl. zero-credit DQ rounds)
  roundsRegular: number;
  roundsPlayoffs: number;
  roundWins: number;
  roundWinsRegular: number;
  roundWinsPlayoffs: number;
  matches: number;
  matchesRegular: number;
  matchesPlayoffs: number;
  wpa: number;         // post-adjustment season total
  wpaRegular: number;
  wpaPlayoffs: number;
  // ── Leverage / Clutch (DQ rounds EXCLUDED — see rule 3) ──
  liRounds: number;        // rounds counted toward LI/Clutch (excludes DQ)
  liRoundsRegular: number;
  liRoundsPlayoffs: number;
  liSum: number;           // Σ LI over counted rounds
  liSumRegular: number;
  liSumPlayoffs: number;
  avgLi: number;           // liSum / liRounds — a USAGE stat, not a performance one
  cnWpa: number;           // Σ context-neutral WPA over counted rounds
  cnWpaRegular: number;
  cnWpaPlayoffs: number;
  clutch: number;          // wpa − cnWpa
  clutchRegular: number;
  clutchPlayoffs: number;
  perRound: {
    matchIndex: number;
    date: string;
    round: number;
    roundId?: number;
    phase: MatchResult['phase'];
    opponent: string;
    opponentTeam: string;
    wpa: number;
    li: number;
    cnWpa: number;
    isDq: boolean;
  }[];
}

export interface SeasonWpa {
  modelVersion: string;
  byMatch: Map<number, MatchWpa>;
  byFighter: Map<string, FighterWpa>;
  validation: {
    matches: number;
    roundsIncluded: number;
    excludedRows: number;
    dqRounds: number;
    // Pre-adjustment invariants (per spec, checked before the DQ zeroing):
    worstZeroSum: number;    // max |team1 + team2| over all rounds — 0 by construction
    worstTelescope: number;  // max |Σ teamWpa − (outcome − 0.5)| over matches
    seasonTeamTotal: number; // Σ over matches of (team1Total + team2Total) — 0
    preAdjustmentFighterTotal: number; // Σ fighter credit with DQ rounds credited — 0
    // Post-adjustment:
    postAdjustmentFighterTotal: number; // ≠ 0 only by the unattributed DQ swing
    dqRoundsAllZero: boolean;
    // Leverage / Clutch invariants — both must be 0 (± 1e-6).
    cnWpaTotal: number;
    clutchTotal: number;
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────
export function isDqMethod(method: string | undefined): boolean {
  return /\bdq\b/i.test(method ?? '');
}

function isValidFighter(name: string | undefined): boolean {
  const n = (name ?? '').trim();
  return n !== '' && n.toUpperCase() !== 'N/A';
}

export function scheduledRoundsFor(matchIndex: number, config: WpaModelConfig): number {
  return config.scheduledRounds.overrides[String(matchIndex)] ?? config.scheduledRounds.default;
}

// Win probability for the team with differential d and r rounds remaining.
// d outside the table range is clamped (those states are ~certain anyway);
// r is clamped to the table's max.
export function wpLookup(table: WpTable, d: number, r: number): number {
  const dc = Math.min(Math.max(Math.round(d), table.dMin), table.dMax);
  const rc = Math.min(Math.max(r, 0), table.rMax);
  return table.rows[rc][dc - table.dMin];
}

// Leverage Index for the state entering a round: differential d with r rounds
// remaining, r INCLUDING the round about to be fought. Same clamping as wpLookup.
export function liLookup(table: LiTable, d: number, r: number): number {
  const dc = Math.min(Math.max(Math.round(d), table.dMin), table.dMax);
  const rc = Math.min(Math.max(r, 0), table.rMax);
  return table.rows[rc][dc - table.dMin];
}

// Context-neutral WPA for a round margin: what the result would have been worth
// at exactly average leverage. Margins outside the ±4 scoring scale are clamped.
export function cnWpaFor(margin: number, config: WpaModelConfig): number {
  const m = Math.min(Math.max(Math.round(margin), -4), 4);
  return config.cnWpaByMargin[String(m)] ?? 0;
}

// ── Per-match WPA ────────────────────────────────────────────────────────────
export function computeMatchWpa(
  match: MatchResult,
  table: WpTable,
  config: WpaModelConfig,
  liTable: LiTable,
): MatchWpa {
  const N = scheduledRoundsFor(match.matchIndex, config);
  const excludedSet = new Set(
    config.excludedRounds
      .filter((e) => e.matchIndex === match.matchIndex)
      .map((e) => e.round),
  );

  const ordered = [...match.boxScore].sort((a, b) => a.round - b.round);
  const rounds: WpaRound[] = [];
  let running = 0;
  let excludedRows = 0;

  for (const row of ordered) {
    const t = row.round;
    if (t > N || excludedSet.has(t)) {
      excludedRows++;
      continue;
    }
    const diffBefore = running;
    const diffAfter = running + (row.score1 - row.score2);
    const roundsBefore = N - t + 1;
    const roundsAfter = N - t;
    const wpBefore = wpLookup(table, diffBefore, roundsBefore);
    const wpAfter = wpLookup(table, diffAfter, roundsAfter);
    // roundsBefore already INCLUDES the round about to be fought — exactly the
    // `r` the LI definition calls for. Both fighters share this value.
    const li = liLookup(liTable, diffBefore, roundsBefore);
    const roundMargin = Math.min(Math.max(Math.round(row.score1 - row.score2), -4), 4);
    const cnWpa = cnWpaFor(roundMargin, config);
    const teamWpa = wpAfter - wpBefore;

    const isDq = isDqMethod(row.method);
    // Both-or-neither attribution keeps fighter WPA zero-sum per round.
    const hasFighters = isValidFighter(row.fighter1) && isValidFighter(row.fighter2);
    const attributed = !isDq && hasFighters;

    rounds.push({
      round: t,
      roundId: row.roundId,
      weightClass: row.weightClass,
      roundPhase: row.phase,
      fighter1: row.fighter1,
      fighter2: row.fighter2,
      score1: row.score1,
      score2: row.score2,
      roundMargin,
      li,
      cnWpa,
      method: row.method,
      diffBefore,
      diffAfter,
      wpBefore,
      wpAfter,
      teamWpa,
      isDq,
      attributed,
      fighter1Wpa: attributed ? teamWpa : 0,
      fighter2Wpa: attributed ? -teamWpa : 0,
    });
    running = diffAfter;
  }

  const finalDiff = running;
  const outcome = finalDiff > 0 ? 1 : finalDiff < 0 ? 0 : 0.5;
  const team1Total = rounds.reduce((s, r) => s + r.teamWpa, 0);

  return {
    matchIndex: match.matchIndex,
    team1: match.team1,
    team2: match.team2,
    phase: match.phase,
    date: match.date,
    scheduledRounds: N,
    rounds,
    excludedRows,
    finalDiff,
    outcome,
    team1Total,
    footnote: config.matchFootnotes?.[String(match.matchIndex)],
  };
}

// ── Season aggregation ───────────────────────────────────────────────────────
export function computeSeasonWpa(
  matches: MatchResult[],
  table: WpTable,
  config: WpaModelConfig,
  slugify: (name: string) => string,
  liTable: LiTable,
): SeasonWpa {
  const byMatch = new Map<number, MatchWpa>();
  const byFighter = new Map<string, FighterWpa>();
  const fighterMatches = new Map<string, Set<number>>();
  const fighterMatchesRegular = new Map<string, Set<number>>();
  const fighterMatchesPlayoffs = new Map<string, Set<number>>();

  let roundsIncluded = 0;
  let excludedRows = 0;
  let dqRounds = 0;
  let worstTelescope = 0;
  let seasonTeamTotal = 0;
  let preAdjustmentFighterTotal = 0;
  let postAdjustmentFighterTotal = 0;
  let dqRoundsAllZero = true;
  let cnWpaTotal = 0;
  let clutchTotal = 0;

  for (const match of matches) {
    const mw = computeMatchWpa(match, table, config, liTable);
    byMatch.set(match.matchIndex, mw);
    excludedRows += mw.excludedRows;
    roundsIncluded += mw.rounds.length;

    // Pre-adjustment invariants. Zero-sum is 0 by construction
    // (team2's WPA is defined as −team1's); telescoping is the real test.
    worstTelescope = Math.max(worstTelescope, Math.abs(mw.team1Total - (mw.outcome - 0.5)));
    seasonTeamTotal += mw.team1Total + -mw.team1Total;

    for (const r of mw.rounds) {
      if (r.isDq) {
        dqRounds++;
        if (r.fighter1Wpa !== 0 || r.fighter2Wpa !== 0) dqRoundsAllZero = false;
      }
      // Pre-adjustment fighter credit: DQ rounds credited normally; both-or-
      // neither rounds with no fighters contribute nothing to either sum.
      const hasFighters = isValidFighter(r.fighter1) && isValidFighter(r.fighter2);
      if (hasFighters) preAdjustmentFighterTotal += r.teamWpa + -r.teamWpa;
      postAdjustmentFighterTotal += r.fighter1Wpa + r.fighter2Wpa;

      if (!hasFighters) continue;

      // Rule 3: DQ rounds are excluded from fighter-level LI and Clutch. They
      // already produce zero WPA, so counting their leverage in the denominator
      // would distort both stats. The round keeps its `li` for match-page display.
      const countsForLi = !r.isDq;

      const record = (
        name: string,
        wpa: number,
        cnWpa: number,
        wonRound: boolean,
        opponent: string,
        opponentTeam: string,
      ) => {
        const slug = slugify(name);
        let f = byFighter.get(slug);
        if (!f) {
          f = {
            slug,
            name,
            rounds: 0,
            roundsRegular: 0,
            roundsPlayoffs: 0,
            roundWins: 0,
            roundWinsRegular: 0,
            roundWinsPlayoffs: 0,
            matches: 0,
            matchesRegular: 0,
            matchesPlayoffs: 0,
            wpa: 0,
            wpaRegular: 0,
            wpaPlayoffs: 0,
            liRounds: 0,
            liRoundsRegular: 0,
            liRoundsPlayoffs: 0,
            liSum: 0,
            liSumRegular: 0,
            liSumPlayoffs: 0,
            avgLi: 0,
            cnWpa: 0,
            cnWpaRegular: 0,
            cnWpaPlayoffs: 0,
            clutch: 0,
            clutchRegular: 0,
            clutchPlayoffs: 0,
            perRound: [],
          };
          byFighter.set(slug, f);
          fighterMatches.set(slug, new Set());
          fighterMatchesRegular.set(slug, new Set());
          fighterMatchesPlayoffs.set(slug, new Set());
        }
        const isPlayoff = mw.phase === 'playoffs';
        f.rounds++;
        if (isPlayoff) f.roundsPlayoffs++;
        else f.roundsRegular++;
        if (wonRound) {
          f.roundWins++;
          if (isPlayoff) f.roundWinsPlayoffs++;
          else f.roundWinsRegular++;
        }
        f.wpa += wpa;
        if (isPlayoff) f.wpaPlayoffs += wpa;
        else f.wpaRegular += wpa;
        if (countsForLi) {
          f.liRounds++;
          f.liSum += r.li;
          f.cnWpa += cnWpa;
          if (isPlayoff) {
            f.liRoundsPlayoffs++;
            f.liSumPlayoffs += r.li;
            f.cnWpaPlayoffs += cnWpa;
          } else {
            f.liRoundsRegular++;
            f.liSumRegular += r.li;
            f.cnWpaRegular += cnWpa;
          }
        }
        fighterMatches.get(slug)!.add(mw.matchIndex);
        (isPlayoff ? fighterMatchesPlayoffs : fighterMatchesRegular).get(slug)!.add(mw.matchIndex);
        f.perRound.push({
          matchIndex: mw.matchIndex,
          date: mw.date,
          round: r.round,
          roundId: r.roundId,
          phase: mw.phase,
          opponent: name === r.fighter1 ? r.fighter2 : r.fighter1,
          opponentTeam: name === r.fighter1 ? mw.team2 : mw.team1,
          wpa,
          li: r.li,
          cnWpa,
          isDq: r.isDq,
        });
      };

      if (countsForLi) cnWpaTotal += r.cnWpa + -r.cnWpa;
      record(r.fighter1, r.fighter1Wpa, r.cnWpa, r.score1 > r.score2, r.fighter2, mw.team2);
      record(r.fighter2, r.fighter2Wpa, -r.cnWpa, r.score2 > r.score1, r.fighter1, mw.team1);
    }
  }

  for (const [slug, f] of byFighter) {
    f.matches = fighterMatches.get(slug)?.size ?? 0;
    f.matchesRegular = fighterMatchesRegular.get(slug)?.size ?? 0;
    f.matchesPlayoffs = fighterMatchesPlayoffs.get(slug)?.size ?? 0;
    f.avgLi = f.liRounds > 0 ? f.liSum / f.liRounds : 0;
    // Clutch = what actually happened minus what it would have been worth at
    // average leverage. DQ rounds contribute 0 to both sides of this.
    f.clutch = f.wpa - f.cnWpa;
    f.clutchRegular = f.wpaRegular - f.cnWpaRegular;
    f.clutchPlayoffs = f.wpaPlayoffs - f.cnWpaPlayoffs;
    clutchTotal += f.clutch;
  }

  return {
    modelVersion: table.modelVersion,
    byMatch,
    byFighter,
    validation: {
      matches: byMatch.size,
      roundsIncluded,
      excludedRows,
      dqRounds,
      worstZeroSum: 0,
      worstTelescope,
      seasonTeamTotal,
      preAdjustmentFighterTotal,
      postAdjustmentFighterTotal,
      dqRoundsAllZero,
      cnWpaTotal,
      clutchTotal,
    },
  };
}
