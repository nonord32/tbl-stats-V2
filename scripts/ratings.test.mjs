// Run: npm test   (node --experimental-strip-types --test scripts/*.test.mjs)
//
// Unit tests for the opponent-adjusted ratings core (src/lib/ratings/core.ts).
// Synthetic leagues only — no network, no sheet data. The real 2026 figures
// (the SOS and aNPPR verification tables, the correlation assertion, the
// bootstrap spread) are checked against live data by /api/admin/ratings-validate.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  computeSeasonRatings,
  solveRidge,
  pairRounds,
  buildPairMap,
  computeSos,
  correlation,
  makeRng,
} from '../src/lib/ratings/core.ts';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const model = JSON.parse(
  fs.readFileSync(path.join(root, 'src', 'lib', 'ratings', 'ratings-model-2026.json'), 'utf8'),
);

const slugify = (name) =>
  name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');

const CONFIG = {
  lambda: model.lambda,
  bootstrapSamples: 40, // fewer than production; these tests only need the shape
  bootstrapSeed: model.bootstrapSeed,
  intervalLow: model.intervalLow,
  intervalHigh: model.intervalHigh,
  minRounds: 1,
  meaningfulDiff: model.meaningfulDiff,
  flagBootSd: model.flagBootSd,
};

// ── Synthetic league builder ─────────────────────────────────────────────────
// `rounds` is a list of { m, r, a, b, margin } — match, round id, the two
// fighter names, and the margin from a's side. Everything else (history rows,
// NPPR numerators and denominators) is derived exactly the way src/lib/data.ts
// and warStats.ts derive them, so the fixtures cannot drift from the real shape.
function league(rounds, extraBouts = []) {
  const history = {};
  const push = (name, opponent, netPts, m, r) => {
    const slug = slugify(name);
    if (!history[slug]) history[slug] = [];
    history[slug].push({ opponent, netPts, matchIndex: m, roundId: r });
  };
  for (const { m, r, a, b, margin } of rounds) {
    push(a, b, margin, m, r);
    push(b, a, -margin, m, r);
  }
  // Bouts with no opposite side, e.g. an opponent recorded as N/A.
  for (const { m, r, a, opponent, margin } of extraBouts) {
    push(a, opponent, margin, m, r);
  }

  const names = new Map();
  for (const { a, b } of rounds) {
    names.set(slugify(a), a);
    names.set(slugify(b), b);
  }
  for (const { a } of extraBouts) names.set(slugify(a), a);

  const fighters = [...names.entries()].map(([slug, name]) => {
    const bouts = history[slug] ?? [];
    const netPts = bouts.reduce((s, x) => s + x.netPts, 0);
    const n = bouts.length;
    return {
      slug,
      name,
      team: 'Test',
      weightClass: 'Featherweight',
      gender: 'M',
      rounds: n,
      netPts,
      nppr: n > 0 ? netPts / n : 0,
    };
  });
  return { fighters, history };
}

const run = (l, overrides = {}) =>
  computeSeasonRatings(l.fighters, l.history, { ...CONFIG, ...overrides }, slugify);

// A round-robin where every fighter goes exactly even.
function balancedRoundRobin(names) {
  const rounds = [];
  let id = 1;
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      rounds.push({ m: id, r: id, a: names[i], b: names[j], margin: 1 });
      id++;
      rounds.push({ m: id, r: id, a: names[i], b: names[j], margin: -1 });
      id++;
    }
  }
  return rounds;
}

// ── The solver ───────────────────────────────────────────────────────────────

// Independent dense reference: build X'X + lambda*I explicitly and factor it.
// If CG and Cholesky agree, the matrix-free product is right.
function choleskyReference(rows, n, lambda) {
  const A = new Float64Array(n * n);
  const b = new Float64Array(n);
  for (const { a, b: bb, y } of rows) {
    A[a * n + a] += 1;
    A[bb * n + bb] += 1;
    A[a * n + bb] -= 1;
    A[bb * n + a] -= 1;
    b[a] += y;
    b[bb] -= y;
  }
  for (let i = 0; i < n; i++) A[i * n + i] += lambda;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = A[i * n + j];
      for (let k = 0; k < j; k++) sum -= A[i * n + k] * A[j * n + k];
      A[i * n + j] = i === j ? Math.sqrt(sum) : sum / A[j * n + j];
    }
  }
  const z = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = b[i];
    for (let k = 0; k < i; k++) s -= A[i * n + k] * z[k];
    z[i] = s / A[i * n + i];
  }
  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let s = z[i];
    for (let k = i + 1; k < n; k++) s -= A[k * n + i] * x[k];
    x[i] = s / A[i * n + i];
  }
  return x;
}

