// GET /api/v1/fighters — every fighter in a season with their stats, for the
// website's fighters directory. Public, read-only. See API.md.
import { getAllData } from '@/lib/data';
import { buildFighterList, isDataUnavailable, resolvePhase, resolveSeason } from '@/lib/api/v1';
import { jsonError, jsonOk, preflight, safely } from '@/lib/api/http';

export async function GET(request: Request) {
  return safely(request, async () => {
    const params = new URL(request.url).searchParams;
    const phaseResult = resolvePhase(params.get('phase'));
    if (!phaseResult.ok) return jsonError(request, 400, phaseResult.code, phaseResult.message);
    const seasonResult = resolveSeason(params.get('season'));
    if (!seasonResult.ok) return jsonError(request, 400, seasonResult.code, seasonResult.message);
    const data = await getAllData(seasonResult.season);
    if (isDataUnavailable(data)) return jsonError(request, 503, 'data_unavailable', 'League data is temporarily unavailable. Try again in a minute.');
    return jsonOk(request, buildFighterList(data, phaseResult.phase));
  });
}

export function OPTIONS(request: Request) {
  return preflight(request);
}
