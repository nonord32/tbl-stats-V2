// GET /api/v1/results/latest — every match from the most recent fight date,
// with round-by-round scores. Public, read-only. See API.md.
//
// Regular season by default, like every endpoint (see AVAILABLE_PHASES in
// src/lib/api/v1.ts). When playoffs are enabled, revisit whether "latest"
// should default to the newest event across both phases.
import { getAllData } from '@/lib/data';
import { buildLatestResults, isDataUnavailable, resolvePhase, resolveSeason } from '@/lib/api/v1';
import { jsonError, jsonOk, preflight, safely } from '@/lib/api/http';

export async function GET(request: Request) {
  return safely(request, async () => {
    const phaseResult = resolvePhase(new URL(request.url).searchParams.get('phase'));
    if (!phaseResult.ok) return jsonError(request, 400, phaseResult.code, phaseResult.message);
    const phase = phaseResult.phase;
    const seasonResult = resolveSeason(new URL(request.url).searchParams.get('season'));
    if (!seasonResult.ok) return jsonError(request, 400, seasonResult.code, seasonResult.message);
    const data = await getAllData(seasonResult.season);
    if (isDataUnavailable(data)) return jsonError(request, 503, 'data_unavailable', 'League data is temporarily unavailable. Try again in a minute.');
    const body = buildLatestResults(data, phase);
    if (!body.data) return jsonError(request, 404, 'no_results', `No completed ${phase === 'regular' ? 'regular-season ' : ''}matches yet.`);
    return jsonOk(request, body);
  });
}

export function OPTIONS(request: Request) {
  return preflight(request);
}