test('solver: conjugate gradient matches a dense Cholesky factorization', () => {
  const rng = makeRng(99);
  const n = 40;
  const rows = [];
  for (let i = 0; i < 400; i++) {
    const a = (rng() * n) | 0;
    let b = (rng() * n) | 0;
    if (a === b) b = (b + 1) % n;
    rows.push({ a, b, y: Math.round(rng() * 8 - 4) });
  }
  const cg = solveRidge(rows, n, 5.0, null).theta;
  const chol = choleskyReference(rows, n, 5.0);
  for (let i = 0; i < n; i++) assert.ok(Math.abs(cg[i] - chol[i]) < 1e-9, `fighter ${i} diverged`);
});

test('solver: row orientation does not change the ratings', () => {
  const rng = makeRng(7);
  const n = 25;
  const rows = [];
  for (let i = 0; i < 200; i++) {
    const a = (rng() * n) | 0;
    let b = (rng() * n) | 0;
    if (a === b) b = (b + 1) % n;
    rows.push({ a, b, y: Math.round(rng() * 6 - 3) });
  }
  // Flip every other row: swap the pair and negate the margin.
  const flipped = rows.map((r, i) => (i % 2 ? { a: r.b, b: r.a, y: -r.y } : r));
  const base = solveRidge(rows, n, 5.0, null).theta;
  const alt = solveRidge(flipped, n, 5.0, null).theta;
  for (let i = 0; i < n; i++) assert.ok(Math.abs(base[i] - alt[i]) < 1e-10);
});

test('aNPPR: a perfectly balanced round-robin rates everyone at zero', () => {
  const season = run(league(balancedRoundRobin(['A A', 'B B', 'C C', 'D D'])));
  for (const f of season.byFighter.values()) {
    assert.ok(Math.abs(f.anppr) < 1e-9, `${f.name} should be neutral, got ${f.anppr}`);
    assert.ok(Math.abs(f.nppr) < 1e-9);
  }
});

test('aNPPR: ridge shrinks a small sample harder than a large one', () => {
  // Two fighters with identical raw NPPR (+2.0) against the same pool, but one
  // has 12 rounds of evidence and the other has 1.
  const rounds = balancedRoundRobin(['P1 X', 'P2 X', 'P3 X', 'P4 X']);
  let id = 500;
  const pool = ['P1 X', 'P2 X', 'P3 X', 'P4 X'];
  for (let i = 0; i < 12; i++) {
    rounds.push({ m: id, r: id, a: 'Big Sample', b: pool[i % 4], margin: 2 });
    id++;
  }
  rounds.push({ m: id, r: id, a: 'Small Sample', b: pool[0], margin: 2 });

  const season = run(league(rounds));
  const big = season.byFighter.get(slugify('Big Sample'));
  const small = season.byFighter.get(slugify('Small Sample'));
  assert.equal(big.nppr, 2);
  assert.equal(small.nppr, 2);
  assert.ok(
    small.anppr < big.anppr,
    `small sample ${small.anppr} should shrink below big sample ${big.anppr}`,
  );
  assert.ok(Math.abs(small.anppr) < Math.abs(small.nppr), 'shrinkage should pull toward zero');
});

// ── Round pairing ────────────────────────────────────────────────────────────

