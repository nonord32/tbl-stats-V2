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
import type { MatchWpa } from '@/lib/wpa/core';
import { computeMatchComeback, comebackDrivers } from '@/lib/wpa/comebacks';
import {
  CAREER,
  CURRENT_SEASON_ID,
  currentSeason,
  getSeason,
  normalizeSeasonId,
  seasonsNewestFirst,
  type SeasonDef,
} from '@/lib/seasons';
import { combineStatLines, groupFightersAcrossSeasons, type StatLine } from './career';

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

// ─── Season ────────────────────────────────────────────────────────────────────
// Every endpoint takes an optional ?season= (default: the current season) and
// echoes it in meta.season. /leaders also accepts season=career (all seasons).
export type SeasonResult =
  | { ok: true; season: string } // a season id, or 'career'
  | { ok: false; code: string; message: string };

export function resolveSeason(raw: string | null, opts: { allowCareer?: boolean } = {}): SeasonResult {
  if (raw == null || raw.trim() === '') return { ok: true, season: currentSeason().id };
  const v = raw.trim().toLowerCase();
  if (opts.allowCareer && v === CAREER) return { ok: true, season: CAREER };
  const id = normalizeSeasonId(v);
  if (id) return { ok: true, season: id };
  const allowed = seasonsNewestFirst().map((s) => s.id);
  if (opts.allowCareer) allowed.push(CAREER);
  return { ok: false, code: 'invalid_season', message: `season must be one of: ${allowed.join(', ')}.` };
}

function seasonRef(def: SeasonDef | null) {
  if (!def) return null;
  return { id: def.id, year: def.year, number: def.number, label: def.label, is_current: def.id === CURRENT_SEASON_ID };
}

function seasonOf(data: ParsedSheetData) {
  return seasonRef(getSeason(data.season ?? '') ?? currentSeason());
}

