// GET /api/v1/advanced — advanced stats for a season: the highest-stakes
// rounds, every fighter's win probability added (WPA), leverage, clutch and
// opponent-adjusted rating, every match's comeback numbers, and headline
// picks. Public, read-only. See API.md.
import { getAllData } from '@/lib/data';
import { getWpaData, getComebackData, WPA_MODEL_VERSION, COMEBACK_THRESHOLD } from '@/lib/wpa';
import { getRatingsData, RATINGS_MODEL, RATINGS_MODEL_VERSION } from '@/lib/ratings';
import { buildAdvanced, isDataUnavailable, resolvePhase, resolveSeason } from '@/lib/api/v1';
import { jsonError, jsonOk, preflight, safely } from '@/lib/api/http';

const DEFAULT_ROUNDS = 50;
const MAX_ROUNDS = 200;

export async function GET(request: Request) {
  return safely(request, async () => {
    const params = new URL(request.url).searchParams;
    const phaseResult = resolvePhase(params.get('phase'));
    if (!phaseResult.ok) return jsonError(request, 400, phaseResult.code, phaseResult.message);
    const seasonResult = resolveSeason(params.get('season'));
    if (!seasonResult.ok) return jsonError(request, 400, seasonResult.code, seasonResult.message);
    const raw = params.get('rounds_limit');
    const roundsLimit = raw == null ? DEFAULT_ROUNDS : Number(raw);
    if (!Number.isInteger(roundsLimit) || roundsLimit < 1 || roundsLimit > MAX_ROUNDS) {
      return jsonError(request, 400, 'invalid_rounds_limit', `rounds_limit must be a whole number from 1 to ${MAX_ROUNDS}.`);
    }

    const season = seasonResult.season;
    const data = await getAllData(season);
    if (isDataUnavailable(data)) return jsonError(request, 503, 'data_unavailable', 'League data is temporarily unavailable. Try again in a minute.');
    const [wpa, ratings, comebacks] = await Promise.all([getWpaData(season), getRatingsData(season), getComebackData(season)]);
    return jsonOk(
      request,
      buildAdvanced(
        data,
        phaseResult.phase,
        {
          wpa,
          ratings,
          comebacks,
          wpaModelVersion: WPA_MODEL_VERSION,
          ratingsModelVersion: RATINGS_MODEL_VERSION,
          minRounds: RATINGS_MODEL.minRounds,
          comebackThreshold: COMEBACK_THRESHOLD,
        },
        { roundsLimit },
      ),
    );
  });
}

export function OPTIONS(request: Request) {
  return preflight(request);
}
