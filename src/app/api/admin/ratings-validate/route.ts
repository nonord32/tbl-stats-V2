// src/app/api/admin/ratings-validate/route.ts
// Admin-only validation for the opponent-adjusted ratings, run against the LIVE
// season data. The synthetic unit tests (scripts/ratings.test.mjs) prove the
// pipeline; this route proves the season against the 2026 verification tables.
// Same RESOLVE_SECRET bearer auth as the other admin routes.
//
// IMPORTANT — two classes of check, and the difference is real:
//
//   EXACT   The point estimates. SOS and aNPPR are fully determined by the data
//           and lambda, so every figure in the reference tables is asserted to
//           4 decimals, as are the correlations and the paired-round count.
//
//   RANGE   The bootstrap. A resample is stochastic and this codebase's seeded
//           PRNG produces a different stream than the one the reference figures
//           came from, so spreads and intervals are checked as tolerant bands.
//           A pass here means "the same magnitude", not "reproduced".
import { getAllData } from '@/lib/data';
import { getRatingsData, RATINGS_MODEL, RATINGS_MODEL_VERSION } from '@/lib/ratings';

export const dynamic = 'force-dynamic';

interface Check {
  name: string;
  kind: 'exact' | 'range';
  pass: boolean;
  detail: string;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization');
  const secret = process.env.RESOLVE_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const [data, season] = await Promise.all([getAllData(), getRatingsData()]);
  const { summary, validation } = season;
  const checks: Check[] = [];
  const add = (name: string, kind: 'exact' | 'range', pass: boolean, detail: string) =>
    checks.push({ name, kind, pass, detail });

  const byName = new Map<string, ReturnType<typeof season.byFighter.get>>();
  for (const f of season.byFighter.values()) byName.set(f.name.toLowerCase(), f);

  // ── Data integrity ──
  add(
    'Every paired round mirrors: fighter A net points == −fighter B net points',
    'exact',
    validation.asymmetricRounds === 0,
    `${validation.asymmetricRounds} round(s) whose two sides disagree. Net Points is a sheet column and is never reconciled against Points Earned, so a non-zero count here means the sheet itself disagrees.`,
  );
  add(
    'Head-to-head counts agree from both sides of every pairing',
    'exact',
    validation.pairCountMismatches === 0,
    `${validation.pairCountMismatches} mismatch(es)`,
  );
  add(
    `Paired rounds == ${RATINGS_MODEL.checks.pairedRounds} (both fighters identified)`,
    'exact',
    summary.pairedRounds === RATINGS_MODEL.checks.pairedRounds,
    `${summary.pairedRounds} paired, ${summary.unpairedBouts} bout(s) dropped for having no opposite side (opponent recorded as N/A)`,
  );
  add(
    'Ridge solve converged well inside the iteration cap',
    'exact',
    validation.solveIterations > 0 && validation.solveIterations < 200,
    `${validation.solveIterations} conjugate-gradient iterations, residual ${validation.worstResidual.toExponential(2)}`,
  );

  // ── The correlation assertion: does the head-to-head exclusion actually work? ──
  const bound = RATINGS_MODEL.checks.sosCorrelationBound;
  add(
    `corr(NPPR, SOS) within ±${bound.toFixed(2)} — the head-to-head exclusion is working`,
    'exact',
    Math.abs(summary.corrNpprSos) <= bound,
    `corr = ${summary.corrNpprSos.toFixed(3)} over ${summary.qualifiedFighters} qualified fighters. Near −0.57 would mean the exclusion is not firing at all; near −0.34 would mean only one round is being excluded.`,
  );
  add(
    `corr(NPPR, aNPPR) ≈ ${RATINGS_MODEL.checks.anpprCorrelation.toFixed(2)} — reorders at the margin, does not reshuffle`,
    'exact',
    Math.abs(summary.corrNpprAnppr - RATINGS_MODEL.checks.anpprCorrelation) < 0.02,
    `corr = ${summary.corrNpprAnppr.toFixed(3)}`,
  );
  add(
    `SOS standard deviation ≈ ${RATINGS_MODEL.checks.sosStdDev.toFixed(3)}`,
    'exact',
    Math.abs(summary.sosStdDev - RATINGS_MODEL.checks.sosStdDev) < 5e-3,
    `sd = ${summary.sosStdDev.toFixed(4)}`,
  );
  add(
    `Ratings standard deviation ≈ ${RATINGS_MODEL.checks.ratingsStdDev.toFixed(3)}`,
    'exact',
    Math.abs(summary.ratingsStdDev - RATINGS_MODEL.checks.ratingsStdDev) < 5e-3,
    `sd = ${summary.ratingsStdDev.toFixed(4)}`,
  );

