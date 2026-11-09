// src/lib/api/v1.ts
// Serializers for the public, read-only JSON API (/api/v1/*) consumed by the
// official Team Boxing League website (Shopify).
//
// Everything here is a pure function of the ParsedSheetData that getAllData()
// already produces for the site, and reuses the site's own helpers (standings
// sort, per-phase aggregation, fighter stat derivation) so the API numbers are
// always identical to what tblstats.com shows. Nothing in here changes any
// existing page.

import type {
  FighterStat,
  FightHistory,
  MatchResult,
  ParsedSheetData,
  TeamStanding,
} from '@/types';
import { extractUniqueMatches, calcFighterStreak, toSlug } from '@/lib/data';
import {
  aggregateTeamStandingsByPhase,
  filterTeamMatchesByPhase,
  type Phase,
} from '@/lib/phaseStats';
import { sortStandings } from '@/lib/standings';
import {
  getCityName,
  getFullTeamName,
  getTeamColor,
  getTeamSlugByName,
} from '@/lib/teams';
import { getFighterWeightClassesOrdered } from '@/lib/fighters';

const SITE = 'https://tblstats.com';

// ─── Phase ─────────────────────────────────────────────────────────────────────
// Every endpoint takes an optional ?phase= and echoes it in meta.phase. All the
// builders below already work for any phase ('regular' | 'playoffs' | 'all');
// what the API *offers* is controlled only by AVAILABLE_PHASES.
//
// The API is regular-season only for now. To open up the playoffs later, add
// 'playoffs' (and/or 'all') to AVAILABLE_PHASES and update API.md.
export type ApiPhase = Phase; // 'regular' | 'playoffs' | 'all'

const KNOWN_PHASES: readonly ApiPhase[] = ['regular', 'playoffs', 'all'];
export const AVAILABLE_PHASES: readonly ApiPhase[] = ['regular'];
export const DEFAULT_PHASE: ApiPhase = 'regular';

export type PhaseResult =
  | { ok: true; phase: ApiPhase }
  | { ok: false; code: string; message: string };

/** Validate ?phase=…, applying the default when it's missing. */
export function resolvePhase(raw: string | null): PhaseResult {
  if (raw == null || raw.trim() === '') return { ok: true, phase: DEFAULT_PHASE };
  const v = raw.trim().toLowerCase() as ApiPhase;
  if (AVAILABLE_PHASES.includes(v)) return { ok: true, phase: v };
  if (KNOWN_PHASES.includes(v)) {
    return {
      ok: false,
      code: 'phase_not_available',
      message: `phase "${v}" is not available yet. Available: ${AVAILABLE_PHASES.join(', ')}.`,
    };
  }
  return {
    ok: false,
    code: 'invalid_phase',
    message: `phase must be one of: ${AVAILABLE_PHASES.join(', ')}.`,
  };
}

// ─── Teams ─────────────────────────────────────────────────────────────────────
// Internal city key (see src/lib/teams.ts) → Shopify page handle. These must
// match the Shopify page handles exactly; do not derive them from names.
export const SHOPIFY_TEAM_HANDLES: Record<string, string> = {
  'los-angeles': 'la-elite',
  'las-vegas': 'las-vegas-hustle-1',
  phoenix: 'phoenix-fury',
  dallas: 'dallas-enforcers',
  houston: 'houston-hitmen',
  'san-antonio': 'san-antonio-snipers',
  boston: 'boston-butchers',
  philadelphia: 'philly-smoke',
  nyc: 'nyc-attitude-1',
  atlanta: 'atlanta-attack',
  miami: 'miami-assassins',
  nashville: 'nashville-smash-1',
};

// TBL's official display names, keyed by city key. Exposed as `short_name`;
// `name` stays the long-standing full name so existing consumers don't break.
export const OFFICIAL_SHORT_NAMES: Record<string, string> = {
  'los-angeles': 'LA Elite',
  'las-vegas': 'Las Vegas Hustle',
  phoenix: 'Phoenix Fury',
  dallas: 'Dallas Enforcers',
  houston: 'Houston Hitmen',
  'san-antonio': 'San Antonio Snipers',
  boston: 'Boston Butchers',
  philadelphia: 'Philadelphia Smoke',
  nyc: 'NYC Attitude',
  atlanta: 'Atlanta Attack',
  miami: 'Miami Assassins',
  nashville: 'Nashville Smash',
};

