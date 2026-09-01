// Run: npm test   (node --experimental-strip-types --test scripts/wpa.test.mjs)
//
// Unit tests for the WPA computation core (src/lib/wpa/core.ts) and the
// committed win-probability table. Everything here runs on the committed JSON
// plus synthetic matches — no network, no sheet data. Live-season validation
// (reference fighter totals, the 8 DQ rounds, season totals) runs against real
// data via /api/admin/wpa-validate.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  wpLookup,
  liLookup,
  cnWpaFor,
  isDqMethod,
  scheduledRoundsFor,
  computeMatchWpa,
  computeSeasonWpa,
} from '../src/lib/wpa/core.ts';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const wpaDir = path.join(root, 'src', 'lib', 'wpa');
const table = JSON.parse(fs.readFileSync(path.join(wpaDir, 'wp-table-2026.json'), 'utf8'));
const liTable = JSON.parse(fs.readFileSync(path.join(wpaDir, 'li-table-2026.json'), 'utf8'));
const model = JSON.parse(fs.readFileSync(path.join(wpaDir, 'wpa-model-2026.json'), 'utf8'));

const slugify = (name) =>
  name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');

// Thin wrappers so every call site passes the LI table.
const computeMatchWpaT = (m, t, mo) => computeMatchWpa(m, t, mo, liTable);
const computeSeasonWpaT = (ms, t, mo, sl) => computeSeasonWpa(ms, t, mo, sl, liTable);

// ── Committed table ──────────────────────────────────────────────────────────

test('committed table matches every model checksum to 6 decimals', () => {
  for (const { d, r, wp } of model.checksums) {
    assert.ok(
      Math.abs(wpLookup(table, d, r) - wp) < 5e-7,
      `WP(${d}, ${r}) = ${wpLookup(table, d, r)} != ${wp}`,
    );
  }
});

test('symmetry WP(d,r) + WP(-d,r) == 1 holds exactly for every cell', () => {
  for (let r = 0; r <= table.rMax; r++) {
    for (let d = table.dMin; d <= table.dMax; d++) {
      assert.equal(wpLookup(table, d, r) + wpLookup(table, -d, r), 1, `asymmetry at d=${d}, r=${r}`);
    }
  }
});

test('r == 0 is deterministic: 1 / 0 / 0.5', () => {
  assert.equal(wpLookup(table, 3, 0), 1);
  assert.equal(wpLookup(table, -3, 0), 0);
  assert.equal(wpLookup(table, 0, 0), 0.5);
});

test('wpLookup clamps out-of-range differentials and rounds', () => {
  assert.equal(wpLookup(table, 500, 10), wpLookup(table, table.dMax, 10));
  assert.equal(wpLookup(table, -500, 10), wpLookup(table, table.dMin, 10));
  assert.equal(wpLookup(table, 3, 99), wpLookup(table, 3, table.rMax));
});

test('methodology worked-example anchors: WP(-2,8) ≈ 25%, WP(+2,7) ≈ 75%', () => {
  assert.ok(Math.abs(wpLookup(table, -2, 8) - 0.25) < 0.03, String(wpLookup(table, -2, 8)));
  assert.ok(Math.abs(wpLookup(table, 2, 7) - 0.75) < 0.03, String(wpLookup(table, 2, 7)));
});

// ── Config plumbing ──────────────────────────────────────────────────────────

test('scheduled rounds: default 24, matches 7 and 48 are 21', () => {
  assert.equal(scheduledRoundsFor(1, model), 24);
  assert.equal(scheduledRoundsFor(7, model), 21);
  assert.equal(scheduledRoundsFor(48, model), 21);
});

test('isDqMethod matches DQ tokens only', () => {
  assert.equal(isDqMethod('DQ'), true);
  assert.equal(isDqMethod('dq'), true);
  assert.equal(isDqMethod('W - DQ'), true);
  assert.equal(isDqMethod('Decision'), false);
  assert.equal(isDqMethod('KO / TKO'), false);
  assert.equal(isDqMethod(undefined), false);
});

// ── Synthetic matches ────────────────────────────────────────────────────────

