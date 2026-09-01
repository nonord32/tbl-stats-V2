// src/app/api/admin/wpa-validate/route.ts
// Admin-only WPA validation report, run against the LIVE season data. The
// synthetic unit tests (scripts/wpa.test.mjs) prove the pipeline; this route
// proves the season: zero-sum, telescoping, season totals, the DQ rule, the
// special-case matches, and the reference fighter totals from the model spec.
// Same RESOLVE_SECRET bearer auth as the other admin routes.
import { getAllData } from '@/lib/data';
import { getTeamSlugByName } from '@/lib/teams';
import {
  getWpaData,
  getComebackData,
  WPA_MODEL,
  WPA_MODEL_VERSION,
  type FighterWpa,
} from '@/lib/wpa';

export const dynamic = 'force-dynamic';

// ── 2026 Comebacks & Blown Leads verification tables (from the spec) ──
// Percentages are stored as the fractions the code actually produces, rounded
// to the same 4 decimals the spec quotes to 2 (7.34% → 0.0734).
const COMEBACK_REFERENCE = {
  biggest: [
    { matchIndex: 54, winner: 'Miami', loser: 'Las Vegas', low: 0.0734, round: 3, deficit: -7, margin: 4 },
    { matchIndex: 2, winner: 'Las Vegas', loser: 'Los Angeles', low: 0.0759, round: 13, deficit: -5, margin: 2 },
    { matchIndex: 6, winner: 'Phoenix', loser: 'Boston', low: 0.0768, round: 8, deficit: -6, margin: 2 },
    { matchIndex: 52, winner: 'Las Vegas', loser: 'Los Angeles', low: 0.0994, round: 4, deficit: -6, margin: 1 },
    { matchIndex: 1, winner: 'Philadelphia', loser: 'NYC', low: 0.1146, round: 8, deficit: -5, margin: 5 },
    { matchIndex: 31, winner: 'NYC', loser: 'San Antonio', low: 0.1215, round: 7, deficit: -5, margin: 9 },
    { matchIndex: 47, winner: 'Phoenix', loser: 'Los Angeles', low: 0.1399, round: 4, deficit: -5, margin: 1 },
    { matchIndex: 14, winner: 'San Antonio', loser: 'Las Vegas', low: 0.158, round: 9, deficit: -4, margin: 2 },
  ],
  decidedMatches: 54,
  below: { p05: 0, p10: 4, p15: 7, p25: 12, p35: 21 },
  medianLow: 0.409,
  teams: [
    { team: 'Las Vegas', comebackWins: 3, deepestHole: 0.076, blownLeads: 2, highestLeadBlown: 0.927 },
    { team: 'Philadelphia', comebackWins: 2, deepestHole: 0.115, blownLeads: 0, highestLeadBlown: null },
    { team: 'Miami', comebackWins: 2, deepestHole: 0.073, blownLeads: 0, highestLeadBlown: null },
    { team: 'Phoenix', comebackWins: 2, deepestHole: 0.077, blownLeads: 0, highestLeadBlown: null },
    { team: 'San Antonio', comebackWins: 1, deepestHole: 0.158, blownLeads: 1, highestLeadBlown: 0.879 },
    { team: 'NYC', comebackWins: 1, deepestHole: 0.122, blownLeads: 2, highestLeadBlown: 0.885 },
    { team: 'Houston', comebackWins: 1, deepestHole: 0.224, blownLeads: 0, highestLeadBlown: null },
    { team: 'Atlanta', comebackWins: 0, deepestHole: null, blownLeads: 1, highestLeadBlown: 0.803 },
    { team: 'Boston', comebackWins: 0, deepestHole: null, blownLeads: 1, highestLeadBlown: 0.923 },
    { team: 'Dallas', comebackWins: 0, deepestHole: null, blownLeads: 1, highestLeadBlown: 0.776 },
    { team: 'Nashville', comebackWins: 0, deepestHole: null, blownLeads: 0, highestLeadBlown: null },
    { team: 'Los Angeles', comebackWins: 0, deepestHole: null, blownLeads: 4, highestLeadBlown: 0.924 },
  ],
} as const;

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

  const [data, season, comebacks] = await Promise.all([
    getAllData(),
    getWpaData(),
    getComebackData(),
  ]);
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

  // ── Comebacks & Blown Leads (built from the same stored win probabilities) ──
  const cbTotals = comebacks.totals;
  add(
    'Comebacks: 54 decided matches (match 25, the draw, excluded)',
    cbTotals.decidedMatches === COMEBACK_REFERENCE.decidedMatches,
    `${cbTotals.decidedMatches} decided of ${season.byMatch.size} played`,
  );
  add(
    'Comebacks: the drawn match 25 is absent from the list',
    !comebacks.matches.some((m) => m.matchIndex === 25),
    comebacks.matches.some((m) => m.matchIndex === 25) ? 'match 25 present — draw not excluded' : 'absent',
  );
  add(
    'Comebacks: Σ team comeback wins == Σ team blown leads == 12',
    cbTotals.teamComebackWins === cbTotals.teamBlownLeads && cbTotals.teamComebackWins === 12,
    `comebackWins=${cbTotals.teamComebackWins}, blownLeads=${cbTotals.teamBlownLeads}, matches flagged=${cbTotals.comebacks}`,
  );
  add(
    'Comebacks: match count equals the per-team comeback total',
    cbTotals.comebacks === cbTotals.teamComebackWins,
    `${cbTotals.comebacks} flagged vs ${cbTotals.teamComebackWins} credited`,
  );

  const distributionResults = (
    ['p05', 'p10', 'p15', 'p25', 'p35'] as const
  ).map((k) => ({
    bar: k,
    expected: COMEBACK_REFERENCE.below[k],
    got: cbTotals.below[k],
    pass: cbTotals.below[k] === COMEBACK_REFERENCE.below[k],
  }));
  add(
    'Comebacks: below-5/10/15/25/35% distribution matches',
    distributionResults.every((r) => r.pass),
    distributionResults.map((r) => `${r.bar}=${r.got}/${r.expected}`).join(', '),
  );
  add(
    'Comebacks: median winner low point == 0.409 (3dp)',
    Math.abs(cbTotals.medianLow - COMEBACK_REFERENCE.medianLow) < 5e-4,
    `median = ${cbTotals.medianLow.toFixed(4)}`,
  );

  // The eight biggest comebacks, in order, with low / round / deficit / margin.
  const biggestResults = COMEBACK_REFERENCE.biggest.map((ref, i) => {
    const got = comebacks.matches[i];
    const pass =
      !!got &&
      got.matchIndex === ref.matchIndex &&
      Math.abs(got.comebackLow - ref.low) < 5e-4 &&
      got.lowRound === ref.round &&
      got.deficitAtLow === ref.deficit &&
      got.finalMargin === ref.margin;
    return {
      rank: i + 1,
      expected: ref,
      got: got
        ? {
            matchIndex: got.matchIndex,
            winner: got.winnerTeam,
            loser: got.loserTeam,
            low: Number(got.comebackLow.toFixed(4)),
            round: got.lowRound,
            deficit: got.deficitAtLow,
            margin: got.finalMargin,
          }
        : null,
      pass,
    };
  });
  add(
    'Comebacks: the 8 biggest match the reference table (rank, low, round, deficit, margin)',
    biggestResults.every((r) => r.pass),
    `${biggestResults.filter((r) => r.pass).length}/${biggestResults.length} match`,
  );
  add(
    'Comebacks: match 14 carries its competitive-scoreboard footnote',
    !!comebacks.matches.find((m) => m.matchIndex === 14)?.footnote,
    comebacks.matches.find((m) => m.matchIndex === 14)?.footnote ? 'footnote present' : 'footnote missing',
  );

  const teamComebackResults = COMEBACK_REFERENCE.teams.map((ref) => {
    const slug = getTeamSlugByName(ref.team);
    const t = comebacks.byTeam.get(slug);
    const near = (got: number | null | undefined, want: number | null) =>
      want == null ? got == null : got != null && Math.abs(got - want) < 5e-4;
    const pass =
      !!t &&
      t.comebackWins === ref.comebackWins &&
      t.blownLeads === ref.blownLeads &&
      near(t.deepestHole, ref.deepestHole) &&
      near(t.highestLeadBlown, ref.highestLeadBlown);
    return {
      team: ref.team,
      slug,
      expected: ref,
      got: t
        ? {
            comebackWins: t.comebackWins,
            deepestHole: t.deepestHole == null ? null : Number(t.deepestHole.toFixed(3)),
            blownLeads: t.blownLeads,
            highestLeadBlown:
              t.highestLeadBlown == null ? null : Number(t.highestLeadBlown.toFixed(3)),
          }
        : null,
      pass,
    };
  });
  add(
    'Comebacks: all 12 team comeback / blown-lead totals match',
    teamComebackResults.every((r) => r.pass),
    `${teamComebackResults.filter((r) => r.pass).length}/${teamComebackResults.length} match`,
  );
  add(
    'Comebacks: every team joined to a real slug (no name-match failures)',
    teamComebackResults.every((r) => r.slug !== '') &&
      [...comebacks.byTeam.keys()].every((k) => k !== ''),
    `${teamComebackResults.filter((r) => r.slug === '').length} unresolved reference name(s), ${comebacks.byTeam.size} teams in table`,
  );

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
          decidedMatches: cbTotals.decidedMatches,
          comebacks: cbTotals.comebacks,
        },
        checks,
        referenceResults,
        liReferenceResults,
        comebackResults: {
          distribution: distributionResults,
          biggest: biggestResults,
          teams: teamComebackResults,
        },
      },
      null,
      2,
    ),
    { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } },
  );
}
