// src/lib/ratings/core.ts
//
// Opponent-adjusted ratings: Strength of Schedule (SOS) and Adjusted NPPR
// (aNPPR). Every other rate stat on the site treats beating the best fighter
// in the league the same as beating the worst; these two do not.
//
//   SOS   — the average NPPR of the opponents a fighter faced, with ALL
//           head-to-head rounds removed from those opponents' numbers.
//   aNPPR — one rating per fighter, solved for everyone simultaneously by
//           ridge regression over every round, rather than rating fighters
//           first and correcting for schedule afterward.
//
// The two are computed INDEPENDENTLY and by different methods. The tempting
// shortcut, SOS = aNPPR - NPPR, is wrong: ridge shrinks extreme NPPRs toward
// zero, so that difference is mechanically anti-correlated with NPPR whatever
// the schedule looked like (-0.848 on 2026 data — worse than the naive stat it
// would be replacing). It measures regression to the mean, not opposition.
//
// Nothing here changes NPPR, WPA, LI or Clutch. Both stats read the same bouts
// NPPR reads, so DQ rounds are already absent (they never enter fighterHistory
// — see the addHistory guard in src/lib/data.ts).
//
// IMPORTANT for testability: this file has NO runtime imports (types only, and
// they are erased at compile time), so it can be loaded directly by
// node --experimental-strip-types in scripts/ratings.test.mjs. The model config
// and the slugifier are injected as parameters — never imported here.

// ── Inputs ───────────────────────────────────────────────────────────────────
// Deliberately structural and minimal rather than the app's FighterStat /
// FightHistory, so the core stays free of app types and tests can build a
// league in a few lines. src/lib/ratings/index.ts does the adapting.

export interface RatingsFighterInput {
  slug: string;
  name: string;
  team: string;
  weightClass: string;
  gender: string;
  /** NPPR denominator — every non-DQ bout, exactly as warStats.ts counts it */
  rounds: number;
  /** NPPR numerator */
  netPts: number;
  nppr: number;
}

export interface RatingsBoutInput {
  opponent: string;
  netPts: number;
  matchIndex: number;
  roundId: number;
}

export interface RatingsModelConfig {
  lambda: number;
  bootstrapSamples: number;
  bootstrapSeed: number;
  intervalLow: number;
  intervalHigh: number;
  minRounds: number;
  meaningfulDiff: number;
  flagBootSd: number;
}

// ── Outputs ──────────────────────────────────────────────────────────────────

export interface FighterRating {
  slug: string;
  name: string;
  team: string;
  weightClass: string;
  gender: string;
  rounds: number;
  nppr: number;
  /** average opponent NPPR, head-to-head rounds excluded; null when no opponent survives */
  sos: number | null;
  /** distinct opponents that contributed to SOS */
  sosOpponents: number;
  /** ridge rating; 0 for a fighter with no paired rounds */
  anppr: number;
  /** aNPPR - NPPR. The mover, and the reason the stat is worth publishing. */
  delta: number;
  /** rounds feeding the regression (both fighters identified) */
  ratedRounds: number;
  /** bootstrap standard deviation of the rating */
  bootSd: number;
  /** bootstrap interval, config.intervalLow .. intervalHigh */
  lo: number;
  hi: number;
  /** bootSd exceeds the config threshold — show the reader the number is soft */
  uncertain: boolean;
  qualified: boolean;
}

export interface DivisionSummary {
  weightClass: string;
  gender: string;
  qualified: number;
  rankStability: number | null;
}

export interface SeasonRatings {
  byFighter: Map<string, FighterRating>;
  /** every fighter, aNPPR descending */
  ranked: FighterRating[];
  summary: {
    fighters: number;
    qualifiedFighters: number;
    /** rounds with BOTH fighters identified — the regression's row count */
    pairedRounds: number;
    /** history rows that had no opposite side (opponent recorded as N/A) */
    unpairedBouts: number;
    corrNpprSos: number;
    corrNpprAnppr: number;
    sosStdDev: number;
    ratingsStdDev: number;
    medianBootSd: number;
    signalToNoise: number;
    rankStabilityCross: number;
    rankStabilityWithin: number;
    toughest: { name: string; sos: number } | null;
    easiest: { name: string; sos: number } | null;
  };
  divisions: DivisionSummary[];
  validation: {
    /** paired rounds where fighter A's net points did not mirror fighter B's */
    asymmetricRounds: number;
    /** paired rounds whose two sides disagreed on the head-to-head count */
    pairCountMismatches: number;
    /** CG iterations for the point solve — a blow-up here means an ill-posed system */
    solveIterations: number;
    worstResidual: number;
  };
}

