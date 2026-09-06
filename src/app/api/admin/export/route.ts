// src/app/api/admin/export/route.ts
// Admin-only export of the code-recalculated data, so the operator can see
// exactly where every number comes from. Same RESOLVE_SECRET bearer auth as the
// other admin routes.
//
//   ?format=csv (default) &type=fighters|standings|matches|bouts|wpa|wpa-rounds → one CSV
//   ?format=xlsx                                            → one .xlsx workbook
//                                                             (all tabs at once)
//
// The fighters data is also the WAR-reconciliation tool: it exposes the WAR
// formula and each scope's league constants (Replacement PPR + Avg Margin),
// then every fighter's NPPR / Rounds / WAR — so a sheet vs code delta can be
// traced to a specific input.
import ExcelJS from 'exceljs';
import { getAllData, extractUniqueMatches } from '@/lib/data';
import { sortStandings } from '@/lib/standings';
import { leagueBaseline } from '@/lib/warStats';
import { getWpaData, WPA_MODEL_VERSION, type SeasonWpa } from '@/lib/wpa';
import type { ParsedSheetData } from '@/types';

export const dynamic = 'force-dynamic';

type Cell = string | number;

// ── Row builders (reused by both the CSV and the xlsx paths) ──
function warConstantsRows(data: ParsedSheetData): Cell[][] {
  const uniqueMatches = extractUniqueMatches(data.teamMatches);
  // ONE league-wide baseline (whole season), used for regular, playoff, and
  // season WAR alike. Only each fighter's NPPR and Rounds change by scope.
  const b = leagueBaseline(data.fighterHistory, uniqueMatches, 'all');
  const decidedMatches = uniqueMatches.filter((m) => m.result !== 'D').length;
  return [
    ['FORMULA', 'WAR = (NPPR - Replacement PPR) * Rounds / Points Per Win'],
    ['NOTE', 'One whole-season baseline is used for regular, playoff, and season WAR. Only each fighter’s NPPR and Rounds change by scope; rate stats (WAR/NPPR/Win%) do not sum across scopes.'],
    [],
    ['Replacement PPR (25th percentile NPPR, all fighters)', b.replacementNppr.toFixed(4)],
    ['Points Per Win (the WAR divisor)', b.pointsPerWin.toFixed(4)],
    ['Average Margin Per Match (mean |PF-PA| over decided matches)', b.avgMargin.toFixed(4)],
    ['Decided matches used for the margin', decidedMatches],
    [],
    ['NOTE', 'Points Per Win is 1 / the WPA model\u2019s win value for a one-point round margin, so WAR and WPA are denominated in the same wins. It is NOT the average match margin: flipping a 3-point loss into a win takes about 6 points, not 3, and most points land in matches whose result they cannot change. The average margin is reported above as a descriptive figure only.'],
  ];
}

function fighterTableRows(data: ParsedSheetData): Cell[][] {
  const regBySlug = new Map(data.fightersByPhase.regular.map((f) => [f.slug, f]));
  const poBySlug = new Map(data.fightersByPhase.playoffs.map((f) => [f.slug, f]));
  const rows: Cell[][] = [
    [
      'slug', 'name', 'team', 'weightClass', 'gender', 'record', 'wins', 'losses',
      'rounds', 'netPts', 'nppr', 'winPct',
      'pointsFor', 'pointsAgainst', 'extraPoints', 'extraPointsAllowed',
      'knockdowns', 'doubleKnockdowns', 'koTko', 'koPct',
      'war_season', 'war_regular', 'war_playoffs',
    ],
  ];
  for (const f of [...data.fighters].sort((a, b) => b.war - a.war)) {
    const reg = regBySlug.get(f.slug);
    const po = poBySlug.get(f.slug);
    rows.push([
      f.slug, f.name, f.team, f.weightClass, f.gender, f.record, f.wins, f.losses,
      f.rounds, Number(f.netPts.toFixed(1)), Number(f.nppr.toFixed(4)), Number((f.winPct * 100).toFixed(1)),
      Number(f.pointsFor.toFixed(1)), Number(f.pointsAgainst.toFixed(1)), f.extraPoints, f.extraPointsAllowed,
      f.knockdowns, f.doubleKnockdowns, f.koTko, Number((f.koPct * 100).toFixed(1)),
      Number(f.war.toFixed(4)), reg ? Number(reg.war.toFixed(4)) : '', po ? Number(po.war.toFixed(4)) : '',
    ]);
  }
  return rows;
}

