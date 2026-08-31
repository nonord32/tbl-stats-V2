// src/app/api/admin/export/route.ts
// Admin-only CSV export of the code-recalculated data, so the operator can see
// exactly where every number comes from. Same RESOLVE_SECRET bearer auth as the
// other admin routes. ?type=fighters|standings|matches.
//
// The fighters export is also the WAR-reconciliation tool: it prints the WAR
// formula and each scope's league constants (Replacement PPR + Avg Margin),
// then every fighter's NPPR / Rounds / WAR — so a sheet vs code delta can be
// traced to a specific input.
import { getAllData, extractUniqueMatches } from '@/lib/data';
import { sortStandings } from '@/lib/standings';
import { leagueBaseline } from '@/lib/warStats';

export const dynamic = 'force-dynamic';

type Cell = string | number;

function csvCell(v: Cell): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(rows: Cell[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\n');
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

  const type = new URL(request.url).searchParams.get('type') ?? 'fighters';
  const data = await getAllData();
  let rows: Cell[][];

  if (type === 'fighters') {
    const uniqueMatches = extractUniqueMatches(data.teamMatches);
    const scopes = ['all', 'regular', 'playoffs'] as const;
    const baselines = {
      all: leagueBaseline(data.fighterHistory, uniqueMatches, 'all'),
      regular: leagueBaseline(data.fighterHistory, uniqueMatches, 'regular'),
      playoffs: leagueBaseline(data.fighterHistory, uniqueMatches, 'playoffs'),
    };
    const regBySlug = new Map(data.fightersByPhase.regular.map((f) => [f.slug, f]));
    const poBySlug = new Map(data.fightersByPhase.playoffs.map((f) => [f.slug, f]));

    rows = [
      ['FORMULA', 'WAR = (NPPR - Replacement PPR) * Rounds / Avg Margin Per Match'],
      ['SCOPE', 'Replacement PPR (25th pct NPPR)', 'Avg Margin Per Match'],
      ['season (all)', baselines.all.replacementNppr.toFixed(4), baselines.all.avgMargin.toFixed(4)],
      ['regular', baselines.regular.replacementNppr.toFixed(4), baselines.regular.avgMargin.toFixed(4)],
      ['playoffs', baselines.playoffs.replacementNppr.toFixed(4), baselines.playoffs.avgMargin.toFixed(4)],
      ['NOTE', 'WAR per scope uses that scope’s baseline; rate stats (WAR/NPPR/Win%) do not sum across scopes'],
      [],
      ['slug', 'name', 'team', 'weightClass', 'gender', 'record', 'wins', 'losses', 'rounds', 'netPts', 'nppr', 'winPct', 'war_season', 'war_regular', 'war_playoffs'],
    ];
    for (const f of [...data.fighters].sort((a, b) => b.war - a.war)) {
      const reg = regBySlug.get(f.slug);
      const po = poBySlug.get(f.slug);
      rows.push([
        f.slug, f.name, f.team, f.weightClass, f.gender, f.record, f.wins, f.losses,
        f.rounds, f.netPts.toFixed(1), f.nppr.toFixed(4), (f.winPct * 100).toFixed(1),
        f.war.toFixed(4), reg ? reg.war.toFixed(4) : '', po ? po.war.toFixed(4) : '',
      ]);
    }
  } else if (type === 'standings') {
    const standings = sortStandings(data.teams, data.teamMatches);
    rows = [['rank', 'team', 'record', 'wins', 'losses', 'pf', 'pa', 'diff', 'streak']];
    standings.forEach((t, i) =>
      rows.push([i + 1, t.team, t.record, t.wins, t.losses, Math.round(t.pf), Math.round(t.pa), Math.round(t.diff), t.streak]),
    );
  } else if (type === 'matches') {
    rows = [['matchIndex', 'date', 'team1', 'team2', 'score1', 'score2', 'margin', 'result', 'phase']];
    for (const m of extractUniqueMatches(data.teamMatches)) {
      rows.push([m.matchIndex, m.date, m.team1, m.team2, m.score1, m.score2, Math.abs(m.score1 - m.score2), m.result, m.phase]);
    }
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
