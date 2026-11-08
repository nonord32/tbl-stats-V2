// GET /api/v1/standings — every team with W-L-D record, ordered by rank.
// Public, read-only. See API.md.
import { getAllData } from '@/lib/data';
import { buildStandings, isDataUnavailable, parsePhase } from '@/lib/api/v1';
import { jsonError, jsonOk, preflight, safely } from '@/lib/api/http';

export async function GET(request: Request) {
  return safely(request, async () => {
    const phase = parsePhase(new URL(request.url).searchParams.get('phase'), 'regular');
    if (!phase) return jsonError(request, 400, 'invalid_phase', 'phase must be one of: regular, playoffs, all.');
    const data = await getAllData();
    if (isDataUnavailable(data)) return jsonError(request, 503, 'data_unavailable', 'League data is temporarily unavailable. Try again in a minute.');
    return jsonOk(request, buildStandings(data, phase));
  });
}

export function OPTIONS(request: Request) {
  return preflight(request);
}
