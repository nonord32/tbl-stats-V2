// GET /api/v1/playoffs — the playoff bracket (seeds, every round, champion),
// or the live projection before the regular season ends. Public, read-only.
// See API.md.
import { getAllData } from '@/lib/data';
import { buildPlayoffs, isDataUnavailable, resolveSeason } from '@/lib/api/v1';
import { jsonError, jsonOk, preflight, safely } from '@/lib/api/http';

export async function GET(request: Request) {
  return safely(request, async () => {
    const seasonResult = resolveSeason(new URL(request.url).searchParams.get('season'));
    if (!seasonResult.ok) return jsonError(request, 400, seasonResult.code, seasonResult.message);
    const data = await getAllData(seasonResult.season);
    if (isDataUnavailable(data)) return jsonError(request, 503, 'data_unavailable', 'League data is temporarily unavailable. Try again in a minute.');
    return jsonOk(request, buildPlayoffs(data));
  });
}

export function OPTIONS(request: Request) {
  return preflight(request);
}
