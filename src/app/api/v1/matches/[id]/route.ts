// GET /api/v1/matches/{id} — one match: box score, round-by-round, win
// probability, comeback and highlights. {id} is the Match ID. Public,
// read-only. See API.md.
import { getAllData } from '@/lib/data';
import { getBracketContext } from '@/lib/bracketData';
import { playoffRoundLabelsByMatch } from '@/lib/playoffs';
import { getWpaData } from '@/lib/wpa';
import { buildMatch, isDataUnavailable } from '@/lib/api/v1';
import { jsonError, jsonOk, preflight, safely } from '@/lib/api/http';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  return safely(request, async () => {
    const raw = (params.id ?? '').trim();
    const matchIndex = /^\d{1,6}$/.test(raw) ? Number(raw) : NaN;
    if (Number.isNaN(matchIndex)) return jsonError(request, 404, 'match_not_found', `No match with id "${raw}".`);
    const data = await getAllData();
    if (isDataUnavailable(data)) return jsonError(request, 503, 'data_unavailable', 'League data is temporarily unavailable. Try again in a minute.');

    const wpa = (await getWpaData()).byMatch.get(matchIndex) ?? null;
    let playoffRound: string | null = null;
    try {
      playoffRound = playoffRoundLabelsByMatch(getBracketContext(data).bracket).get(matchIndex) ?? null;
    } catch {
      playoffRound = null; // the bracket is optional decoration; never fail the match for it
    }
    const body = buildMatch(data, matchIndex, { wpa, playoffRound });
    if (!body) return jsonError(request, 404, 'match_not_found', `No match with id "${raw}".`);
    return jsonOk(request, body);
  });
}

export function OPTIONS(request: Request) {
  return preflight(request);
}