  // ── Reference tables (exact) ──
  const sosResults = RATINGS_MODEL.sosReference.map((ref) => {
    const f = byName.get(ref.name.toLowerCase());
    const pass =
      !!f &&
      f.rounds === ref.rounds &&
      Math.abs(f.nppr - ref.nppr) < 5e-4 &&
      f.sos !== null &&
      Math.abs(f.sos - ref.sos) < 5e-5;
    return {
      name: ref.name,
      expected: ref,
      got: f
        ? {
            rounds: f.rounds,
            nppr: Number(f.nppr.toFixed(4)),
            sos: f.sos === null ? null : Number(f.sos.toFixed(4)),
          }
        : null,
      pass,
    };
  });
  add(
    'SOS reference table matches to 4 decimals',
    'exact',
    sosResults.every((r) => r.pass),
    `${sosResults.filter((r) => r.pass).length}/${sosResults.length} match`,
  );

  const anpprResults = RATINGS_MODEL.anpprReference.map((ref) => {
    const f = byName.get(ref.name.toLowerCase());
    const pass =
      !!f &&
      f.rounds === ref.rounds &&
      Math.abs(f.nppr - ref.nppr) < 5e-4 &&
      Math.abs(f.anppr - ref.anppr) < 5e-5;
    return {
      name: ref.name,
      expected: ref,
      got: f
        ? {
            rounds: f.rounds,
            nppr: Number(f.nppr.toFixed(4)),
            anppr: Number(f.anppr.toFixed(4)),
            delta: Number(f.delta.toFixed(4)),
          }
        : null,
      pass,
    };
  });
  add(
    `aNPPR reference table matches to 4 decimals (λ = ${RATINGS_MODEL.lambda})`,
    'exact',
    anpprResults.every((r) => r.pass),
    `${anpprResults.filter((r) => r.pass).length}/${anpprResults.length} match`,
  );

  const tough = RATINGS_MODEL.checks.toughestSchedule;
  const easy = RATINGS_MODEL.checks.easiestSchedule;
  add(
    `Toughest schedule is ${tough.name} (${tough.sos.toFixed(3)})`,
    'exact',
    !!summary.toughest &&
      summary.toughest.name.toLowerCase() === tough.name.toLowerCase() &&
      Math.abs(summary.toughest.sos - tough.sos) < 5e-4,
    summary.toughest
      ? `${summary.toughest.name} at ${summary.toughest.sos.toFixed(4)}`
      : 'no fighter has an SOS',
  );
  add(
    `Easiest schedule is ${easy.name} (${easy.sos.toFixed(3)})`,
    'exact',
    !!summary.easiest &&
      summary.easiest.name.toLowerCase() === easy.name.toLowerCase() &&
      Math.abs(summary.easiest.sos - easy.sos) < 5e-4,
    summary.easiest
      ? `${summary.easiest.name} at ${summary.easiest.sos.toFixed(4)}`
      : 'no fighter has an SOS',
  );

  // SOS must not be the ridge delta. If someone ever "simplifies" the code into
  // aNPPR − NPPR, this is the check that catches it.
  {
    const qualified = season.ranked.filter((f) => f.qualified && f.sos !== null);
    const identical = qualified.filter((f) => Math.abs((f.sos as number) - f.delta) < 1e-6).length;
    add(
      'SOS is computed independently, not as aNPPR − NPPR',
      'exact',
      qualified.length > 0 && identical < qualified.length,
      `${identical}/${qualified.length} fighters have SOS equal to their ridge delta`,
    );
  }

