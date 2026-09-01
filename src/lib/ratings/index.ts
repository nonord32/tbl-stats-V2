// src/lib/ratings/index.ts
//
// Next-side wiring for the opponent-adjusted ratings. Adapts the app's
// FighterStat / FightHistory shapes onto the pure core's structural inputs and
// exposes a request-cached season computation.
//
// Unlike WPA, there is no precomputable lookup table here: the ratings depend
// on the live season, so the ridge solve and the bootstrap run at request time.
// They are cheap enough for that — the solve is matrix-free conjugate gradient
// (see core.ts), so the point estimate plus 200 bootstrap refits costs on the
// order of 100ms, once per request, inside a 120s ISR window.
//
// The model is versioned (see ratings-model-2026.json). A future-season refit
// gets its own config file so 2026 figures remain reproducible.
//
// Scope: FULL SEASON only. There is deliberately no regular/playoff split — a
// playoffs-only fit would see a few hundred rounds with most fighters at two to
// four of them, and SOS's head-to-head exclusion would empty out most
// opponents entirely.

import { cache } from 'react';
import { getAllData, toSlug } from '@/lib/data';
import {
  computeSeasonRatings,
  type RatingsModelConfig,
  type RatingsBoutInput,
  type SeasonRatings,
  type FighterRating,
  type DivisionSummary,
} from './core';
import modelJson from './ratings-model-2026.json';

export const RATINGS_MODEL = modelJson as unknown as RatingsModelConfig & {
  version: string;
  lambdaNote: string;
  bootstrapSeedNote: string;
  sosNote: string;
  sosIndependenceNote: string;
  roundUniverseNote: string;
  checks: {
    pairedRounds: number;
    sosCorrelationBound: number;
    sosCorrelationNote: string;
    anpprCorrelation: number;
    sosStdDev: number;
    ratingsStdDev: number;
    medianBootSd: number;
    signalToNoise: number;
    rankStabilityCross: number;
    rankStabilityWithin: number;
    toughestSchedule: { name: string; sos: number };
    easiestSchedule: { name: string; sos: number };
  };
  sosReference: { name: string; rounds: number; nppr: number; sos: number }[];
  anpprReference: { name: string; rounds: number; nppr: number; anppr: number }[];
  bootstrapReference: {
    name: string;
    rounds: number;
    anppr: number;
    bootSd: number;
    lo: number;
    hi: number;
  }[];
};

export const RATINGS_MODEL_VERSION = RATINGS_MODEL.version;

export type { SeasonRatings, FighterRating, DivisionSummary };
export { computeSeasonRatings, correlation } from './core';

// Season ratings for every fighter, derived from the same bouts NPPR is built
// from — so DQ rounds are already excluded and the SOS denominators match the
// published NPPR exactly. React cache() dedupes within a request; the
// underlying CSVs are ISR-cached in getAllData.
export const getRatingsData = cache(async (): Promise<SeasonRatings> => {
  const data = await getAllData();

  // Scope 'all' — data.fighters — is the full-season aggregate, whose netPts
  // and rounds are the NPPR numerator and denominator readers see on the site.
  const fighters = data.fighters.map((f) => ({
    slug: f.slug,
    name: f.name,
    team: f.team,
    weightClass: f.weightClass,
    gender: f.gender,
    rounds: f.rounds,
    netPts: f.netPts,
    nppr: f.nppr,
  }));

  const history: Record<string, RatingsBoutInput[]> = {};
  for (const [slug, bouts] of Object.entries(data.fighterHistory)) {
    history[slug] = bouts.map((b) => ({
      opponent: b.opponent,
      netPts: b.netPts,
      matchIndex: b.matchIndex,
      roundId: b.roundId,
    }));
  }

  return computeSeasonRatings(fighters, history, RATINGS_MODEL, toSlug);
});

/** One fighter's season ratings, or null when they have no bouts. */
export async function getFighterRating(slug: string): Promise<FighterRating | null> {
  const season = await getRatingsData();
  return season.byFighter.get(slug) ?? null;
}
