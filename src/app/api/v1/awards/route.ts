// GET /api/v1/awards — every season's awards and champions, grouped by award,
// newest first. Covers all seasons, so it takes no ?season=. Public,
// read-only. See API.md.
import { getAllSeasonsData } from '@/lib/data';
import { buildAwards } from '@/lib/api/v1';
import { jsonError, jsonOk, preflight, safely } from '@/lib/api/http';

export async function GET(request: Request) {
  return safely(request, async () => {
    const seasons = await getAllSeasonsData();
    if (seasons.length === 0) return jsonError(request, 503, 'data_unavailable', 'League data is temporarily unavailable. Try again in a minute.');
    return jsonOk(request, buildAwards(seasons));
  });
}

export function OPTIONS(request: Request) {
  return preflight(request);
}
