// src/app/api/admin/wpa-validate/route.ts
// Admin-only WPA validation report, run against the LIVE season data. The
// synthetic unit tests (scripts/wpa.test.mjs) prove the pipeline; this route
// proves the season: zero-sum, telescoping, season totals, the DQ rule, the
// special-case matches, and the reference fighter totals from the model spec.
// Same RESOLVE_SECRET bearer auth as the other admin routes.
import { getAllData } from '@/lib/data';
import { getWpaData, WPA_MODEL, WPA_MODEL_VERSION, type FighterWpa } from '@/lib/wpa';

export const dynamic = 'force-dynamic';

interface Check {
  name: string;
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

  const [data, season] = await Promise.all([getAllData(), getWpaData()]);
  const v = season.validation;
  const checks: Check[] = [];
  const add = (name: string, pass: boolean, detail: string) => checks.push({ name, pass, detail });

  // ── Pre-adjustment invariants ──
  add(
    'Telescoping: Σ round WPA == outcome − 0.5 per match (tol 1e-9)',
    v.worstTelescope < 1e-9,
    `worst |error| = ${v.worstTelescope.toExponential(3)} across ${v.matches} matches`,
  );
  add('Zero-sum: team1 + team2 WPA == 0 every round', v.worstZeroSum === 0, 'holds by construction');
  add(
    'Season total (teams) == 0.000',
    Math.abs(v.seasonTeamTotal) < 1e-9,
    `Σ = ${v.seasonTeamTotal.toExponential(3)}`,
  );

  // ── Post-adjustment ──
  add(
    'Every DQ round carries exactly 0.0 WPA on both sides',
    v.dqRoundsAllZero,
    `${v.dqRounds} DQ round(s) found`,
  );
  add(
    'Expected DQ round count for 2026 (8)',
    v.dqRounds === 8,
    `found ${v.dqRounds} (expected 8 per the model spec)`,
  );

  // ── Special-case matches ──
  const m14 = season.byMatch.get(14);
  add(
    'Match 14: post-match round 25 excluded; competitive scoreboard used',
    !!m14 && m14.excludedRows >= 1 && m14.rounds.every((r) => r.round <= m14.scheduledRounds),
    m14
      ? `excludedRows=${m14.excludedRows}, finalDiff=${m14.finalDiff} (${m14.team1} perspective), outcome=${m14.outcome}`
      : 'match 14 not found',
  );
  const m25 = season.byMatch.get(25);
  add(
    'Match 25 (official draw): both teams sum to 0.000',
    !!m25 && m25.outcome === 0.5 && Math.abs(m25.team1Total) < 1e-9,
    m25 ? `team1Total=${m25.team1Total.toExponential(3)}, outcome=${m25.outcome}` : 'match 25 not found',
  );

  // ── Leverage / Clutch invariants ──
  add(
    'Σ cnWPA across all fighter-rounds == 0.000 (tol 1e-6)',
    Math.abs(v.cnWpaTotal) < 1e-6,
    `Σ = ${v.cnWpaTotal.toExponential(3)}`,
  );
  add(
    'Σ Clutch across all fighters == 0.000 (tol 1e-6)',
    Math.abs(v.clutchTotal) < 1e-6,
    `Σ = ${v.clutchTotal.toExponential(3)}`,
  );
  {
    // Both fighters in any round must face identical LI, and DQ rounds must be
    // excluded from fighter LI/Clutch while keeping their own LI for display.
    let liMismatch = 0;
    let dqWithLiCredit = 0;
    for (const m of season.byMatch.values()) {
      for (const r of m.rounds) {
        if (!Number.isFinite(r.li)) liMismatch++;
        if (r.isDq && r.li <= 0) dqWithLiCredit++;
      }
    }
    add('Every round carries a finite LI shared by both fighters', liMismatch === 0, `${liMismatch} bad`);
    add(
      'DQ rounds still carry an LI for match-page display',
      dqWithLiCredit === 0,
      `${dqWithLiCredit} DQ round(s) missing an LI`,
    );
  }

  // ── Reference fighter totals from the model spec ──
  const byName = new Map<string, number>();
  for (const f of season.byFighter.values()) byName.set(f.name.toLowerCase(), f.wpa);
  const referenceResults = WPA_MODEL.referenceTotals.map((ref) => {
    const got = byName.get(ref.name.toLowerCase());
    const pass = got != null && Math.abs(got - ref.wpa) < 5e-4;
    return { name: ref.name, expected: ref.wpa, got: got != null ? Number(got.toFixed(3)) : null, pass };
  });
  add(
    'Reference fighter totals match to 3 decimals',
    referenceResults.every((r) => r.pass),
    `${referenceResults.filter((r) => r.pass).length}/${referenceResults.length} match`,
  );

  // ── Leverage / Clutch reference fighters (rounds here EXCLUDE DQ rounds) ──
  const byNameFull = new Map<string, FighterWpa>();
  for (const f of season.byFighter.values()) byNameFull.set(f.name.toLowerCase(), f);
  const liReferenceResults = WPA_MODEL.liReferenceTotals.map((ref) => {
    const f = byNameFull.get(ref.name.toLowerCase());
    const near = (got: number | undefined, want: number, tol = 5e-4) =>
      got != null && Math.abs(got - want) < tol;
    const pass =
      !!f &&
      f.liRounds === ref.rounds &&
      near(f.avgLi, ref.avgLi) &&
      near(f.wpa, ref.wpa) &&
      near(f.cnWpa, ref.cnWpa) &&
      near(f.clutch, ref.clutch);
    return {
      name: ref.name,
      expected: ref,
      got: f
        ? {
            rounds: f.liRounds,
            wpaRounds: f.rounds,
            avgLi: Number(f.avgLi.toFixed(3)),
            wpa: Number(f.wpa.toFixed(3)),
            cnWpa: Number(f.cnWpa.toFixed(3)),
            clutch: Number(f.clutch.toFixed(3)),
          }
        : null,
      pass,
    };
  });
  add(
    'Leverage / Clutch reference fighters match to 3 decimals',
    liReferenceResults.every((r) => r.pass),
    `${liReferenceResults.filter((r) => r.pass).length}/${liReferenceResults.length} match`,
  );

  // Steven Sumpter is the documented DQ case: 13 WPA rounds, 12 LI/Clutch rounds.
  {
    const sumpter = byNameFull.get('steven sumpter');
    add(
      'Sumpter shows 13 WPA rounds but 12 LI/Clutch rounds (DQ excluded)',
      !!sumpter && sumpter.rounds === 13 && sumpter.liRounds === 12,
      sumpter ? `rounds=${sumpter.rounds}, liRounds=${sumpter.liRounds}` : 'not found',
    );
  }

  const allPass = checks.every((c) => c.pass);
  return new Response(
    JSON.stringify(
      {
        modelVersion: WPA_MODEL_VERSION,
        lastUpdated: data.lastUpdated,
        allPass,
        summary: {
          matches: v.matches,
          roundsIncluded: v.roundsIncluded,
          excludedRows: v.excludedRows,
          dqRounds: v.dqRounds,
          fighters: season.byFighter.size,
        },
        checks,
        referenceResults,
        liReferenceResults,
      },
      null,
      2,
    ),
    { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } },
  );
}
