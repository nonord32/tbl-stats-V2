// src/components/home/shared.ts
// Types and small helpers shared by the home page and the components it
// composes. These used to live inside src/app/page.tsx; they moved out when
// the desktop and mobile trees were merged.

import { getCityName } from '@/lib/teams';

/** A completed match, as the home page's result cards want it. */
export interface ResultCard {
  matchIndex: number;
  date: string;
  team1: string;
  team2: string;
  s1: number;
  s2: number;
  phase?: string;
}

/**
 * What the hero shows when no match is upcoming: the most recent result,
 * framed as a MegaBrawl champion crowning when that result is the final.
 */
export interface HeroResult {
  eyebrow: string;
  winnerName: string;
  winnerTeam: string;
  loserName: string;
  loserTeam: string;
  scoreLine: string;
  href: string;
  isChampion: boolean;
  verb: string; // "def." for a win, "drew" for a draw
}

export function firstName(name: string): string {
  return name.split(' ')[0] ?? name;
}

export function lastName(name: string): string {
  const parts = name.split(' ');
  return parts.slice(1).join(' ') || '';
}

// Map a team display name (as stored in CSVs — often short like "NYC" or
// "Dallas") to our canonical city slug. Mirrors the mapping in src/lib/teams.ts
// but simpler.
export function teamSlug(name: string): string {
  const s = name.toLowerCase().trim();
  if (s === 'nyc') return 'nyc';
  if (s === 'las vegas' || s === 'lv') return 'las-vegas';
  if (s === 'los angeles' || s === 'la' || s === 'lax') return 'los-angeles';
  if (s === 'san antonio') return 'san-antonio';
  return s.replace(/\s+/g, '-');
}

// Compact 2–3 letter abbreviation for narrow cards. Mirrors the mapping used
// on the Schedule page.
export function shortAbbr(team: string): string {
  const city = getCityName(team).toUpperCase();
  const map: Record<string, string> = {
    'NEW YORK': 'NYC',
    NYC: 'NYC',
    'LOS ANGELES': 'LA',
    'LAS VEGAS': 'LV',
    'SAN ANTONIO': 'SA',
    ATLANTA: 'ATL',
    BOSTON: 'BOS',
    DALLAS: 'DAL',
    HOUSTON: 'HOU',
    MIAMI: 'MIA',
    NASHVILLE: 'NSH',
    PHILADELPHIA: 'PHI',
    PHOENIX: 'PHX',
  };
  return map[city] ?? city.slice(0, 3);
}