// Extra spellings the sheet might use that the city-key matcher won't catch.
const TEAM_ALIASES: Record<string, string> = {
  la: 'los-angeles',
  'la-elite': 'los-angeles',
  vegas: 'las-vegas',
  philly: 'philadelphia',
  'philly-smoke': 'philadelphia',
  'new-york': 'nyc',
  'new-york-city': 'nyc',
};

/** Internal city key for any team name the sheet uses ("Dallas", "Dallas Enforcers"…). */
function teamKeyOf(name: string): string {
  const key = getTeamSlugByName(name);
  if (key) return key;
  const s = name.toLowerCase().trim().replace(/\s+/g, '-');
  for (const [alias, k] of Object.entries(TEAM_ALIASES)) {
    if (s === alias || s.startsWith(alias + '-')) return k;
  }
  return '';
}

/** Shopify handle for a team name; falls back to a name slug for unknown teams. */
export function teamHandleOf(name: string): string {
  const key = teamKeyOf(name);
  return SHOPIFY_TEAM_HANDLES[key] ?? toSlug(name);
}

function teamRef(name: string) {
  const key = teamKeyOf(name);
  return {
    slug: SHOPIFY_TEAM_HANDLES[key] ?? toSlug(name),
    name: key ? getFullTeamName(key) : name,
    short_name: OFFICIAL_SHORT_NAMES[key] ?? name,
    city: key ? getCityName(key) : name,
    color: key ? getTeamColor(key) || null : null,
    logo_url: key ? `${SITE}/logos/${key}.png` : null,
  };
}

// ─── Fighters ──────────────────────────────────────────────────────────────────
// Every fighter is identified by the stable "Fighter ID" from the Data tab.
// Until that column is filled in, a fighter falls back to a temporary ID (their
// name slug) and is marked id_is_stable: false.
function fighterIdOf(data: ParsedSheetData, slug: string) {
  const id = data.fighterIds?.[slug];
  return id ? { id, id_is_stable: true } : { id: slug, id_is_stable: false };
}