test('pairing: an N/A-opponent bout is excluded from the regression but still counts in NPPR', () => {
  const l = league(
    [
      { m: 1, r: 1, a: 'Real One', b: 'Real Two', margin: 2 },
      { m: 1, r: 2, a: 'Real One', b: 'Real Two', margin: -1 },
    ],
    [{ m: 1, r: 3, a: 'Real One', opponent: 'N/A', margin: 4 }],
  );
  const paired = pairRounds(l.history);
  assert.equal(paired.rows.length, 2, 'only the two-sided rounds enter the regression');
  assert.equal(paired.unpairedBouts, 1);

  const season = run(l);
  const one = season.byFighter.get(slugify('Real One'));
  assert.equal(one.rounds, 3, 'NPPR still counts the N/A round');
  assert.ok(Math.abs(one.nppr - 5 / 3) < 1e-12, 'and its points, so NPPR is 5 over 3 rounds');
  assert.equal(one.ratedRounds, 2, 'but only two rounds are rated');
  assert.equal(season.summary.pairedRounds, 2);
});

test('pairing: a round whose two sides disagree on net points is flagged, not silently kept', () => {
  const history = {
    'a-one': [{ opponent: 'B One', netPts: 3, matchIndex: 1, roundId: 1 }],
    'b-one': [{ opponent: 'A One', netPts: 1, matchIndex: 1, roundId: 1 }], // should be -3
  };
  const paired = pairRounds(history);
  assert.equal(paired.rows.length, 1);
  assert.equal(paired.asymmetricRounds, 1);
});

// ── Strength of Schedule ─────────────────────────────────────────────────────

test('SOS: excluding head-to-head rounds fires — a repeat beating stops depressing the beater', () => {
  // "Punching Bag" is a genuinely average fighter against everyone else, but
  // gets beaten repeatedly by Dominant. Without the exclusion, Dominant's own
  // beatings drag Punching Bag's NPPR down and so drag Dominant's SOS down too.
  const rounds = [];
  let id = 1;
  for (let i = 0; i < 6; i++) {
    rounds.push({ m: 1, r: id++, a: 'Dominant Fighter', b: 'Punching Bag', margin: 4 });
  }
  for (let i = 0; i < 6; i++) {
    rounds.push({ m: 2, r: id++, a: 'Punching Bag', b: `Filler ${i}`, margin: i % 2 ? 1 : -1 });
  }
  const l = league(rounds);
  const season = run(l);

  const totals = new Map(l.fighters.map((f) => [f.slug, { netPts: f.netPts, rounds: f.rounds }]));
  const bag = totals.get(slugify('Punching Bag'));
  const naive = bag.netPts / bag.rounds; // what SOS would be without the exclusion

  const dominant = season.byFighter.get(slugify('Dominant Fighter'));
  // Punching Bag is exactly even against everyone who is not Dominant.
  assert.ok(Math.abs(dominant.sos) < 1e-9, `excluded SOS should be ~0, got ${dominant.sos}`);
  assert.ok(naive < -1.9, `naive opponent NPPR should be badly depressed, got ${naive}`);
  assert.ok(
    dominant.sos - naive > 1.9,
    'the exclusion must move the number substantially, not cosmetically',
  );
});

test('SOS: an opponent with no rounds left after exclusion is skipped entirely', () => {
  // "Only Ever Faced Me" fought nobody else, so removing the head-to-head
  // rounds leaves them with a zero denominator.
  const l = league([
    { m: 1, r: 1, a: 'Main Fighter', b: 'Only Ever Faced Me', margin: 3 },
    { m: 1, r: 2, a: 'Main Fighter', b: 'Only Ever Faced Me', margin: 3 },
    { m: 2, r: 3, a: 'Main Fighter', b: 'Broad Schedule', margin: -1 },
    { m: 2, r: 4, a: 'Broad Schedule', b: 'Third Party', margin: 2 },
  ]);
  const season = run(l);
  const main = season.byFighter.get(slugify('Main Fighter'));
  assert.equal(main.sosOpponents, 1, 'only Broad Schedule survives the exclusion');

  // Broad Schedule's NPPR with the Main Fighter rounds removed: +2 over 1 round.
  assert.ok(Math.abs(main.sos - 2) < 1e-9, `expected +2.000, got ${main.sos}`);

  // The other direction still resolves: Only Ever Faced Me's single opponent
  // keeps one round after their head-to-head comes out, so the exclusion
  // narrows the sample rather than erasing it.
  // Main Fighter: 5 net over 3 rounds; drop the 6 net across 2 head-to-head
  // rounds and -1 over 1 round remains.
  const orphan = season.byFighter.get(slugify('Only Ever Faced Me'));
  assert.ok(Math.abs(orphan.sos + 1) < 1e-9, `expected -1.000, got ${orphan.sos}`);
});

