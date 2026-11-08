// GET /api/v1/fighters/[id] — one fighter's profile and full fight history.
// [id] is the stable Fighter ID from the Data tab. Public, read-only. See API.md.
import { getAllData } from '@/lib/data';
import { buildFighter, isDataUnavailable, parsePhase } from '@/lib/api/v1';
import { jsonError, jsonOk, preflight, safely } from '@/lib/api/http';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  return safely(request, async () => {
    const id = params.id ?? '';
    const phase = parsePhase(new URL(request.url).searchParams.get('phase'), 'regular');
    if (!phase) return jsonError(request, 400, 'invalid_phase', 'phase must be one of: regular, playoffs, all.');
    const data = await getAllData();
    if (isDataUnavailable(data)) return jsonError(request, 503, 'data_unavailable', 'League data is temporarily unavailable. Try again in a minute.');
    const body = buildFighter(data, id, phase);
    if (!body) return jsonError(request, 404, 'fighter_not_found', `No fighter with id "${id}".`);
    return jsonOk(request, body);
  });
}

export function OPTIONS(request: Request) {
  return preflight(request);
}
