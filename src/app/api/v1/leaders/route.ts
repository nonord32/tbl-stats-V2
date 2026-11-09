// GET /api/v1/leaders — top fighters in the main stat categories.
// Public, read-only. See API.md.
import { getAllData } from '@/lib/data';
import { buildLeaders, isDataUnavailable, LEADER_CATEGORY_KEYS, resolvePhase } from '@/lib/api/v1';
import { jsonError, jsonOk, preflight, safely } from '@/lib/api/http';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

export async function GET(request: Request) {
  return safely(request, async () => {
    const params = new URL(request.url).searchParams;
    const phaseResult = resolvePhase(params.get('phase'));
    if (!phaseResult.ok) return jsonError(request, 400, phaseResult.code, phaseResult.message);
    const phase = phaseResult.phase;

    const limitRaw = params.get('limit');
    const limit = limitRaw == null ? DEFAULT_LIMIT : Number(limitRaw);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      return jsonError(request, 400, 'invalid_limit', `limit must be a whole number from 1 to ${MAX_LIMIT}.`);
    }

    const minRaw = params.get('min_rounds');
    const minRounds = minRaw == null ? null : Number(minRaw);
    if (minRounds !== null && (!Number.isInteger(minRounds) || minRounds < 0)) {
      return jsonError(request, 400, 'invalid_min_rounds', 'min_rounds must be a whole number, 0 or more.');
    }

    const category = params.get('category');
    if (category !== null && !LEADER_CATEGORY_KEYS.includes(category)) {
      return jsonError(request, 400, 'invalid_category', `category must be one of: ${LEADER_CATEGORY_KEYS.join(', ')}.`);
    }

    const data = await getAllData();
    if (isDataUnavailable(data)) return jsonError(request, 503, 'data_unavailable', 'League data is temporarily unavailable. Try again in a minute.');
    return jsonOk(request, buildLeaders(data, phase, { limit, minRounds, category }));
  });
}

export function OPTIONS(request: Request) {
  return preflight(request);
}
