// Run once: node scripts/generate-wpa-table.mjs   (npm run gen:wpa)
//
// Generates the WPA win-probability lookup table (src/lib/wpa/wp-table-2026.json)
// from the versioned model config (src/lib/wpa/wpa-model-2026.json).
//
// Model (implement exactly — do not "improve"):
//   Stage 1: convolve the fixed per-round margin distribution r times, shift by
//            the current differential d, then P = P(final > 0) + 0.5 * P(final == 0).
//   Stage 2: sharpen — WP = sigmoid(GAMMA * logit(P)), with P clamped to
//            [1e-12, 1 - 1e-12]. r == 0 stays deterministic (1 / 0 / 0.5).
//
// The script verifies every checksum in the config (6 decimals) and exact
// symmetry WP(d,r) + WP(-d,r) == 1 before writing; it exits non-zero on any
// mismatch so a bad table can never be committed silently.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const wpaDir = path.join(root, 'src', 'lib', 'wpa');
const model = JSON.parse(fs.readFileSync(path.join(wpaDir, 'wpa-model-2026.json'), 'utf8'));

const GAMMA = model.gamma;
const margin = Object.entries(model.marginDistribution).map(([m, p]) => [Number(m), p]);
const { dMin, dMax, rMax } = model.table;

// Sanity: the margin distribution must sum to 1 and be symmetric.
{
  const total = margin.reduce((s, [, p]) => s + p, 0);
  if (Math.abs(total - 1) > 1e-9) throw new Error(`margin distribution sums to ${total}, not 1`);
  const byM = new Map(margin);
  for (const [m, p] of margin) {
    if (byM.get(-m) !== p) throw new Error(`margin distribution asymmetric at ${m}`);
  }
}

function baseline(d, r) {
  if (r === 0) return d > 0 ? 1 : d < 0 ? 0 : 0.5;
  // Distribution over the future point swing: start at {0: 1}, convolve r times.
  let dist = new Map([[0, 1]]);
  for (let i = 0; i < r; i++) {
    const next = new Map();
    for (const [s, p] of dist) {
      for (const [m, q] of margin) {
        const k = s + m;
        next.set(k, (next.get(k) ?? 0) + p * q);
      }
    }
    dist = next;
  }
  let win = 0;
  let tie = 0;
  for (const [s, p] of dist) {
    const final = d + s;
    if (final > 0) win += p;
    else if (final === 0) tie += p;
  }
  // Half credit for a tie: TBL matches can end in a draw.
  return win + 0.5 * tie;
}

function sharpen(p) {
  const c = Math.min(Math.max(p, 1e-12), 1 - 1e-12);
  const logit = Math.log(c / (1 - c));
  return 1 / (1 + Math.exp(-GAMMA * logit));
}

// Build rows[r][d - dMin]. Compute d >= 0 and mirror the negative side as
// 1 - WP(d) so symmetry holds EXACTLY in floating point.
const rows = [];
for (let r = 0; r <= rMax; r++) {
  const row = new Array(dMax - dMin + 1);
  for (let d = 0; d <= dMax; d++) {
    // d == 0 is exactly 0.5 for every r: the margin distribution is symmetric,
    // so this is the mathematically exact value (floating-point convolution
    // drift would otherwise leave it a few ulps off).
    const wp = d === 0 ? 0.5 : r === 0 ? 1 : sharpen(baseline(d, r));
    row[d - dMin] = wp;
    if (d > 0) row[-d - dMin] = 1 - wp;
  }
  rows.push(row);
}

const wp = (d, r) => rows[r][d - dMin];

// ── Verify checksums (6 decimals) ──
let failures = 0;
for (const { d, r, wp: want } of model.checksums) {
  const got = wp(d, r);
  const ok = Math.abs(got - want) < 5e-7;
  console.log(`${ok ? '✓' : '✗'} WP(${String(d).padStart(3)}, ${String(r).padStart(2)}) = ${got.toFixed(6)} (expected ${want.toFixed(6)})`);
  if (!ok) failures++;
}