const CAREER_REF = { id: CAREER, year: null, number: null, label: 'Career', is_current: false };

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
  const extras = data.fighterProfiles?.[f.slug];
  return {
    ...fighterIdOf(data, f.slug),
    name: f.name,
    team: teamRef(f.team),
    weight_class: f.weightClass || null,
    gender: f.gender || null,
    profile_url: `${SITE}/fighters/${f.slug}`,
    // Optional, from the Fighter Stats tab ("Bio", "Photo URL" columns).
    bio: extras?.bio ?? null,
    photo_url: extras?.photoUrl ?? null,
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
    season: seasonOf(data),
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

interface LeaderEntry {
  name: string;
  summary: ReturnType<typeof fighterSummary>;
  s: StatLine;
}

function rankLeaders(
  fighters: LeaderEntry[],
  opts: { limit: number; minRounds: number | null; category: string | null },
) {
  // Default qualifier for rate stats: at least half the average rounds fought.
  const avgRounds =
    fighters.length > 0 ? fighters.reduce((n, x) => n + x.s.rounds, 0) / fighters.length : 0;
  const minRounds = opts.minRounds ?? Math.max(1, Math.ceil(avgRounds / 2));

  const cats = opts.category ? CATEGORIES.filter((c) => c.key === opts.category) : CATEGORIES;

  return cats.map((c) => {
    const pool = fighters.filter((x) => !c.qualified || x.s.rounds >= minRounds);
    pool.sort((a, b) => {
      const d = c.order === 'desc' ? c.value(b.s) - c.value(a.s) : c.value(a.s) - c.value(b.s);
      return d !== 0 ? d : a.name.localeCompare(b.name);
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
        fighter: x.summary,
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
}

export function buildLeaders(
  data: ParsedSheetData,
  phase: ApiPhase,
  opts: { limit: number; minRounds: number | null; category: string | null },
) {
  const fighters = fightersForPhase(data, phase).map((f) => ({
    name: f.name,
    summary: fighterSummary(data, f),
    s: fighterStats(f),
  }));
  return { data: rankLeaders(fighters, opts), meta: { ...meta(data, phase), limit: opts.limit } };
}

// ─── Across seasons ────────────────────────────────────────────────────────────
export interface SeasonData {
  season: SeasonDef;
  data: ParsedSheetData;
}

interface SeasonFighter {
  seasonId: string;
  slug: string;
  id: string | null;
  season: SeasonDef;
  data: ParsedSheetData;
  f: FighterStat;
}

/** Every fighter in every season (for the given phase), grouped by person. Groups list seasons oldest first. */
function fightersAcrossSeasons(seasons: readonly SeasonData[], phase: ApiPhase): SeasonFighter[][] {
  const entries: SeasonFighter[] = [];
  for (const { season, data } of seasons) {
    for (const f of fightersForPhase(data, phase)) {
      entries.push({ seasonId: season.id, slug: f.slug, id: data.fighterIds?.[f.slug] ?? null, season, data, f });
    }
  }
  return [...groupFightersAcrossSeasons(entries).values()].map((g) =>
    [...g].sort((a, b) => a.season.year - b.season.year),
  );
}

/** /leaders?season=career — all-time leaders, with rates recomputed from career totals. */
export function buildCareerLeaders(
  seasons: readonly SeasonData[],
  phase: ApiPhase,
  opts: { limit: number; minRounds: number | null; category: string | null },
) {
  const fighters = fightersAcrossSeasons(seasons, phase).map((group) => {
    const latest = group[group.length - 1];
    return {
      name: latest.f.name,
      // Name, team and photo from their most recent season.
      summary: fighterSummary(latest.data, latest.f),
      s: combineStatLines(group.map((x) => fighterStats(x.f))),
    };
  });
  const newest = seasons[seasons.length - 1]?.data;
  const base = newest ? meta(newest, phase) : { phase, generated_at: new Date().toISOString() };
  return {
    data: rankLeaders(fighters, opts),
    meta: { ...base, season: CAREER_REF, seasons_included: seasons.map((x) => x.season.id), limit: opts.limit },
  };
}

// ─── /seasons ──────────────────────────────────────────────────────────────────
export function buildSeasons(withData: readonly SeasonData[]) {
  const has = new Set(withData.map((x) => x.season.id));
  return {
    data: seasonsNewestFirst().map((s) => ({
      ...seasonRef(s)!,
      complete: s.complete,
      has_data: has.has(s.id),
    })),
    meta: { current: CURRENT_SEASON_ID, generated_at: new Date().toISOString() },
  };
}

// ─── Matches (shared by /results/latest) ───────────────────────────────────────
function matchJson(data: ParsedSheetData, m: MatchResult) {
  const sched = data.schedule.find((s) => s.matchIndex === m.matchIndex) ?? null;
  const team1Wins = m.result === 'W';
  const team2Wins = m.result === 'L';
  return {
    match_id: m.matchIndex,
    // Match IDs restart each season, so links to a match should carry this too.
    season: data.season ?? CURRENT_SEASON_ID,
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

// ─── /schedule ─────────────────────────────────────────────────────────────────
// The season schedule from the Schedule tab, joined to results by Match ID.
// Completed entries carry the final score; upcoming entries carry the venue and
// time as typed in the sheet. "TBD" or blank teams come back as null.
export type ScheduleStatusFilter = 'all' | 'upcoming' | 'completed';
export const SCHEDULE_STATUSES: readonly ScheduleStatusFilter[] = ['all', 'upcoming', 'completed'];

function scheduleTeam(name: string) {
  const n = (name || '').trim();
  if (!n || /^tb[ad]$/i.test(n)) return null;
  return teamRef(n);
}

// The Schedule tab usually writes dates without a year ("Fri, Mar 20"), which
// JavaScript would read as 2001. Use the year when the sheet gives one;
// otherwise pick the year that puts the date nearest to today (so a fixture
// in March reads as next March when we're in November).
function scheduleIsoDate(raw: string, now: Date = new Date()): string | null {
  const text = (raw || '').trim();
  if (!text) return null;
  if (/\b\d{4}\b/.test(text)) return isoDate(text);
  const parsed = new Date(`${text.replace(/^[A-Za-z]+,?\s+(?=[A-Za-z]+\s+\d)/, '')} 2000`);
  const us = /^(\d{1,2})\/(\d{1,2})$/.exec(text);
  const month = us ? Number(us[1]) - 1 : parsed.getMonth();
  const day = us ? Number(us[2]) : parsed.getDate();
  if (!us && isNaN(parsed.getTime())) return null;
  const candidates = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => new Date(y, month, day));
  const best = candidates.reduce((a, b) => (Math.abs(b.getTime() - now.getTime()) < Math.abs(a.getTime() - now.getTime()) ? b : a));
  return isoDate(best.toDateString());
}

/** "7:00 PM Local" → "7:00 PM" (times on the Schedule tab are always the venue's local time). */
function scheduleTime(raw: string): string | null {
  const t = (raw || '').replace(/\s*local\s*$/i, '').trim();
  return t || null;
}

function scheduleStatus(raw: string, hasResult: boolean): 'upcoming' | 'completed' | 'cancelled' {
  const s = (raw || '').trim().toLowerCase();
  if (hasResult || s === 'completed' || s === 'final') return 'completed';
  if (s === 'cancelled' || s === 'canceled' || s === 'postponed') return 'cancelled';
  return 'upcoming';
}

export function buildSchedule(
  data: ParsedSheetData,
  phase: ApiPhase,
  opts: { status: ScheduleStatusFilter; team: string | null },
) {
  const matches = new Map(extractUniqueMatches(data.teamMatches).map((m) => [m.matchIndex, m]));
  const entries = data.schedule
    .map((s) => {
      const m = s.matchIndex != null ? matches.get(s.matchIndex) ?? null : null;
      // A completed match outside the requested phase is left out; upcoming
      // games are always listed (the sheet doesn't say which phase they are).
      if (m && phase !== 'all' && m.phase !== phase) return null;
      const status = scheduleStatus(s.status, Boolean(m));
      // Use the match's own team order when there is a result, so the scores
      // line up with /results/latest.
      const team1 = m ? teamRef(m.team1) : scheduleTeam(s.team1);
      const team2 = m ? teamRef(m.team2) : scheduleTeam(s.team2);
      return {
        match_id: m ? m.matchIndex : s.matchIndex,
        season: data.season ?? CURRENT_SEASON_ID,
        week: s.week > 0 ? s.week : null,
        // Played matches: the Data tab's date (it has the year). Otherwise the schedule's.
        date: (m ? isoDate(m.date) : null) ?? scheduleIsoDate(s.date),
        time: scheduleTime(s.time),
        status,
        season_phase: m ? m.phase : null,
        venue: s.venueName || s.venueCity ? { name: s.venueName || null, city: s.venueCity || null } : null,
        team1,
        team2,
        result: m
          ? {
              team1_score: round3(m.score1),
              team2_score: round3(m.score2),
              team1_rounds_won: m.wins1,
              team2_rounds_won: m.wins2,
              winner: m.result === 'W' ? 'team1' : m.result === 'L' ? 'team2' : 'draw',
            }
          : null,
        stats_url: m ? `${SITE}/matches/${m.matchIndex}` : null,
      };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null)
    .filter((e) => opts.status === 'all' || e.status === opts.status)
    .filter((e) => !opts.team || e.team1?.slug === opts.team || e.team2?.slug === opts.team)
    .sort(
      (a, b) =>
        (a.date ?? '9999').localeCompare(b.date ?? '9999') ||
        (a.week ?? 0) - (b.week ?? 0) ||
        (a.match_id ?? 0) - (b.match_id ?? 0),
    );

  const next = entries.find((e) => e.status === 'upcoming') ?? null;
  return {
    data: { next, entries },
    meta: { ...meta(data, phase), status: opts.status, team: opts.team },
  };
}

// ─── /matches/{id} ─────────────────────────────────────────────────────────────
// One match with everything tblstats.com's match page shows: the box score
// (same shape as /results/latest), each round's win probability, the comeback
// story when there is one, the playoff round name and highlight links.
const round4 = (n: number) => Math.round(n * 10000) / 10000;

export function buildMatch(
  data: ParsedSheetData,
  matchIndex: number,
  extras: { wpa: MatchWpa | null; playoffRound: string | null },
) {
  const m = extractUniqueMatches(data.teamMatches).find((x) => x.matchIndex === matchIndex);
  if (!m) return null;
  const base = matchJson(data, m);
  const wpa = extras.wpa;
  const wpaByRound = new Map((wpa?.rounds ?? []).map((r) => [r.roundId ?? -r.round, r] as const));
  const peakRound = wpa && wpa.rounds.length > 0 ? wpa.rounds.reduce((best, r) => (r.li > best.li ? r : best)).round : null;

  const rounds = base.rounds.map((r) => {
    const w = wpaByRound.get(r.round_id ?? -r.round);
    return {
      ...r,
      // Team 1's win probability after the round, and the swing it caused
      // (team 1 perspective, -1..1). null when the round is excluded (e.g. DQ).
      team1_win_prob_after: w && !w.isDq ? round4(w.wpAfter) : null,
      team1_wpa: w && !w.isDq ? round4(w.teamWpa) : null,
      leverage: w && !w.isDq ? round3(w.li) : null,
      is_peak_leverage: w ? w.round === peakRound : false,
    };
  });

  const cb = wpa ? computeMatchComeback(wpa) : null;
  const comeback =
    cb && cb.isComeback && wpa
      ? {
          winner: cb.winnerTeam === m.team1 ? 'team1' : 'team2',
          lowest_win_prob: round4(cb.comebackLow),
          low_round: cb.lowRound,
          deficit_at_low: round3(cb.deficitAtLow),
          final_margin: round3(cb.finalMargin),
          key_rounds: comebackDrivers(wpa, cb.lowRound, 3).map((d) => ({
            round: d.round,
            fighter: fighterRef(data, d.fighter),
            opponent: fighterRef(data, d.opponent),
            wpa: round4(d.wpa),
            method: d.method || null,
          })),
        }
      : null;

  const highlights = data.highlights
    .filter((h) => h.page === String(matchIndex))
    .map((h) => ({ label: h.label || null, url: h.url, type: h.type || null }));

  return {
    data: {
      ...base,
      rounds,
      playoff_round: extras.playoffRound ?? null,
      comeback,
      highlights,
    },
    meta: meta(data, 'all'),
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
  // 2. The fighter's name slug. This is their temporary ID until a stable ID is
  //    added, and keeps working afterwards so links saved earlier never break.
  const f = data.fighters.find((x) => x.slug === wanted);
  if (f) return f.slug;
  return null;
}

function fightJson(data: ParsedSheetData, h: FightHistory) {
  return {
    date: isoDate(h.date),
    match_id: h.matchIndex,
    season: data.season ?? CURRENT_SEASON_ID,
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

/** The season (newest first) whose sheet has this fighter, for links that don't name a season. */
export function findFighterSeason(seasons: readonly SeasonData[], id: string): SeasonData | null {
  const byNewest = [...seasons].sort((a, b) => b.season.year - a.season.year);
  const current = byNewest.find((x) => x.season.id === CURRENT_SEASON_ID);
  const order = current ? [current, ...byNewest.filter((x) => x !== current)] : byNewest;
  return order.find((x) => findFighterSlug(x.data, id) !== null) ?? null;
}

export function buildFighter(
  data: ParsedSheetData,
  id: string,
  phase: ApiPhase,
  allSeasons: readonly SeasonData[] = [],
) {
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

  // Season-by-season lines + career totals (like the back of a baseball card).
  // Always includes the season being viewed, even when other sheets fail.
  const thisSeason = getSeason(data.season ?? '') ?? currentSeason();
  const seasonsIn = allSeasons.some((x) => x.season.id === thisSeason.id)
    ? allSeasons
    : [...allSeasons, { season: thisSeason, data }];
  const group =
    fightersAcrossSeasons(seasonsIn, phase).find((g) =>
      g.some((x) => x.season.id === thisSeason.id && x.slug === slug),
    ) ?? [];
  const seasonLines = group.map((x) => ({
    season: seasonRef(x.season),
    team: teamRef(x.f.team),
    weight_class: x.f.weightClass || null,
    stats: fighterStats(x.f),
  }));

  return {
    data: {
      ...fighterSummary(data, scoped ?? career),
      weight_classes: getFighterWeightClassesOrdered(career, fullHistory),
      instagram: career.instagram || null,
      streak: calcFighterStreak(history) || null,
      stats: fighterStats(scoped),
      fights: history.map((h) => fightJson(data, h)),
      seasons: seasonLines,
      career: {
        seasons_played: seasonLines.length,
        stats: combineStatLines(seasonLines.map((l) => l.stats)),
      },
    },
    meta: meta(data, phase),
  };
}