function bout(round, score1, score2, opts = {}) {
  return {
    round,
    phase: 'Phase 1',
    fighter1: opts.f1 ?? `Alpha ${round}`,
    fighter2: opts.f2 ?? `Bravo ${round}`,
    score1,
    score2,
    winner: score1 > score2 ? 'f1' : score2 > score1 ? 'f2' : '',
    weightClass: 'Lightweight',
    method: opts.method ?? (score1 === score2 ? undefined : 'Decision'),
  };
}

function syntheticMatch(matchIndex, scores, extra = {}) {
  return {
    matchIndex,
    date: '5/1/2026',
    team1: 'Alpha City',
    team2: 'Bravo Town',
    score1: 0,
    score2: 0,
    wins1: 0,
    wins2: 0,
    result: 'W',
    phase: extra.phase ?? 'regular',
    boxScore: scores.map(([s1, s2, opts], i) => bout(i + 1, s1, s2, opts ?? {})),
  };
}

// A 24-round match team1 wins: margins drawn from the margin support.
const WIN_SCORES = [
  [1, 0], [0, 2], [4, 0], [1, 0], [0, 1], [2, 0], [1, 0], [0, 4],
  [1, 0], [1, 0], [0, 1], [3, 0], [1, 0], [0, 0], [1, 0], [0, 2],
  [1, 0], [1, 0], [0, 1], [1, 0], [4, 0], [0, 1], [1, 0], [1, 0],
];
// Mirror image: team1 loses.
const LOSS_SCORES = WIN_SCORES.map(([a, b]) => [b, a]);
// Alternating 1-0 / 0-1: exact draw.
const DRAW_SCORES = Array.from({ length: 24 }, (_, i) => (i % 2 === 0 ? [1, 0] : [0, 1]));

test('zero-sum: every round, fighter1 WPA + fighter2 WPA == 0', () => {
  const mw = computeMatchWpaT(syntheticMatch(1, WIN_SCORES), table, model);
  for (const r of mw.rounds) assert.equal(r.fighter1Wpa + r.fighter2Wpa, 0);
});

test('telescoping: Σ team WPA == outcome − 0.5 (win, loss, draw), tol 1e-9', () => {
  for (const [scores, outcome] of [
    [WIN_SCORES, 1],
    [LOSS_SCORES, 0],
    [DRAW_SCORES, 0.5],
  ]) {
    const mw = computeMatchWpaT(syntheticMatch(1, scores), table, model);
    assert.equal(mw.outcome, outcome);
    assert.ok(
      Math.abs(mw.team1Total - (outcome - 0.5)) < 1e-9,
      `telescope ${mw.team1Total} vs ${outcome - 0.5}`,
    );
  }
});

test('season total across fighters and matches is 0 (pre- and post-adjustment, no DQ)', () => {
  const season = computeSeasonWpaT(
    [syntheticMatch(1, WIN_SCORES), syntheticMatch(2, LOSS_SCORES), syntheticMatch(3, DRAW_SCORES)],
    table,
    model,
    slugify,
  );
  assert.ok(Math.abs(season.validation.seasonTeamTotal) < 1e-12);
  assert.ok(Math.abs(season.validation.postAdjustmentFighterTotal) < 1e-12);
  let sum = 0;
  for (const f of season.byFighter.values()) sum += f.wpa;
  assert.ok(Math.abs(sum) < 1e-12, String(sum));
});

test('DQ round: zero credit both sides, points still shift the differential, telescoping intact', () => {
  const scores = WIN_SCORES.map((s, i) => (i === 9 ? [s[0], s[1], { method: 'DQ' }] : s));
  const mw = computeMatchWpaT(syntheticMatch(1, scores), table, model);
  const dqRound = mw.rounds[9];
  assert.equal(dqRound.isDq, true);
  assert.equal(dqRound.fighter1Wpa, 0);
  assert.equal(dqRound.fighter2Wpa, 0);
  assert.notEqual(dqRound.teamWpa, 0); // the swing still exists at team level
  assert.equal(dqRound.diffAfter - dqRound.diffBefore, scores[9][0] - scores[9][1]);
  // Pre-adjustment telescoping still holds — the DQ only suppresses credit.
  assert.ok(Math.abs(mw.team1Total - (mw.outcome - 0.5)) < 1e-9);
  // Team 1's fighters are short exactly the DQ round's swing (the credit went
  // to nobody), while the all-fighter sum stays 0 — both sides drop together.
  const season = computeSeasonWpaT([syntheticMatch(1, scores)], table, model, slugify);
  let team1Sum = 0;
  let allSum = 0;
  for (const f of season.byFighter.values()) {
    allSum += f.wpa;
    if (f.name.startsWith('Alpha')) team1Sum += f.wpa;
  }
  assert.ok(Math.abs(team1Sum - ((mw.outcome - 0.5) - dqRound.teamWpa)) < 1e-9);
  assert.ok(Math.abs(allSum) < 1e-12);
  assert.equal(season.validation.dqRounds, 1);
  assert.equal(season.validation.dqRoundsAllZero, true);
});

