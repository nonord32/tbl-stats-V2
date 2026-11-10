// GET /api/v1/matches/{id} — one match: box score, round-by-round, win
// probability, comeback and highlights. {id} is the Match ID. Public,
// read-only. See API.md.
import { getAllData } from '@/lib/data';
import { getWpaData } from '@/lib/wpa';
import { buildMatch, isDataUnavailable, playoffLabelsFor, resolveSeason } from '@/lib/api/v1';
import { jsonError, jsonOk, preflight, safely } from '@/lib/api/http';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  return safely(request, async () => {
    const raw = (params.id ?? '').trim();
    const matchIndex = /^\d{1,6}$/.test(raw) ? Number(raw) : NaN;
    if (Number.isNaN(matchIndex)) return jsonError(request, 404, 'match_not_found', `No match with id "${raw}".`);
    const seasonResult = resolveSeason(new URL(request.url).searchParams.get('season'));
    if (!seasonResult.ok) return jsonError(request, 400, seasonResult.code, seasonResult.message);
    const data = await getAllData(seasonResult.season);
    if (isDataUnavailable(data)) return jsonError(request, 503, 'data_unavailable', 'League data is temporarily unavailable. Try again in a minute.');

    const wpa = (await getWpaData(seasonResult.season)).byMatch.get(matchIndex) ?? null;
    // Optional decoration: playoffLabelsFor never throws.
    const playoffRound = playoffLabelsFor(data).get(matchIndex) ?? null;
    const body = buildMatch(data, matchIndex, { wpa, playoffRound });
    if (!body) return jsonError(request, 404, 'match_not_found', `No match with id "${raw}".`);
    return jsonOk(request, body);
  });
}

export function OPTIONS(request: Request) {
  return preflight(request);
}
