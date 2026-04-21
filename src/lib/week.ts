// src/lib/week.ts
// Shared helpers for determining the active pick'em week and the most
// recently completed week from schedule data.

import type { ScheduleEntry } from '@/types';
import { isPickOpen } from './gameTime';

/**
 * Strict current pick'em week: earliest week number that still has at least
 * one Upcoming match whose pick window is open. Returns null when every
 * upcoming match has locked or the season is over. This matches the picks
 * page semantics — a pick'em week only "counts" while picks are accepted.
 */
export function getCurrentWeek(schedule: ScheduleEntry[]): number | null {
  const open = schedule.filter(
    (s) =>
      s.matchIndex &&
      Number(s.week) > 0 &&
      s.status === 'Upcoming' &&
      isPickOpen(s.date, s.time, s.venueCity)
  );
  if (open.length === 0) return null;
  return Math.min(...open.map((s) => Number(s.week)));
}

/**
 * Looser "week to display on the homepage": earliest week that still has any
 * Upcoming match (regardless of pick lock). Used when picks have locked but
 * the week hasn't been marked Completed yet, so the homepage can still show
 * "Week N" instead of jumping forward.
 */
export function getDisplayedCurrentWeek(
  schedule: ScheduleEntry[]
): number | null {
  const upcoming = schedule.filter(
    (s) => Number(s.week) > 0 && s.status === 'Upcoming'
  );
  if (upcoming.length === 0) return null;
  return Math.min(...upcoming.map((s) => Number(s.week)));
}

/** Most recently completed week. Returns null if no matches have completed. */
export function getLastCompletedWeek(
  schedule: ScheduleEntry[]
): number | null {
  const completed = schedule.filter(
    (s) => Number(s.week) > 0 && s.status === 'Completed'
  );
  if (completed.length === 0) return null;
  return Math.max(...completed.map((s) => Number(s.week)));
}

/** All schedule entries for a given week number. */
export function scheduleForWeek(
  schedule: ScheduleEntry[],
  week: number
): ScheduleEntry[] {
  return schedule.filter((s) => Number(s.week) === week);
}