test('rows past the scheduled round count are excluded (match 14 rule)', () => {
  const scores = [...WIN_SCORES, [0, 9]]; // a 25th "administrative" row
  const mw = computeMatchWpaT(syntheticMatch(14, scores), table, model);
  assert.equal(mw.rounds.length, 24);
  assert.equal(mw.excludedRows, 1);
  // Competitive outcome ignores the excluded row.
  assert.equal(mw.outcome, 1);
  assert.ok(Math.abs(mw.team1Total - 0.5) < 1e-9);
  assert.ok(mw.footnote && mw.footnote.length > 0);
});

test('a 0-0 round still moves win probability for the leading team (clock WPA)', () => {
  // Round 14 of WIN_SCORES is 0-0; team1 leads by 4 entering it.
  const mw = computeMatchWpaT(syntheticMatch(1, WIN_SCORES), table, model);
  const r14 = mw.rounds[13];
  assert.equal(r14.score1, 0);
  assert.equal(r14.score2, 0);
  assert.ok(r14.diffBefore > 0);
  assert.ok(r14.teamWpa > 0, `expected positive clock WPA, got ${r14.teamWpa}`);
  // And a 0-0 round in a TIED match is worth exactly 0.
  const tied = computeMatchWpaT(
    syntheticMatch(2, [[0, 0], ...DRAW_SCORES.slice(1)]),
    table,
    model,
  );
  assert.equal(tied.rounds[0].teamWpa, 0);
});

test('a round with no fighter data is carried at team level, assigned to no fighter', () => {
  const scores = WIN_SCORES.map((s, i) =>
    i === 4 ? [s[0], s[1], { f1: 'N/A', f2: 'N/A' }] : s,
  );
  const season = computeSeasonWpaT([syntheticMatch(1, scores)], table, model, slugify);
  const mw = season.byMatch.get(1);
  const r5 = mw.rounds[4];
  assert.equal(r5.attributed, false);
  assert.equal(r5.fighter1Wpa, 0);
  assert.equal(r5.fighter2Wpa, 0);
  assert.ok(Math.abs(mw.team1Total - 0.5) < 1e-9); // telescoping unaffected
  for (const f of season.byFighter.values()) {
    assert.ok(!f.perRound.some((p) => p.round === 5));
  }
});

test('scheduled-round override: a 21-round match telescopes with N = 21', () => {
  const mw = computeMatchWpaT(syntheticMatch(7, WIN_SCORES.slice(0, 21)), table, model);
  assert.equal(mw.scheduledRounds, 21);
  assert.equal(mw.rounds.length, 21);
  assert.ok(Math.abs(mw.team1Total - (mw.outcome - 0.5)) < 1e-9);
});

test('fighter aggregation: rounds, round wins, matches, per-phase split', () => {
  const season = computeSeasonWpaT(
    [
      syntheticMatch(1, [[1, 0, { f1: 'Solo Star', f2: 'Foe One' }]]),
      syntheticMatch(2, [[0, 2, { f1: 'Solo Star', f2: 'Foe Two' }]], { phase: 'playoffs' }),
    ],
    table,
    model,
    slugify,
  );
  const star = season.byFighter.get('solo-star');
  assert.equal(star.rounds, 2);
  assert.equal(star.roundWins, 1);
  assert.equal(star.matches, 2);
  assert.ok(Math.abs(star.wpa - (star.wpaRegular + star.wpaPlayoffs)) < 1e-12);
  assert.equal(star.perRound.length, 2);
  assert.equal(star.perRound[1].phase, 'playoffs');
});

// ── Leverage Index & Clutch ──────────────────────────────────────────────────