// ── Small numeric helpers (dependency-free by necessity) ─────────────────────

// Google-Sheets PERCENTILE.INC, mirroring percentileInclusive in warStats.ts.
// Duplicated rather than imported: warStats.ts has runtime imports, which would
// break the type-stripping test harness.
function percentileInclusive(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const rank = p * (sorted.length - 1);
  const lo = Math.floor(rank);
  const frac = rank - lo;
  if (lo + 1 >= sorted.length) return sorted[sorted.length - 1];
  return sorted[lo] + frac * (sorted[lo + 1] - sorted[lo]);
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

/** Population standard deviation. */
function stdDev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  let s = 0;
  for (const x of xs) s += (x - m) * (x - m);
  return Math.sqrt(s / xs.length);
}

export function correlation(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return 0;
  return sxy / Math.sqrt(sxx * syy);
}

// mulberry32 — small, fast, and fully determined by its seed. The bootstrap
// MUST be reproducible: ratings are recomputed on every ISR revalidation, and
// an unseeded resample would make every published interval flicker.
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── The ridge solve ──────────────────────────────────────────────────────────

/** One regression row: fighter `a` vs fighter `b`, margin `y` from a's side. */
export interface RoundRow {
  a: number;
  b: number;
  y: number;
}

export interface SolveResult {
  theta: Float64Array;
  iterations: number;
  residual: number;
}

// Solve (X'X + lambda*I) theta = X'y for the +1/-1 pairwise design.
//
// X'X + lambda*I is a graph Laplacian plus lambda*I: sparse, and strictly
// positive definite for lambda > 0. Conjugate gradient never forms the N x N
// matrix — each product costs O(rounds) by walking the round list — so this is
// flat in the number of fighters and cheap enough to run 200 more times for the
// bootstrap. Benchmarked against a dense Cholesky factorization at 1e-12
// agreement; scripts/ratings.test.mjs keeps that cross-check honest.
//
// `weights[r]` is how many times round r was drawn (null means once each).
export function solveRidge(
  rows: RoundRow[],
  n: number,
  lambda: number,
  weights: Float64Array | null,
  tol = 1e-12,
  maxIterations = 1000,
): SolveResult {
  const b = new Float64Array(n);
  for (let r = 0; r < rows.length; r++) {
    const w = weights ? weights[r] : 1;
    if (w === 0) continue;
    const row = rows[r];
    const wy = w * row.y;
    b[row.a] += wy;
    b[row.b] -= wy;
  }

  const apply = (v: Float64Array, out: Float64Array): void => {
    out.fill(0);
    for (let r = 0; r < rows.length; r++) {
      const w = weights ? weights[r] : 1;
      if (w === 0) continue;
      const row = rows[r];
      const d = w * (v[row.a] - v[row.b]);
      out[row.a] += d;
      out[row.b] -= d;
    }
    for (let i = 0; i < n; i++) out[i] += lambda * v[i];
  };

  const theta = new Float64Array(n);
  const resid = Float64Array.from(b);
  const p = Float64Array.from(b);
  const ap = new Float64Array(n);

  let rs = 0;
  for (let i = 0; i < n; i++) rs += resid[i] * resid[i];
  const rs0 = rs;
  const target = tol * tol * rs0;

  let iterations = 0;
  while (iterations < maxIterations && rs > target) {
    apply(p, ap);
    let pap = 0;
    for (let i = 0; i < n; i++) pap += p[i] * ap[i];
    if (pap <= 0) break; // cannot happen for lambda > 0; bail rather than divide by zero
    const alpha = rs / pap;
    for (let i = 0; i < n; i++) {
      theta[i] += alpha * p[i];
      resid[i] -= alpha * ap[i];
    }
    let rs2 = 0;
    for (let i = 0; i < n; i++) rs2 += resid[i] * resid[i];
    const beta = rs2 / rs;
    rs = rs2;
    for (let i = 0; i < n; i++) p[i] = resid[i] + beta * p[i];
    iterations++;
  }

  return { theta, iterations, residual: Math.sqrt(rs) };
}

// ── Round pairing ────────────────────────────────────────────────────────────

export interface PairedRounds {
  rows: RoundRow[];
  index: Map<string, number>;
  slugs: string[];
  unpairedBouts: number;
  asymmetricRounds: number;
}

const NA = new Set(['', 'n/a', 'na', 'tbd', '-', '—']);

