// src/lib/resolve.ts
// Pure scoring helpers shared between the legacy admin /api/resolve +
// /api/fantasy/score routes and the lazy on-read resolver. Each function
// takes a service-role Supabase client and either a single match/week or
// pulls all pending work itself. All updates are idempotent — they
// short-circuit when the stored values already match the computed values,
// so concurrent invocations are safe.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DiffBand, MatchResult, ParsedSheetData } from '@/types';
import { extractUniqueMatches } from './data';
import { scoreLineup } from './fantasyData';
import type { FantasyFighter } from './fantasyMock';

function scoreToBand(diff: number): DiffBand {
  if (diff <= 2) return 'close';
  if (diff <= 5) return 'medium';
  if (diff <= 9) return 'comfortable';
  return 'dominant';
}

export interface PickemResolveResult {
  matchIndex: number;
  resolved: number;
  changed: number;
}

export async function resolvePickemMatch(
  supabase: SupabaseClient,
  match: MatchResult
): Promise<PickemResolveResult> {
  const diff = Math.abs(match.score1 - match.score2);
  const actualBand = scoreToBand(diff);
  const actualWinner = match.result === 'W' ? match.team1 : match.team2;

  const { data: picks, error } = await supabase
    .from('picks')
    .select('id, picked_team, diff_band, is_correct_winner, is_correct_band, points_earned, resolved_at')
    .eq('match_index', match.matchIndex);
  if (error || !picks?.length) {
    return { matchIndex: match.matchIndex, resolved: 0, changed: 0 };
  }

  const now = new Date().toISOString();
  let resolved = 0;
  let changed = 0;

  for (const pick of picks) {
    const isCorrectWinner = pick.picked_team === actualWinner;
    const isCorrectBand = pick.diff_band === actualBand;
    const pointsEarned = isCorrectWinner ? (isCorrectBand ? 2 : 1) : 0;

    const wasAlreadyResolved = pick.resolved_at !== null;
    const scoreChanged =
      pick.is_correct_winner !== isCorrectWinner ||
      pick.is_correct_band !== isCorrectBand ||
      pick.points_earned !== pointsEarned;

    // Idempotent skip — already resolved with matching values.
    if (wasAlreadyResolved && !scoreChanged) continue;

    const { error: updateError } = await supabase
      .from('picks')
      .update({
        is_correct_winner: isCorrectWinner,
        is_correct_band: isCorrectBand,
        points_earned: pointsEarned,
        resolved_at: now,
      })
      .eq('id', pick.id);

    if (!updateError) {
      resolved++;
      changed++;
    }
  }

  return { matchIndex: match.matchIndex, resolved, changed };
}

export async function resolveAllPendingPickem(
  supabase: SupabaseClient,
  sheet: ParsedSheetData
): Promise<PickemResolveResult[]> {
  const { data: pending, error } = await supabase
    .from('picks')
    .select('match_index')
    .is('resolved_at', null);
  if (error || !pending?.length) return [];

  const pendingIndexes = Array.from(new Set(pending.map((p) => p.match_index as number)));
  const completed = extractUniqueMatches(sheet.teamMatches);
  const completedByIndex = new Map(completed.map((m) => [m.matchIndex, m]));

  const results: PickemResolveResult[] = [];
  for (const idx of pendingIndexes) {
    const match = completedByIndex.get(idx);
    if (!match) continue; // not yet complete in sheet
    results.push(await resolvePickemMatch(supabase, match));
  }
  return results;
}

export interface FantasyResolveResult {
  week: number;
  resolved: number;
  total: number;
  skipped?: 'incomplete' | 'no-rows' | 'no-schedule';
}

function buildMinimalFighterPool(sheet: ParsedSheetData): FantasyFighter[] {
  return sheet.fighters.map((f) => ({
    id: f.slug,
    name: f.name,
    team: f.team,
    city: f.team,
    weightClass: f.weightClass,
    gender: (f.gender === 'Female' ? 'Female' : 'Male') as 'Female' | 'Male',
    projected: 0,
    avg: 0,
    owned: 0,
    status: 'active',
  }));
}

function buildMatchIndexToWeek(sheet: ParsedSheetData): Map<number, number> {
  const m = new Map<number, number>();
  sheet.schedule.forEach((s) => {
    if (s.matchIndex != null) m.set(s.matchIndex, Number(s.week));
  });
  return m;
}

export async function resolveFantasyWeek(
  supabase: SupabaseClient,
  week: number,
  sheet: ParsedSheetData
): Promise<FantasyResolveResult> {
  // Fantasy week is only resolvable when every match in that week is complete in the sheet.
  const completed = extractUniqueMatches(sheet.teamMatches);
  const completedSet = new Set(completed.map((m) => m.matchIndex));
  const weekMatches = sheet.schedule.filter(
    (s) => Number(s.week) === week && s.matchIndex != null
  );
  if (weekMatches.length === 0) {
    return { week, resolved: 0, total: 0, skipped: 'no-schedule' };
  }
  const allComplete = weekMatches.every((s) => s.matchIndex && completedSet.has(s.matchIndex));
  if (!allComplete) {
    return { week, resolved: 0, total: 0, skipped: 'incomplete' };
  }

  const { data: rows, error } = await supabase
    .from('fantasy_weeks')
    .select('id, starter_slugs, opponent_starter_slugs, resolved_at')
    .eq('week', week);
  if (error || !rows?.length) {
    return { week, resolved: 0, total: 0, skipped: 'no-rows' };
  }

  const minimalPool = buildMinimalFighterPool(sheet);
  const matchIndexToWeek = buildMatchIndexToWeek(sheet);
  const now = new Date().toISOString();

  let resolved = 0;
  for (const row of rows) {
    if (row.resolved_at) continue; // idempotent skip
    const userScore = scoreLineup(
      (row.starter_slugs as string[]) ?? [],
      minimalPool,
      sheet.fighterHistory,
      matchIndexToWeek,
      week
    );
    const oppScore = scoreLineup(
      (row.opponent_starter_slugs as string[]) ?? [],
      minimalPool,
      sheet.fighterHistory,
      matchIndexToWeek,
      week
    );
    const { error: upd } = await supabase
      .from('fantasy_weeks')
      .update({
        user_points: userScore.total,
        opponent_points: oppScore.total,
        resolved_at: now,
      })
      .eq('id', row.id);
    if (!upd) resolved++;
  }
  return { week, resolved, total: rows.length };
}

export async function resolveAllPendingFantasy(
  supabase: SupabaseClient,
  sheet: ParsedSheetData
): Promise<FantasyResolveResult[]> {
  const { data: rows, error } = await supabase
    .from('fantasy_weeks')
    .select('week')
    .is('resolved_at', null);
  if (error || !rows?.length) return [];

  const weeks = Array.from(new Set(rows.map((r) => r.week as number)));
  const out: FantasyResolveResult[] = [];
  for (const w of weeks) {
    out.push(await resolveFantasyWeek(supabase, w, sheet));
  }
  return out;
}