// ── Verify exact symmetry across the whole grid ──
for (let r = 0; r <= rMax; r++) {
  for (let d = dMin; d <= dMax; d++) {
    if (wp(d, r) + wp(-d, r) !== 1) {
      console.error(`✗ symmetry broken at d=${d}, r=${r}`);
      failures++;
    }
  }
}
if (failures === 0) console.log('✓ symmetry WP(d,r) + WP(-d,r) == 1 holds exactly for every cell');

if (failures > 0) {
  console.error(`\n${failures} verification failure(s) — table NOT written.`);
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Leverage Index — how much win probability is at stake BEFORE a round is
// fought. A property of the situation: both fighters in a round share it.
//
//   rawLI(d, r) = SUM over margins v of [ P(v) * | WP(d + v, r - 1) - WP(d, r) | ]
//   LI(d, r)    = rawLI(d, r) / LI_NORMALIZER
//
// r INCLUDES the round about to be fought. LI_NORMALIZER is the frozen mean
// rawLI over the 2026 season — never recomputed per season, so an LI of 1.20
// means the same thing in every year.
const LI_NORM = model.liNormalizer;
if (!LI_NORM) throw new Error('liNormalizer missing from model config');

// Clamped WP accessor: d + margin can run past the table edge for extreme
// differentials (|d| >= dMax - 4). Those states are already certainty, so
// clamping is exact rather than an approximation.
const wpC = (d, r) => wp(Math.min(Math.max(d, dMin), dMax), r);

const liRows = [];
for (let r = 0; r <= rMax; r++) {
  const row = new Array(dMax - dMin + 1).fill(0);
  // r === 0 means there is no round left to fight — LI undefined; leave zeroed.
  if (r > 0) {
    for (let d = 0; d <= dMax; d++) {
      let raw = 0;
      for (const [m, q] of margin) raw += q * Math.abs(wpC(d + m, r - 1) - wpC(d, r));
      const value = raw / LI_NORM;
      row[d - dMin] = value;
      // Mirror so LI(d,r) === LI(-d,r) holds EXACTLY in floating point.
      if (d > 0) row[-d - dMin] = value;
    }
  }
  liRows.push(row);
}
const li = (d, r) => liRows[r][d - dMin];

let liFailures = 0;
for (const { d, r, li: want } of model.liChecksums) {
  const got = li(d, r);
  const ok = Math.abs(got - want) < 5e-4; // 3 decimals
  console.log(`${ok ? '✓' : '✗'} LI(${String(d).padStart(3)}, ${String(r).padStart(2)}) = ${got.toFixed(3)} (expected ${want.toFixed(3)})`);
  if (!ok) liFailures++;
}
for (let r = 1; r <= rMax; r++) {
  for (let d = dMin; d <= dMax; d++) {
    if (li(d, r) !== li(-d, r)) {
      console.error(`✗ LI symmetry broken at d=${d}, r=${r}`);
      liFailures++;
    }
  }
}
if (liFailures === 0) console.log('✓ symmetry LI(d,r) == LI(-d,r) holds exactly for every cell');

// The most important situation possible in TBL: tied match, one round left.
const liMax = Math.max(...liRows.flat());
if (Math.abs(liMax - 6.625) > 5e-4) {
  console.error(`✗ max LI is ${liMax.toFixed(3)}, expected 6.625`);
  liFailures++;
} else {
  console.log(`✓ max LI = ${liMax.toFixed(3)} (tied match, one round left)`);
}

if (liFailures > 0) {
  console.error(`\n${liFailures} LI verification failure(s) — tables NOT written.`);
  process.exit(1);
}

const meta = { modelVersion: model.version, season: model.season, dMin, dMax, rMax };
const write = (name, payload, label) => {
  const outPath = path.join(wpaDir, name);
  fs.writeFileSync(outPath, JSON.stringify(payload));
  const kb = (fs.statSync(outPath).size / 1024).toFixed(0);
  console.log(`✓ wrote ${path.relative(root, outPath)} (${kb} KB, ${label}, model ${model.version})`);
};
write('wp-table-2026.json', { ...meta, rows }, `${rows.length} × ${dMax - dMin + 1} cells`);
write('li-table-2026.json', { ...meta, liNormalizer: LI_NORM, rows: liRows }, `${liRows.length} × ${dMax - dMin + 1} cells`);
