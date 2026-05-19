// src/lib/cards.ts
// Compute the four weekly IG card payloads from the existing sheet data.

import { toSlug } from './data';
import type {
  FighterStat,
  FightHistory,
  ScheduleEntry,
} from '@/types';
import type {
  Card1Data,
  Card2Data,
  Card3Data,
  Card4Data,
  Card4Side,
  FinishMethod,
} from '@/components/cards/shared';

// Normalize "Decision", "KO", "TKO", "Knockdown", etc → KO | TKO | DEC.
function normalizeMethod(raw: string | undefined): FinishMethod {
  const m = (raw || '').trim().toUpperCase();
  if (m.startsWith('KO') || m === 'KNOCKDOWN') return 'KO';
  if (m.startsWith('TKO') || m === 'RSC' || m === 'RTD') return 'TKO';
  return 'DEC';
}

function fmtPts(n: number): string {
  return (n >= 0 ? '+' : '') + n.toFixed(1);
}

function teamShort(team: string): string {
  // Map full team names to 3-letter codes used on the cards.
  const map: Record<string, string> = {
    atlanta: 'ATL',
    boston: 'BOS',
    dallas: 'DAL',
    houston: 'HOU',
    'las vegas': 'LV',
    'los angeles': 'LAX',
    miami: 'MIA',
    nashville: 'NSH',
    nyc: 'NYC',
    'new york': 'NYC',
    philadelphia: 'PHI',
    phoenix: 'PHX',
    'san antonio': 'SA',
  };
  const key = (team || '').toLowerCase().trim();
  if (map[key]) return map[key];
  // Fall back to a 3-letter uppercase slug of the first significant word.
  const word = key.split(/\s+/)[0] || '';
  return word.slice(0, 3).toUpperCase() || team.slice(0, 3).toUpperCase();
}

// ─── Card 1 — Top Performers (current week) ──────────────────────────────────
export function computeTopPerformers(
  fighters: FighterStat[],
  history: Record<string, FightHistory[]>,
  schedule: ScheduleEntry[],
  week: number
): Card1Data {
  // Match indices that belong to this week.
  const weekMatchIdx = new Set(
    schedule
      .filter((s) => Number(s.week) === week && s.matchIndex != null)
      .map((s) => Number(s.matchIndex))
  );

  type Acc = { name: string; team: string; netPts: number; method: FinishMethod };
  const acc = new Map<string, Acc>();

  for (const f of fighters) {
    const hist = history[f.slug] || [];
    const weekBouts = hist.filter((h) => weekMatchIdx.has(h.matchIndex));
    if (weekBouts.length === 0) continue;
    const total = weekBouts.reduce((s, h) => s + h.netPts, 0);
    // Prefer a finish method if any bout was a finish; otherwise DEC.
    let method: FinishMethod = 'DEC';
    for (const b of weekBouts) {
      const m = normalizeMethod(b.resultMethod);
      if (m === 'KO') { method = 'KO'; break; }
      if (m === 'TKO') method = 'TKO';
    }
    acc.set(f.slug, { name: f.name, team: f.team, netPts: total, method });
  }

  const top = [...acc.values()]
    .sort((a, b) => b.netPts - a.netPts)
    .slice(0, 6)
    .map((a) => ({
      name: a.name,
      team: teamShort(a.team),
      pts: fmtPts(a.netPts),
      method: a.method,
    }));

  return { week, fighters: top };
}

// ─── Card 2 — Hot Streak (last 5 bouts, ranked by sum) ───────────────────────
export function computeHotStreak(
  fighters: FighterStat[],
  history: Record<string, FightHistory[]>
): Card2Data {
  type Row = { name: string; team: string; pts: number[]; total: number };
  const rows: Row[] = [];

  for (const f of fighters) {
    const hist = history[f.slug] || [];
    if (hist.length < 5) continue;
    // history is pre-sorted desc; take the most recent 5 then reverse to
    // chronological order so the sparkline reads left→right oldest→newest.
    const last5 = hist.slice(0, 5).reverse().map((h) => h.netPts);
    const total = last5.reduce((s, n) => s + n, 0);
    rows.push({ name: f.name, team: teamShort(f.team), pts: last5, total });
  }

  rows.sort((a, b) => b.total - a.total);
  return {
    fighters: rows.slice(0, 6).map(({ name, team, pts }) => ({ name, team, pts })),
  };
}

// ─── Card 3 — Finish Rates ((KO+TKO) / total wins, min 5 fights) ─────────────
export function computeFinishRates(
  fighters: FighterStat[],
  history: Record<string, FightHistory[]>
): Card3Data {
  type Row = { name: string; team: string; finishRate: number; totalFights: number };
  const rows: Row[] = [];

  for (const f of fighters) {
    const hist = history[f.slug] || [];
    if (hist.length < 5) continue;
    const wins = hist.filter((h) => h.result === 'W');
    if (wins.length === 0) continue;
    const finishes = wins.filter((h) => {
      const m = normalizeMethod(h.resultMethod);
      return m === 'KO' || m === 'TKO';
    }).length;
    rows.push({
      name: f.name,
      team: teamShort(f.team),
      finishRate: finishes / wins.length,
      totalFights: hist.length,
    });
  }

  rows.sort((a, b) => b.finishRate - a.finishRate || b.totalFights - a.totalFights);
  return { fighters: rows.slice(0, 6) };
}

// ─── Card 4 — Tale Of The Tape (featured upcoming matchup) ───────────────────
// Heuristic: next upcoming match (smallest week with status Upcoming, then
// earliest date). For each team in that match pick the fighter with the
// highest season WAR as the headliner.
export function computeFeaturedMatchup(
  fighters: FighterStat[],
  history: Record<string, FightHistory[]>,
  schedule: ScheduleEntry[],
  fallbackWeek: number
): Card4Data {
  const upcoming = schedule
    .filter((s) => s.status === 'Upcoming' && Number(s.week) > 0)
    .sort(
      (a, b) =>
        Number(a.week) - Number(b.week) ||
        new Date(a.date).getTime() - new Date(b.date).getTime()
    );

  const featured = upcoming[0];
  const week = featured ? Number(featured.week) : fallbackWeek;
  const team1 = featured?.team1 || '';
  const team2 = featured?.team2 || '';

  function sideFor(team: string): Card4Side {
    const roster = fighters
      .filter((f) => f.team && f.team.toLowerCase() === team.toLowerCase())
      .sort((a, b) => b.war - a.war);
    const headliner = roster[0];
    if (!headliner) {
      return { name: team || 'TBA', team, record: '0-0', netPts: 0, roundWinPct: 0, last3: [] };
    }
    const hist = history[headliner.slug] || [];
    const last3 = hist.slice(0, 3).map<'w' | 'l'>((h) => (h.result === 'W' ? 'w' : 'l'));
    const totalRounds = hist.length;
    const wonRounds = hist.filter((h) => h.result === 'W').length;
    const roundWinPct = totalRounds > 0 ? Math.round((wonRounds / totalRounds) * 100) : 0;
    return {
      name: headliner.name,
      team,
      record: headliner.record || `${headliner.wins}-${headliner.losses}`,
      netPts: Number(headliner.netPts.toFixed(1)),
      roundWinPct,
      last3,
    };
  }

  return { week, a: sideFor(team1), b: sideFor(team2) };
}
