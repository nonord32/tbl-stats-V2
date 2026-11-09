// GET /api/v1/seasons — every league season, newest first, and which one is
// current. Public, read-only. See API.md.
import { getAllSeasonsData } from '@/lib/data';
import { buildSeasons } from '@/lib/api/v1';
import { jsonOk, preflight, safely } from '@/lib/api/http';

export async function GET(request: Request) {
  return safely(request, async () => jsonOk(request, buildSeasons(await getAllSeasonsData())));
}

export function OPTIONS(request: Request) {
  return preflight(request);
}