function isRealOpponent(name: string | undefined): boolean {
  return !!name && !NA.has(name.trim().toLowerCase());
}

// Group every bout by match + round and keep only the groups with two sides.
//
// That single rule gives "both fighters identified" for free: addHistory in
// src/lib/data.ts returns early on a blank or N/A fighter name, so a round with
// one unnamed fighter leaves exactly one history row behind and is dropped
// here. Those rounds still count toward NPPR and toward SOS weighting — only
// the regression needs both sides.
//
// Slugs are iterated in sorted order so the A/B orientation is deterministic.
// It is also mathematically irrelevant: flipping a row negates both the +1/-1
// pattern and y, leaving X'X and X'y unchanged.
export function pairRounds(
  history: Record<string, RatingsBoutInput[]>,
): PairedRounds {
  const groups = new Map<string, { slug: string; netPts: number }[]>();
  for (const slug of Object.keys(history).sort()) {
    for (const bout of history[slug]) {
      const key = `${bout.matchIndex}:${bout.roundId}`;
      let g = groups.get(key);
      if (!g) {
        g = [];
        groups.set(key, g);
      }
      g.push({ slug, netPts: bout.netPts });
    }
  }

  const index = new Map<string, number>();
  const slugs: string[] = [];
  const idxOf = (slug: string): number => {
    let i = index.get(slug);
    if (i === undefined) {
      i = slugs.length;
      index.set(slug, i);
      slugs.push(slug);
    }
    return i;
  };

  const rows: RoundRow[] = [];
  let unpairedBouts = 0;
  let asymmetricRounds = 0;

  for (const g of groups.values()) {
    if (g.length !== 2) {
      unpairedBouts += g.length;
      continue;
    }
    const [x, y] = g;
    if (x.slug === y.slug) {
      // A fighter cannot face themselves; a data fault, not a round.
      unpairedBouts += 2;
      continue;
    }
    // netPts is read verbatim from the sheet's Net Points column for each side
    // and is never reconciled against pointsFor - pointsAgainst anywhere in the
    // codebase, so the mirror is checked rather than assumed. The margin is
    // taken from side A per the model spec.
    if (Math.abs(x.netPts + y.netPts) > 1e-9) asymmetricRounds++;
    rows.push({ a: idxOf(x.slug), b: idxOf(y.slug), y: x.netPts });
  }

  return { rows, index, slugs, unpairedBouts, asymmetricRounds };
}

// ── Strength of Schedule ─────────────────────────────────────────────────────

export interface PairTotals {
  /** X's net points in rounds against A */
  net: number;
  /** how many rounds X fought against A */
  k: number;
}

/** Key: `${opponentSlug}|${fighterSlug}` → what the opponent did against them. */
export function buildPairMap(
  history: Record<string, RatingsBoutInput[]>,
  slugify: (name: string) => string,
): Map<string, PairTotals> {
  const pairs = new Map<string, PairTotals>();
  for (const slug of Object.keys(history)) {
    for (const bout of history[slug]) {
      if (!isRealOpponent(bout.opponent)) continue;
      const oppSlug = slugify(bout.opponent);
      if (!oppSlug || oppSlug === slug) continue;
      const key = `${slug}|${oppSlug}`;
      let p = pairs.get(key);
      if (!p) {
        p = { net: 0, k: 0 };
        pairs.set(key, p);
      }
      p.net += bout.netPts;
      p.k += 1;
    }
  }
  return pairs;
}

export interface SosResult {
  sos: number | null;
  opponents: number;
  /** the fighter's own count of rounds vs an opponent disagreed with that opponent's */
  countMismatches: number;
}