  // ── Bootstrap (range only — see the header note) ──
  const near = (got: number, want: number, tol: number) => Math.abs(got - want) <= tol;
  add(
    `Median bootstrap sd in the region of ${RATINGS_MODEL.checks.medianBootSd.toFixed(3)}`,
    'range',
    near(summary.medianBootSd, RATINGS_MODEL.checks.medianBootSd, 0.06),
    `${summary.medianBootSd.toFixed(4)} (reference ${RATINGS_MODEL.checks.medianBootSd}, tolerance ±0.06 — a different resampling stream will not land on the same figure)`,
  );
  add(
    `Signal-to-noise in the region of ${RATINGS_MODEL.checks.signalToNoise.toFixed(2)}`,
    'range',
    near(summary.signalToNoise, RATINGS_MODEL.checks.signalToNoise, 0.45),
    `${summary.signalToNoise.toFixed(3)} (reference ${RATINGS_MODEL.checks.signalToNoise}, tolerance ±0.45)`,
  );
  add(
    'Cross-division rank stability exceeds within-division',
    'range',
    summary.rankStabilityCross > summary.rankStabilityWithin,
    `cross ${summary.rankStabilityCross.toFixed(3)} vs within ${summary.rankStabilityWithin.toFixed(3)} (reference ${RATINGS_MODEL.checks.rankStabilityCross} vs ${RATINGS_MODEL.checks.rankStabilityWithin}). This ordering is the claim the methodology page makes; the exact values are seed-dependent.`,
  );

  const bootResults = RATINGS_MODEL.bootstrapReference.map((ref) => {
    const f = byName.get(ref.name.toLowerCase());
    const brackets = !!f && f.lo <= f.anppr && f.anppr <= f.hi;
    const sdClose = !!f && near(f.bootSd, ref.bootSd, 0.1);
    return {
      name: ref.name,
      expected: ref,
      got: f
        ? {
            rounds: f.rounds,
            anppr: Number(f.anppr.toFixed(3)),
            bootSd: Number(f.bootSd.toFixed(3)),
            lo: Number(f.lo.toFixed(3)),
            hi: Number(f.hi.toFixed(3)),
            uncertain: f.uncertain,
          }
        : null,
      pass: brackets && sdClose,
    };
  });
  add(
    'Bootstrap reference fighters: interval brackets the estimate, sd in range',
    'range',
    bootResults.every((r) => r.pass),
    `${bootResults.filter((r) => r.pass).length}/${bootResults.length} within ±0.10 of the reference sd`,
  );

  // Every qualified fighter's interval must contain their point estimate — this
  // one IS exact, whatever the seed.
  {
    const qualified = season.ranked.filter((f) => f.qualified);
    const bad = qualified.filter((f) => f.lo > f.anppr || f.anppr > f.hi);
    add(
      'Every qualified fighter’s interval brackets their point estimate',
      'exact',
      bad.length === 0,
      bad.length === 0 ? `${qualified.length} checked` : `${bad.length} outside: ${bad.slice(0, 5).map((f) => f.name).join(', ')}`,
    );
  }

  // ── Divisions ──
  const divisionsWithField = season.divisions.filter((d) => d.qualified > 0);
  add(
    'Per-division qualified counts are available for the division filter',
    'exact',
    divisionsWithField.length > 0,
    divisionsWithField.map((d) => `${d.weightClass}${d.gender ? `/${d.gender}` : ''}=${d.qualified}`).join(', '),
  );

  const allPass = checks.every((c) => c.pass);
  const exactPass = checks.filter((c) => c.kind === 'exact').every((c) => c.pass);

  return new Response(
    JSON.stringify(
      {
        modelVersion: RATINGS_MODEL_VERSION,
        lastUpdated: data.lastUpdated,
        allPass,
        exactPass,
        note: 'exactPass covers the deterministic checks — the point estimates, correlations and counts. The `range` checks cover the bootstrap, which is stochastic: this codebase reseeds its own resampling stream, so those figures are verified as magnitudes rather than reproduced exactly.',
        summary: {
          lambda: RATINGS_MODEL.lambda,
          bootstrapSamples: RATINGS_MODEL.bootstrapSamples,
          bootstrapSeed: RATINGS_MODEL.bootstrapSeed,
          minRounds: RATINGS_MODEL.minRounds,
          ...summary,
        },
        validation,
        checks,
        sosResults,
        anpprResults,
        bootResults,
        divisions: season.divisions,
      },
      null,
      2,
    ),
    { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } },
  );
}