function fighterRef(data: ParsedSheetData, name: string) {
  const slug = toSlug(name);
  return { ...fighterIdOf(data, slug), name };
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

function fighterStats(f: FighterStat | null) {
  const wins = f?.wins ?? 0;
  const losses = f?.losses ?? 0;
  const rounds = f?.rounds ?? 0;
  const draws = Math.max(0, rounds - wins - losses);
  return {
    wins,
    losses,
    draws,
    record: `${wins}-${losses}-${draws}`,
    rounds,
    win_pct: round3(f?.winPct ?? 0),
    net_points: round3(f?.netPts ?? 0),
    nppr: round3(f?.nppr ?? 0),
    points_scored: round3(f?.pointsFor ?? 0),
    points_allowed: round3(f?.pointsAgainst ?? 0),
    points_allowed_per_round: rounds > 0 ? round3((f?.pointsAgainst ?? 0) / rounds) : 0,
    war: round3(f?.war ?? 0),
    ko_tko: f?.koTko ?? 0,
    knockdowns: f?.knockdowns ?? 0,
    double_knockdowns: f?.doubleKnockdowns ?? 0,
  };
}

function fightersForPhase(data: ParsedSheetData, phase: ApiPhase): FighterStat[] {
  return phase === 'all' ? data.fighters : data.fightersByPhase[phase] ?? [];
}

function fighterSummary(data: ParsedSheetData, f: FighterStat) {
  return {
    ...fighterIdOf(data, f.slug),
    name: f.name,
    team: teamRef(f.team),
    weight_class: f.weightClass || null,
    gender: f.gender || null,
    profile_url: `${SITE}/fighters/${f.slug}`,
  };
}

// ─── Dates ─────────────────────────────────────────────────────────────────────
function isoDate(raw: string): string | null {
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function meta(data: ParsedSheetData, phase: ApiPhase) {
  return {
    phase,
    // When the stats data was last updated (ISO 8601), and which clock that is:
    //   'sheet_modified' — Google's own modified time for the Data tab;
    //   'data_fetched'   — when the Data tab was last downloaded from Google and
    //                      successfully parsed (used when Google doesn't send a
    //                      modified time). See dataUpdated in src/lib/data.ts.
    sheet_last_updated: data.dataUpdated?.at ?? null,
    sheet_last_updated_source: data.dataUpdated?.source ?? null,
    generated_at: new Date().toISOString(),
  };
}

/** True when the sheet clearly failed to load (vs. a legitimately empty phase). */
export function isDataUnavailable(data: ParsedSheetData): boolean {
  return data.teams.length === 0 && Object.keys(data.teamMatches).length === 0;
}

// ─── /standings ────────────────────────────────────────────────────────────────
function rankedStandings(data: ParsedSheetData, phase: ApiPhase) {
  const matches = filterTeamMatchesByPhase(data.teamMatches, phase);
  // Same computation the Teams page uses: per-phase records recomputed from
  // match data, ordered by the league tiebreaker rules.
  const phaseTeams = aggregateTeamStandingsByPhase(data.teams, data.teamMatches, phase);
  const ordered = sortStandings(phaseTeams, matches);
  // Teams that haven't played in this phase yet still appear, at the bottom.
  const present = new Set(ordered.map((t) => t.slug));
  const idle: TeamStanding[] = data.teams
    .filter((t) => !present.has(t.slug))
    .map((t) => ({ ...t, wins: 0, losses: 0, record: '0-0', pf: 0, pa: 0, diff: 0, streak: '' }));
  return { ordered: [...ordered, ...idle], matches };
}

function standingRow(t: TeamStanding, rank: number, matches: ReturnType<typeof filterTeamMatchesByPhase>) {
  const played = matches[t.team] ?? [];
  const draws = played.filter((m) => m.result === 'D').length;
  return {
    rank,
    team: teamRef(t.team),
    wins: t.wins,
    losses: t.losses,
    draws,
    record: `${t.wins}-${t.losses}-${draws}`,
    matches_played: played.length,
    points_for: round3(t.pf),
    points_against: round3(t.pa),
    point_diff: round3(t.diff),
    streak: t.streak || null,
  };
}

export function buildStandings(data: ParsedSheetData, phase: ApiPhase) {
  const { ordered, matches } = rankedStandings(data, phase);
  return {
    data: ordered.map((t, i) => standingRow(t, i + 1, matches)),
    meta: meta(data, phase),
  };
}

// ─── /leaders ──────────────────────────────────────────────────────────────────
type Stats = ReturnType<typeof fighterStats>;
interface Category {
  key: string;
  label: string;
  value: (s: Stats) => number;
  order: 'desc' | 'asc';
  qualified?: boolean; // rate stat → minimum-rounds cutoff applies
}

// Listed in display order — Net Points first, as requested.
const CATEGORIES: Category[] = [
  { key: 'net_points', label: 'Net Points', value: (s) => s.net_points, order: 'desc' },
  { key: 'points_scored', label: 'Points Scored', value: (s) => s.points_scored, order: 'desc' },
  { key: 'points_allowed_per_round', label: 'Fewest Points Allowed per Round', value: (s) => s.points_allowed_per_round, order: 'asc', qualified: true },
  { key: 'war', label: 'WAR', value: (s) => s.war, order: 'desc' },
  { key: 'wins', label: 'Wins', value: (s) => s.wins, order: 'desc' },
  { key: 'win_pct', label: 'Win %', value: (s) => s.win_pct, order: 'desc', qualified: true },
  { key: 'nppr', label: 'Net Points per Round', value: (s) => s.nppr, order: 'desc', qualified: true },
  { key: 'ko_tko', label: 'KO / TKO', value: (s) => s.ko_tko, order: 'desc' },
  { key: 'knockdowns', label: 'Knockdowns', value: (s) => s.knockdowns, order: 'desc' },
];

export const LEADER_CATEGORY_KEYS = CATEGORIES.map((c) => c.key);

export function buildLeaders(
  data: ParsedSheetData,
  phase: ApiPhase,
  opts: { limit: number; minRounds: number | null; category: string | null },
) {
  const fighters = fightersForPhase(data, phase).map((f) => ({ f, s: fighterStats(f) }));

  // Default qualifier for rate stats: at least half the average rounds fought.
  const avgRounds =
    fighters.length > 0 ? fighters.reduce((n, x) => n + x.s.rounds, 0) / fighters.length : 0;
  const minRounds = opts.minRounds ?? Math.max(1, Math.ceil(avgRounds / 2));

  const cats = opts.category ? CATEGORIES.filter((c) => c.key === opts.category) : CATEGORIES;

  const categories = cats.map((c) => {
    const pool = fighters.filter((x) => !c.qualified || x.s.rounds >= minRounds);
    pool.sort((a, b) => {
      const d = c.order === 'desc' ? c.value(b.s) - c.value(a.s) : c.value(a.s) - c.value(b.s);
      return d !== 0 ? d : a.f.name.localeCompare(b.f.name);
    });
    // Standard competition ranking: ties share a rank (1, 2, 2, 4).
    let rank = 0;
    let prev: number | null = null;
    const leaders = pool.slice(0, opts.limit).map((x, i) => {
      const v = c.value(x.s);
      if (prev === null || v !== prev) rank = i + 1;
      prev = v;
      return {
        rank,
        value: v,
        fighter: fighterSummary(data, x.f),
        record: x.s.record,
        rounds: x.s.rounds,
      };
    });
    return {
      key: c.key,
      label: c.label,
      order: c.order === 'desc' ? 'highest_first' : 'lowest_first',
      min_rounds: c.qualified ? minRounds : null,
      leaders,
    };
  });

  return { data: categories, meta: { ...meta(data, phase), limit: opts.limit } };
}

// ─── Matches (shared by /results/latest) ───────────────────────────────────────
function matchJson(data: ParsedSheetData, m: MatchResult) {
  const sched = data.schedule.find((s) => s.matchIndex === m.matchIndex) ?? null;
  const team1Wins = m.result === 'W';
  const team2Wins = m.result === 'L';
  return {
    match_id: m.matchIndex,
    date: isoDate(m.date),
    week: sched && sched.week > 0 ? sched.week : null,
    season_phase: m.phase,
    venue: sched ? { name: sched.venueName || null, city: sched.venueCity || null } : null,
    stats_url: `${SITE}/matches/${m.matchIndex}`,
    team1: { ...teamRef(m.team1), score: round3(m.score1), rounds_won: m.wins1 },
    team2: { ...teamRef(m.team2), score: round3(m.score2), rounds_won: m.wins2 },
    winner: team1Wins ? 'team1' : team2Wins ? 'team2' : 'draw',
    rounds: [...m.boxScore]
      .sort((a, b) => (a.roundId ?? a.round) - (b.roundId ?? b.round))
      .map((r) => ({
        round: r.round,
        round_id: r.roundId ?? null,
        round_phase: r.phase || null,
        weight_class: r.weightClass || null,
        method: r.method || null,
        team1_fighter: { ...fighterRef(data, r.fighter1), score: round3(r.score1) },
        team2_fighter: { ...fighterRef(data, r.fighter2), score: round3(r.score2) },
        winner: r.winner === r.fighter1 && r.winner ? 'team1' : r.winner === r.fighter2 && r.winner ? 'team2' : 'draw',
      })),
  };
}

// ─── /results/latest ───────────────────────────────────────────────────────────
export function buildLatestResults(data: ParsedSheetData, phase: ApiPhase) {
  const all = extractUniqueMatches(data.teamMatches).filter(
    (m) => phase === 'all' || m.phase === phase,
  );
  const dated = all.filter((m) => isoDate(m.date) !== null);
  const latest = dated.reduce<string | null>((best, m) => {
    const d = isoDate(m.date)!;
    return best === null || d > best ? d : best;
  }, null);
  const matches = latest
    ? dated.filter((m) => isoDate(m.date) === latest).sort((a, b) => a.matchIndex - b.matchIndex)
    : [];
  return {
    data: latest
      ? { date: latest, matches: matches.map((m) => matchJson(data, m)) }
      : null,
    meta: meta(data, phase),
  };
}

// ─── /teams/[slug] ─────────────────────────────────────────────────────────────
export const KNOWN_TEAM_SLUGS = Object.values(SHOPIFY_TEAM_HANDLES);

export function buildTeam(data: ParsedSheetData, slug: string, phase: ApiPhase) {
  const { ordered, matches } = rankedStandings(data, phase);
  const idx = ordered.findIndex((t) => teamHandleOf(t.team) === slug);
  if (idx < 0) return null;
  const team = ordered[idx];
  const key = teamKeyOf(team.team);

  const roster = fightersForPhase(data, phase)
    .filter((f) => (key ? teamKeyOf(f.team) === key : f.team === team.team))
    .sort((a, b) => b.netPts - a.netPts || a.name.localeCompare(b.name))
    .map((f) => ({ ...fighterSummary(data, f), stats: fighterStats(f) }));

  return {
    data: {
      ...teamRef(team.team),
      stats_url: `${SITE}/teams/${team.slug}`,
      standing: standingRow(team, idx + 1, matches),
      roster,
    },
    meta: meta(data, phase),
  };
}

// ─── /fighters/[id] ────────────────────────────────────────────────────────────
function findFighterSlug(data: ParsedSheetData, id: string): string | null {
  const wanted = id.trim().toLowerCase();
  if (!wanted) return null;
  // 1. Stable ID from the sheet.
  for (const [slug, fid] of Object.entries(data.fighterIds ?? {})) {
    if (fid.trim().toLowerCase() === wanted) return slug;
  }
  // 2. Temporary ID — only for fighters who don't have a stable ID yet.
  const f = data.fighters.find((x) => x.slug === wanted);
  if (f && !data.fighterIds?.[f.slug]) return f.slug;
  return null;
}

function fightJson(data: ParsedSheetData, h: FightHistory) {
  return {
    date: isoDate(h.date),
    match_id: h.matchIndex,
    round_id: h.roundId,
    round: Number(h.round) || null,
    round_phase: h.roundPhase || null,
    season_phase: h.phase,
    week: h.week ?? null,
    weight_class: h.weightClass || null,
    opponent: { ...fighterRef(data, h.opponent), team: teamRef(h.opponentTeam) },
    result: h.result,
    method: h.resultMethod || null,
    points_scored: round3(h.pointsFor),
    points_allowed: round3(h.pointsAgainst),
    net_points: round3(h.netPts),
    match_url: `${SITE}/matches/${h.matchIndex}`,
  };
}

export function buildFighter(data: ParsedSheetData, id: string, phase: ApiPhase) {
  const slug = findFighterSlug(data, id);
  if (!slug) return null;
  const career = data.fighters.find((f) => f.slug === slug);
  if (!career) return null;
  const scoped = fightersForPhase(data, phase).find((f) => f.slug === slug) ?? null;

  const weekByMatch = new Map<number, number>();
  for (const s of data.schedule) {
    if (s.matchIndex != null && s.week > 0) weekByMatch.set(s.matchIndex, s.week);
  }
  const fullHistory = (data.fighterHistory[slug] ?? []).map((h) => {
    const week = weekByMatch.get(h.matchIndex);
    return week != null ? { ...h, week } : h;
  });
  const history = fullHistory.filter((h) => phase === 'all' || h.phase === phase);

  return {
    data: {
      ...fighterSummary(data, scoped ?? career),
      weight_classes: getFighterWeightClassesOrdered(career, fullHistory),
      instagram: career.instagram || null,
      streak: calcFighterStreak(history) || null,
      stats: fighterStats(scoped),
      fights: history.map((h) => fightJson(data, h)),
    },
    meta: meta(data, phase),
  };
}
