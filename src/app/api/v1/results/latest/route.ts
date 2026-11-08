// GET /api/v1/results/latest — every match from the most recent fight date,
// with round-by-round scores. Public, read-only. See API.md.
//
// Defaults to phase=all (unlike the other endpoints) so "latest" really is the
// latest event once the playoffs start.
import { getAllData } from '@/lib/data';
import { buildLatestResults, isDataUnavailable, parsePhase } from '@/lib/api/v1';
import { jsonError, jsonOk, preflight, safely } from '@/lib/api/http';

export async function GET(request: Request) {
  return safely(request, async () => {
    const phase = parsePhase(new URL(request.url).searchParams.get('phase'), 'all');
    if (!phase) return jsonError(request, 400, 'invalid_phase', 'phase must be one of: regular, playoffs, all.');
    const data = await getAllData();
    if (isDataUnavailable(data)) return jsonError(request, 503, 'data_unavailable', 'League data is temporarily unavailable. Try again in a minute.');
    const body = buildLatestResults(data, phase);
    if (!body.data) return jsonError(request, 404, 'no_results', 'No completed matches yet for this phase.');
    return jsonOk(request, body);
  });
}

export function OPTIONS(request: Request) {
  return preflight(request);
}