test('SOS: a pair who fought only each other leaves both sides without a schedule', () => {
  const l = league([
    { m: 1, r: 1, a: 'Isolated One', b: 'Isolated Two', margin: 3 },
    { m: 1, r: 2, a: 'Isolated One', b: 'Isolated Two', margin: -1 },
  ]);
  const season = run(l);
  for (const name of ['Isolated One', 'Isolated Two']) {
    const f = season.byFighter.get(slugify(name));
    assert.equal(f.sos, null, `${name} has nothing left once the head-to-head comes out`);
    assert.equal(f.sosOpponents, 0);
  }
});

test('SOS: opponents are weighted by how many rounds were fought against them', () => {
  // Faced Often three times, Faced Once once. Each opponent has outside rounds
  // that set their excluded NPPR to a known value: +2.0 and -2.0.
  const l = league([
    { m: 1, r: 1, a: 'Weigher', b: 'Faced Often', margin: 0 },
    { m: 1, r: 2, a: 'Weigher', b: 'Faced Often', margin: 0 },
    { m: 1, r: 3, a: 'Weigher', b: 'Faced Often', margin: 0 },
    { m: 1, r: 4, a: 'Weigher', b: 'Faced Once', margin: 0 },
    { m: 2, r: 5, a: 'Faced Often', b: 'Outsider One', margin: 2 },
    { m: 2, r: 6, a: 'Faced Once', b: 'Outsider Two', margin: -2 },
  ]);
  const season = run(l);
  const w = season.byFighter.get(slugify('Weigher'));
  // (3 * (+2.0) + 1 * (-2.0)) / 4 = +1.0
  assert.ok(Math.abs(w.sos - 1) < 1e-9, `expected +1.000, got ${w.sos}`);
  assert.equal(w.sosOpponents, 2);
});

test('SOS: the pair map keys on the opponent, and reports a head-to-head count mismatch', () => {
  const l = league([
    { m: 1, r: 1, a: 'One Side', b: 'Other Side', margin: 2 },
    { m: 1, r: 2, a: 'One Side', b: 'Other Side', margin: -2 },
  ]);
  const pairs = buildPairMap(l.history, slugify);
  const other = pairs.get(`${slugify('Other Side')}|${slugify('One Side')}`);
  assert.equal(other.k, 2);
  assert.equal(other.net, 0, "the opponent's net points against us, from their side");

  const totals = new Map(l.fighters.map((f) => [f.slug, { netPts: f.netPts, rounds: f.rounds }]));
  const res = computeSos(
    slugify('One Side'),
    l.history[slugify('One Side')],
    totals,
    pairs,
    slugify,
  );
  assert.equal(res.sos, null, 'the only opponent has nothing left after exclusion');
  assert.equal(res.countMismatches, 0);
});

// ── Bootstrap ────────────────────────────────────────────────────────────────

test('bootstrap: the same seed produces identical intervals across runs', () => {
  const l = league(balancedRoundRobin(['S1 A', 'S2 A', 'S3 A', 'S4 A', 'S5 A']));
  const a = run(l);
  const b = run(l);
  for (const [slug, ra] of a.byFighter) {
    const rb = b.byFighter.get(slug);
    assert.equal(ra.bootSd, rb.bootSd, `${slug} bootSd drifted between runs`);
    assert.equal(ra.lo, rb.lo);
    assert.equal(ra.hi, rb.hi);
  }
  // And a different seed genuinely resamples.
  const c = run(l, { bootstrapSeed: 424242 });
  const anyDifferent = [...a.byFighter.keys()].some(
    (slug) => a.byFighter.get(slug).bootSd !== c.byFighter.get(slug).bootSd,
  );
  assert.ok(anyDifferent, 'a different seed should produce a different resampling stream');
});