test('committed LI table matches every model checksum to 3 decimals', () => {
  for (const { d, r, li } of model.liChecksums) {
    assert.ok(
      Math.abs(liLookup(liTable, d, r) - li) < 5e-4,
      `LI(${d}, ${r}) = ${liLookup(liTable, d, r)} != ${li}`,
    );
  }
});

test('LI is symmetric: LI(d,r) == LI(-d,r) for every cell', () => {
  for (let r = 1; r <= liTable.rMax; r++) {
    for (let d = liTable.dMin; d <= liTable.dMax; d++) {
      assert.equal(liLookup(liTable, d, r), liLookup(liTable, -d, r), `asymmetry at d=${d}, r=${r}`);
    }
  }
});

test('max LI over the whole grid is 6.625 — tied match, one round left', () => {
  let max = 0;
  for (let r = 1; r <= liTable.rMax; r++) {
    for (let d = liTable.dMin; d <= liTable.dMax; d++) max = Math.max(max, liLookup(liTable, d, r));
  }
  assert.ok(Math.abs(max - 6.625) < 5e-4, String(max));
  assert.ok(Math.abs(liLookup(liTable, 0, 1) - 6.625) < 5e-4);
});

test('LI collapses to 0.000 in a genuine blowout and rises as a tied match runs out', () => {
  assert.ok(liLookup(liTable, 15, 4) < 0.0005);
  const tied = [24, 12, 4, 2, 1].map((r) => liLookup(liTable, 0, r));
  for (let i = 1; i < tied.length; i++) {
    assert.ok(tied[i] > tied[i - 1], `LI should rise as rounds run out: ${tied}`);
  }
});

test('cnWPA table reproduces from (WP(v,23) - 0.5) * CN_SCALE and is symmetric', () => {
  for (let v = -4; v <= 4; v++) {
    const derived = (wpLookup(table, v, 23) - 0.5) * model.cnScale;
    assert.ok(
      Math.abs(cnWpaFor(v, model) - derived) < 5e-7,
      `cnWPA(${v}) = ${cnWpaFor(v, model)} != ${derived}`,
    );
    assert.ok(Math.abs(cnWpaFor(v, model) + cnWpaFor(-v, model)) < 1e-12, `asymmetry at ${v}`);
  }
  assert.equal(cnWpaFor(0, model), 0);
  // Margins beyond the ±4 scoring scale clamp rather than returning undefined.
  assert.equal(cnWpaFor(9, model), cnWpaFor(4, model));
});

test('OFF-BY-ONE GUARD: r includes the round about to be fought', () => {
  // Round 1 of a tied 24-round match must face LI(0, 24) — not LI(0, 23).
  const mw = computeMatchWpaT(syntheticMatch(1, DRAW_SCORES), table, model);
  assert.ok(Math.abs(mw.rounds[0].li - 1.319) < 5e-4, `round 1 LI = ${mw.rounds[0].li}`);
  assert.equal(mw.rounds[0].li, liLookup(liTable, 0, 24));
  // The final round of a still-TIED match is the maximum-leverage situation.
  // DRAW_SCORES alternates, so it sits at +1 entering round 24 (LI 3.766, not
  // 6.625) — build a scenario that is genuinely level instead: 22 alternating
  // rounds net to 0, then a 0-0 round, then the decider.
  const tiedEntering = [...DRAW_SCORES.slice(0, 22), [0, 0], [1, 0]];
  const decider = computeMatchWpaT(syntheticMatch(1, tiedEntering), table, model);
  const last = decider.rounds[decider.rounds.length - 1];
  assert.equal(last.round, 24);
  assert.equal(last.diffBefore, 0);
  assert.ok(Math.abs(last.li - 6.625) < 5e-4, `final round LI = ${last.li}`);
});

test('both fighters in a round face identical LI', () => {
  const season = computeSeasonWpaT([syntheticMatch(1, WIN_SCORES)], table, model, slugify);
  const mw = season.byMatch.get(1);
  for (const r of mw.rounds) {
    const f1 = season.byFighter.get(slugify(r.fighter1)).perRound.find((p) => p.round === r.round);
    const f2 = season.byFighter.get(slugify(r.fighter2)).perRound.find((p) => p.round === r.round);
    assert.equal(f1.li, f2.li, `LI differs between fighters at round ${r.round}`);
    assert.equal(f1.li, r.li);
  }
});