// The average NPPR of the opponents a fighter faced, with ALL head-to-head
// rounds excluded:
//
//   X_nppr_excl_A = (X's total net points - X's net points in rounds vs A)
//                   / (X's total rounds - k)
//   SOS(A)        = mean of X_nppr_excl_A weighted by k
//
// The exclusion is what makes the stat honest. Beating an opponent repeatedly
// drags their NPPR down, so without it a fighter's own schedule looks weaker
// the better they are — and TBL's Launch/Middle/Money structure makes that
// unusually severe, since about half of all pairings repeat inside one match.
//
// `k` is taken from the OPPONENT's side of the pair map, because it is the
// opponent's totals being adjusted. An opponent whose round count falls to zero
// after exclusion is skipped entirely — out of the weighted mean's numerator
// and its weight total both.
export function computeSos(
  slug: string,
  bouts: RatingsBoutInput[],
  totals: Map<string, { netPts: number; rounds: number }>,
  pairs: Map<string, PairTotals>,
  slugify: (name: string) => string,
): SosResult {
  const faced = new Map<string, number>();
  for (const bout of bouts) {
    if (!isRealOpponent(bout.opponent)) continue;
    const oppSlug = slugify(bout.opponent);
    if (!oppSlug || oppSlug === slug) continue;
    faced.set(oppSlug, (faced.get(oppSlug) ?? 0) + 1);
  }

  let weighted = 0;
  let weight = 0;
  let opponents = 0;
  let countMismatches = 0;

  for (const [oppSlug, ownCount] of faced) {
    const opp = totals.get(oppSlug);
    if (!opp) continue;
    const pair = pairs.get(`${oppSlug}|${slug}`);
    const k = pair ? pair.k : 0;
    const net = pair ? pair.net : 0;
    if (k !== ownCount) countMismatches++;
    const denom = opp.rounds - k;
    if (denom <= 0) continue; // nothing of theirs left once our rounds come out
    weighted += k * ((opp.netPts - net) / denom);
    weight += k;
    opponents++;
  }

  return {
    sos: weight > 0 ? weighted / weight : null,
    opponents,
    countMismatches,
  };
}

// ── Season computation ───────────────────────────────────────────────────────

// Spearman rank correlation between two rankings of the same fighters, given
// as arrays of values (higher = better). Used to measure how much a bootstrap
// refit reshuffles the leaderboard.
function rankStability(pointValues: number[], sampleValues: number[]): number {
  const n = pointValues.length;
  if (n < 2) return 1;
  const rankOf = (vals: number[]): number[] => {
    const order = vals.map((v, i) => [v, i] as [number, number]);
    order.sort((p, q) => q[0] - p[0]);
    const ranks = new Array<number>(n);
    for (let r = 0; r < n; r++) ranks[order[r][1]] = r + 1;
    return ranks;
  };
  const ra = rankOf(pointValues);
  const rb = rankOf(sampleValues);
  let d2 = 0;
  for (let i = 0; i < n; i++) {
    const d = ra[i] - rb[i];
    d2 += d * d;
  }
  return 1 - (6 * d2) / (n * (n * n - 1));
}

