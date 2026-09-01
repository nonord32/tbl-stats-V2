// src/app/api/admin/export/route.ts
// Admin-only export of the code-recalculated data, so the operator can see
// exactly where every number comes from. Same RESOLVE_SECRET bearer auth as the
// other admin routes.
//
//   ?format=csv (default) &type=fighters|standings|matches → one CSV
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
    ['FORMULA', 'WAR = (NPPR - Replacement PPR) * Rounds / Avg Margin Per Match'],
    ['NOTE', 'One whole-season baseline is used for regular, playoff, and season WAR. Only each fighter’s NPPR and Rounds change by scope; rate stats (WAR/NPPR/Win%) do not sum across scopes.'],
    [],
    ['Replacement PPR (25th percentile NPPR, all fighters)', b.replacementNppr.toFixed(4)],
    ['Average Margin Per Match (mean |PF-PA| over decided matches)', b.avgMargin.toFixed(4)],
    ['Decided matches used for the margin', decidedMatches],
  ];
}

function fighterTableRows(data: ParsedSheetData): Cell[][] {
  const regBySlug = new Map(data.fightersByPhase.regular.map((f) => [f.slug, f]));
  const poBySlug = new Map(data.fightersByPhase.playoffs.map((f) => [f.slug, f]));
  const rows: Cell[][] = [
    ['slug', 'name', 'team', 'weightClass', 'gender', 'record', 'wins', 'losses', 'rounds', 'netPts', 'nppr', 'winPct', 'war_season', 'war_regular', 'war_playoffs'],
  ];
  for (const f of [...data.fighters].sort((a, b) => b.war - a.war)) {
    const reg = regBySlug.get(f.slug);
    const po = poBySlug.get(f.slug);
    rows.push([
      f.slug, f.name, f.team, f.weightClass, f.gender, f.record, f.wins, f.losses,
      f.rounds, Number(f.netPts.toFixed(1)), Number(f.nppr.toFixed(4)), Number((f.winPct * 100).toFixed(1)),
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

// ── CSV ──
function csvCell(v: Cell): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(rows: Cell[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\n');
}

// ── xlsx ──
async function buildWorkbook(data: ParsedSheetData): Promise<Uint8Array<ArrayBuffer>> {
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

  if (format === 'xlsx') {
    const buf = await buildWorkbook(data);
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