test('league-wide Σ cnWPA and Σ Clutch are both 0 (tol 1e-6)', () => {
  const season = computeSeasonWpaT(
    [syntheticMatch(1, WIN_SCORES), syntheticMatch(2, LOSS_SCORES), syntheticMatch(3, DRAW_SCORES)],
    table,
    model,
    slugify,
  );
  assert.ok(Math.abs(season.validation.cnWpaTotal) < 1e-6, String(season.validation.cnWpaTotal));
  assert.ok(Math.abs(season.validation.clutchTotal) < 1e-6, String(season.validation.clutchTotal));
  let cn = 0;
  let clutch = 0;
  for (const f of season.byFighter.values()) {
    cn += f.cnWpa;
    clutch += f.clutch;
  }
  assert.ok(Math.abs(cn) < 1e-6, String(cn));
  assert.ok(Math.abs(clutch) < 1e-6, String(clutch));
});

test('Clutch == WPA − cnWPA, and avgLi == liSum / liRounds', () => {
  const season = computeSeasonWpaT([syntheticMatch(1, WIN_SCORES)], table, model, slugify);
  for (const f of season.byFighter.values()) {
    assert.ok(Math.abs(f.clutch - (f.wpa - f.cnWpa)) < 1e-12);
    assert.ok(Math.abs(f.avgLi - f.liSum / f.liRounds) < 1e-12);
    assert.ok(Math.abs(f.clutch - (f.clutchRegular + f.clutchPlayoffs)) < 1e-12);
  }
});

test('DQ round: excluded from fighter LI/cnWPA/Clutch, but the round keeps its LI', () => {
  const scores = WIN_SCORES.map((s, i) => (i === 9 ? [s[0], s[1], { method: 'DQ' }] : s));
  const season = computeSeasonWpaT([syntheticMatch(1, scores)], table, model, slugify);
  const dqRound = season.byMatch.get(1).rounds[9];
  assert.equal(dqRound.isDq, true);
  // The situation still had stakes — the match page shows this.
  assert.ok(dqRound.li > 0, `DQ round should still carry an LI, got ${dqRound.li}`);
  // ...but neither fighter's aggregates count it.
  const f = season.byFighter.get(slugify(dqRound.fighter1));
  assert.equal(f.rounds, 1);    // appeared
  assert.equal(f.liRounds, 0);  // but not counted for LI/Clutch
  assert.equal(f.liSum, 0);
  assert.equal(f.cnWpa, 0);
  assert.equal(f.avgLi, 0);
  assert.equal(f.clutch, 0);
});

test('a fighter with a DQ round shows fewer LI rounds than WPA rounds (Sumpter case)', () => {
  // Same fighter in two rounds of one match, one of them a DQ.
  const m = syntheticMatch(1, [
    [1, 0, { f1: 'Solo Star', f2: 'Foe One' }],
    [0, 1, { f1: 'Solo Star', f2: 'Foe Two', method: 'DQ' }],
    ...WIN_SCORES.slice(2),
  ]);
  const season = computeSeasonWpaT([m], table, model, slugify);
  const star = season.byFighter.get('solo-star');
  assert.equal(star.rounds, 2);   // WPA-leaderboard count
  assert.equal(star.liRounds, 1); // LI / Clutch count
});

test('scheduled-round override changes LI: round 1 of a 21-round tied match', () => {
  const mw = computeMatchWpaT(syntheticMatch(7, DRAW_SCORES.slice(0, 21)), table, model);
  assert.equal(mw.scheduledRounds, 21);
  assert.equal(mw.rounds[0].li, liLookup(liTable, 0, 21));
  assert.notEqual(mw.rounds[0].li, liLookup(liTable, 0, 24));
});

test('a 0-0 round carries real LI and its cnWPA is exactly 0', () => {
  const mw = computeMatchWpaT(syntheticMatch(1, WIN_SCORES), table, model);
  const r14 = mw.rounds[13];
  assert.equal(r14.score1, 0);
  assert.equal(r14.score2, 0);
  assert.ok(r14.li > 0, `0-0 round should still have leverage, got ${r14.li}`);
  assert.equal(r14.roundMargin, 0);
  assert.equal(r14.cnWpa, 0);
});
