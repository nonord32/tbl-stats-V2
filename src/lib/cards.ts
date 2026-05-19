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
  Card1Fighter,
  Card2Data,
  Card3Data,
  Card4Data,
  Card4Side,
  FinishMethod,
  HotStreakHistoryEntry,
} from '@/components/cards/shared';

// Normalize "Decision", "KO", "TKO", "Knockdown", etc → KO | TKO | KD | DEC.
// Knockdown stays distinct from KO (the bout still went the distance — KO
// would mean the fight ended on the knockdown).
function normalizeMethod(raw: string | undefined): FinishMethod {
  const m = (raw || '').trim().toUpperCase();
  if (m === 'KNOCKDOWN' || m.startsWith('KD')) return 'KD';
  if (m.startsWith('KO')) return 'KO';
  if (m.startsWith('TKO') || m === 'RSC' || m === 'RTD') return 'TKO';
  return 'DEC';
}

// Whole-number formatting — top performers + hot streak totals are displayed
// without decimals (e.g. "+24", "-3", "0").
function fmtPts(n: number): string {
  const rounded = Math.round(n);
  return (rounded > 0 ? '+' : '') + rounded;
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
// Returns the full ranking for the given week (every fighter who fought
// that week, sorted by net points desc). The admin UI slices this to the
// desired display count.
export function computeTopPerformersForWeek(
  fighters: FighterStat[],
  history: Record<string, FightHistory[]>,
  schedule: ScheduleEntry[],
  week: number
): Card1Fighter[] {
  const weekMatchIdx = new Set(
    schedule
      .filter((s) => Number(s.week) === week && s.matchIndex != null)
      .map((s) => Number(s.matchIndex))
  );

  type Acc = {
    name: string;
    team: string;
    netPts: number;
    bouts: { roundId: number; method: FinishMethod }[];
  };
  const acc = new Map<string, Acc>();

  for (const f of fighters) {
    const hist = history[f.slug] || [];
    const weekBouts = hist.filter((h) => weekMatchIdx.has(h.matchIndex));
    if (weekBouts.length === 0) continue;
    const total = weekBouts.reduce((s, h) => s + h.netPts, 0);
    const bouts = weekBouts
      // Display in fight order, oldest first, so "TKO/DEC" reads chronologically.
      .slice()
      .sort((a, b) => a.roundId - b.roundId)
      .map((b) => ({ roundId: b.roundId, method: normalizeMethod(b.resultMethod) }));
    acc.set(f.slug, { name: f.name, team: f.team, netPts: total, bouts });
  }

  return [...acc.values()]
    .sort((a, b) => b.netPts - a.netPts)
    .map((a) => ({
      name: a.name,
      team: teamShort(a.team),
      pts: fmtPts(a.netPts),
      method: a.bouts.map((x) => x.method).join('/'),
    }));
}

// Build a per-week ranking for every week that has any fight data, so the
// admin can switch weeks client-side without another fetch.
export function computeTopPerformersByWeek(
  fighters: FighterStat[],
  history: Record<string, FightHistory[]>,
  schedule: ScheduleEntry[]
): { byWeek: Record<number, Card1Fighter[]>; weeks: number[] } {
  const weeks = Array.from(
    new Set(
      schedule
        .filter((s) => Number(s.week) > 0 && s.matchIndex != null)
        .map((s) => Number(s.week))
    )
  ).sort((a, b) => a - b);

  const byWeek: Record<number, Card1Fighter[]> = {};
  for (const w of weeks) {
    const ranked = computeTopPerformersForWeek(fighters, history, schedule, w);
    if (ranked.length > 0) byWeek[w] = ranked;
  }
  return { byWeek, weeks: weeks.filter((w) => byWeek[w]?.length) };
}

export function computeTopPerformers(
  fighters: FighterStat[],
  history: Record<string, FightHistory[]>,
  schedule: ScheduleEntry[],
  week: number,
  count = 6
): Card1Data {
  const ranked = computeTopPerformersForWeek(fighters, history, schedule, week);
  return { week, fighters: ranked.slice(0, count) };
}

// ─── Card 2 — Hot Streak (last N rounds, ranked by sum) ──────────────────────
// Returns each fighter's full recent net-points history (oldest first,
// capped at MAX_HOTSTREAK_HISTORY) so the admin UI can slide the rounds
// window without another fetch.
const MAX_HOTSTREAK_HISTORY = 20;

export function computeHotStreakHistory(
  fighters: FighterStat[],
  history: Record<string, FightHistory[]>
): HotStreakHistoryEntry[] {
  const rows: HotStreakHistoryEntry[] = [];
  for (const f of fighters) {
    const hist = history[f.slug] || [];
    if (hist.length === 0) continue;
    // history is desc by date — take the most recent N, reverse to
    // chronological order so the sparkline reads left→right oldest→newest.
    const allPts = hist
      .slice(0, MAX_HOTSTREAK_HISTORY)
      .reverse()
      .map((h) => h.netPts);
    rows.push({ name: f.name, team: teamShort(f.team), allPts });
  }
  return rows;
}

export function sliceHotStreak(
  entries: HotStreakHistoryEntry[],
  rounds: number,
  count: number
): Card2Data {
  const r = Math.max(1, rounds);
  return {
    rounds: r,
    fighters: entries
      .filter((e) => e.allPts.length >= r)
      .map((e) => {
        const pts = e.allPts.slice(-r);
        return {
          name: e.name,
          team: e.team,
          pts,
          total: pts.reduce((s, n) => s + n, 0),
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, count)
      .map(({ name, team, pts }) => ({ name, team, pts })),
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
