// Run: npm test   (node --experimental-strip-types --test scripts/*.test.mjs)
//
// Unit tests for multi-season helpers: career totals (src/lib/api/career.ts)
// and the season registry (src/lib/seasons.ts). Synthetic inputs only.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { combineStatLines, groupFightersAcrossSeasons } from '../src/lib/api/career.ts';
import {
  SEASONS,
  CURRENT_SEASON_ID,
  currentSeason,
  normalizeSeasonId,
  sheetCsvUrl,
  sheetRevalidateSeconds,
  GIDS_2026,
} from '../src/lib/seasons.ts';

const line = (o) => ({
  wins: 0, losses: 0, draws: 0, record: '', rounds: 0, win_pct: 0, net_points: 0, nppr: 0,
  points_scored: 0, points_allowed: 0, points_allowed_per_round: 0, war: 0, ko_tko: 0,
  knockdowns: 0, double_knockdowns: 0, ...o,
});

test('career adds counting stats and recomputes rates from totals', () => {
  const a = line({ wins: 9, losses: 1, draws: 0, rounds: 10, net_points: 20, points_scored: 50, points_allowed: 30, war: 1.25, ko_tko: 2, knockdowns: 3 });
  const b = line({ wins: 1, losses: 1, draws: 0, rounds: 2, net_points: -2, points_scored: 8, points_allowed: 10, war: -0.1, double_knockdowns: 1 });
  const c = combineStatLines([a, b]);
  assert.equal(c.wins, 10);
  assert.equal(c.losses, 2);
  assert.equal(c.rounds, 12);
  assert.equal(c.record, '10-2-0');
  // 10/12, not the average of 0.9 and 0.5
  assert.equal(c.win_pct, 0.833);
  assert.equal(c.net_points, 18);
  assert.equal(c.nppr, 1.5);
  assert.equal(c.points_allowed_per_round, 3.333);
  assert.equal(c.war, 1.15);
  assert.equal(c.ko_tko, 2);
  assert.equal(c.knockdowns, 3);
  assert.equal(c.double_knockdowns, 1);
});

test('career of nothing is all zeros (no division by zero)', () => {
  const c = combineStatLines([]);
  assert.equal(c.rounds, 0);
  assert.equal(c.win_pct, 0);
  assert.equal(c.nppr, 0);
  assert.equal(c.record, '0-0-0');
});

test('draws count toward rounds but not win %', () => {
  const c = combineStatLines([line({ wins: 1, losses: 1, draws: 2, rounds: 4 })]);
  assert.equal(c.win_pct, 0.5);
  assert.equal(c.record, '1-1-2');
});

test('fighters group by stable ID across seasons, even if renamed', () => {
  const g = groupFightersAcrossSeasons([
    { seasonId: '2026', slug: 'jo-smith', id: 'TBL001' },
    { seasonId: '2027', slug: 'jo-smith-jones', id: 'tbl001 ' },
  ]);
  assert.equal(g.size, 1);
  assert.equal([...g.values()][0].length, 2);
});

test('an ID-less season joins the ID group with the same name', () => {
  const g = groupFightersAcrossSeasons([
    { seasonId: '2026', slug: 'jo-smith', id: null },
    { seasonId: '2027', slug: 'jo-smith', id: 'TBL001' },
  ]);
  assert.deepEqual([...g.keys()], ['id:tbl001']);
});

test('same name, different IDs stay separate people', () => {
  const g = groupFightersAcrossSeasons([
    { seasonId: '2026', slug: 'chris-lee', id: 'TBL010' },
    { seasonId: '2027', slug: 'chris-lee', id: 'TBL099' },
    { seasonId: '2027', slug: 'chris-lee', id: null },
  ]);
  // The ID-less entry is ambiguous, so it is grouped by name on its own.
  assert.deepEqual([...g.keys()].sort(), ['id:tbl010', 'id:tbl099', 'slug:chris-lee']);
});

test('without any IDs, fighters group by name', () => {
  const g = groupFightersAcrossSeasons([
    { seasonId: '2026', slug: 'pat-doe', id: '' },
    { seasonId: '2027', slug: 'pat-doe', id: null },
    { seasonId: '2027', slug: 'sam-roe', id: null },
  ]);
  assert.equal(g.get('slug:pat-doe').length, 2);
  assert.equal(g.get('slug:sam-roe').length, 1);
});

test('season registry: current season exists and is labelled', () => {
  assert.ok(SEASONS.length >= 1);
  assert.equal(currentSeason().id, CURRENT_SEASON_ID);
  const s2026 = SEASONS.find((s) => s.id === '2026');
  assert.equal(s2026.label, '2026 · Season 4');
  assert.equal(s2026.number, 4);
  assert.equal(new Set(SEASONS.map((s) => s.id)).size, SEASONS.length, 'season ids are unique');
});

test('season ids are validated', () => {
  assert.equal(normalizeSeasonId(' 2026 '), '2026');
  assert.equal(normalizeSeasonId('1999'), null);
  assert.equal(normalizeSeasonId(null), null);
});

test('2026 sheet URLs are unchanged', () => {
  const s = SEASONS.find((x) => x.id === '2026');
  assert.equal(
    sheetCsvUrl(s, 'matches'),
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vTDpxOV--xewT8SdQckLWo70ZEeupxHRcyOYui9nEPQwvbvE2bc5nkOs0JN-XUVpIXwjn3WauVLdeJw/pub?gid=0&single=true&output=csv',
  );
  assert.equal(GIDS_2026.awards, 644608532);
  assert.equal(sheetRevalidateSeconds({ ...s, complete: false }), 120);
  assert.equal(sheetRevalidateSeconds({ ...s, complete: true }), 86400);
});