function standingsRows(data: ParsedSheetData): Cell[][] {
  const standings = sortStandings(data.teams, data.teamMatches);
  const rows: Cell[][] = [['rank', 'team', 'record', 'wins', 'losses', 'pf', 'pa', 'diff', 'streak']];
  standings.forEach((t, i) =>
    rows.push([i + 1, t.team, t.record, t.wins, t.losses, Math.round(t.pf), Math.round(t.pa), Math.round(t.diff), t.streak]),
  );
  return rows;
}

function matchesRows(data: ParsedSheetData): Cell[][] {
  const rows: Cell[][] = [['matchIndex', 'date', 'team1', 'team2', 'score1', 'score2', 'margin', 'result', 'phase']];
  for (const m of extractUniqueMatches(data.teamMatches)) {
    rows.push([m.matchIndex, m.date, m.team1, m.team2, m.score1, m.score2, Math.abs(m.score1 - m.score2), m.result, m.phase]);
  }
  return rows;
}

// Pure per-round extract: one row per bout (round) of every game, straight from
// the box scores — the rawest view of the underlying results. Also carries the
// running match score after each round (team1 cumulative, team2 cumulative, and
// the running differential team1 − team2) so the score state at every round is
// available for WPA-style analysis.
function boutsRows(data: ParsedSheetData): Cell[][] {
  const rows: Cell[][] = [[
    'matchIndex', 'date', 'gamePhase', 'team1', 'team2', 'round', 'weightClass',
    'roundPhase', 'fighter1', 'score1', 'fighter2', 'score2', 'winner', 'method',
    'runningScore1', 'runningScore2', 'runningDiff',
  ]];
  for (const m of extractUniqueMatches(data.teamMatches)) {
    // Cumulative score reset per match; box score is already round-ordered.
    let run1 = 0;
    let run2 = 0;
    for (const r of m.boxScore) {
      run1 += r.score1;
      run2 += r.score2;
      rows.push([
        m.matchIndex, m.date, m.phase, m.team1, m.team2, r.round, r.weightClass ?? '',
        r.phase ?? '', r.fighter1, r.score1, r.fighter2, r.score2, r.winner ?? '', r.method ?? '',
        Number(run1.toFixed(1)), Number(run2.toFixed(1)), Number((run1 - run2).toFixed(1)),
      ]);
    }
  }
  return rows;
}

// Per-fighter WPA totals, stamped with the model version so stored figures are
// always traceable to the model that produced them.
function wpaFighterRows(season: SeasonWpa): Cell[][] {
  const rows: Cell[][] = [
    ['WPA MODEL VERSION', WPA_MODEL_VERSION],
    ['NOTE', 'WPA = change in team win probability per round, credited to the round winner. DQ rounds credit neither fighter (their points still count on the scoreboard).'],
    ['NOTE', 'LI (Leverage Index) = how much was at stake before the round; 1.00 is an average round. Clutch = WPA minus what the same results were worth at average leverage (cnWPA). DQ rounds are excluded from liRounds/avgLi/cnWpa/clutch, so liRounds can be lower than rounds.'],
    [],
    ['slug', 'name', 'matches', 'rounds', 'roundWins', 'wpa', 'wpaPerRound', 'wpaRegular', 'wpaPlayoffs',
     'liRounds', 'avgLi', 'cnWpa', 'clutch'],
  ];
  for (const f of [...season.byFighter.values()].sort((a, b) => b.wpa - a.wpa)) {
    rows.push([
      f.slug, f.name, f.matches, f.rounds, f.roundWins,
      Number(f.wpa.toFixed(4)), f.rounds > 0 ? Number((f.wpa / f.rounds).toFixed(4)) : 0,
      Number(f.wpaRegular.toFixed(4)), Number(f.wpaPlayoffs.toFixed(4)),
      // liRounds EXCLUDES DQ rounds, so it can be lower than `rounds`.
      f.liRounds, Number(f.avgLi.toFixed(4)), Number(f.cnWpa.toFixed(4)), Number(f.clutch.toFixed(4)),
    ]);
  }
  return rows;
}

