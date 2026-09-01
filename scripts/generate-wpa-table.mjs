// Run once: node scripts/generate-wpa-table.mjs
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

const out = {
  modelVersion: model.version,
  season: model.season,
  dMin,
  dMax,
  rMax,
  rows,
};
const outPath = path.join(wpaDir, 'wp-table-2026.json');
fs.writeFileSync(outPath, JSON.stringify(out));
const kb = (fs.statSync(outPath).size / 1024).toFixed(0);
console.log(`✓ wrote ${path.relative(root, outPath)} (${kb} KB, ${rows.length} × ${dMax - dMin + 1} cells, model ${model.version})`);
