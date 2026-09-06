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
  REPLACEMENT_NPPR,
  REPLACEMENT_TEAM_WIN_PCT,
  percentileInclusive,
  npprOf,
  leagueBaseline,
  computeWar,
} from '../src/lib/war/core.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const wpaModel = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src/lib/wpa/wpa-model-2026.json'), 'utf8'),
);
const wpTable = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src/lib/wpa/wp-table-2026.json'), 'utf8'),
);
const SCHEDULED_ROUNDS = wpaModel.scheduledRounds.default;
const wp = (d, r) => wpTable.rows[r][d - wpTable.dMin];

// The margin a team carrying win probability `target` holds at the opening
// bell, by linear interpolation between the two bracketing integer margins.
function marginForWinPct(target, rounds) {
  let lo = null;
  for (let d = -40; d <= 0; d++) if (wp(d, rounds) <= target) lo = d;
  const hi = lo + 1;
  const frac = (target - wp(lo, rounds)) / (wp(hi, rounds) - wp(lo, rounds));
  return lo + frac;
}

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

// ── The replacement anchor ──────────────────────────────────────────────────
// Replacement level is not a quantile of observed play. It is fixed where a
// whole team of such fighters would win REPLACEMENT_TEAM_WIN_PCT of their
// matches — baseball's convention, translated through our own win-probability
// table. If that table is ever re-fit, this fails rather than leaving the bar
// silently stale.
test('the replacement bar is derived from the win-probability table', () => {
  const margin = marginForWinPct(REPLACEMENT_TEAM_WIN_PCT, SCHEDULED_ROUNDS);
  const derived = margin / SCHEDULED_ROUNDS;
  assert.ok(
    Math.abs(derived - REPLACEMENT_NPPR) < 5e-5,
    `REPLACEMENT_NPPR is ${REPLACEMENT_NPPR} but the table derives ${derived.toFixed(6)} ` +
      `for a ${REPLACEMENT_TEAM_WIN_PCT} team. Update src/lib/war/core.ts.`,
  );
});

test('a replacement team is bad, not mathematically eliminated', () => {
  const d = Math.round(REPLACEMENT_NPPR * SCHEDULED_ROUNDS);
  const winPct = wp(d, SCHEDULED_ROUNDS);
  assert.ok(winPct > 0.2 && winPct < 0.4, `replacement team wins ${winPct}`);
  // The old 25th-percentile bar put replacement at -2.004 NP/R, a rate at which
  // a team loses every match by 48 points and never wins one.
  const oldBar = Math.round(-2.004 * SCHEDULED_ROUNDS);
  assert.ok(wp(oldBar, SCHEDULED_ROUNDS) < 1e-6, 'the old bar should be a 0% team');
  assert.ok(REPLACEMENT_NPPR > -2.004);
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
const baseline = {
  replacementNppr: REPLACEMENT_NPPR,
  pointsPerWin: POINTS_PER_WIN,
  observedP25Nppr: -2.004,
  avgMargin: 11.98,
};

test('computeWar converts production above replacement into wins', () => {
  // A fighter exactly at replacement level adds nothing, however many rounds.
  assert.equal(computeWar(REPLACEMENT_NPPR, 40, baseline), 0);
  // Below replacement is negative; above is positive.
  assert.ok(computeWar(-0.5, 10, baseline) < 0);
  assert.ok(computeWar(1.0, 10, baseline) > 0);
  // Linear in rounds.
  const a = computeWar(1.0, 10, baseline);
  const b = computeWar(1.0, 20, baseline);
  assert.ok(Math.abs(b - 2 * a) < 1e-12);
});

test('computeWar puts Stacia-shaped production just above her WPA', () => {
  // 19 net points over 13 rounds. Her published WPA is +1.155, and the
  // definitions say WAR should sit a little ABOVE that — by the replacement
  // cushion. It read 3.76 under the old denominator and 2.79 once the
  // denominator was fixed but the bar was still the 25th percentile.
  const war = computeWar(19 / 13, 13, baseline);
  assert.ok(war > 1.155, `expected WAR above WPA 1.155, got ${war}`);
  assert.ok(war < 1.35, `expected WAR just above WPA, got ${war}`);
});

test('the cushion no longer makes WAR a durability stat', () => {
  // A fighter at exactly 0.00 NP/R contributes no net points. However many
  // rounds they fight, they should score near zero — under the old bar this
  // was 3.73 WAR over 30 rounds, beating genuinely productive fighters.
  const war = computeWar(0, 30, baseline);
  assert.ok(war < 0.3, `an average 30-round fighter should be near zero, got ${war}`);
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

test('leagueBaseline reports the constants and scopes correctly', () => {
  const all = leagueBaseline(history, matches, 'all');
  // The bar is an anchor, so it does not move with the sample.
  assert.equal(all.replacementNppr, REPLACEMENT_NPPR);
  // NP/R values across all bouts: a 2, b 0, c -2, d -4 -> sorted -4,-2,0,2
  // 25th percentile: rank 0.75 -> -4 + 0.75*2 = -2.5. Reported, not used —
  // and this fixture is exactly the small-sample distortion that motivated
  // anchoring the bar instead of taking a quantile.
  assert.equal(all.observedP25Nppr, -2.5);
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
  assert.equal(b.replacementNppr, REPLACEMENT_NPPR);
  // A zero avgMargin no longer zeroes WAR — that was the old failure mode.
  assert.ok(computeWar(1.0, 10, b) > 0);
});