// Per-round WPA detail: the full computation trail for every included round.
function wpaRoundRows(season: SeasonWpa): Cell[][] {
  const rows: Cell[][] = [[
    'matchIndex', 'date', 'gamePhase', 'team1', 'team2', 'round', 'fighter1', 'fighter2',
    'score1', 'score2', 'diffBefore', 'diffAfter', 'wpBefore', 'wpAfter', 'teamWpa',
    'fighter1Wpa', 'fighter2Wpa', 'li', 'roundMargin', 'cnWpa', 'isDq', 'attributed', 'scheduledRounds',
  ]];
  const matches = [...season.byMatch.values()].sort((a, b) => a.matchIndex - b.matchIndex);
  for (const m of matches) {
    for (const r of m.rounds) {
      rows.push([
        m.matchIndex, m.date, m.phase, m.team1, m.team2, r.round, r.fighter1, r.fighter2,
        r.score1, r.score2, r.diffBefore, r.diffAfter,
        Number(r.wpBefore.toFixed(6)), Number(r.wpAfter.toFixed(6)), Number(r.teamWpa.toFixed(6)),
        Number(r.fighter1Wpa.toFixed(6)), Number(r.fighter2Wpa.toFixed(6)),
        Number(r.li.toFixed(4)), r.roundMargin, Number(r.cnWpa.toFixed(6)),
        r.isDq ? 'DQ' : '', r.attributed ? 'Y' : 'N', m.scheduledRounds,
      ]);
    }
  }
  return rows;
}

// ── CSV ──
function csvCell(v: Cell): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(rows: Cell[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\n');
}

// ── xlsx ──
async function buildWorkbook(data: ParsedSheetData, wpaSeason: SeasonWpa): Promise<Uint8Array<ArrayBuffer>> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'TBL Stats';
  wb.created = new Date();
  const addSheet = (name: string, rows: Cell[][], headerRow: number | null) => {
    const ws = wb.addWorksheet(name);
    ws.addRows(rows);
    if (headerRow != null) {
      ws.getRow(headerRow).font = { bold: true };
      ws.views = [{ state: 'frozen', ySplit: headerRow }];
    }
    ws.columns.forEach((col) => {
      let max = 10;
      col.eachCell?.({ includeEmpty: false }, (cell) => {
        max = Math.max(max, String(cell.value ?? '').length + 2);
      });
      col.width = Math.min(max, 40);
    });
  };
  addSheet('WAR (formula & constants)', warConstantsRows(data), 4);
  addSheet('Fighters', fighterTableRows(data), 1);
  addSheet('Standings', standingsRows(data), 1);
  addSheet('Matches', matchesRows(data), 1);
  addSheet('Bouts (raw rounds)', boutsRows(data), 1);
  addSheet('WPA (fighters)', wpaFighterRows(wpaSeason), 4);
  addSheet('WPA (rounds)', wpaRoundRows(wpaSeason), 1);
  // Copy into a Uint8Array with a concrete ArrayBuffer backing so it's a valid
  // Response/Blob body under the current typed-array generics.
  return Uint8Array.from(await wb.xlsx.writeBuffer() as unknown as ArrayLike<number>);
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

  const params = new URL(request.url).searchParams;
  const format = params.get('format') ?? 'csv';
  const data = await getAllData();
  const wpaSeason = await getWpaData();

  if (format === 'xlsx') {
    const buf = await buildWorkbook(data, wpaSeason);
    return new Response(new Blob([buf]), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="tbl-data.xlsx"',
        'Cache-Control': 'no-store',
      },
    });
  }

  const type = params.get('type') ?? 'fighters';
  let rows: Cell[][];
  if (type === 'fighters') {
    rows = [...warConstantsRows(data), [], ...fighterTableRows(data)];
  } else if (type === 'standings') {
    rows = standingsRows(data);
  } else if (type === 'matches') {
    rows = matchesRows(data);
  } else if (type === 'bouts') {
    rows = boutsRows(data);
  } else if (type === 'wpa') {
    rows = wpaFighterRows(wpaSeason);
  } else if (type === 'wpa-rounds') {
    rows = wpaRoundRows(wpaSeason);
  } else {
    return new Response(JSON.stringify({ error: `Unknown type "${type}"` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(toCsv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="tbl-${type}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
