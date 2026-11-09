// GET /api/v1/fighters/[id] — one fighter's profile, fight history for one
// season, a stat line for every season they fought in, and career totals.
// [id] is the stable Fighter ID, or the name slug. Public, read-only. See API.md.
//
// Without ?season=, the current season is shown; a fighter who only fought in
// earlier seasons falls back to their most recent one, so saved links never break.
import { getAllData, getAllSeasonsData } from '@/lib/data';
import { buildFighter, findFighterSeason, isDataUnavailable, resolvePhase, resolveSeason } from '@/lib/api/v1';
import { jsonError, jsonOk, preflight, safely } from '@/lib/api/http';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  return safely(request, async () => {
    const id = params.id ?? '';
    const search = new URL(request.url).searchParams;
    const phaseResult = resolvePhase(search.get('phase'));
    if (!phaseResult.ok) return jsonError(request, 400, phaseResult.code, phaseResult.message);
    const phase = phaseResult.phase;
    const seasonParam = search.get('season');
    const seasonResult = resolveSeason(seasonParam);
    if (!seasonResult.ok) return jsonError(request, 400, seasonResult.code, seasonResult.message);

    const [requested, allSeasons] = await Promise.all([getAllData(seasonResult.season), getAllSeasonsData()]);
    let data = requested;
    if (!seasonParam?.trim()) {
      data = findFighterSeason(allSeasons, id)?.data ?? requested;
    }
    if (isDataUnavailable(data)) return jsonError(request, 503, 'data_unavailable', 'League data is temporarily unavailable. Try again in a minute.');
    const body = buildFighter(data, id, phase, allSeasons);
    if (!body) return jsonError(request, 404, 'fighter_not_found', `No fighter with id "${id}"${seasonParam ? ` in season ${seasonResult.season}` : ''}.`);
    return jsonOk(request, body);
  });
}

export function OPTIONS(request: Request) {
  return preflight(request);
}
