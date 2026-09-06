// Run: npm test   (node --experimental-strip-types --test scripts/*.test.mjs)
//
// Unit tests for the WAR core (src/lib/war/core.ts). Synthetic inputs only —
// no network, no sheet data. The real 2026 constants are reported live by
// /api/admin/export.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  WIN_VALUE_PER_POINT,
  POINTS_PER_WIN,
  percentileInclusive,
  npprOf,
  leagueBaseline,
  computeWar,
} from '../src/lib/war/core.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const wpaModel = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src/lib/wpa/wpa-model-2026.json'), 'utf8'),
);

// ── The guard that matters most ─────────────────────────────────────────────
// WAR and WPA are both denominated in wins. They stay on one scale only because
// WAR's points-per-win is the reciprocal of the WPA model's own win value for a
// one-point round margin. If someone re-fits the WPA model without updating
// WAR, this fails rather than silently putting the two stats on different
// scales — which is exactly the bug that made WAR 3x too large.
test('points per win is tied to the WPA model constant', () => {
  const modelValue = wpaModel.cnWpaByMargin['1'];
  assert.equal(
    WIN_VALUE_PER_POINT,
    modelValue,
    `WAR's WIN_VALUE_PER_POINT (${WIN_VALUE_PER_POINT}) must equal the WPA model's ` +
      `cnWpaByMargin["1"] (${modelValue}). Update src/lib/war/core.ts if the model was re-fit.`,
  );
  assert.ok(Math.abs(POINTS_PER_WIN - 1 / modelValue) < 1e-12);
  // Sanity: a win costs far more than the average winning margin (~5.6 points).
  assert.ok(POINTS_PER_WIN > 12 && POINTS_PER_WIN < 20, `got ${POINTS_PER_WIN}`);
});

// ── percentileInclusive: Google Sheets PERCENTILE / Excel PERCENTILE.INC ─────
test('percentileInclusive matches the spreadsheet definition', () => {
  const v = [1, 2, 3, 4];
  assert.equal(percentileInclusive(v, 0), 1);
  assert.equal(percentileInclusive(v, 1), 4);
  assert.equal(percentileInclusive(v, 0.5), 2.5);
  // rank = 0.25 * 3 = 0.75 -> 1 + 0.75*(2-1) = 1.75
  assert.equal(percentileInclusive(v, 0.25), 1.75);
  // Unsorted input must give the same answer.
  assert.equal(percentileInclusive([4, 1, 3, 2], 0.25), 1.75);
  assert.equal(percentileInclusive([], 0.25), 0);
  assert.equal(percentileInclusive([7], 0.25), 7);
});

test('npprOf averages net points over rounds', () => {
  assert.equal(npprOf([]), 0);
  assert.equal(npprOf([{ netPts: 1 }, { netPts: 2 }, { netPts: -3 }]), 0);
  assert.equal(npprOf([{ netPts: 2 }, { netPts: 4 }]), 3);
});

// ── computeWar ──────────────────────────────────────────────────────────────
const baseline = { replacementNppr: -0.16, pointsPerWin: POINTS_PER_WIN, avgMargin: 5.6 };

test('computeWar converts production above replacement into wins', () => {
  // A fighter exactly at replacement level adds nothing, however many rounds.
  assert.equal(computeWar(-0.16, 40, baseline), 0);
  // Below replacement is negative; above is positive.
  assert.ok(computeWar(-0.5, 10, baseline) < 0);
  assert.ok(computeWar(1.0, 10, baseline) > 0);
  // Linear in rounds.
  const a = computeWar(1.0, 10, baseline);
  const b = computeWar(1.0, 20, baseline);
  assert.ok(Math.abs(b - 2 * a) < 1e-12);
});

test('computeWar puts Stacia-shaped production near her Win Impact', () => {
  // 19 net points over 13 rounds. Her published WPA is +1.155, and the
  // definitions say WAR should sit a little ABOVE that — by the replacement
  // cushion — rather than 3x it, which is what the old denominator produced.
  const war = computeWar(19 / 13, 13, baseline);
  assert.ok(war > 1.155, `expected WAR above WPA 1.155, got ${war}`);
  assert.ok(war < 1.6, `expected WAR within a few tenths of WPA, got ${war}`);
});

test('computeWar is guarded against a zero denominator', () => {
  assert.equal(computeWar(1.0, 10, { ...baseline, pointsPerWin: 0 }), 0);
});

// ── leagueBaseline ──────────────────────────────────────────────────────────
const history = {
  a: [{ netPts: 2, phase: 'regular' }, { netPts: 2, phase: 'playoffs' }],
  b: [{ netPts: 0, phase: 'regular' }],
  c: [{ netPts: -2, phase: 'regular' }],
  d: [{ netPts: -4, phase: 'regular' }],
};
const matches = [
  { phase: 'regular', result: 'W', score1: 14, score2: 10 }, // margin 4
  { phase: 'regular', result: 'L', score1: 8, score2: 16 },  // margin 8
  { phase: 'regular', result: 'D', score1: 12, score2: 12 }, // draws excluded
  { phase: 'playoffs', result: 'W', score1: 20, score2: 4 }, // margin 16
];

test('leagueBaseline reports both constants and scopes correctly', () => {
  const all = leagueBaseline(history, matches, 'all');
  // NP/R values across all bouts: a 2, b 0, c -2, d -4 -> sorted -4,-2,0,2
  // 25th percentile: rank 0.75 -> -4 + 0.75*2 = -2.5
  assert.equal(all.replacementNppr, -2.5);
  assert.equal(all.avgMargin, (4 + 8 + 16) / 3);
  assert.equal(all.pointsPerWin, POINTS_PER_WIN);

  const reg = leagueBaseline(history, matches, 'regular');
  assert.equal(reg.avgMargin, (4 + 8) / 2, 'playoff match must be out of scope');

  // The two are different quantities and must not be confused again: the
  // average margin moves with the match sample, points-per-win never does.
  assert.notEqual(all.avgMargin, reg.avgMargin);
  assert.equal(all.pointsPerWin, reg.pointsPerWin);
});

test('leagueBaseline degrades safely with no decided matches', () => {
  const b = leagueBaseline(history, [{ phase: 'regular', result: 'D', score1: 1, score2: 1 }], 'all');
  assert.equal(b.avgMargin, 0);
  // A zero avgMargin no longer zeroes WAR — that was the old failure mode.
  assert.ok(computeWar(1.0, 10, b) > 0);
});