test('bootstrap: the interval brackets the point estimate and widens with less evidence', () => {
  const rounds = balancedRoundRobin(['B1 A', 'B2 A', 'B3 A', 'B4 A']);
  let id = 900;
  const pool = ['B1 A', 'B2 A', 'B3 A', 'B4 A'];
  for (let i = 0; i < 16; i++) rounds.push({ m: id, r: id++, a: 'Well Known', b: pool[i % 4], margin: 2 });
  for (let i = 0; i < 2; i++) rounds.push({ m: id, r: id++, a: 'Barely Seen', b: pool[i % 4], margin: 2 });

  const season = run(league(rounds), { bootstrapSamples: 120 });
  const known = season.byFighter.get(slugify('Well Known'));
  const barely = season.byFighter.get(slugify('Barely Seen'));

  for (const f of [known, barely]) {
    assert.ok(f.lo <= f.anppr + 1e-9 && f.anppr <= f.hi + 1e-9, `${f.name}: ${f.lo}..${f.hi} misses ${f.anppr}`);
  }
  assert.ok(
    barely.hi - barely.lo > known.hi - known.lo,
    'two rounds of evidence must yield a wider interval than sixteen',
  );
  assert.ok(barely.bootSd > known.bootSd);
});

test('bootstrap: signal-to-noise and rank stability are reported and in range', () => {
  const rounds = [];
  let id = 1;
  const names = Array.from({ length: 12 }, (_, i) => `Fighter ${String.fromCharCode(65 + i)}`);
  const rng = makeRng(5150);
  for (let i = 0; i < 300; i++) {
    const a = names[(rng() * names.length) | 0];
    let b = names[(rng() * names.length) | 0];
    if (a === b) b = names[(names.indexOf(a) + 1) % names.length];
    rounds.push({ m: 1 + ((i / 10) | 0), r: id++, a, b, margin: Math.round(rng() * 6 - 3) });
  }
  const season = run(league(rounds), { minRounds: 10, bootstrapSamples: 60 });
  assert.ok(season.summary.qualifiedFighters > 0);
  assert.ok(season.summary.ratingsStdDev > 0);
  assert.ok(season.summary.medianBootSd > 0);
  assert.ok(Number.isFinite(season.summary.signalToNoise));
  assert.ok(
    season.summary.rankStabilityCross > -1 && season.summary.rankStabilityCross <= 1,
    'rank stability is a correlation and must sit in [-1, 1]',
  );
});

// ── Independence of the two stats ────────────────────────────────────────────

test('SOS is not aNPPR minus NPPR', () => {
  const rounds = [];
  let id = 1;
  const names = ['Ind A', 'Ind B', 'Ind C', 'Ind D', 'Ind E', 'Ind F'];
  const rng = makeRng(31337);
  for (let i = 0; i < 120; i++) {
    const a = names[(rng() * names.length) | 0];
    let b = names[(rng() * names.length) | 0];
    if (a === b) b = names[(names.indexOf(a) + 1) % names.length];
    rounds.push({ m: 1 + ((i / 8) | 0), r: id++, a, b, margin: Math.round(rng() * 6 - 3) });
  }
  const season = run(league(rounds), { minRounds: 5, bootstrapSamples: 20 });
  const qualified = season.ranked.filter((f) => f.qualified && f.sos !== null);
  assert.ok(qualified.length >= 4, 'need a few fighters to compare');
  const differs = qualified.some((f) => Math.abs(f.sos - f.delta) > 1e-6);
  assert.ok(differs, 'SOS must be computed independently, not as the ridge delta');
});

test('correlation helper: perfect, inverse and flat inputs', () => {
  assert.ok(Math.abs(correlation([1, 2, 3, 4], [2, 4, 6, 8]) - 1) < 1e-12);
  assert.ok(Math.abs(correlation([1, 2, 3, 4], [-2, -4, -6, -8]) + 1) < 1e-12);
  assert.equal(correlation([1, 1, 1], [1, 2, 3]), 0);
});

test('config: the shipped 2026 model carries the frozen constants', () => {
  assert.equal(model.lambda, 5.0);
  assert.equal(model.bootstrapSamples, 200);
  assert.equal(model.minRounds, 10);
  assert.equal(model.meaningfulDiff, 0.2);
  assert.equal(model.checks.pairedRounds, 1313);
  assert.equal(model.checks.sosCorrelationBound, 0.1);
  assert.ok(typeof model.bootstrapSeed === 'number', 'the bootstrap must be seeded');
  assert.equal(model.sosReference.length, 6);
  assert.equal(model.anpprReference.length, 7);
});