export function computeSeasonRatings(
  fighters: RatingsFighterInput[],
  history: Record<string, RatingsBoutInput[]>,
  config: RatingsModelConfig,
  slugify: (name: string) => string,
): SeasonRatings {
  const paired = pairRounds(history);
  const n = paired.slugs.length;

  // Point estimate.
  const point = solveRidge(paired.rows, n, config.lambda, null);

  // Bootstrap: resample rounds with replacement, refit, and collect each
  // fighter's spread. Seeded, so the published intervals are stable.
  const R = paired.rows.length;
  const B = config.bootstrapSamples;
  const rng = makeRng(config.bootstrapSeed);
  const samples: Float64Array[] = [];
  if (R > 0 && n > 0) {
    for (let s = 0; s < B; s++) {
      const weights = new Float64Array(R);
      for (let k = 0; k < R; k++) weights[(rng() * R) | 0] += 1;
      samples.push(solveRidge(paired.rows, n, config.lambda, weights).theta);
    }
  }

  // SOS inputs: the PUBLISHED NPPR numerator and denominator, so the stat is
  // defined against the NPPR readers actually see.
  const totals = new Map<string, { netPts: number; rounds: number }>();
  for (const f of fighters) totals.set(f.slug, { netPts: f.netPts, rounds: f.rounds });
  const pairs = buildPairMap(history, slugify);

  const byFighter = new Map<string, FighterRating>();
  let pairCountMismatches = 0;

  for (const f of fighters) {
    const idx = paired.index.get(f.slug);
    const anppr = idx === undefined ? 0 : point.theta[idx];
    const bouts = history[f.slug] ?? [];
    const sos = computeSos(f.slug, bouts, totals, pairs, slugify);
    pairCountMismatches += sos.countMismatches;

    let bootSd = 0;
    let lo = anppr;
    let hi = anppr;
    if (idx !== undefined && samples.length > 1) {
      const draws = new Array<number>(samples.length);
      for (let s = 0; s < samples.length; s++) draws[s] = samples[s][idx];
      const m = mean(draws);
      let ss = 0;
      for (const v of draws) ss += (v - m) * (v - m);
      bootSd = Math.sqrt(ss / (draws.length - 1));
      draws.sort((a, b) => a - b);
      lo = percentileInclusive(draws, config.intervalLow);
      hi = percentileInclusive(draws, config.intervalHigh);
    }

    let ratedRounds = 0;
    if (idx !== undefined) {
      for (const row of paired.rows) if (row.a === idx || row.b === idx) ratedRounds++;
    }

    byFighter.set(f.slug, {
      slug: f.slug,
      name: f.name,
      team: f.team,
      weightClass: f.weightClass,
      gender: f.gender,
      rounds: f.rounds,
      nppr: f.nppr,
      sos: sos.sos,
      sosOpponents: sos.opponents,
      anppr,
      delta: anppr - f.nppr,
      ratedRounds,
      bootSd,
      lo,
      hi,
      uncertain: bootSd > config.flagBootSd,
      qualified: f.rounds >= config.minRounds,
    });
  }

  const ranked = [...byFighter.values()].sort((a, b) => b.anppr - a.anppr);
  const qualified = ranked.filter((f) => f.qualified);
  const withSos = qualified.filter((f) => f.sos !== null);

  const npprOfSos = withSos.map((f) => f.nppr);
  const sosValues = withSos.map((f) => f.sos as number);
  const bySos = [...withSos].sort((a, b) => (b.sos as number) - (a.sos as number));

  const ratingsStdDev = stdDev(qualified.map((f) => f.anppr));
  const bootSds = qualified.map((f) => f.bootSd).sort((a, b) => a - b);
  const medianBootSd = bootSds.length ? percentileInclusive(bootSds, 0.5) : 0;

  // Rank stability: how much each bootstrap refit reshuffles the leaderboard.
  // Computed pound-for-pound and within division, because the two answer
  // different questions and 2026 says the cross-division answer is the steadier
  // one — inside a division fighters sit closer together, so noise reorders
  // them more easily.
  const qualIdx = qualified
    .map((f) => ({ f, idx: paired.index.get(f.slug) }))
    .filter((q): q is { f: FighterRating; idx: number } => q.idx !== undefined);

  const stabilityOver = (group: { f: FighterRating; idx: number }[]): number | null => {
    if (group.length < 2 || samples.length === 0) return null;
    const pointVals = group.map((q) => q.f.anppr);
    let total = 0;
    for (const sample of samples) {
      total += rankStability(pointVals, group.map((q) => sample[q.idx]));
    }
    return total / samples.length;
  };

  const divisionKey = (f: FighterRating) => `${f.weightClass}|${f.gender}`;
  const divisionGroups = new Map<string, { f: FighterRating; idx: number }[]>();
  for (const q of qualIdx) {
    const key = divisionKey(q.f);
    let g = divisionGroups.get(key);
    if (!g) {
      g = [];
      divisionGroups.set(key, g);
    }
    g.push(q);
  }

  const divisions: DivisionSummary[] = [];
  const withinScores: number[] = [];
  for (const [key, group] of divisionGroups) {
    const [weightClass, gender] = key.split('|');
    // 5+ qualified fighters before a within-division stability figure means
    // anything; below that a single swap dominates it.
    const stability = group.length >= 5 ? stabilityOver(group) : null;
    if (stability !== null) withinScores.push(stability);
    divisions.push({ weightClass, gender, qualified: group.length, rankStability: stability });
  }
  divisions.sort((a, b) => b.qualified - a.qualified || a.weightClass.localeCompare(b.weightClass));

  return {
    byFighter,
    ranked,
    summary: {
      fighters: byFighter.size,
      qualifiedFighters: qualified.length,
      pairedRounds: paired.rows.length,
      unpairedBouts: paired.unpairedBouts,
      corrNpprSos: correlation(npprOfSos, sosValues),
      corrNpprAnppr: correlation(
        qualified.map((f) => f.nppr),
        qualified.map((f) => f.anppr),
      ),
      sosStdDev: stdDev(sosValues),
      ratingsStdDev,
      medianBootSd,
      signalToNoise: medianBootSd > 0 ? ratingsStdDev / medianBootSd : 0,
      rankStabilityCross: stabilityOver(qualIdx) ?? 0,
      rankStabilityWithin: withinScores.length ? mean(withinScores) : 0,
      toughest: bySos.length ? { name: bySos[0].name, sos: bySos[0].sos as number } : null,
      easiest: bySos.length
        ? { name: bySos[bySos.length - 1].name, sos: bySos[bySos.length - 1].sos as number }
        : null,
    },
    divisions,
    validation: {
      asymmetricRounds: paired.asymmetricRounds,
      pairCountMismatches,
      solveIterations: point.iterations,
      worstResidual: point.residual,
    },
  };
}
